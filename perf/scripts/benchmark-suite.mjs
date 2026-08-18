import { writeFile } from "node:fs/promises";

import {
  dispatchPointer,
  evaluate,
  finiteValues,
  median,
  metricsToObject,
  openPage,
  sleep,
  stepFrame,
  summarizeRun,
  waitForHarness,
} from "./benchmark-core.mjs";

async function runSingleBenchmark(
  chrome,
  baseUrl,
  scenario,
  options,
  frameCount = options.frames,
) {
  const query = new URLSearchParams({
    scenario: scenario.scenario,
    theme: scenario.theme,
    mode: "benchmark",
    variant: scenario.variant ?? "full",
  });
  const page = await openPage(
    chrome,
    `${baseUrl}/?${query.toString()}`,
    scenario.viewport,
  );
  try {
    await waitForHarness(page.client);
    await sleep(50);
    for (let frame = 0; frame < options.warmupFrames; frame += 1) {
      await dispatchPointer(page.client, scenario.scenario, frame * 0.37);
      await stepFrame(page.client);
    }
    await evaluate(
      page.client,
      `window.__LUMATHREAD_HARNESS__.resetMeasurements()`,
    );
    const metricsBefore = metricsToObject(
      await page.client.call("Performance.getMetrics"),
    );
    const stepSamples = [];
    for (let frame = 0; frame < frameCount; frame += 1) {
      await dispatchPointer(
        page.client,
        scenario.scenario,
        0.35 + frame * 0.61,
      );
      stepSamples.push(await stepFrame(page.client));
    }
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
    return summarizeRun(payload, metricsBefore, metricsAfter, stepSamples);
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
    runs.flatMap((run) => Object.keys(run.glPerFrame ?? {})),
  );
  for (const name of counterNames) {
    counters[name] = aggregate((run) => run.glPerFrame[name]);
  }
  return {
    runCount: runs.length,
    fps: aggregate((run) => run.fps),
    wallMeanMs: aggregate((run) => run.wallMs.mean),
    wallP50Ms: aggregate((run) => run.wallMs.p50),
    wallP95Ms: aggregate((run) => run.wallMs.p95),
    submitMeanMs: aggregate((run) => run.submitMs.mean),
    submitP95Ms: aggregate((run) => run.submitMs.p95),
    drainMeanMs: aggregate((run) => run.drainMs.mean),
    drainP95Ms: aggregate((run) => run.drainMs.p95),
    taskDurationMs: aggregate((run) => run.browser.taskDurationMs),
    scriptDurationMs: aggregate((run) => run.browser.scriptDurationMs),
    jsHeapUsedBytes: aggregate((run) => run.browser.jsHeapUsedBytes),
    glPerFrame: counters,
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
    wallMeanMs: lowerIsBetter("wallMeanMs"),
    wallP95Ms: lowerIsBetter("wallP95Ms"),
    submitMeanMs: lowerIsBetter("submitMeanMs"),
    submitP95Ms: lowerIsBetter("submitP95Ms"),
    drainMeanMs: lowerIsBetter("drainMeanMs"),
    drainP95Ms: lowerIsBetter("drainP95Ms"),
    taskDurationMs: lowerIsBetter("taskDurationMs"),
    scriptDurationMs: lowerIsBetter("scriptDurationMs"),
  };
}

async function captureSnapshot(chrome, baseUrl, snapshot, destination) {
  const query = new URLSearchParams({
    scenario: snapshot.scenario,
    theme: snapshot.theme,
    mode: "snapshot",
    variant: "full",
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

function formatChange(value) {
  return Number.isFinite(value)
    ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
    : "n/a";
}

function markdownSummary(results) {
  const lines = [
    "# Lumathread renderer benchmark",
    "",
    `Reference: \`${results.reference}\``,
    "",
    "Measurements are medians of fixed, synchronously stepped frames. Each frame is followed by `gl.finish()` so wall time includes all queued rendering work under the same Chromium/ANGLE/SwiftShader environment. Absolute software-renderer timings are not representative of a discrete GPU; A/B changes are.",
    "",
    "| Scenario | Metric | Baseline | Candidate | Change |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const scenario of results.scenarios) {
    const comparison = scenario.comparison;
    const rows = [
      ["FPS equivalent", comparison.fps],
      ["Wall mean (ms)", comparison.wallMeanMs],
      ["Wall p95 (ms)", comparison.wallP95Ms],
      ["Submit mean (ms)", comparison.submitMeanMs],
      ["GPU drain mean (ms)", comparison.drainMeanMs],
      ["Task duration (ms)", comparison.taskDurationMs],
    ];
    for (const [label, value] of rows) {
      lines.push(
        `| ${scenario.name} | ${label} | ${formatNumber(value.baseline)} | ${formatNumber(value.candidate)} | ${formatChange(value.changePercent)} |`,
      );
    }
  }

  if (results.profiles?.length) {
    lines.push(
      "",
      "## Pipeline attribution",
      "",
      "The ablations are diagnostic only: `no-glass` keeps the filament and dots, `path-only` also removes dots, and `no-twinkle` keeps glass but disables its sparkle field.",
      "",
      "| Surface | Variant | Baseline wall (ms) | Candidate wall (ms) | Baseline vs full | Candidate vs full |",
      "|---|---:|---:|---:|---:|---:|",
    );
    for (const profile of results.profiles) {
      const baselineFull = profile.variants.find(
        (entry) => entry.variant === "full",
      )?.baseline.wallMeanMs.median;
      const candidateFull = profile.variants.find(
        (entry) => entry.variant === "full",
      )?.candidate.wallMeanMs.median;
      for (const entry of profile.variants) {
        const baselineValue = entry.baseline.wallMeanMs.median;
        const candidateValue = entry.candidate.wallMeanMs.median;
        lines.push(
          `| ${profile.name} | ${entry.variant} | ${formatNumber(baselineValue)} | ${formatNumber(candidateValue)} | ${formatChange(percentChange(baselineFull, baselineValue))} | ${formatChange(percentChange(candidateFull, candidateValue))} |`,
        );
      }
    }
  }

  lines.push("", "## Renderer and environment", "");
  const first = results.scenarios[0]?.candidate;
  lines.push(
    `- Renderer status: \`${JSON.stringify(first?.renderer ?? null)}\``,
    `- WebGL: \`${JSON.stringify(first?.webgl ?? null)}\``,
    `- Main runs: ${results.options.repeats} A/B repeats × ${results.options.frames} measured frames after ${results.options.warmupFrames} warmup frame(s).`,
    `- Attribution runs: ${results.options.profileFrames} measured frame(s) per variant.`,
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
