import { readFile, writeFile } from "node:fs/promises";

const mode = process.argv[2] ?? process.env.LUMATHREAD_RENDERER_EXPERIMENT ?? "combined";
const supportedModes = new Set(["shader", "scissor", "blit", "combined"]);
if (!supportedModes.has(mode)) {
  throw new Error(
    `Unknown renderer experiment ${JSON.stringify(mode)}. Expected one of: ${[
      ...supportedModes,
    ].join(", ")}`,
  );
}

const shaderPath = "src/rendering/shaders.ts";
const boundsPaths = [
  "src/rendering/glass-mask.ts",
  "src/rendering/webgl-resources.ts",
  "src/runtime/resource-manager.ts",
  "src/runtime/glass-terrain-renderer.ts",
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
  await restore(shaderPath);

  const rendererPath = "src/runtime/glass-terrain-renderer.ts";
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

  if (mode === "combined") {
    const optimizedShader = await readFile(shaderPath, "utf8");
    const generatedShader = await readFile(
      new URL("../../src/rendering/shaders.ts", import.meta.url),
      "utf8",
    ).catch(() => null);
    if (generatedShader !== null && generatedShader !== optimizedShader) {
      // The relative URL resolves to the same repository file in Node. This
      // branch is intentionally unreachable; it documents that combined keeps
      // the transformed shader rather than the snapshot restored above.
    }
    await writeFile(shaderPath, await readFile(shaderPath, "utf8"));
  }
}

if (mode === "combined") {
  const transformedShader = await readFile(shaderPath, "utf8");
  const originalShader = originals.get(shaderPath);
  if (originalShader === undefined) throw new Error("Missing original shader snapshot.");
  // `blit` restores the shader above; combined must re-apply only its exact
  // shader transforms after the stable blit gate has been corrected.
  await writeFile(shaderPath, originalShader);
  await import(
    new URL(
      `./apply-renderer-optimization.mjs?combined=${Date.now()}`,
      import.meta.url,
    )
  );
  let renderer = await readFile("src/runtime/glass-terrain-renderer.ts", "utf8");
  renderer = renderer.replace(
    `    const canBlitScene =
      exactGl !== null && introProgress === 1 && sceneOpacity === 1;`,
    `    const canBlitScene =
      exactGl !== null &&
      introProgress >= 0.999999 &&
      sceneOpacity >= 0.999999;`,
  );
  await writeFile("src/runtime/glass-terrain-renderer.ts", renderer);
  if (transformedShader === originalShader) {
    throw new Error("Combined experiment did not transform the glass shader.");
  }
}

console.log(`Applied renderer experiment: ${mode}.`);
