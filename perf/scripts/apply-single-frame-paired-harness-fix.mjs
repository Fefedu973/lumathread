import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? ".";
const fileAt = (path) => (root === "." ? path : join(root, path));

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) {
    throw new Error(`Expected block not found in ${path}: ${before.slice(0, 120)}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

const rendererPath = fileAt("src/runtime/use-hero-wave-renderer.ts");
await replaceOnce(
  rendererPath,
  `      if (
        !running ||
        frameScheduled ||
        document.visibilityState === "hidden" ||`,
  `      if (
        !running ||
        frameScheduled ||
        settings.paused ||
        manualPausedRef.current ||
        document.visibilityState === "hidden" ||`,
);
await replaceOnce(
  rendererPath,
  `      step: (seconds: number) => {
        const safeSeconds = finite(seconds, 0);`,
  `      step: (seconds: number) => {
        if (frameScheduled) {
          cancelAnimationFrame(raf);
          frameScheduled = false;
        }
        const safeSeconds = finite(seconds, 0);`,
);

if (root === ".") {
  const suitePath = "perf/scripts/benchmark-suite.mjs";
  let source = await readFile(suitePath, "utf8");
  const replaceSuiteOnce = (before, after) => {
    const index = source.indexOf(before);
    if (index < 0) {
      throw new Error(`Expected benchmark-suite block not found: ${before.slice(0, 120)}`);
    }
    if (source.indexOf(before, index + before.length) >= 0) {
      throw new Error(`Expected unique benchmark-suite block: ${before.slice(0, 120)}`);
    }
    source = source.slice(0, index) + after + source.slice(index + before.length);
  };
  const replaceSuiteAll = (before, after, expectedCount) => {
    const count = source.split(before).length - 1;
    if (count !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} benchmark-suite blocks, found ${count}: ${before.slice(0, 120)}`,
      );
    }
    source = source.split(before).join(after);
  };

  replaceSuiteOnce(
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
  replaceSuiteAll(
    `      for (const build of frameOrder) {
        await dispatchPointer(`,
    `      for (const build of frameOrder) {
        await activateBenchmarkPage(pages[build]);
        await dispatchPointer(`,
    2,
  );
  replaceSuiteOnce(
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
  replaceSuiteOnce(
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
  await writeFile(suitePath, source);
}

console.log(
  root === "."
    ? "Applied single-frame debug stepping and symmetric page activation."
    : `Applied single-frame debug stepping to ${root}.`,
);
