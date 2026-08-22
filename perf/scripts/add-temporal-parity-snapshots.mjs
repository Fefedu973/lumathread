import { readFile, writeFile } from "node:fs/promises";

const benchmarkPath = "perf/scripts/benchmark.mjs";
const suitePath = "perf/scripts/benchmark-suite.mjs";
let benchmark = await readFile(benchmarkPath, "utf8");
let suite = await readFile(suitePath, "utf8");

const scenarioMarker = "  const allScenarios = [\n";
const snapshotMarker = "  const allSnapshots = [\n";
for (const [marker, label] of [
  [scenarioMarker, "scenario"],
  [snapshotMarker, "snapshot"],
]) {
  if (!benchmark.includes(marker)) {
    throw new Error(`Unable to locate benchmark ${label} matrix.`);
  }
}

const steadyCaptureMarker =
  "const steadySteps = Array.isArray(snapshot.steps) ? snapshot.steps : null;";
if (!suite.includes(steadyCaptureMarker)) {
  const start = suite.indexOf("async function captureSnapshot(");
  const end = suite.indexOf("\nfunction formatNumber", start);
  if (start < 0 || end < 0) {
    throw new Error("Unable to locate captureSnapshot implementation.");
  }
  const replacement = `async function captureSnapshot(chrome, baseUrl, snapshot, destination) {
  const steadySteps = Array.isArray(snapshot.steps) ? snapshot.steps : null;
  const query = new URLSearchParams({
    scenario: snapshot.scenario,
    theme: snapshot.theme,
    mode: steadySteps ? "benchmark" : "snapshot",
    variant: "full",
  });
  if (!steadySteps) query.set("time", String(snapshot.time));
  const page = await openPage(
    chrome,
    baseUrl + "/?" + query.toString(),
    snapshot.viewport,
  );
  try {
    await waitForHarness(page.client);
    await evaluate(page.client, \`document.fonts?.ready ?? Promise.resolve()\`);
    if (steadySteps) {
      await sleep(100);
      for (const seconds of steadySteps) await stepFrame(page.client, seconds);
      await sleep(50);
    } else {
      await sleep(900);
    }
    const result = await page.client.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(destination, Buffer.from(result.data, "base64"));
    return await evaluate(
      page.client,
      \`({
        status: window.__LUMATHREAD_HARNESS__.rendererStatus,
        errors: window.__LUMATHREAD_HARNESS__.rendererErrors,
        gl: window.__LUMATHREAD_GL_STATS__,
      })\`,
    );
  } finally {
    await page.close();
  }
}
`;
  suite = suite.slice(0, start) + replacement + suite.slice(end);
  await writeFile(suitePath, suite);
}

const desktop = `{ width: 1600, height: 900, dpr: 1, mobile: false }`;
const mobile = `{ width: 412, height: 915, dpr: 2, mobile: true }`;

const missingScenarios = [
  ["cta-light-desktop", "cta", "light", desktop],
  ["hero-light-mobile-2x", "hero", "light", mobile],
  ["cta-light-mobile-2x", "cta", "light", mobile],
].filter(([name]) => !benchmark.includes(`name: "${name}"`));

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
  benchmark = benchmark.replace(
    scenarioMarker,
    `${scenarioMarker}${scenarioEntries}\n`,
  );
}

