import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseArguments, startChrome } from "./benchmark-core.mjs";
import {
  aggregateRuns,
  captureSnapshot,
  compareAggregates,
  markdownSummary,
  runSingleBenchmark,
} from "./benchmark-suite.mjs";

async function main() {
  const options = parseArguments(process.argv.slice(2));
  await mkdir(options.out, { recursive: true });
  await mkdir(path.join(options.out, "screenshots", "baseline"), {
    recursive: true,
  });
  await mkdir(path.join(options.out, "screenshots", "candidate"), {
    recursive: true,
  });

  const scenarios = [
    {
      name: "hero-dark-desktop",
      scenario: "hero",
      theme: "dark",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-light-desktop",
      scenario: "hero",
      theme: "light",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-dark-desktop",
      scenario: "cta",
      theme: "dark",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-dark-mobile-2x",
      scenario: "hero",
      theme: "dark",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
    {
      name: "cta-dark-mobile-2x",
      scenario: "cta",
      theme: "dark",
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
  ];
  const profileSurfaces = [
    {
      name: "hero-dark-desktop",
      scenario: "hero",
      theme: "dark",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-dark-desktop",
      scenario: "cta",
      theme: "dark",
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
  ];
  const profileVariants = ["full", "no-glass", "path-only", "no-twinkle"];
  const snapshots = [
    {
      name: "hero-dark-desktop-t0_35",
      scenario: "hero",
      theme: "dark",
      time: 0.35,
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-dark-desktop-t2_25",
      scenario: "hero",
      theme: "dark",
      time: 2.25,
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-light-desktop-t2_25",
      scenario: "hero",
      theme: "light",
      time: 2.25,
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-dark-desktop-t2_25",
      scenario: "cta",
      theme: "dark",
      time: 2.25,
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "cta-light-desktop-t2_25",
      scenario: "cta",
      theme: "light",
      time: 2.25,
      viewport: { width: 1600, height: 900, dpr: 1, mobile: false },
    },
    {
      name: "hero-dark-mobile-2x-t2_25",
      scenario: "hero",
      theme: "dark",
      time: 2.25,
      viewport: { width: 412, height: 915, dpr: 2, mobile: true },
    },
  ];

  const chrome = await startChrome();
  try {
    const result = {
      generatedAt: new Date().toISOString(),
      reference: "7f4289aa3ff640f479701ceec0b0d790af037692",
      options,
      scenarios: [],
      profiles: [],
      snapshots: [],
    };
    for (const scenario of scenarios) {
      console.log(`Benchmarking ${scenario.name}...`);
      const raw = { baseline: [], candidate: [] };
      for (let repeat = 0; repeat < options.repeats; repeat += 1) {
        const order =
          repeat % 2 === 0
            ? ["baseline", "candidate"]
            : ["candidate", "baseline"];
        for (const variant of order) {
          console.log(`  ${variant} repeat ${repeat + 1}/${options.repeats}`);
          raw[variant].push(
            await runSingleBenchmark(
              chrome,
              variant === "baseline" ? options.baseline : options.candidate,
              scenario,
              options,
            ),
          );
        }
      }
      const baseline = aggregateRuns(raw.baseline);
      const candidate = aggregateRuns(raw.candidate);
      result.scenarios.push({
        ...scenario,
        raw,
        baseline,
        candidate,
        comparison: compareAggregates(baseline, candidate),
      });
      await writeFile(
        path.join(options.out, "benchmark-progress.json"),
        JSON.stringify(result, null, 2),
      );
    }

    for (const surface of profileSurfaces) {
      console.log(`Profiling ${surface.name} pipeline...`);
      const profile = { ...surface, variants: [] };
      for (let index = 0; index < profileVariants.length; index += 1) {
        const profileVariant = profileVariants[index];
        const scenario = { ...surface, variant: profileVariant };
        const order =
          index % 2 === 0
            ? ["baseline", "candidate"]
            : ["candidate", "baseline"];
        const raw = { baseline: [], candidate: [] };
        for (const build of order) {
          console.log(`  ${profileVariant}: ${build}`);
          raw[build].push(
            await runSingleBenchmark(
              chrome,
              build === "baseline" ? options.baseline : options.candidate,
              scenario,
              options,
              options.profileFrames,
            ),
          );
        }
        const baseline = aggregateRuns(raw.baseline);
        const candidate = aggregateRuns(raw.candidate);
        profile.variants.push({
          variant: profileVariant,
          raw,
          baseline,
          candidate,
          comparison: compareAggregates(baseline, candidate),
        });
      }
      result.profiles.push(profile);
      await writeFile(
        path.join(options.out, "benchmark-progress.json"),
        JSON.stringify(result, null, 2),
      );
    }

    for (const snapshot of snapshots) {
      console.log(`Capturing ${snapshot.name}...`);
      const baselinePath = path.join(
        options.out,
        "screenshots",
        "baseline",
        `${snapshot.name}.png`,
      );
      const candidatePath = path.join(
        options.out,
        "screenshots",
        "candidate",
        `${snapshot.name}.png`,
      );
      const baselineMetadata = await captureSnapshot(
        chrome,
        options.baseline,
        snapshot,
        baselinePath,
      );
      const candidateMetadata = await captureSnapshot(
        chrome,
        options.candidate,
        snapshot,
        candidatePath,
      );
      result.snapshots.push({
        ...snapshot,
        baselinePath,
        candidatePath,
        baselineMetadata,
        candidateMetadata,
      });
    }

    await writeFile(
      path.join(options.out, "benchmark.json"),
      JSON.stringify(result, null, 2),
    );
    await writeFile(
      path.join(options.out, "benchmark.md"),
      markdownSummary(result),
    );
  } catch (error) {
    console.error(error);
    console.error(chrome.logLines.join("\n"));
    throw error;
  } finally {
    await chrome.close();
  }
}

await main();
