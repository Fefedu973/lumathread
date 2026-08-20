import { readFile, writeFile } from "node:fs/promises";

const path = "perf/scripts/benchmark.mjs";
const source = await readFile(path, "utf8");
const marker = "  const snapshots = [\n";
if (!source.includes(marker)) {
  throw new Error("Unable to locate benchmark snapshot matrix.");
}
if (source.includes("hero-dark-desktop-t0_371")) {
  console.log("Temporal parity snapshots are already present.");
  process.exit(0);
}

const desktop = `{ width: 1600, height: 900, dpr: 1, mobile: false }`;
const mobile = `{ width: 412, height: 915, dpr: 2, mobile: true }`;
const snapshots = [
  ["hero-dark-desktop-t0_371", "dark", 0.371, desktop],
  ["hero-dark-desktop-t0_913", "dark", 0.913, desktop],
  ["hero-dark-desktop-t1_337", "dark", 1.337, desktop],
  ["hero-dark-desktop-t2_191", "dark", 2.191, desktop],
  ["hero-light-desktop-t0_371", "light", 0.371, desktop],
  ["hero-light-desktop-t0_913", "light", 0.913, desktop],
  ["hero-light-desktop-t1_337", "light", 1.337, desktop],
  ["hero-light-desktop-t2_191", "light", 2.191, desktop],
  ["hero-dark-mobile-2x-t0_913", "dark", 0.913, mobile],
  ["hero-dark-mobile-2x-t1_337", "dark", 1.337, mobile],
  ["hero-light-mobile-2x-t0_913", "light", 0.913, mobile],
  ["hero-light-mobile-2x-t1_337", "light", 1.337, mobile],
];

const entries = snapshots
  .map(
    ([name, theme, time, viewport]) => `    {
      name: "${name}",
      scenario: "hero",
      theme: "${theme}",
      time: ${time},
      viewport: ${viewport},
    },`,
  )
  .join("\n");

await writeFile(path, source.replace(marker, `${marker}${entries}\n`));
console.log(`Added ${snapshots.length} off-anchor Hero parity snapshots.`);
