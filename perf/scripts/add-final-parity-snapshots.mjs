import { readFile, writeFile } from "node:fs/promises";

const benchmarkPath = "perf/scripts/benchmark.mjs";
let benchmark = await readFile(benchmarkPath, "utf8");
const marker = "  const allSnapshots = [\n";
if (!benchmark.includes(marker)) {
  throw new Error("Unable to locate the deterministic snapshot matrix.");
}

const desktop = `{ width: 1600, height: 900, dpr: 1, mobile: false }`;
const mobile = `{ width: 412, height: 915, dpr: 2, mobile: true }`;
const snapshots = [
  ["hero-dark-desktop-off-anchor-0_371", "hero", "dark", "time: 0.371", desktop],
  ["hero-dark-desktop-off-anchor-0_913", "hero", "dark", "time: 0.913", desktop],
  ["hero-light-desktop-off-anchor-1_337", "hero", "light", "time: 1.337", desktop],
  ["hero-light-desktop-off-anchor-2_191", "hero", "light", "time: 2.191", desktop],
  ["hero-dark-mobile-2x-off-anchor-0_913", "hero", "dark", "time: 0.913", mobile],
  ["hero-light-mobile-2x-off-anchor-1_337", "hero", "light", "time: 1.337", mobile],
  ["cta-dark-desktop-off-anchor-0_371", "cta", "dark", "time: 0.371", desktop],
  ["cta-dark-desktop-off-anchor-0_913", "cta", "dark", "time: 0.913", desktop],
  ["cta-light-desktop-off-anchor-1_337", "cta", "light", "time: 1.337", desktop],
  ["cta-light-desktop-off-anchor-2_191", "cta", "light", "time: 2.191", desktop],
  ["cta-dark-mobile-2x-off-anchor-0_913", "cta", "dark", "time: 0.913", mobile],
  ["cta-light-mobile-2x-off-anchor-1_337", "cta", "light", "time: 1.337", mobile],
  ["hero-dark-desktop-sequential-60hz-f7", "hero", "dark", "steps: Array.from({ length: 7 }, () => 1 / 60)", desktop],
  ["hero-light-desktop-sequential-120hz-f11", "hero", "light", "steps: Array.from({ length: 11 }, () => 1 / 120)", desktop],
  ["hero-dark-mobile-2x-sequential-120hz-f7", "hero", "dark", "steps: Array.from({ length: 7 }, () => 1 / 120)", mobile],
  ["hero-light-mobile-2x-sequential-60hz-f11", "hero", "light", "steps: Array.from({ length: 11 }, () => 1 / 60)", mobile],
  ["cta-dark-desktop-sequential-60hz-f7", "cta", "dark", "steps: Array.from({ length: 7 }, () => 1 / 60)", desktop],
  ["cta-light-desktop-sequential-120hz-f11", "cta", "light", "steps: Array.from({ length: 11 }, () => 1 / 120)", desktop],
  ["cta-dark-mobile-2x-sequential-120hz-f7", "cta", "dark", "steps: Array.from({ length: 7 }, () => 1 / 120)", mobile],
  ["cta-light-mobile-2x-sequential-60hz-f11", "cta", "light", "steps: Array.from({ length: 11 }, () => 1 / 60)", mobile],
];

const entries = snapshots
  .filter(([name]) => !benchmark.includes(`name: "${name}"`))
  .map(
    ([name, scenario, theme, timeOrSteps, viewport]) => `    {
      name: "${name}",
      scenario: "${scenario}",
      theme: "${theme}",
      ${timeOrSteps},
      viewport: ${viewport},
    },`,
  )
  .join("\n");

if (entries) benchmark = benchmark.replace(marker, `${marker}${entries}\n`);
await writeFile(benchmarkPath, benchmark);
console.log(`Added ${entries ? entries.split("\n    {").length : 0} final parity snapshots.`);
