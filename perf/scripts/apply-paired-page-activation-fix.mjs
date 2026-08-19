import { readFile, writeFile } from "node:fs/promises";

const path = "perf/scripts/benchmark-suite.mjs";
let source = await readFile(path, "utf8");

const replaceOnce = (before, after) => {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Expected block not found: ${before.slice(0, 120)}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected a unique block: ${before.slice(0, 120)}`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
};

const replaceAllExact = (before, after, expectedCount) => {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} occurrences, found ${count}: ${before.slice(0, 120)}`,
    );
  }
  source = source.split(before).join(after);
};

replaceOnce(
  `async function resetMeasurements(page) {
  await evaluate(
    page.client,
    \`window.__LUMATHREAD_HARNESS__.resetMeasurements()\`,
  );
}
`,
  `async function resetMeasurements(page) {
  await evaluate(
    page.client,
    \`window.__LUMATHREAD_HARNESS__.resetMeasurements()\`,
  );
}

async function activateBenchmarkPage(page) {
  await page.client.call("Page.bringToFront");
  const visibility = await evaluate(page.client, "document.visibilityState");
  if (visibility !== "visible") {
    throw new Error(
      \`Benchmark target did not become visible: \${String(visibility)}\`,
    );
  }
}
`,
);

replaceAllExact(
  `      for (const build of frameOrder) {
        await dispatchPointer(`,
  `      for (const build of frameOrder) {
        await activateBenchmarkPage(pages[build]);
        await dispatchPointer(`,
  2,
);

replaceOnce(
  `    for (const build of initialOrder) {
      await resetMeasurements(pages[build]);
    }
    const metricsBefore = {};
    for (const build of initialOrder) {
      metricsBefore[build] = metricsToObject(`,
  `    for (const build of initialOrder) {
      await activateBenchmarkPage(pages[build]);
      await resetMeasurements(pages[build]);
    }
    const metricsBefore = {};
    for (const build of initialOrder) {
      await activateBenchmarkPage(pages[build]);
      metricsBefore[build] = metricsToObject(`,
);

replaceOnce(
  `    for (const build of initialOrder) {
      metricsAfter[build] = metricsToObject(
        await pages[build].client.call("Performance.getMetrics"),
      );
      payloads[build] = await collectPayload(pages[build]);
    }`,
  `    for (const build of initialOrder) {
      await activateBenchmarkPage(pages[build]);
      metricsAfter[build] = metricsToObject(
        await pages[build].client.call("Performance.getMetrics"),
      );
      payloads[build] = await collectPayload(pages[build]);
    }`,
);

await writeFile(path, source);
console.log("Applied paired-page foreground activation fix.");
