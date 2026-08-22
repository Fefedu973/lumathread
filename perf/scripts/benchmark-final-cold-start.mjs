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
    const hostReadyMs = performance.now() - navigationStarted;
    const browser = await evaluate(
      page.client,
      `(() => ({
        readyMs: performance.now(),
        navigation: performance.getEntriesByType("navigation")[0]?.toJSON?.() ?? null,
        canvasReady: document.querySelector("canvas")?.dataset.ready === "true",
        rendererStatus: window.__LUMATHREAD_HARNESS__?.rendererStatus ?? null,
        rendererErrors: window.__LUMATHREAD_HARNESS__?.rendererErrors ?? [],
        gl: JSON.parse(JSON.stringify(window.__LUMATHREAD_GL_STATS__ ?? null)),
      }))()`,
    );
    if (!browser.canvasReady) {
      throw new Error(`${side}: canvas did not report ready`);
    }
    if (browser.rendererErrors?.length) {
      throw new Error(
        `${side}: renderer errors: ${JSON.stringify(browser.rendererErrors)}`,
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

| Metric | Original median | Final median | Paired median ratio |
|---|---:|---:|---:|
| Host navigation → ready (ms) | ${format(baseline.hostReadyMs)} | ${format(candidate.hostReadyMs)} | ${format(result.ratios.hostReady, 4)} |
| Browser navigation → ready (ms) | ${format(baseline.browserReadyMs)} | ${format(candidate.browserReadyMs)} | ${format(result.ratios.browserReady, 4)} |
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