const temporalSnapshots = [
  {
    name: "hero-dark-desktop-t0_371",
    scenario: "hero",
    theme: "dark",
    value: "time: 0.371",
    viewport: desktop,
  },
  {
    name: "hero-dark-desktop-t0_913",
    scenario: "hero",
    theme: "dark",
    value: "time: 0.913",
    viewport: desktop,
  },
  {
    name: "hero-dark-desktop-t1_337",
    scenario: "hero",
    theme: "dark",
    value: "time: 1.337",
    viewport: desktop,
  },
  {
    name: "hero-dark-desktop-t2_191",
    scenario: "hero",
    theme: "dark",
    value: "time: 2.191",
    viewport: desktop,
  },
  {
    name: "hero-light-desktop-t0_371",
    scenario: "hero",
    theme: "light",
    value: "time: 0.371",
    viewport: desktop,
  },
  {
    name: "hero-light-desktop-t0_913",
    scenario: "hero",
    theme: "light",
    value: "time: 0.913",
    viewport: desktop,
  },
  {
    name: "hero-light-desktop-t1_337",
    scenario: "hero",
    theme: "light",
    value: "time: 1.337",
    viewport: desktop,
  },
  {
    name: "hero-light-desktop-t2_191",
    scenario: "hero",
    theme: "light",
    value: "time: 2.191",
    viewport: desktop,
  },
  {
    name: "hero-dark-mobile-2x-t0_913",
    scenario: "hero",
    theme: "dark",
    value: "time: 0.913",
    viewport: mobile,
  },
  {
    name: "hero-dark-mobile-2x-t1_337",
    scenario: "hero",
    theme: "dark",
    value: "time: 1.337",
    viewport: mobile,
  },
  {
    name: "hero-light-mobile-2x-t0_913",
    scenario: "hero",
    theme: "light",
    value: "time: 0.913",
    viewport: mobile,
  },
  {
    name: "hero-light-mobile-2x-t1_337",
    scenario: "hero",
    theme: "light",
    value: "time: 1.337",
    viewport: mobile,
  },
  {
    name: "hero-light-mobile-2x-t2_25",
    scenario: "hero",
    theme: "light",
    value: "time: 2.25",
    viewport: mobile,
  },
  {
    name: "hero-dark-desktop-steady-60hz-f7",
    scenario: "hero",
    theme: "dark",
    value: "steps: Array.from({ length: 7 }, () => 1 / 60)",
    viewport: desktop,
  },
  {
    name: "hero-dark-desktop-steady-120hz-f11",
    scenario: "hero",
    theme: "dark",
    value: "steps: Array.from({ length: 11 }, () => 1 / 120)",
    viewport: desktop,
  },
  {
    name: "hero-light-desktop-steady-60hz-f11",
    scenario: "hero",
    theme: "light",
    value: "steps: Array.from({ length: 11 }, () => 1 / 60)",
    viewport: desktop,
  },
  {
    name: "hero-dark-mobile-2x-steady-120hz-f11",
    scenario: "hero",
    theme: "dark",
    value: "steps: Array.from({ length: 11 }, () => 1 / 120)",
    viewport: mobile,
  },
  {
    name: "hero-light-mobile-2x-steady-60hz-f7",
    scenario: "hero",
    theme: "light",
    value: "steps: Array.from({ length: 7 }, () => 1 / 60)",
    viewport: mobile,
  },
  {
    name: "hero-light-mobile-2x-steady-120hz-f7",
    scenario: "hero",
    theme: "light",
    value: "steps: Array.from({ length: 7 }, () => 1 / 120)",
    viewport: mobile,
  },
  {
    name: "cta-light-mobile-2x-t2_25",
    scenario: "cta",
    theme: "light",
    value: "time: 2.25",
    viewport: mobile,
  },
];

const missingSnapshots = temporalSnapshots.filter(
  ({ name }) => !benchmark.includes(`name: "${name}"`),
);
const snapshotEntries = missingSnapshots
  .map(
    ({ name, scenario, theme, value, viewport }) => `    {
      name: "${name}",
      scenario: "${scenario}",
      theme: "${theme}",
      ${value},
      viewport: ${viewport},
    },`,
  )
  .join("\n");
if (snapshotEntries) {
  benchmark = benchmark.replace(
    snapshotMarker,
    `${snapshotMarker}${snapshotEntries}\n`,
  );
}

await writeFile(benchmarkPath, benchmark);
console.log(
  `Added ${missingScenarios.length} production scenarios, ${missingSnapshots.length} temporal captures, and sequential capture support.`,
);
