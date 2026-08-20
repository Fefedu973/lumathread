import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseArguments, startChrome } from "./benchmark-core.mjs";
import {
  aggregateRuns,
  compareAggregates,
  comparePairedRuns,
  runPairedBenchmark,
} from "./benchmark-suite.mjs";

const geometricMean = (values) => {
  const valid = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  if (valid.length === 0) return null;
  return Math.exp(
    valid.reduce((sum, value) => sum + Math.log(value), 0) / valid.length,
  );
};

const format = (value, digits = 4) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "n/a";

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await mkdir(options.out, { recursive: true });

  const scenarios = [
    {
      name: "hero-dark-desktop",
      scenario: "hero",
      theme: "dark",
      instrument: "none",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-light-desktop",
      scenario: "hero",
      theme: "light",
      instrument: "none",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-dark-desktop",
      scenario: "cta",
      theme: "dark",
      instrument: "none",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-light-desktop",
      scenario: "cta",
      theme: "light",
      instrument: "none",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-dark-mobile-2x",
      scenario: "hero",
      theme: "dark",
      instrument: "none",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
    {
      name: "hero-light-mobile-2x",
      scenario: "hero",
      theme: "light",
      instrument: "none",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
    {
      name: "cta-dark-mobile-2x",
      scenario: "cta",
      theme: "dark",
      instrument: "none",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
    {
      name: "cta-light-mobile-2x",
      scenario: "cta",
      theme: "light",
      instrument: "none",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
  ].filter(
    (scenario) =>
      options.focus === "all" || scenario.scenario === options.focus,
  );

  const chrome = await startChrome();
  try {
    const result = {
      generatedAt: new Date().toISOString(),
      reference: "7f4289aa3ff640f479701ceec0b0d790af037692",
      instrumentation: {
        glCallCounters: false,
        perDrawGpuQueries: false,
        terminalGlFinishPerFrame: true,
      },
      options,
      scenarios: [],
    };

    for (const scenario of scenarios) {
      console.log(`Production-wall benchmark: ${scenario.name}`);
      const raw = { baseline: [], candidate: [] };
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        const order =
          repeat % 2 === 0
            ? ["baseline", "candidate"]
            : ["candidate", "baseline"];
        console.log(
          `  paired repeat ${repeat + 1}/${options.repeats} (${order.join(" → ")})`,
        );
        const pair = await runPairedBenchmark(
          chrome,
          options.baseline,
          options.candidate,
          scenario,
          options,
          options.frames,
          order,
        );
        raw.baseline.push(pair.baseline);
        raw.candidate.push(pair.candidate);
      }
      const baseline = aggregateRuns(raw.baseline);
      const candidate = aggregateRuns(raw.candidate);
      result.scenarios.push({
        ...scenario,
        raw,
        baseline,
        candidate,
        comparison: compareAggregates(baseline, candidate),
        paired: comparePairedRuns(raw.baseline, raw.candidate),
      });
      await writeFile(
        path.join(options.out, "production-wall-progress.json"),
        `${JSON.stringify(result, null, 2)}\n`,
      );
    }

    const rows = result.scenarios.map((scenario) => ({
      name: scenario.name,
      wallRatio: scenario.paired.wallMeanMs.geometricMeanRatio,
      submitRatio: scenario.paired.submitMeanMs.geometricMeanRatio,
      drainRatio: scenario.paired.drainMeanMs.geometricMeanRatio,
      baselineFps: scenario.baseline.fps.median,
      candidateFps: scenario.candidate.fps.median,
    }));
    const wallRatio = geometricMean(rows.map((row) => row.wallRatio));
    const submitRatio = geometricMean(rows.map((row) => row.submitRatio));
    const drainRatio = geometricMean(rows.map((row) => row.drainRatio));
    const worstWallRatio = Math.max(...rows.map((row) => row.wallRatio));
    const verdict = {
      accepted: wallRatio <= 0.5 && worstWallRatio <= 0.75,
      wallRatio,
      equivalentFpsMultiplier: wallRatio ? 1 / wallRatio : null,
      submitRatio,
      drainRatio,
      worstWallRatio,
      targetWallRatio: 0.5,
      maximumScenarioWallRatio: 0.75,
      scenarios: rows,
    };
    result.verdict = verdict;

    const markdownRows = rows
      .map(
        (row) =>
          `| ${row.name} | ${format(row.wallRatio)} | ${format(
            row.wallRatio ? 1 / row.wallRatio : null,
            2,
          )}× | ${format(row.submitRatio)} | ${format(row.drainRatio)} | ${format(
            row.baselineFps,
            1,
          )} | ${format(row.candidateFps, 1)} |`,
      )
      .join("\n");
    const markdown = `# Production wall/FPS benchmark\n\n` +
      `This run keeps one terminal \`gl.finish()\` per measured frame but disables ` +
      `all WebGL call wrappers and per-draw timer queries.\n\n` +
      `- Verdict: **${verdict.accepted ? "ACCEPT" : "REJECT"}**\n` +
      `- Geometric wall ratio: **${format(wallRatio)}**\n` +
      `- Equivalent uncapped FPS multiplier: **${format(verdict.equivalentFpsMultiplier, 2)}×**\n` +
      `- Geometric submit ratio: **${format(submitRatio)}**\n` +
      `- Geometric drain ratio: **${format(drainRatio)}**\n` +
      `- Worst surface wall ratio: **${format(worstWallRatio)}**\n\n` +
      `| Scenario | Wall ratio | FPS multiplier | Submit ratio | Drain ratio | Baseline FPS | Candidate FPS |\n` +
      `|---|---:|---:|---:|---:|---:|---:|\n${markdownRows}\n`;

    await writeFile(
      path.join(options.out, "production-wall.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    await writeFile(
      path.join(options.out, "production-wall.md"),
      markdown,
    );
    console.log(markdown);
  } finally {
    await chrome.close();
  }
}

await main();
