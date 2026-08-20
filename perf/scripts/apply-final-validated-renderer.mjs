import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Unable to find ${label} in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

const path = "src/runtime/path-renderer.ts";
let source = await readFile(path, "utf8");

if (!source.includes("const temporalSceneStability = new WeakMap")) {
  await replaceOnce(
    path,
    `  const integralStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n`,
    `  const integralStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n  const temporalSceneStability = new WeakMap<\n    PathResources,\n    { key: string; stableFrames: number }\n  >();\n`,
    "temporal scene stability storage",
  );
}

source = await readFile(path, "utf8");
if (!source.includes("const shouldUseTemporalPathCache =")) {
  await replaceOnce(
    path,
    `  const shouldUseTemporalHeroCache = (\n    root: Settings,\n    scene: readonly PreparedFilamentFrame[],\n  ) =>\n    scene.length === 1 &&\n    root.motionMode === "travel" &&\n    root.pathMode === "custom" &&\n    root.segmentLength >= 0.999 &&\n    root.quality.quadrature >= 2 &&\n    !root.propagation.enabled &&\n    !root.musicVisualizer.enabled &&\n    !root.filamentInteraction.enabled &&\n    !hasConditionalFollow(root) &&\n    root.speed > 0.000001 &&\n    root.filamentPlaybackRate > 0.000001;\n`,
    `  const anchoredSceneIsStable = (\n    resources: PathResources,\n    scene: readonly PreparedFilamentFrame[],\n  ) => {\n    const entry = scene[0];\n    if (!entry || pointerState.dotPointerActive) {\n      temporalSceneStability.delete(resources);\n      return false;\n    }\n    const modifiers = entry.modifiers;\n    const key = [\n      resources.uploadedSceneHashes[0],\n      resources.uploadedSceneHashes[1],\n      resources.uploadedSceneHashes[2],\n      entry.followBlend,\n      modifiers.width,\n      modifiers.glow,\n      modifiers.reflection,\n      modifiers.intensity,\n      modifiers.hueDegrees,\n      modifiers.visibility,\n    ].join("|");\n    const previous = temporalSceneStability.get(resources);\n    if (!previous || previous.key !== key) {\n      temporalSceneStability.set(resources, { key, stableFrames: 1 });\n      return false;\n    }\n    previous.stableFrames = Math.min(previous.stableFrames + 1, 3);\n    return previous.stableFrames >= 2;\n  };\n\n  const shouldUseTemporalPathCache = (\n    resources: PathResources,\n    root: Settings,\n    scene: readonly PreparedFilamentFrame[],\n  ) => {\n    const common =\n      scene.length === 1 &&\n      root.pathMode === "custom" &&\n      root.segmentLength >= 0.999 &&\n      root.quality.quadrature >= 2 &&\n      !root.propagation.enabled &&\n      !root.musicVisualizer.enabled &&\n      !root.filamentInteraction.enabled &&\n      root.speed > 0.000001 &&\n      root.filamentPlaybackRate > 0.000001;\n    if (!common) {\n      temporalSceneStability.delete(resources);\n      return false;\n    }\n    if (root.motionMode === "travel") {\n      temporalSceneStability.delete(resources);\n      return !hasConditionalFollow(root);\n    }\n    return (\n      root.motionMode === "anchored" &&\n      root.quality.quadrature >= 4 &&\n      root.headTaper <= 0.001001 &&\n      anchoredSceneIsStable(resources, scene)\n    );\n  };\n`,
    "temporal cache selector",
  );

  await replaceOnce(
    path,
    `    if (shouldUseTemporalHeroCache(root, preparedSceneFrames)) {\n`,
    `    if (shouldUseTemporalPathCache(resources, root, preparedSceneFrames)) {\n`,
    "temporal cache call site",
  );
}

source = await readFile(path, "utf8");
if (!source.includes("const temporalAnchorRateHz =")) {
  await replaceOnce(
    path,
    `    const visualStep = Math.max(\n      Math.abs(root.speed * root.filamentPlaybackRate) / 15,\n      1 / 240,\n    );`,
    `    const temporalAnchorRateHz =\n      root.motionMode === "anchored" ? 10 : 15;\n    const visualStep = Math.max(\n      Math.abs(root.speed * root.filamentPlaybackRate) / temporalAnchorRateHz,\n      1 / 240,\n    );`,
    "per-mode temporal anchor rate",
  );
}

source = await readFile(path, "utf8");
for (const marker of [
  "const temporalSceneStability = new WeakMap",
  "const anchoredSceneIsStable =",
  "const shouldUseTemporalPathCache =",
  "root.motionMode === \"anchored\" ? 10 : 15",
  "shouldUseTemporalPathCache(resources, root, preparedSceneFrames)",
]) {
  if (!source.includes(marker)) {
    throw new Error(`Final renderer marker missing: ${marker}`);
  }
}

console.log("Applied final validated Hero 15 Hz / idle CTA 10 Hz renderer selector.");
