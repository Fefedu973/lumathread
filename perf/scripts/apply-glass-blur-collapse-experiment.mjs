import { readFile, writeFile } from "node:fs/promises";

const mode =
  new URL(import.meta.url).searchParams.get("mode") ??
  process.env.LUMATHREAD_GLASS_BLUR_EXPERIMENT ??
  process.argv[2] ??
  "minus-one";
if (mode !== "minus-one" && mode !== "half") {
  throw new Error(`Unknown glass blur experiment: ${JSON.stringify(mode)}`);
}

const rendererPath = "src/runtime/glass-terrain-renderer.ts";
const source = await readFile(rendererPath, "utf8");
const before = `    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
    const baseStep =
      0.45 +
      settings.glassText.blur * 1.2 +
      settings.glassText.frost * 1.8 +
      settings.glassText.diffusion * 2.8;
    let source = resources.sceneTexture;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const step = baseStep * (1 + iteration * 0.28);`;
const targetIterations =
  mode === "minus-one"
    ? `Math.max(2, originalIterations - 1)`
    : `Math.max(1, Math.ceil(originalIterations * 0.5))`;
const after = `    const originalIterations =
      2 + Math.round(settings.glassText.diffusion * 2);
    const baseStep =
      0.45 +
      settings.glassText.blur * 1.2 +
      settings.glassText.frost * 1.8 +
      settings.glassText.diffusion * 2.8;
    let originalVariance = 0;
    for (let iteration = 0; iteration < originalIterations; iteration++) {
      const factor = 1 + iteration * 0.28;
      originalVariance += factor * factor;
    }
    const iterations = ${targetIterations};
    const collapsedStep =
      baseStep * Math.sqrt(originalVariance / iterations);
    let source = resources.sceneTexture;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const step = collapsedStep;`;
const first = source.indexOf(before);
if (first < 0) {
  throw new Error("Expected glass blur loop was not found.");
}
if (source.indexOf(before, first + before.length) >= 0) {
  throw new Error("Expected a unique glass blur loop.");
}
await writeFile(
  rendererPath,
  source.slice(0, first) + after + source.slice(first + before.length),
);
console.log(`Applied ${mode} variance-preserving glass blur experiment.`);
