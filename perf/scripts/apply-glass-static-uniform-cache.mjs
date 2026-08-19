import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing ${label} in ${path}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Non-unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

async function replaceAllExact(path, before, after, expectedCount, label) {
  const source = await readFile(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} ${label} blocks in ${path}, found ${count}`,
    );
  }
  await writeFile(path, source.split(before).join(after));
}

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `  const {
    ensureTerrainResources,
    updateTerrainGeometry,
    bindSceneTarget,
    glassIsActive,
    ensureGlassResources,
  } = resourceManager;
`,
  `  const {
    ensureTerrainResources,
    updateTerrainGeometry,
    bindSceneTarget,
    glassIsActive,
    ensureGlassResources,
  } = resourceManager;

  const glassStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const compositeStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const blurStaticUniformKeys = new WeakMap<ProgramBundle, string>();
`,
  "glass uniform cache declarations",
);

await replaceAllExact(
  "src/runtime/glass-terrain-renderer.ts",
  `      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      uniform2f(
`,
  `      uniform2f(
`,
  2,
  "blur repeated static uniform",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
`,
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const blurStaticKey = [resources.blurWidth, resources.blurHeight].join("|");
    if (blurStaticUniformKeys.get(resources.blurProgram) !== blurStaticKey) {
      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      blurStaticUniformKeys.set(resources.blurProgram, blurStaticKey);
    }
    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
`,
  "scene blur static uniform initialization",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const normalizedRadius = radiusPhysicalPx * 0.55;
`,
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const blurStaticKey = [resources.blurWidth, resources.blurHeight].join("|");
    if (blurStaticUniformKeys.get(resources.blurProgram) !== blurStaticKey) {
      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      blurStaticUniformKeys.set(resources.blurProgram, blurStaticKey);
    }
    const normalizedRadius = radiusPhysicalPx * 0.55;
`,
  "effect blur static uniform initialization",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredScene);
    uniform1i(gl, glassProgram, "uScene", 0);
`,
  `    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredScene);
    const tint = hexToVec3(settings.glassText.tint);
    const glassStaticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      resourceState.dpr,
      settings.glassText.refraction,
      settings.glassText.edgeWrap,
      settings.glassText.surfaceModel,
      settings.glassText.bevelMode,
      settings.glassText.surfaceDepth,
      settings.glassText.ior,
      settings.glassText.magnificationX,
      settings.glassText.magnificationY,
      settings.glassText.displacementX,
      settings.glassText.displacementY,
      settings.glassText.diffusion,
      settings.glassText.blur,
      settings.glassText.distortion,
      settings.glassText.chromaticAberration,
      settings.glassText.frost,
      settings.glassText.roughness,
      settings.glassText.bevel,
      settings.glassText.ribStrength,
      settings.glassText.ribWidth,
      settings.glassText.ribAngle,
      settings.glassText.liquidStrength,
      settings.glassText.liquidScale,
      settings.glassText.liquidSpeed,
      settings.glassText.edgeStrength,
      settings.glassText.specular,
      settings.glassText.fresnel,
      settings.glassText.twinkle,
      settings.glassText.twinkleDensity,
      settings.glassText.twinkleSpeed,
      settings.glassText.twinkleSize,
      tint[0],
      tint[1],
      tint[2],
      settings.glassText.tintStrength,
      settings.glassText.saturation,
      settings.glassText.brightness,
      settings.glassText.opacity,
    ].join("|");
    const updateGlassStaticUniforms =
      glassStaticUniformKeys.get(glassProgram) !== glassStaticKey;
    if (updateGlassStaticUniforms) {
      uniform1i(gl, glassProgram, "uScene", 0);
`,
  "glass static uniform key and guard",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(gl, glassProgram, "uTime", getClockTime());
    uniform1f(
`,
  `    }
    uniform1f(gl, glassProgram, "uTime", getClockTime());
    if (updateGlassStaticUniforms) {
      uniform1f(
`,
  "glass dynamic time split",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const tint = hexToVec3(settings.glassText.tint);
    gl.uniform3f(glassProgram.uniforms.uTint ?? null, ...tint);
`,
  `    gl.uniform3f(glassProgram.uniforms.uTint ?? null, ...tint);
`,
  "duplicate glass tint declaration",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(gl, glassProgram, "uBrightness", settings.glassText.brightness);
    uniform1f(gl, glassProgram, "uOpacity", settings.glassText.opacity);
    if (effectBounds) {
`,
  `    uniform1f(gl, glassProgram, "uBrightness", settings.glassText.brightness);
    uniform1f(gl, glassProgram, "uOpacity", settings.glassText.opacity);
      glassStaticUniformKeys.set(glassProgram, glassStaticKey);
    }
    if (effectBounds) {
`,
  "close glass static uniform guard",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredEffect);
    uniform1i(gl, resources.compositeProgram, "uScene", 0);
    uniform1i(gl, resources.compositeProgram, "uEffect", 1);
    uniform1i(gl, resources.compositeProgram, "uBlurEffect", 2);
    uniform2f(
      gl,
      resources.compositeProgram,
      "uResolution",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
`,
  `    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredEffect);
    const compositeStaticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      resourceState.dpr,
      settings.glassText.introOffsetY,
    ].join("|");
    if (
      compositeStaticUniformKeys.get(resources.compositeProgram) !==
      compositeStaticKey
    ) {
      uniform1i(gl, resources.compositeProgram, "uScene", 0);
      uniform1i(gl, resources.compositeProgram, "uEffect", 1);
      uniform1i(gl, resources.compositeProgram, "uBlurEffect", 2);
      uniform2f(
        gl,
        resources.compositeProgram,
        "uResolution",
        resourceState.canvasWidth,
        resourceState.canvasHeight,
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uOffsetY",
        settings.glassText.introOffsetY * resourceState.dpr,
      );
      compositeStaticUniformKeys.set(
        resources.compositeProgram,
        compositeStaticKey,
      );
    }
`,
  "composite static uniform cache",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(
      gl,
      resources.compositeProgram,
      "uOffsetY",
      settings.glassText.introOffsetY * resourceState.dpr,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
`,
  `    gl.drawArrays(gl.TRIANGLES, 0, 3);
`,
  "remove repeated composite offset uniform",
);

console.log("Applied glass, blur, and composite static-uniform caches.");
