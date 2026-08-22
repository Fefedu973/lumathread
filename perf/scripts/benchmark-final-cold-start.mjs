import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluate,
  openPage,
  startChrome,
  waitForHarness,
} from "./benchmark-core.mjs";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const baselineUrl = readArg("--baseline", "http://127.0.0.1:4173");
const candidateUrl = readArg("--candidate", "http://127.0.0.1:4174");
const out = readArg("--out", "cold-start-results");
const requestedSurface = readArg("--surface", "hero-dark-desktop");
const repeats = Number(readArg("--repeats", "8"));
const GPU_QUERY_DRAIN_ATTEMPTS = 240;
const GPU_QUERY_RAF_TIMEOUT_MS = 100;

const surfaces = {
  "hero-dark-desktop": {
    scenario: "hero",
    theme: "dark",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  "hero-light-desktop": {
    scenario: "hero",
    theme: "light",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  "cta-dark-desktop": {
    scenario: "cta",
    theme: "dark",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  "cta-light-desktop": {
    scenario: "cta",
    theme: "light",
    viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
  },
  "hero-dark-mobile-2x": {
    scenario: "hero",
    theme: "dark",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
  "hero-light-mobile-2x": {
    scenario: "hero",
    theme: "light",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
  "cta-dark-mobile-2x": {
    scenario: "cta",
    theme: "dark",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
  "cta-light-mobile-2x": {
    scenario: "cta",
    theme: "light",
    viewport: { width: 412, height: 915, dpr: 2, mobile: true },
  },
};

const surface = surfaces[requestedSurface];
if (!surface) {
  throw new Error(`Unknown cold-start surface: ${requestedSurface}`);
}
if (!Number.isInteger(repeats) || repeats < 2) {
  throw new Error(
    `Cold-start repeats must be an integer >= 2, received ${repeats}`,
  );
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

async function captureGpuCompletedReadyState(page) {
  return evaluate(
    page.client,
    `(async () => {
      const profiler = window.__LUMATHREAD_GPU_PROFILER__;
      if (!profiler) throw new Error("GPU profiler is unavailable.");

      const validateProfile = (profile) => {
        if (!profile.supported) {
          throw new Error("GPU timer-query extension is unavailable.");
        }
        if (profile.errors?.length) {
          throw new Error(
            \`GPU profiler reported errors: \${profile.errors.join(" | ")}\`,
          );
        }
        if (profile.disjointCount > 0) {
          throw new Error(
            \`GPU timer queries became disjoint \${profile.disjointCount} time(s).\`,
          );
        }
      };

      const drainStartedMs = performance.now();
      let pollAttempts = 0;
      let rafYields = 0;
      let timeoutFallbacks = 0;
      let profile = profiler.snapshot();
      validateProfile(profile);
      while (
        (pollAttempts === 0 || profile.pendingCount > 0) &&
        pollAttempts < ${GPU_QUERY_DRAIN_ATTEMPTS}
      ) {
        // WebGL timer-query results are published asynchronously. Yielding a
        // native animation frame lets Chromium finish the submitted image and
        // matches the extension's conformance polling protocol without using
        // the synchronous and distorting gl.finish().
        const yieldKind = await new Promise((resolve) => {
          let settled = false;
          const settle = (kind) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve(kind);
          };
          const timeout = setTimeout(
            () => settle("timeout"),
            ${GPU_QUERY_RAF_TIMEOUT_MS},
          );
          requestAnimationFrame(() => settle("animation-frame"));
        });
        pollAttempts += 1;
        if (yieldKind === "animation-frame") rafYields += 1;
        else timeoutFallbacks += 1;
        profiler.collect();
        profile = profiler.snapshot();
        validateProfile(profile);
      }
      if (profile.pendingCount > 0) {
        throw new Error(
          \`GPU timer queries did not drain after \${pollAttempts} polling yield(s) (\${profile.pendingCount} pending).\`,
        );
      }

      const counters = window.__LUMATHREAD_GL_STATS__?.counters ?? {};
      const expectedSampleCount = [
        "drawArrays",
        "drawArraysInstanced",
        "drawElements",
        "drawElementsInstanced",
      ].reduce((sum, name) => sum + (Number(counters[name]) || 0), 0);
      if (!(profile.sampleCount > 0)) {
        throw new Error("GPU profiler drained without a timer-query sample.");
      }
      if (profile.sampleCount !== expectedSampleCount) {
        throw new Error(
          \`GPU profiler collected \${profile.sampleCount} sample(s); expected \${expectedSampleCount} measured draw(s).\`,
        );
      }

      const readyMs = performance.now();
      return {
        readyMs,
        navigation:
          performance.getEntriesByType("navigation")[0]?.toJSON?.() ?? null,
        canvasReady:
          document.querySelector("canvas")?.dataset.ready === "true",
        rendererStatus:
          window.__LUMATHREAD_HARNESS__?.rendererStatus ?? null,
        rendererErrors:
          window.__LUMATHREAD_HARNESS__?.rendererErrors ?? [],
        gpuDrain: {
          durationMs: readyMs - drainStartedMs,
          pollAttempts,
          rafYields,
          timeoutFallbacks,
          sampleCount: profile.sampleCount,
          frameCount: profile.frameCount,
          pendingCount: profile.pendingCount,
        },
        gl: JSON.parse(JSON.stringify(window.__LUMATHREAD_GL_STATS__ ?? null)),
      };
    })()`,
  );
}

async function measureSide(baseUrl, side, repeat) {
  const processStarted = performance.now();
  const chrome = await startChrome();
  const browserStartedMs = performance.now() - processStarted;
  let page;
  try {
    const query = new URLSearchParams({
      scenario: surface.scenario,
      theme: surface.theme,
      mode: "benchmark",
      variant: "full",
      coldStart: `${side}-${repeat}-${Date.now()}`,
    });
    const navigationStarted = performance.now();
    page = await openPage(
      chrome,
      `${baseUrl}/?${query.toString()}`,
      surface.viewport,
    );
    await waitForHarness(page.client);
    const browser = await captureGpuCompletedReadyState(page);
    const hostReadyMs = performance.now() - navigationStarted;
    if (!browser.canvasReady) {
      throw new Error(`${side}: canvas did not report ready`);
    }
    if (browser.rendererErrors?.length) {
      throw new Error(
        `${side}: renderer errors: ${JSON.stringify(browser.rendererErrors)}`,
      );
    }
    if (
      browser.rendererStatus?.renderer !== "hdr" ||
      browser.rendererStatus?.supported !== true ||
      browser.rendererStatus?.approximate === true
    ) {
      throw new Error(
        `${side}: renderer became unavailable during GPU completion: ${JSON.stringify(browser.rendererStatus)}`,
      );
    }
    return {
      side,
      repeat,
      browserStartedMs,
      hostReadyMs,
      browserReadyMs: browser.readyMs,
      navigation: browser.navigation,
      rendererStatus: browser.rendererStatus,
      gpuDrain: browser.gpuDrain,
      gl: browser.gl,
    };
  } finally {
    if (page) await page.close();
    await chrome.close();
  }
}

await mkdir(out, { recursive: true });
const raw = { baseline: [], candidate: [] };
for (let repeat = 0; repeat < repeats; repeat += 1) {
  const order =
    repeat % 2 === 0 ? ["baseline", "candidate"] : ["candidate", "baseline"];
  console.log(
    `Cold-start repeat ${repeat + 1}/${repeats}: ${order.join(" → ")}`,
  );
  for (const side of order) {
    raw[side].push(
      await measureSide(
        side === "baseline" ? baselineUrl : candidateUrl,
        side,
        repeat,
      ),
    );
  }
}

const aggregate = (runs) => {
  const counterMedian = (name) =>
    median(runs.map((run) => Number(run.gl?.counters?.[name] ?? 0)));
  return {
    browserStartedMs: median(runs.map((run) => run.browserStartedMs)),
    hostReadyMs: median(runs.map((run) => run.hostReadyMs)),
    browserReadyMs: median(runs.map((run) => run.browserReadyMs)),
    gpuDrainMs: median(runs.map((run) => run.gpuDrain.durationMs)),
    gpuDrainPollAttempts: median(runs.map((run) => run.gpuDrain.pollAttempts)),
    gpuDrainRafYields: median(runs.map((run) => run.gpuDrain.rafYields)),
    gpuDrainTimeoutFallbacks: median(
      runs.map((run) => run.gpuDrain.timeoutFallbacks),
    ),
    gpuTimerSamples: median(runs.map((run) => run.gpuDrain.sampleCount)),
    contexts: median(runs.map((run) => Number(run.gl?.contexts ?? 0))),
    webgl2Contexts: median(
      runs.map((run) => Number(run.gl?.webgl2Contexts ?? 0)),
    ),
    createProgram: counterMedian("createProgram"),
    createTexture: counterMedian("createTexture"),
    createFramebuffer: counterMedian("createFramebuffer"),
    bufferBytes: counterMedian("bufferBytes"),
    textureUploadPixels: counterMedian("textureUploadPixels"),
  };
};

const baseline = aggregate(raw.baseline);
const candidate = aggregate(raw.candidate);
const counterValue = (run, name) => Number(run.gl?.counters?.[name] ?? 0);
const metricReaders = {
  browserStarted: (run) => run.browserStartedMs,
  hostReady: (run) => run.hostReadyMs,
  browserReady: (run) => run.browserReadyMs,
  createProgram: (run) => counterValue(run, "createProgram"),
  createTexture: (run) => counterValue(run, "createTexture"),
  createFramebuffer: (run) => counterValue(run, "createFramebuffer"),
  bufferBytes: (run) => counterValue(run, "bufferBytes"),
  textureUploadPixels: (run) => counterValue(run, "textureUploadPixels"),
};
const candidateByRepeat = new Map(
  raw.candidate.map((run) => [run.repeat, run]),
);
const pairedRatios = Object.fromEntries(
  Object.entries(metricReaders).map(([key, readMetric]) => {
    const values = raw.baseline.map((baselineRun) => {
      const candidateRun = candidateByRepeat.get(baselineRun.repeat);
      if (!candidateRun) {
        throw new Error(
          `Missing candidate cold-start run for repeat ${baselineRun.repeat}.`,
        );
      }
      const baselineValue = readMetric(baselineRun);
      const candidateValue = readMetric(candidateRun);
      if (!(baselineValue > 0) || !(candidateValue > 0)) {
        throw new Error(
          `Cold-start metric ${key} must be positive for repeat ${baselineRun.repeat}.`,
        );
      }
      return candidateValue / baselineValue;
    });
    if (values.length !== repeats) {
      throw new Error(
        `Cold-start metric ${key} has ${values.length} pair(s); expected ${repeats}.`,
      );
    }
    return [key, values];
  }),
);
const ratio = (key) => median(pairedRatios[key]);
const result = {
  generatedAt: new Date().toISOString(),
  surface: requestedSurface,
  repeats,
  completionProtocol:
    "Canvas ready plus all initial EXT_disjoint_timer_query_webgl2 samples published after event-loop yields led by native requestAnimationFrame (100 ms task fallback); gl.finish is not used.",
  raw,
  baseline,
  candidate,
  pairedRatios,
  ratios: {
    browserStarted: ratio("browserStarted"),
    hostReady: ratio("hostReady"),
    browserReady: ratio("browserReady"),
    createProgram: ratio("createProgram"),
    createTexture: ratio("createTexture"),
    createFramebuffer: ratio("createFramebuffer"),
    bufferBytes: ratio("bufferBytes"),
    textureUploadPixels: ratio("textureUploadPixels"),
  },
};

const format = (value, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "n/a";
const markdown = `# Cold-start proof: ${requestedSurface}

Ready is recorded only after the canvas reports ready and every initial GPU
timer query has been published. Polling yields native animation frames (with a
100 ms task fallback for stalled headless tabs) and does not call \`gl.finish()\`.

| Metric | Original median | Final median | Paired median ratio |
|---|---:|---:|---:|
| Host navigation → ready (ms) | ${format(baseline.hostReadyMs)} | ${format(candidate.hostReadyMs)} | ${format(result.ratios.hostReady, 4)} |
| Browser navigation → ready (ms) | ${format(baseline.browserReadyMs)} | ${format(candidate.browserReadyMs)} | ${format(result.ratios.browserReady, 4)} |
| Post-callback GPU drain (ms) | ${format(baseline.gpuDrainMs)} | ${format(candidate.gpuDrainMs)} | n/a |
| GPU-drain polling yields | ${format(baseline.gpuDrainPollAttempts, 0)} | ${format(candidate.gpuDrainPollAttempts, 0)} | n/a |
| GPU-drain animation-frame yields | ${format(baseline.gpuDrainRafYields, 0)} | ${format(candidate.gpuDrainRafYields, 0)} | n/a |
| GPU-drain timeout fallbacks | ${format(baseline.gpuDrainTimeoutFallbacks, 0)} | ${format(candidate.gpuDrainTimeoutFallbacks, 0)} | n/a |
| Initial GPU timer samples | ${format(baseline.gpuTimerSamples, 0)} | ${format(candidate.gpuTimerSamples, 0)} | n/a |
| Chrome process startup (ms) | ${format(baseline.browserStartedMs)} | ${format(candidate.browserStartedMs)} | ${format(result.ratios.browserStarted, 4)} |
| Programs created | ${format(baseline.createProgram, 0)} | ${format(candidate.createProgram, 0)} | ${format(result.ratios.createProgram, 4)} |
| Textures created | ${format(baseline.createTexture, 0)} | ${format(candidate.createTexture, 0)} | ${format(result.ratios.createTexture, 4)} |
| Framebuffers created | ${format(baseline.createFramebuffer, 0)} | ${format(candidate.createFramebuffer, 0)} | ${format(result.ratios.createFramebuffer, 4)} |
| Buffer bytes uploaded | ${format(baseline.bufferBytes, 0)} | ${format(candidate.bufferBytes, 0)} | ${format(result.ratios.bufferBytes, 4)} |
| Texture pixels uploaded | ${format(baseline.textureUploadPixels, 0)} | ${format(candidate.textureUploadPixels, 0)} | ${format(result.ratios.textureUploadPixels, 4)} |
`;

await writeFile(
  path.join(out, "cold-start.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
await writeFile(path.join(out, "cold-start.md"), markdown);
console.log(markdown);
