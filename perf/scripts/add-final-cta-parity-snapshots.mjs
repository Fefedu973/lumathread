import { readFile, writeFile } from "node:fs/promises";

const benchmarkPath = "perf/scripts/benchmark.mjs";
let benchmark = await readFile(benchmarkPath, "utf8");
const marker = "  const allSnapshots = [\n";
if (!benchmark.includes(marker)) {
  throw new Error("Unable to locate the benchmark snapshot matrix.");
}

const desktop = `{ width: 1600, height: 900, dpr: 1, mobile: false }`;
const mobile = `{ width: 412, height: 915, dpr: 2, mobile: true }`;
const snapshots = [
  ["cta-dark-desktop-t0_371", "dark", "time: 0.371", desktop],
  ["cta-dark-desktop-t0_913", "dark", "time: 0.913", desktop],
  ["cta-dark-desktop-t1_337", "dark", "time: 1.337", desktop],
  ["cta-dark-desktop-t2_191", "dark", "time: 2.191", desktop],
  ["cta-light-desktop-t0_371", "light", "time: 0.371", desktop],
  ["cta-light-desktop-t0_913", "light", "time: 0.913", desktop],
  ["cta-light-desktop-t1_337", "light", "time: 1.337", desktop],
  ["cta-light-desktop-t2_191", "light", "time: 2.191", desktop],
  ["cta-dark-mobile-2x-t0_913", "dark", "time: 0.913", mobile],
  ["cta-dark-mobile-2x-t1_337", "dark", "time: 1.337", mobile],
  ["cta-light-mobile-2x-t0_913", "light", "time: 0.913", mobile],
  ["cta-light-mobile-2x-t1_337", "light", "time: 1.337", mobile],
  [
    "cta-dark-desktop-steady-60hz-f7",
    "dark",
    "steps: Array.from({ length: 7 }, () => 1 / 60)",
    desktop,
  ],
  [
    "cta-dark-desktop-steady-120hz-f11",
    "dark",
    "steps: Array.from({ length: 11 }, () => 1 / 120)",
    desktop,
  ],
  [
    "cta-light-desktop-steady-60hz-f11",
    "light",
    "steps: Array.from({ length: 11 }, () => 1 / 60)",
    desktop,
  ],
  [
    "cta-light-desktop-steady-120hz-f7",
    "light",
    "steps: Array.from({ length: 7 }, () => 1 / 120)",
    desktop,
  ],
  [
    "cta-dark-mobile-2x-steady-60hz-f7",
    "dark",
    "steps: Array.from({ length: 7 }, () => 1 / 60)",
    mobile,
  ],
  [
    "cta-dark-mobile-2x-steady-120hz-f11",
    "dark",
    "steps: Array.from({ length: 11 }, () => 1 / 120)",
    mobile,
  ],
  [
    "cta-light-mobile-2x-steady-60hz-f11",
    "light",
    "steps: Array.from({ length: 11 }, () => 1 / 60)",
    mobile,
  ],
  [
    "cta-light-mobile-2x-steady-120hz-f7",
    "light",
    "steps: Array.from({ length: 7 }, () => 1 / 120)",
    mobile,
  ],
];

const missing = snapshots.filter(
  ([name]) => !benchmark.includes(`name: "${name}"`),
);
const entries = missing
  .map(
    ([name, theme, value, viewport]) => `    {
      name: "${name}",
      scenario: "cta",
      theme: "${theme}",
      ${value},
      viewport: ${viewport},
    },`,
  )
  .join("\n");
if (entries) benchmark = benchmark.replace(marker, `${marker}${entries}\n`);

await writeFile(benchmarkPath, benchmark);
console.log(`Added ${missing.length} final CTA temporal parity captures.`);
