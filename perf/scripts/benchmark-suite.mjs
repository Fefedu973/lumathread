import { writeFile } from "node:fs/promises";

import {
  evaluate,
  finiteValues,
  median,
  metricsToObject,
  openPage,
  sleep,
  startPointerMotion,
  stopPointerMotion,
  summarizeRun,
  waitForHarness,
} from "./benchmark-core.mjs";

async function runSingleBenchmark(chrome, baseUrl, scenario, options) {
  const query = new URLSearchParams({
    scenario: scenario.scenario,
    theme: scenario.theme,
    mode: "benchmark",
  });
  const page = await openPage(
    chrome,
    `${baseUrl}/?${query.toString()}`,
    scenario.viewport,
  );
  try {
    await waitForHarness(page.client);
    await startPointerMotion(page.client, scenario.scenario);
    await sleep(options.warmupMs);
    await evaluate(
      page.client,
      `window.__LUMATHREAD_HARNESS__.resetMeasurements()`,
    );
    const metricsBefore = metricsToObject(
      await page.client.call("Performance.getMetrics"),
    );
    await sleep(options.durationMs);
    await sleep(350);
    await stopPointerMotion(page.client);
    await evaluate(page.client, `window.__LUMATHREAD_HARNESS__.pause()`);
    await sleep(100);
    const metricsAfter = metricsToObject(
      await page.client.call("Performance.getMetrics"),
    );
    const payload = await evaluate(
      page.client,
      `(() => {
        const harness = window.__LUMATHREAD_HARNESS__;
        const context = window.__LUMATHREAD_GL_CONTEXTS__?.[0];
        const debug = context?.getExtension("WEBGL_debug_renderer_info");
        return {
          runtime: {
            samples: harness.samples,
            frameDeltasMs: harness.frameDeltasMs,
            renderedFrames: harness.renderedFrames,
            firstFrameAt: harness.firstFrameAt,
            lastFrameAt: harness.lastFrameAt,
            rendererStatus: harness.rendererStatus,
            rendererErrors: harness.rendererErrors,
          },
          gl: JSON.parse(JSON.stringify(window.__LUMATHREAD_GL_STATS__)),
          webgl: context ? {
            version: context.getParameter(context.VERSION),
            shadingLanguageVersion: context.getParameter(context.SHADING_LANGUAGE_VERSION),
            vendor: debug
              ? context.getParameter(debug.UNMASKED_VENDOR_WEBGL)
              : context.getParameter(context.VENDOR),
            renderer: debug
              ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL)
              : context.getParameter(context.RENDERER),
          } : null,
        };
      })()`,
    );
    return summarizeRun(payload, metricsBefore, metricsAfter);
  } finally {
    await page.close();
  }
}

function aggregateRuns(runs) {
  const pick = (selector) => finiteValues(runs.map(selector));
  const aggregate = (selector) => {
    const values = pick(selector);
    return {
      median: median(values),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    };
  };
  const counters = {};
  const counterNames = new Set(
    runs.flatMap((run) => Object.keys(run.gl?.counters ?? {})),
  );
  for (const name of counterNames) {
    counters[name] = aggregate((run) => run.gl.counters[name]);
  }
  return {
    runCount: runs.length,
    fps: aggregate((run) => run.fps),
    frameP50Ms: aggregate((run) => run.frameMs.p50),
    frameP95Ms: aggregate((run) => run.frameMs.p95),
    frameP99Ms: aggregate((run) => run.frameMs.p99),
    dropped20msRatio: aggregate((run) => run.frameMs.dropped20msRatio),
    cpuMeanMs: aggregate((run) => run.cpuMs.mean),
    cpuP50Ms: aggregate((run) => run.cpuMs.p50),
    cpuP95Ms: aggregate((run) => run.cpuMs.p95),
    gpuMeanMs: aggregate((run) => run.gpuMs.mean),
    gpuP50Ms: aggregate((run) => run.gpuMs.p50),
    gpuP95Ms: aggregate((run) => run.gpuMs.p95),
    taskDurationMs: aggregate((run) => run.browser.taskDurationMs),
    scriptDurationMs: aggregate((run) => run.browser.scriptDurationMs),
    jsHeapUsedBytes: aggregate((run) => run.browser.jsHeapUsedBytes),
    glCounters: counters,
    renderer: runs[0]?.renderer ?? null,
    webgl: runs[0]?.webgl ?? null,
  };
}

