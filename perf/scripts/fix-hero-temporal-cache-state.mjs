import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(
      `Expected block not found in ${path}: ${before.slice(0, 120)}`,
    );
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(
      `Expected a unique block in ${path}: ${before.slice(0, 120)}`,
    );
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  temporalAnchorIndex: number;\n  temporalSettingsReference: Settings | null;\n  temporalSizeRevision: number;`,
  `  temporalAnchorIndex: number;\n  temporalSettingsReference: Settings | null;\n  temporalSettingsKey: string;\n  temporalPaletteTexture: WebGLTexture | null;\n  temporalProfilesTexture: WebGLTexture | null;\n  temporalSizeRevision: number;`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;\n    resources.temporalSettingsReference = null;\n    resources.temporalSizeRevision = -1;`,
  `    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;\n    resources.temporalSettingsReference = null;\n    resources.temporalSettingsKey = "";\n    resources.temporalPaletteTexture = null;\n    resources.temporalProfilesTexture = null;\n    resources.temporalSizeRevision = -1;`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        temporalAnchorIndex: Number.MIN_SAFE_INTEGER,\n        temporalSettingsReference: null,\n        temporalSizeRevision: -1,`,
  `        temporalAnchorIndex: Number.MIN_SAFE_INTEGER,\n        temporalSettingsReference: null,\n        temporalSettingsKey: "",\n        temporalPaletteTexture: null,\n        temporalProfilesTexture: null,\n        temporalSizeRevision: -1,`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const updateTemporalHeroCache = (\n    resources: PathResources,\n    root: Settings,\n    scene: readonly PreparedFilamentFrame[],\n  ) => {`,
  `  const temporalHeroSettingsKey = (\n    resources: PathResources,\n    root: Settings,\n    scene: readonly PreparedFilamentFrame[],\n  ) => {\n    const entry = scene[0];\n    if (!entry) return "";\n    const bounds = root.profileBounds;\n    const material = root.material;\n    const modifiers = entry.modifiers;\n    return [\n      resourceState.canvasWidth,\n      resourceState.canvasHeight,\n      root.timeOffset,\n      root.filamentPlaybackRate,\n      root.speed,\n      root.curveTravel,\n      root.segmentLength,\n      root.tailTaper,\n      root.headTaper,\n      root.closedLoopTaper ? 1 : 0,\n      root.glow,\n      root.upperGlowSpread,\n      root.lowerGlowSpread,\n      root.glowAsymmetry,\n      root.intensity,\n      root.colorSpeed,\n      root.paletteWrap,\n      root.hue,\n      root.hueDrift,\n      root.quality.quadrature,\n      bounds.maximumGlow,\n      bounds.maximumWidth,\n      bounds.maximumUpperGlowSpread,\n      bounds.maximumLowerGlowSpread,\n      material.atmosphere,\n      material.broad,\n      material.body,\n      material.ridge,\n      material.core,\n      material.veil,\n      material.exposure,\n      material.saturation,\n      entry.geometry.closed ? 1 : 0,\n      entry.followBlend,\n      modifiers.width,\n      modifiers.glow,\n      modifiers.reflection,\n      modifiers.intensity,\n      modifiers.hueDegrees,\n      modifiers.visibility,\n      resources.uploadedSceneHashes[0],\n      resources.uploadedSceneHashes[1],\n      resources.uploadedSceneHashes[2],\n    ].join("|");\n  };\n\n  const updateTemporalHeroCache = (\n    resources: PathResources,\n    root: Settings,\n    scene: readonly PreparedFilamentFrame[],\n  ) => {`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    const anchorIndex = Math.floor(currentTime / visualStep);\n    const settingsChanged =\n      resources.temporalSettingsReference !== root ||\n      resources.temporalSizeRevision !== resourceState.sizeRevision;`,
  `    const anchorIndex = Math.floor(currentTime / visualStep);\n    const entry = scene[0];\n    const settingsKey = temporalHeroSettingsKey(resources, root, scene);\n    const settingsChanged =\n      resources.temporalSettingsKey !== settingsKey ||\n      resources.temporalPaletteTexture !== (entry?.style.palette ?? null) ||\n      resources.temporalProfilesTexture !== (entry?.style.profiles ?? null) ||\n      resources.temporalSizeRevision !== resourceState.sizeRevision;`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `      resources.temporalAnchorIndex = anchorIndex;\n      resources.temporalSettingsReference = root;\n      resources.temporalSizeRevision = resourceState.sizeRevision;`,
  `      resources.temporalAnchorIndex = anchorIndex;\n      resources.temporalSettingsReference = root;\n      resources.temporalSettingsKey = settingsKey;\n      resources.temporalPaletteTexture = entry?.style.palette ?? null;\n      resources.temporalProfilesTexture = entry?.style.profiles ?? null;\n      resources.temporalSizeRevision = resourceState.sizeRevision;`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;\n    resources.temporalSettingsReference = null;\n    resources.temporalSizeRevision = -1;`,
  `    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;\n    resources.temporalSettingsReference = null;\n    resources.temporalSettingsKey = "";\n    resources.temporalPaletteTexture = null;\n    resources.temporalProfilesTexture = null;\n    resources.temporalSizeRevision = -1;`,
);

console.log(
  "Fixed Hero temporal cache invalidation with a stable render signature.",
);
