import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected block in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected a unique block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  "perf/harness/index.html",
  `        const contexts = [];\n        const increment = (name, value = 1) => {`,
  `        const contexts = [];\n        const instrumentationDisabled =\n          new URLSearchParams(window.location.search).get("instrument") ===\n          "none";\n        const increment = (name, value = 1) => {`,
);

await replaceOnce(
  "perf/harness/index.html",
  `          contexts.push(context);\n\n          const wrap = (name, before) => {`,
  `          contexts.push(context);\n          if (instrumentationDisabled) return context;\n\n          const wrap = (name, before) => {`,
);

await replaceOnce(
  "perf/harness/gl-profiler.js",
  `(() => {\n  const benchmarkMode =`,
  `(() => {\n  const instrumentationDisabled =\n    new URLSearchParams(window.location.search).get("instrument") === "none";\n  if (instrumentationDisabled) {\n    const emptySnapshot = () => ({\n      supported: false,\n      extension: null,\n      frameCount: 0,\n      pendingCount: 0,\n      sampleCount: 0,\n      disjointCount: 0,\n      errors: [],\n      byStage: {},\n      byDraw: {},\n    });\n    window.__LUMATHREAD_GPU_PROFILER__ = {\n      beginFrame() {},\n      collect() {},\n      reset() {},\n      snapshot: emptySnapshot,\n    };\n    return;\n  }\n  const benchmarkMode =`,
);

await replaceOnce(
  "perf/scripts/benchmark-suite.mjs",
  `    variant: scenario.variant ?? "full",\n  });`,
  `    variant: scenario.variant ?? "full",\n    instrument: scenario.instrument ?? "full",\n  });`,
);

console.log(
  "Applied production-wall harness: one gl.finish, no counters or per-draw timer queries.",
);
