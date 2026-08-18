import { readFile, writeFile } from "node:fs/promises";

const mode =
  process.argv[2] ?? process.env.LUMATHREAD_RENDERER_EXPERIMENT ?? "combined";
const supportedModes = new Set(["shader", "scissor", "blit", "combined"]);
if (!supportedModes.has(mode)) {
  throw new Error(
    `Unknown renderer experiment ${JSON.stringify(mode)}. Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
}

const shaderPath = "src/rendering/shaders.ts";
const rendererPath = "src/runtime/glass-terrain-renderer.ts";
const boundsPaths = [
  "src/rendering/glass-mask.ts",
  "src/rendering/webgl-resources.ts",
  "src/runtime/resource-manager.ts",
  rendererPath,
];
const trackedPaths = [shaderPath, ...boundsPaths];
const originals = new Map(
  await Promise.all(
    trackedPaths.map(async (path) => [path, await readFile(path, "utf8")]),
  ),
);

await import(
  new URL(
    `./apply-renderer-optimization.mjs?mode=${encodeURIComponent(mode)}`,
    import.meta.url,
  )
);

const restore = async (path) => {
  const source = originals.get(path);
  if (source === undefined) throw new Error(`Missing source snapshot for ${path}`);
  await writeFile(path, source);
};

if (mode === "shader") {
  for (const path of boundsPaths) await restore(path);
} else {
  if (mode !== "combined") await restore(shaderPath);

  let renderer = await readFile(rendererPath, "utf8");
  const strictGate = `    const canBlitScene =
      exactGl !== null && introProgress === 1 && sceneOpacity === 1;`;
  const tolerantGate = `    const canBlitScene =
      exactGl !== null &&
      introProgress >= 0.999999 &&
      sceneOpacity >= 0.999999;`;
  if (!renderer.includes(strictGate)) {
    throw new Error("Expected the generated stable blit gate was not found.");
  }
  renderer = renderer.replace(
    strictGate,
    mode === "scissor" ? "    const canBlitScene = false;" : tolerantGate,
  );
  await writeFile(rendererPath, renderer);
}

console.log(`Applied renderer experiment: ${mode}.`);
