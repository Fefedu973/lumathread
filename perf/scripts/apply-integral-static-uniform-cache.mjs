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

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const { followModifiers } = followController;

  const pathPassProfileRadius`,
  `  const { followModifiers } = followController;

  const integralStaticUniformKeys = new WeakMap<ProgramBundle, string>();

  const pathPassProfileRadius`,
  "integral static uniform cache declaration",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    const negativeRadius = Math.min(
      maximumRadius,
      commonRadius *
        Math.max(
          settings.lowerGlowSpread *
            settings.profileBounds.maximumLowerGlowSpread,
          0.02,
        ) +
        2,
    );
    exactGl.activeTexture(exactGl.TEXTURE0);`,
  `    const negativeRadius = Math.min(
      maximumRadius,
      commonRadius *
        Math.max(
          settings.lowerGlowSpread *
            settings.profileBounds.maximumLowerGlowSpread,
          0.02,
        ) +
        2,
    );
    const staticUniformKey = [
      passWidth,
      passHeight,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      profileRadius,
      settings.glow,
      settings.profileBounds.maximumGlow,
      settings.profileBounds.maximumWidth,
      settings.curveTravel,
      settings.segmentLength,
      settings.tailTaper,
      settings.headTaper,
      closed ? 1 : 0,
      settings.closedLoopTaper ? 1 : 0,
      settings.upperGlowSpread,
      settings.lowerGlowSpread,
      settings.glowAsymmetry,
      quadraturePointsForPass(settings, pass),
      paletteWrapUniform(settings.paletteWrap),
      settings.material.atmosphere,
      settings.material.broad,
      settings.material.body,
      settings.material.ridge,
      settings.material.core,
      settings.material.veil,
      settings.material.exposure,
      settings.material.saturation,
    ].join("|");
    const updateStaticUniforms =
      integralStaticUniformKeys.get(bundle) !== staticUniformKey;
    exactGl.activeTexture(exactGl.TEXTURE0);`,
  "integral static uniform key",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1i(exactGl, bundle, "uPalette", 0);
    uniform1i(exactGl, bundle, "uK0Lut", 1);
    uniform1i(exactGl, bundle, "uProfiles", 2);
    uniform2f(exactGl, bundle, "uTargetResolution", passWidth, passHeight);
    uniform2f(
      exactGl,
      bundle,
      "uCanvasResolution",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );`,
  `    if (updateStaticUniforms) {
      uniform1i(exactGl, bundle, "uPalette", 0);
      uniform1i(exactGl, bundle, "uK0Lut", 1);
      uniform1i(exactGl, bundle, "uProfiles", 2);
      uniform2f(exactGl, bundle, "uTargetResolution", passWidth, passHeight);
      uniform2f(
        exactGl,
        bundle,
        "uCanvasResolution",
        resourceState.canvasWidth,
        resourceState.canvasHeight,
      );
    }`,
  "integral sampler and resolution uniforms",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1f(
      exactGl,
      bundle,
      "uSupportRadiusBasePx",
      profileRadius * Math.max(settings.glow, 0.02) * passHeight,
    );
    if (pass === HERO_PATH_PASS_FAR) {
      exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 1, 1, 1, 0);
      exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 0);
    } else if (pass === HERO_PATH_PASS_MID) {
      exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 1);
      exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 1);
    } else {
      exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 0);
      exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 1, 0);
    }
    uniform1f(
      exactGl,
      bundle,
      "uQuadraturePoints",
      quadraturePointsForPass(settings, pass),
    );`,
  `    if (updateStaticUniforms) {
      uniform1f(
        exactGl,
        bundle,
        "uSupportRadiusBasePx",
        profileRadius * Math.max(settings.glow, 0.02) * passHeight,
      );
      if (pass === HERO_PATH_PASS_FAR) {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 1, 1, 1, 0);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 0);
      } else if (pass === HERO_PATH_PASS_MID) {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 1);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 1);
      } else {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 0);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 1, 0);
      }
      uniform1f(
        exactGl,
        bundle,
        "uQuadraturePoints",
        quadraturePointsForPass(settings, pass),
      );
    }`,
  "integral support and layer uniforms",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1f(exactGl, bundle, "uTime", visualTime);
    uniform1f(exactGl, bundle, "uCurveTravel", settings.curveTravel);`,
  `    uniform1f(exactGl, bundle, "uTime", visualTime);
    if (updateStaticUniforms) {
      uniform1f(exactGl, bundle, "uCurveTravel", settings.curveTravel);
    }`,
  "integral curve travel uniform",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1f(exactGl, bundle, "uSegmentLength", settings.segmentLength);
    uniform1f(exactGl, bundle, "uTailTaper", settings.tailTaper);
    uniform1f(exactGl, bundle, "uHeadTaper", settings.headTaper);
    uniform1f(exactGl, bundle, "uPathClosed", closed ? 1 : 0);
    uniform1f(
      exactGl,
      bundle,
      "uClosedLoopTaper",
      settings.closedLoopTaper ? 1 : 0,
    );`,
  `    if (updateStaticUniforms) {
      uniform1f(exactGl, bundle, "uSegmentLength", settings.segmentLength);
      uniform1f(exactGl, bundle, "uTailTaper", settings.tailTaper);
      uniform1f(exactGl, bundle, "uHeadTaper", settings.headTaper);
      uniform1f(exactGl, bundle, "uPathClosed", closed ? 1 : 0);
      uniform1f(
        exactGl,
        bundle,
        "uClosedLoopTaper",
        settings.closedLoopTaper ? 1 : 0,
      );
    }`,
  "integral envelope shape uniforms",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1f(exactGl, bundle, "uBandSpread", settings.glow);
    uniform1f(exactGl, bundle, "uUpperGlowSpread", settings.upperGlowSpread);
    uniform1f(exactGl, bundle, "uLowerGlowSpread", settings.lowerGlowSpread);
    uniform1f(exactGl, bundle, "uGlowAsymmetry", settings.glowAsymmetry);`,
  `    if (updateStaticUniforms) {
      uniform1f(exactGl, bundle, "uBandSpread", settings.glow);
      uniform1f(exactGl, bundle, "uUpperGlowSpread", settings.upperGlowSpread);
      uniform1f(exactGl, bundle, "uLowerGlowSpread", settings.lowerGlowSpread);
      uniform1f(exactGl, bundle, "uGlowAsymmetry", settings.glowAsymmetry);
    }`,
  "integral glow uniforms",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1f(
      exactGl,
      bundle,
      "uPaletteWrap",
      paletteWrapUniform(settings.paletteWrap),
    );
    exactGl.uniform4f(
      bundle.uniforms.uMaterialWeights0 ?? null,
      settings.material.atmosphere,
      settings.material.broad,
      settings.material.body,
      settings.material.ridge,
    );
    exactGl.uniform4f(
      bundle.uniforms.uMaterialWeights1 ?? null,
      settings.material.core,
      settings.material.veil,
      settings.material.exposure,
      settings.material.saturation,
    );`,
  `    if (updateStaticUniforms) {
      uniform1f(
        exactGl,
        bundle,
        "uPaletteWrap",
        paletteWrapUniform(settings.paletteWrap),
      );
      exactGl.uniform4f(
        bundle.uniforms.uMaterialWeights0 ?? null,
        settings.material.atmosphere,
        settings.material.broad,
        settings.material.body,
        settings.material.ridge,
      );
      exactGl.uniform4f(
        bundle.uniforms.uMaterialWeights1 ?? null,
        settings.material.core,
        settings.material.veil,
        settings.material.exposure,
        settings.material.saturation,
      );
      integralStaticUniformKeys.set(bundle, staticUniformKey);
    }`,
  "integral palette and material uniforms",
);

console.log("Applied integral static-uniform cache experiment.");