function percentChange(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) {
    return null;
  }
  return ((after - before) / before) * 100;
}

function compareAggregates(baseline, candidate) {
  const lowerIsBetter = (key) => ({
    baseline: baseline[key].median,
    candidate: candidate[key].median,
    changePercent: percentChange(baseline[key].median, candidate[key].median),
    improvementPercent:
      percentChange(baseline[key].median, candidate[key].median) === null
        ? null
        : -percentChange(baseline[key].median, candidate[key].median),
  });
  return {
    fps: {
      baseline: baseline.fps.median,
      candidate: candidate.fps.median,
      changePercent: percentChange(baseline.fps.median, candidate.fps.median),
    },
    frameP95Ms: lowerIsBetter("frameP95Ms"),
    cpuMeanMs: lowerIsBetter("cpuMeanMs"),
    cpuP95Ms: lowerIsBetter("cpuP95Ms"),
    gpuMeanMs: lowerIsBetter("gpuMeanMs"),
    gpuP95Ms: lowerIsBetter("gpuP95Ms"),
    taskDurationMs: lowerIsBetter("taskDurationMs"),
    scriptDurationMs: lowerIsBetter("scriptDurationMs"),
  };
}

async function captureSnapshot(chrome, baseUrl, snapshot, destination) {
  const query = new URLSearchParams({
    scenario: snapshot.scenario,
    theme: snapshot.theme,
    mode: "snapshot",
    time: String(snapshot.time),
  });
  const page = await openPage(
    chrome,
    `${baseUrl}/?${query.toString()}`,
    snapshot.viewport,
  );
  try {
    await waitForHarness(page.client);
    await evaluate(page.client, `document.fonts?.ready ?? Promise.resolve()`);
    await sleep(900);
    const result = await page.client.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(destination, Buffer.from(result.data, "base64"));
    return await evaluate(
      page.client,
      `({
        status: window.__LUMATHREAD_HARNESS__.rendererStatus,
        errors: window.__LUMATHREAD_HARNESS__.rendererErrors,
        gl: window.__LUMATHREAD_GL_STATS__,
      })`,
    );
  } finally {
    await page.close();
  }
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function markdownSummary(results) {
  const lines = [
    "# Lumathread renderer benchmark",
    "",
    `Reference: \`${results.reference}\``,
    "",
    "Measurements are medians across repeated A/B runs in the same headless Chromium process using ANGLE/SwiftShader. Lower CPU/GPU/frame values are better; FPS is capped by RAF when the renderer stays below budget.",
    "",
    "| Scenario | Metric | Baseline | Candidate | Change |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const scenario of results.scenarios) {
    const comparison = scenario.comparison;
    const rows = [
      ["FPS", comparison.fps, false],
      ["Frame p95 (ms)", comparison.frameP95Ms, true],
      ["CPU mean (ms)", comparison.cpuMeanMs, true],
      ["CPU p95 (ms)", comparison.cpuP95Ms, true],
      ["GPU mean (ms)", comparison.gpuMeanMs, true],
      ["GPU p95 (ms)", comparison.gpuP95Ms, true],
      ["Task duration (ms)", comparison.taskDurationMs, true],
    ];
    for (const [label, value, lowerIsBetter] of rows) {
      const rawChange = value.changePercent;
      const displayed = Number.isFinite(rawChange)
        ? `${rawChange >= 0 ? "+" : ""}${rawChange.toFixed(1)}%${lowerIsBetter ? "" : ""}`
        : "n/a";
      lines.push(
        `| ${scenario.name} | ${label} | ${formatNumber(value.baseline)} | ${formatNumber(value.candidate)} | ${displayed} |`,
      );
    }
  }
  lines.push("", "## Renderer and environment", "");
  const first = results.scenarios[0]?.candidate;
  lines.push(
    `- Renderer status: \`${JSON.stringify(first?.renderer ?? null)}\``,
    `- WebGL: \`${JSON.stringify(first?.webgl ?? null)}\``,
    `- Repeats: ${results.options.repeats}; warmup: ${results.options.warmupMs} ms; measured window: ${results.options.durationMs} ms.`,
  );
  return `${lines.join("\n")}\n`;
}

export {
  runSingleBenchmark,
  aggregateRuns,
  compareAggregates,
  captureSnapshot,
  markdownSummary,
};
