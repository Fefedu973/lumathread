import { readFile, writeFile } from "node:fs/promises";

const path = "perf/scripts/benchmark.mjs";
let source = await readFile(path, "utf8");
const scenarioMarker = "  const allScenarios = [\n";
const snapshotMarker = "  const allSnapshots = [\n";
for (const [marker, label] of [
  [scenarioMarker, "scenario"],
  [snapshotMarker, "snapshot"],
]) {
  if (!source.includes(marker)) {
    throw new Error(`Unable to locate benchmark ${label} matrix.`);
  }
}

const desktop = `{ width: 1600, height: 900, dpr: 1, mobile: false }`;
const mobile = `{ width: 412, height: 915, dpr: 2, mobile: true }`;

const missingScenarios = [
  ["cta-light-desktop", "cta", "light", desktop],
  ["hero-light-mobile-2x", "hero", "light", mobile],
  ["cta-light-mobile-2x", "cta", "light", mobile],
].filter(([name]) => !source.includes(`name: "${name}"`));

const scenarioEntries = missingScenarios
  .map(
    ([name, scenario, theme, viewport]) => `    {
      name: "${name}",
      scenario: "${scenario}",
      theme: "${theme}",
      viewport: ${viewport},
    },`,
  )
  .join("\n");
if (scenarioEntries) {
  source = source.replace(
    scenarioMarker,
    `${scenarioMarker}${scenarioEntries}\n`,
  );
}

const temporalSnapshots = [
  ["hero-dark-desktop-t0_371", "hero", "dark", 0.371, desktop],
  ["hero-dark-desktop-t0_913", "hero", "dark", 0.913, desktop],
  ["hero-dark-desktop-t1_337", "hero", "dark", 1.337, desktop],
  ["hero-dark-desktop-t2_191", "hero", "dark", 2.191, desktop],
  ["hero-light-desktop-t0_371", "hero", "light", 0.371, desktop],
  ["hero-light-desktop-t0_913", "hero", "light", 0.913, desktop],
  ["hero-light-desktop-t1_337", "hero", "light", 1.337, desktop],
  ["hero-light-desktop-t2_191", "hero", "light", 2.191, desktop],
  ["hero-dark-mobile-2x-t0_913", "hero", "dark", 0.913, mobile],
  ["hero-dark-mobile-2x-t1_337", "hero", "dark", 1.337, mobile],
  ["hero-light-mobile-2x-t0_913", "hero", "light", 0.913, mobile],
  ["hero-light-mobile-2x-t1_337", "hero", "light", 1.337, mobile],
  ["hero-light-mobile-2x-t2_25", "hero", "light", 2.25, mobile],
  ["cta-light-mobile-2x-t2_25", "cta", "light", 2.25, mobile],
];

const missingSnapshots = temporalSnapshots.filter(
  ([name]) => !source.includes(`name: "${name}"`),
);
const snapshotEntries = missingSnapshots
  .map(
    ([name, scenario, theme, time, viewport]) => `    {
      name: "${name}",
      scenario: "${scenario}",
      theme: "${theme}",
      time: ${time},
      viewport: ${viewport},
    },`,
  )
  .join("\n");
if (snapshotEntries) {
  source = source.replace(
    snapshotMarker,
    `${snapshotMarker}${snapshotEntries}\n`,
  );
}

await writeFile(path, source);
console.log(
  `Added ${missingScenarios.length} production scenarios and ${missingSnapshots.length} parity captures.`,
);
