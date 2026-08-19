import { readFile, writeFile } from "node:fs/promises";

const variant = process.argv[2];
const allowed = new Set(["core", "mid-core", "all"]);
if (!allowed.has(variant)) {
  throw new Error(
    `Expected one of ${[...allowed].join(", ")}, received ${variant}`,
  );
}

const path = "src/runtime/path-renderer.ts";
let source = await readFile(path, "utf8");

const replaceOnce = (before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Unable to find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique ${label}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
};

const heroPassExpression =
  variant === "core"
    ? "pass === HERO_PATH_PASS_CORE"
    : variant === "mid-core"
      ? "pass >= HERO_PATH_PASS_MID"
      : "pass >= HERO_PATH_PASS_FAR";

replaceOnce(
  `  const shouldUseSourceInstancedQuadrature = (settings: Settings) =>\n    settings.motionMode === "anchored" &&\n    settings.quality.quadrature >= 4 &&\n    settings.segmentLength >= 0.999 &&\n    settings.headTaper <= 0.001001;`,
  `  const shouldUseSourceInstancedQuadrature = (\n    settings: Settings,\n    pass: number,\n  ) => {\n    const anchoredProductionSignature =\n      settings.motionMode === "anchored" &&\n      settings.quality.quadrature >= 4 &&\n      settings.segmentLength >= 0.999 &&\n      settings.headTaper <= 0.001001;\n    const heroTravelSignature =\n      settings.motionMode === "travel" &&\n      settings.quality.quadrature >= 4 &&\n      settings.segmentLength >= 0.999 &&\n      ${heroPassExpression};\n    return anchoredProductionSignature || heroTravelSignature;\n  };`,
  "source-instanced selector",
);

replaceOnce(
  `        const sourceInstanced = shouldUseSourceInstancedQuadrature(\n          entry.settings,\n        );`,
  `        const sourceInstanced = shouldUseSourceInstancedQuadrature(\n          entry.settings,\n          pass,\n        );`,
  "source-instanced selector call",
);

await writeFile(path, source);
console.log(`Applied Hero source-instanced pass experiment: ${variant}.`);
