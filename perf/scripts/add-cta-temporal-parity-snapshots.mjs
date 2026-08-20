import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Unable to locate ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const benchmarkPath = "perf/scripts/benchmark.mjs";
const suitePath = "perf/scripts/benchmark-suite.mjs";
let benchmark = await readFile(benchmarkPath, "utf8");
let suite = await readFile(suitePath, "utf8");
const snapshotMarker = "  const allSnapshots = [\n";
if (!benchmark.includes(snapshotMarker)) {
  throw new Error("Unable to locate benchmark snapshot matrix.");
}

if (!benchmark.includes('scenario: "cta",\n      pointer: false,')) {
  const before = 'scenario: "cta",\n      theme:';
  const count = benchmark.split(before).length - 1;
  if (count < 4) {
    throw new Error(
      `Expected at least four CTA matrix entries, found ${count}.`,
    );
  }
  benchmark = benchmark.replaceAll(
    before,
    'scenario: "cta",\n      pointer: false,\n      theme:',
  );
}

if (!suite.includes("scenario.pointer !== false")) {
  suite = await replaceOnce(
    suite,
    `      await dispatchPointer(page.client, scenario.scenario, frame * 0.37);\n      await stepFrame(page.client);`,
    `      if (scenario.pointer !== false) {\n        await dispatchPointer(page.client, scenario.scenario, frame * 0.37);\n      }\n      await stepFrame(page.client);`,
    "single-run warmup pointer dispatch",
  );
  suite = await replaceOnce(
    suite,
    `      await dispatchPointer(\n        page.client,\n        scenario.scenario,\n        0.35 + frame * 0.61,\n      );\n      stepSamples.push(await stepFrame(page.client));`,
    `      if (scenario.pointer !== false) {\n        await dispatchPointer(\n          page.client,\n          scenario.scenario,\n          0.35 + frame * 0.61,\n        );\n      }\n      stepSamples.push(await stepFrame(page.client));`,
    "single-run measured pointer dispatch",
  );
  suite = await replaceOnce(
    suite,
    `        await dispatchPointer(\n          pages[build].client,\n          scenario.scenario,\n          frame * 0.37,\n        );\n        await stepFrame(pages[build].client);`,
    `        if (scenario.pointer !== false) {\n          await dispatchPointer(\n            pages[build].client,\n            scenario.scenario,\n            frame * 0.37,\n          );\n        }\n        await stepFrame(pages[build].client);`,
    "paired warmup pointer dispatch",
  );
  suite = await replaceOnce(
    suite,
    `        await dispatchPointer(pages[build].client, scenario.scenario, phase);\n        samples[build].push(await stepFrame(pages[build].client));`,
    `        if (scenario.pointer !== false) {\n          await dispatchPointer(pages[build].client, scenario.scenario, phase);\n        }\n        samples[build].push(await stepFrame(pages[build].client));`,
    "paired measured pointer dispatch",
  );
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
      pointer: false,
      theme: "${theme}",
      ${value},
      viewport: ${viewport},
    },`,
  )
  .join("\n");
if (entries) {
  benchmark = benchmark.replace(
    snapshotMarker,
    `${snapshotMarker}${entries}\n`,
  );
}

await writeFile(benchmarkPath, benchmark);
await writeFile(suitePath, suite);
console.log(
  `Configured idle CTA benchmark and added ${missing.length} temporal parity captures.`,
);
