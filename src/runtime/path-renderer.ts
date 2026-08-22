import {
  HERO_PATH_SEGMENT_STRIDE,
  HERO_PATH_QUAD_VERTEX_COUNT,
  HERO_PATH_PASS_FAR,
  HERO_PATH_PASS_MID,
  HERO_PATH_PASS_CORE,
  HERO_PATH_PASS_COUNT,
  HERO_PATH_FAR_PROFILE_RADIUS,
  HERO_PATH_MID_PROFILE_RADIUS,
  HERO_PATH_CORE_PROFILE_RADIUS,
  type Settings,
} from "../config/settings";

import { hashMix, hashString } from "../runtime/cache-keys";

import {
  type PathResources,
  type ProgramBundle,
  uniform1f,
  uniform1i,
  uniform2f,
} from "../rendering/webgl-resources";

import {
  type FilamentStyleTextures,
  type FollowRuntimeModifiers,
  type PreparedFilamentFrame,
  createRuntimeModifiers,
  paletteWrapUniform,
  ensureFloatCapacity,
} from "../runtime/state";

import type { DrawControllerOptions } from "./draw-types";
import type { createDrawCommon } from "./draw-common";
import type { createGlassTerrainRenderer } from "./glass-terrain-renderer";

export function selectTemporalPathCacheAction(
  cachedAnchorIndex: number,
  nextAnchorIndex: number,
  secondBankReady: boolean,
  settingsChanged: boolean,
) {
  if (
    settingsChanged ||
    cachedAnchorIndex === Number.MIN_SAFE_INTEGER ||
    Math.abs(nextAnchorIndex - cachedAnchorIndex) > 1
  ) {
    return "render-primary" as const;
  }
  if (!secondBankReady) {
    return nextAnchorIndex === cachedAnchorIndex
      ? ("render-secondary" as const)
      : ("render-primary" as const);
  }
  if (nextAnchorIndex === cachedAnchorIndex + 1) {
    return "swap-render-secondary" as const;
  }
  return nextAnchorIndex === cachedAnchorIndex
    ? ("reuse" as const)
    : ("render-primary" as const);
}

export function isTemporalPathBootstrapAligned(
  currentTime: number,
  visualStep: number,
) {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(visualStep) ||
    visualStep <= 0
  ) {
    return false;
  }
  const nearestAnchor = Math.round(currentTime / visualStep) * visualStep;
  const floatingPointSlack =
    Number.EPSILON * Math.max(1, Math.abs(currentTime), visualStep) * 8;
  return (
    Math.abs(currentTime - nearestAnchor) <=
    visualStep / 12 + floatingPointSlack
  );
}

export function selectTemporalPathAnchorIndex(
  currentTime: number,
  visualStep: number,
  settingsChanged: boolean,
  motionMode: Settings["motionMode"],
) {
  return settingsChanged &&
    motionMode === "anchored" &&
    isTemporalPathBootstrapAligned(currentTime, visualStep)
    ? Math.round(currentTime / visualStep)
    : Math.floor(currentTime / visualStep);
}

export function createPathRenderer(
  {
    gl,
    exactGl,
    resourceState,
    pointerState,
    backgroundTexture,
    hueMatrix,
    zeroFloat4,
    preparedSceneFrames,
    followModifierScratch,
    musicModifierScratch,
    getClockTime,
    isInitialFramePresented,
    activateProgram,
    getStyleTextures,
    updateBackgroundImage,
    hasConditionalFollow,
    resourceManager,
    geometryController,
    musicController,
    followController,
  }: DrawControllerOptions,
  common: ReturnType<typeof createDrawCommon>,
  glassTerrain: ReturnType<typeof createGlassTerrainRenderer>,
) {
  const {
    updateMaskTexture,
    bindFullscreen,
    bindIntegralGeometry,
    bindCompositeTextures,
    localVisualTime,
    paletteOffsetFor,
    fillHueMatrix,
  } = common;
  const { applyDotInteractionUniforms } = glassTerrain;
  const {
    bindSceneTarget,
    ensurePathResources,
    allocatePathTargets,
    ensureTemporalPathTargets,
    failPathResources,
    reportPathResourcesReady,
    ensurePathIntegralProgram,
    ensurePathCompositeProgram,
    ensurePathDotsProgram,
  } = resourceManager;
  const { updateGeometryState } = geometryController;
  const { musicModifiers, combineRuntimeModifiers } = musicController;
  const { followModifiers } = followController;

  const integralStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const temporalSceneStability = new WeakMap<
    PathResources,
    { key: string; stableFrames: number }
  >();

  const pathPassProfileRadius = (pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? HERO_PATH_FAR_PROFILE_RADIUS
      : pass === HERO_PATH_PASS_MID
        ? HERO_PATH_MID_PROFILE_RADIUS
        : HERO_PATH_CORE_PROFILE_RADIUS;

  const quadraturePointsForPass = (settings: Settings, pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? Math.min(settings.quality.quadrature, 2)
      : settings.quality.quadrature;

  const shouldUseSourceInstancedQuadrature = (settings: Settings) =>
    settings.motionMode === "anchored" &&
    settings.quality.quadrature >= 4 &&
    settings.segmentLength >= 0.999 &&
    settings.headTaper <= 0.001001;

  const applyIntegralUniforms = (
    resources: PathResources,
    bundle: ProgramBundle,
    settings: Settings,
    style: FilamentStyleTextures,
    modifiers: FollowRuntimeModifiers,
    visualTime: number,
    pass: number,
    closed: boolean,
    followBlend: number,
  ) => {
    if (!exactGl) return;
    const passWidth = resources.passWidths[pass]!;
    const passHeight = resources.passHeights[pass]!;
    const profileRadius = pathPassProfileRadius(pass);
    const maximumRadius = Math.hypot(passWidth, passHeight) + 2;
    const commonRadius =
      profileRadius *
      Math.max(settings.glow, 0.02) *
      settings.profileBounds.maximumGlow *
      settings.profileBounds.maximumWidth *
      modifiers.glow *
      modifiers.width *
      passHeight;
    const positiveRadius = Math.min(
      maximumRadius,
      commonRadius *
        Math.max(
          settings.upperGlowSpread *
            settings.profileBounds.maximumUpperGlowSpread,
          0.02,
        ) +
        2,
    );
    const negativeRadius = Math.min(
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
    exactGl.activeTexture(exactGl.TEXTURE0);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.palette);
    exactGl.activeTexture(exactGl.TEXTURE1);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.k0Texture);
    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
    if (updateStaticUniforms) {
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
    }
    uniform1f(exactGl, bundle, "uSupportRadiusPositivePx", positiveRadius);
    uniform1f(exactGl, bundle, "uSupportRadiusNegativePx", negativeRadius);
    if (updateStaticUniforms) {
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
    }
    uniform1f(exactGl, bundle, "uTime", visualTime);
    if (updateStaticUniforms) {
      uniform1f(exactGl, bundle, "uCurveTravel", settings.curveTravel);
    }
    uniform1f(
      exactGl,
      bundle,
      "uEnvelopeStationary",
      settings.motionMode !== "travel" ? 1 : followBlend,
    );
    uniform1f(
      exactGl,
      bundle,
      "uStationaryCenter",
      0.5 + (0.82 - 0.5) * followBlend,
    );
    if (updateStaticUniforms) {
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
    }
    uniform1f(
      exactGl,
      bundle,
      "uBrightness",
      settings.intensity * modifiers.intensity,
    );
    if (updateStaticUniforms) {
      uniform1f(exactGl, bundle, "uBandSpread", settings.glow);
      uniform1f(exactGl, bundle, "uUpperGlowSpread", settings.upperGlowSpread);
      uniform1f(exactGl, bundle, "uLowerGlowSpread", settings.lowerGlowSpread);
      uniform1f(exactGl, bundle, "uGlowAsymmetry", settings.glowAsymmetry);
    }
    uniform1f(
      exactGl,
      bundle,
      "uPaletteOffset",
      paletteOffsetFor(settings, visualTime),
    );
    if (updateStaticUniforms) {
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
    }
    uniform1f(exactGl, bundle, "uVelocityWidthScale", modifiers.width);
    uniform1f(exactGl, bundle, "uVelocityGlowScale", modifiers.glow);
    uniform1f(
      exactGl,
      bundle,
      "uVelocityReflectionScale",
      modifiers.reflection,
    );
    uniform1f(exactGl, bundle, "uVisibility", modifiers.visibility);
    fillHueMatrix(settings, visualTime, modifiers.hueDegrees);
    exactGl.uniformMatrix3fv(
      bundle.uniforms.uHueMatrix ?? null,
      false,
      hueMatrix,
    );
  };

  const uploadSceneGeometry = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
  ) => {
    if (!exactGl) return;
    const sceneHashes: [number, number, number] = [
      2_166_136_261, 2_166_136_261, 2_166_136_261,
    ];
    let totalFloatCount = 0;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      let sceneHash = sceneHashes[pass]!;
      for (const entry of scene) {
        const count = entry.geometry.segmentCounts[pass] ?? 0;
        entry.segmentOffsets[pass] = totalFloatCount;
        totalFloatCount += count * HERO_PATH_SEGMENT_STRIDE;
        sceneHash = hashString(sceneHash, entry.geometry.id);
        sceneHash = hashMix(sceneHash, entry.geometry.meshRevision);
        sceneHash = hashMix(sceneHash, count);
      }
      sceneHashes[pass] = sceneHash;
    }
    const changed = sceneHashes.some(
      (hash, pass) => resources.uploadedSceneHashes[pass] !== hash,
    );
    if (!changed) return;
    resources.uploadedSceneHashes = sceneHashes;
    if (totalFloatCount <= 0) return;

    let staging = resources.stagingData[0]!;
    staging = ensureFloatCapacity(staging, totalFloatCount);
    resources.stagingData[0] = staging;
    let cursor = 0;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      for (const entry of scene) {
        const count = entry.geometry.segmentCounts[pass] ?? 0;
        const floatCount = count * HERO_PATH_SEGMENT_STRIDE;
        if (floatCount <= 0) continue;
        staging.set(
          entry.geometry.segmentData[pass]!.subarray(0, floatCount),
          cursor,
        );
        cursor += floatCount;
      }
    }

    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[0]!);
    // One orphaning upload covers far, mid, and core geometry. Per-pass
    // offsets still select exactly the same segment records at draw time.
    exactGl.bufferData(
      exactGl.ARRAY_BUFFER,
      staging.subarray(0, totalFloatCount),
      exactGl.STREAM_DRAW,
    );
  };

  const drawUploadedFilament = (
    resources: PathResources,
    bundle: ProgramBundle,
    entry: PreparedFilamentFrame,
    pass: number,
    sourceInstanced: boolean,
  ) => {
    if (!exactGl) return;
    const count = entry.geometry.segmentCounts[pass] ?? 0;
    if (count <= 0) return;
    const quadraturePoints = sourceInstanced
      ? quadraturePointsForPass(entry.settings, pass)
      : 1;
    if (sourceInstanced) {
      const vaoKey = entry.segmentOffsets[pass] * 8 + quadraturePoints;
      let vao = resources.sourceIntegralVaos[pass];
      if (!vao) {
        vao = exactGl.createVertexArray();
        if (!vao) {
          throw new Error("Unable to allocate the source-integral VAO.");
        }
        resources.sourceIntegralVaos[pass] = vao;
      }
      if (resources.sourceIntegralVaoKeys[pass] !== vaoKey) {
        exactGl.bindVertexArray(vao);
        bindIntegralGeometry(
          resources,
          pass,
          bundle,
          entry.segmentOffsets[pass],
          quadraturePoints,
        );
        exactGl.bindVertexArray(null);
        resources.sourceIntegralVaoKeys[pass] = vaoKey;
      }
      exactGl.bindVertexArray(vao);
      exactGl.drawArraysInstanced(
        exactGl.TRIANGLES,
        0,
        HERO_PATH_QUAD_VERTEX_COUNT,
        count * quadraturePoints,
      );
      exactGl.bindVertexArray(null);
      return;
    }
    bindIntegralGeometry(
      resources,
      pass,
      bundle,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count * quadraturePoints,
    );
  };

  const clearIntegralPass = (
    resources: PathResources,
    pass: number,
    framebuffers: PathResources["framebuffers"] = resources.framebuffers,
  ) => {
    if (!exactGl) return;
    exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, framebuffers[pass]!);
    exactGl.viewport(
      0,
      0,
      resources.passWidths[pass]!,
      resources.passHeights[pass]!,
    );
    exactGl.clearBufferfv(exactGl.COLOR, 0, zeroFloat4);
    if (pass < HERO_PATH_PASS_CORE)
      exactGl.clearBufferfv(exactGl.COLOR, 1, zeroFloat4);
  };

  const shouldSplitFlatDots = (settings: Settings) =>
    settings.motionMode === "anchored" &&
    settings.dotsEnabled &&
    settings.dotMode === "flat" &&
    settings.dotOpacity > 0.000001 &&
    settings.dotSpacing > 0.000001;

  const flatDotPointerBounds = (settings: Settings) => {
    if (!settings.dotInteraction.enabled || !pointerState.dotPointerActive) {
      return null;
    }
    const radius = settings.dotInteraction.radius * resourceState.dpr;
    const centerX = pointerState.dotPointerX * resourceState.canvasWidth;
    const centerY = pointerState.dotPointerY * resourceState.canvasHeight;
    const left = Math.max(0, Math.floor(centerX - radius));
    const bottom = Math.max(0, Math.floor(centerY - radius));
    const right = Math.min(
      resourceState.canvasWidth,
      Math.ceil(centerX + radius),
    );
    const top = Math.min(
      resourceState.canvasHeight,
      Math.ceil(centerY + radius),
    );
    return right > left && top > bottom ? { left, bottom, right, top } : null;
  };

  const preflightPathPrograms = (
    resources: PathResources,
    root: Settings,
    scene: readonly PreparedFilamentFrame[],
    temporalActive: boolean,
  ) => {
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      let needsIntegral = false;
      let needsSourceIntegral = false;
      for (const entry of scene) {
        if ((entry.geometry.segmentCounts[pass] ?? 0) <= 0) continue;
        if (shouldUseSourceInstancedQuadrature(entry.settings)) {
          needsSourceIntegral = true;
        } else {
          needsIntegral = true;
        }
      }
      if (needsIntegral) {
        ensurePathIntegralProgram(resources, pass, false);
      }
      if (needsSourceIntegral) {
        ensurePathIntegralProgram(resources, pass, true);
      }
    }
    const splitFlatDots = shouldSplitFlatDots(root);
    ensurePathCompositeProgram(resources, temporalActive, splitFlatDots);
    if (!splitFlatDots) return;
    ensurePathDotsProgram(resources, false);
    if (flatDotPointerBounds(root)) {
      ensurePathDotsProgram(resources, true);
    }
  };

  const applyFlatDotUniforms = (bundle: ProgramBundle, settings: Settings) => {
    if (!exactGl) return;
    uniform2f(
      exactGl,
      bundle,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1f(exactGl, bundle, "uTime", getClockTime());
    uniform1i(exactGl, bundle, "uFarReflection", 1);
    uniform1i(exactGl, bundle, "uMidReflection", 3);
    uniform1i(exactGl, bundle, "uDotMask", 5);
    uniform1f(
      exactGl,
      bundle,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(exactGl, bundle, "uDotR", 1.1 * resourceState.dpr);
    uniform1f(exactGl, bundle, "uDotAlpha", settings.dotOpacity);
    uniform1f(exactGl, bundle, "uTwinkle", settings.twinkle);
    uniform1f(exactGl, bundle, "uReflect", settings.reflect);
    uniform1f(
      exactGl,
      bundle,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(exactGl, bundle, settings);
  };

  const drawSplitFlatDots = (resources: PathResources, settings: Settings) => {
    if (!exactGl || !shouldSplitFlatDots(settings)) return;
    const spacing = Math.max(settings.dotSpacing * resourceState.dpr, 1);
    const columns = Math.max(1, Math.ceil(resourceState.canvasWidth / spacing));
    const rows = Math.max(1, Math.ceil(resourceState.canvasHeight / spacing));

    exactGl.enable(exactGl.BLEND);
    exactGl.blendEquation(exactGl.FUNC_ADD);
    if (settings.theme === "light") {
      exactGl.blendFunc(exactGl.SRC_ALPHA, exactGl.ONE_MINUS_SRC_ALPHA);
    } else {
      exactGl.blendFuncSeparate(
        exactGl.ONE,
        exactGl.ONE,
        exactGl.ZERO,
        exactGl.ONE,
      );
    }

    const idleDotsProgram = ensurePathDotsProgram(resources, false);
    activateProgram(idleDotsProgram.program);
    applyFlatDotUniforms(idleDotsProgram, settings);
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      columns * rows,
    );

    const pointerBounds = flatDotPointerBounds(settings);
    if (pointerBounds) {
      const pointerDotsProgram = ensurePathDotsProgram(resources, true);
      activateProgram(pointerDotsProgram.program);
      bindFullscreen(pointerDotsProgram);
      applyFlatDotUniforms(pointerDotsProgram, settings);
      exactGl.enable(exactGl.SCISSOR_TEST);
      exactGl.scissor(
        pointerBounds.left,
        pointerBounds.bottom,
        pointerBounds.right - pointerBounds.left,
        pointerBounds.top - pointerBounds.bottom,
      );
      exactGl.drawArrays(exactGl.TRIANGLES, 0, 3);
      exactGl.disable(exactGl.SCISSOR_TEST);
    }
    exactGl.disable(exactGl.BLEND);
  };

  const compositePath = (
    resources: PathResources,
    settings: Settings,
    temporalMix = 0,
    temporalActive = false,
  ) => {
    if (!exactGl) return;
    updateMaskTexture(settings);
    updateBackgroundImage(settings);
    bindSceneTarget(settings);
    exactGl.viewport(
      0,
      0,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    exactGl.disable(exactGl.BLEND);
    bindCompositeTextures(resources, temporalActive);
    const splitFlatDots = shouldSplitFlatDots(settings);
    const compositeProgram = ensurePathCompositeProgram(
      resources,
      temporalActive,
      splitFlatDots,
    );
    activateProgram(compositeProgram.program);
    bindFullscreen(compositeProgram);
    uniform2f(
      exactGl,
      compositeProgram,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1i(exactGl, compositeProgram, "uFarWave", 0);
    uniform1i(exactGl, compositeProgram, "uFarReflection", 1);
    uniform1i(exactGl, compositeProgram, "uMidWave", 2);
    uniform1i(exactGl, compositeProgram, "uMidReflection", 3);
    uniform1i(exactGl, compositeProgram, "uCoreWave", 4);
    if (temporalActive) {
      uniform1i(exactGl, compositeProgram, "uFarWaveNext", 7);
      uniform1i(exactGl, compositeProgram, "uFarReflectionNext", 8);
      uniform1i(exactGl, compositeProgram, "uMidWaveNext", 9);
      uniform1i(exactGl, compositeProgram, "uMidReflectionNext", 10);
      uniform1i(exactGl, compositeProgram, "uCoreWaveNext", 11);
      uniform1f(exactGl, compositeProgram, "uTemporalMix", temporalMix);
    }
    uniform1i(exactGl, compositeProgram, "uDotMask", 5);
    exactGl.activeTexture(exactGl.TEXTURE6);
    exactGl.bindTexture(exactGl.TEXTURE_2D, backgroundTexture);
    uniform1i(exactGl, compositeProgram, "uBackgroundImage", 6);
    uniform1f(
      exactGl,
      compositeProgram,
      "uBackgroundOpacity",
      settings.backgroundImage.opacity,
    );
    uniform1f(exactGl, compositeProgram, "uTime", getClockTime());
    uniform1f(
      exactGl,
      compositeProgram,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(exactGl, compositeProgram, "uDotR", 1.1 * resourceState.dpr);
    uniform1f(
      exactGl,
      compositeProgram,
      "uDotAlpha",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.dotOpacity
        : 0,
    );
    uniform1f(exactGl, compositeProgram, "uTwinkle", settings.twinkle);
    uniform1f(
      exactGl,
      compositeProgram,
      "uReflect",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.reflect
        : 0,
    );
    uniform1f(
      exactGl,
      compositeProgram,
      "uNoisePhase",
      (getClockTime() % 1) * 61.7,
    );
    uniform1f(
      exactGl,
      compositeProgram,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(exactGl, compositeProgram, settings);
    exactGl.drawArrays(exactGl.TRIANGLES, 0, 3);
    if (splitFlatDots) drawSplitFlatDots(resources, settings);
  };

  const renderPreparedPathBank = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
    framebuffers: PathResources["framebuffers"],
    visualTimeOverride: number | null,
  ) => {
    if (!exactGl) return;
    exactGl.enable(exactGl.BLEND);
    exactGl.blendEquation(exactGl.FUNC_ADD);
    exactGl.blendFunc(exactGl.ONE, exactGl.ONE);
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      clearIntegralPass(resources, pass, framebuffers);
      let activeProgram: WebGLProgram | null = null;
      for (const entry of scene) {
        if ((entry.geometry.segmentCounts[pass] ?? 0) <= 0) continue;
        const sourceInstanced = shouldUseSourceInstancedQuadrature(
          entry.settings,
        );
        const bundle = ensurePathIntegralProgram(
          resources,
          pass,
          sourceInstanced,
        );
        if (activeProgram !== bundle.program) {
          activateProgram(bundle.program);
          activeProgram = bundle.program;
        }
        applyIntegralUniforms(
          resources,
          bundle,
          entry.settings,
          entry.style,
          entry.modifiers,
          visualTimeOverride ?? entry.visualTime,
          pass,
          entry.geometry.closed,
          entry.followBlend,
        );
        drawUploadedFilament(resources, bundle, entry, pass, sourceInstanced);
      }
    }
    exactGl.disable(exactGl.BLEND);
  };

  const anchoredSceneIsStable = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
  ) => {
    const entry = scene[0];
    if (!entry || pointerState.dotPointerActive) {
      temporalSceneStability.delete(resources);
      return false;
    }
    const modifiers = entry.modifiers;
    const key = [
      resources.uploadedSceneHashes[0],
      resources.uploadedSceneHashes[1],
      resources.uploadedSceneHashes[2],
      entry.followBlend,
      modifiers.width,
      modifiers.glow,
      modifiers.reflection,
      modifiers.intensity,
      modifiers.hueDegrees,
      modifiers.visibility,
    ].join("|");
    const previous = temporalSceneStability.get(resources);
    if (!previous || previous.key !== key) {
      temporalSceneStability.set(resources, { key, stableFrames: 1 });
      return false;
    }
    previous.stableFrames = Math.min(previous.stableFrames + 1, 3);
    return previous.stableFrames >= 2;
  };

  const temporalPathSettingsKey = (
    resources: PathResources,
    root: Settings,
    scene: readonly PreparedFilamentFrame[],
  ) => {
    if (!isInitialFramePresented()) {
      temporalSceneStability.delete(resources);
      return null;
    }
    const common =
      scene.length === 1 &&
      root.pathMode === "custom" &&
      root.segmentLength >= 0.999 &&
      root.quality.quadrature >= 2 &&
      !root.propagation.enabled &&
      !root.musicVisualizer.enabled &&
      !root.filamentInteraction.enabled &&
      root.speed > 0.000001 &&
      root.filamentPlaybackRate > 0.000001;
    if (!common) {
      temporalSceneStability.delete(resources);
      return null;
    }
    if (root.motionMode === "travel") {
      temporalSceneStability.delete(resources);
      return hasConditionalFollow(root)
        ? null
        : temporalHeroSettingsKey(resources, root, scene);
    }
    const stable =
      root.motionMode === "anchored" &&
      root.quality.quadrature >= 4 &&
      root.headTaper <= 0.001001 &&
      anchoredSceneIsStable(resources, scene);
    if (!stable) return null;
    const settingsKey = temporalHeroSettingsKey(resources, root, scene);
    if (!temporalHeroCacheIdentityChanged(resources, scene, settingsKey)) {
      return settingsKey;
    }
    const currentTime = scene[0]?.visualTime;
    if (currentTime === undefined) return null;
    const visualStep = Math.max(
      Math.abs(root.speed * root.filamentPlaybackRate) / 10,
      1 / 240,
    );
    return isTemporalPathBootstrapAligned(currentTime, visualStep)
      ? settingsKey
      : null;
  };

  const swapTemporalPathBanks = (resources: PathResources) => {
    const temporalTargets = resources.temporalTargets;
    if (!temporalTargets) {
      throw new Error("Temporal path targets have not been allocated.");
    }
    [resources.framebuffers, temporalTargets.framebuffers] = [
      temporalTargets.framebuffers,
      resources.framebuffers,
    ];
    [resources.waveTextures, temporalTargets.waveTextures] = [
      temporalTargets.waveTextures,
      resources.waveTextures,
    ];
    [resources.reflectionTextures, temporalTargets.reflectionTextures] = [
      temporalTargets.reflectionTextures,
      resources.reflectionTextures,
    ];
  };

  const temporalHeroSettingsKey = (
    resources: PathResources,
    root: Settings,
    scene: readonly PreparedFilamentFrame[],
  ) => {
    const entry = scene[0];
    if (!entry) return "";
    const bounds = root.profileBounds;
    const material = root.material;
    const modifiers = entry.modifiers;
    return [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      root.motionMode,
      root.timeOffset,
      root.filamentPlaybackRate,
      root.speed,
      root.curveTravel,
      root.segmentLength,
      root.tailTaper,
      root.headTaper,
      root.closedLoopTaper ? 1 : 0,
      root.glow,
      root.upperGlowSpread,
      root.lowerGlowSpread,
      root.glowAsymmetry,
      root.intensity,
      root.colorSpeed,
      root.paletteWrap,
      root.hue,
      root.hueDrift,
      root.quality.quadrature,
      bounds.maximumGlow,
      bounds.maximumWidth,
      bounds.maximumUpperGlowSpread,
      bounds.maximumLowerGlowSpread,
      material.atmosphere,
      material.broad,
      material.body,
      material.ridge,
      material.core,
      material.veil,
      material.exposure,
      material.saturation,
      entry.geometry.closed ? 1 : 0,
      entry.followBlend,
      modifiers.width,
      modifiers.glow,
      modifiers.reflection,
      modifiers.intensity,
      modifiers.hueDegrees,
      modifiers.visibility,
      resources.uploadedSceneHashes[0],
      resources.uploadedSceneHashes[1],
      resources.uploadedSceneHashes[2],
    ].join("|");
  };

  const temporalHeroCacheIdentityChanged = (
    resources: PathResources,
    scene: readonly PreparedFilamentFrame[],
    settingsKey: string,
  ) => {
    const entry = scene[0];
    return (
      resources.temporalSettingsKey !== settingsKey ||
      resources.temporalPaletteTexture !== (entry?.style.palette ?? null) ||
      resources.temporalProfilesTexture !== (entry?.style.profiles ?? null) ||
      resources.temporalSizeRevision !== resourceState.sizeRevision
    );
  };

  const updateTemporalHeroCache = (
    resources: PathResources,
    root: Settings,
    scene: readonly PreparedFilamentFrame[],
    settingsKey: string,
  ) => {
    const temporalTargets = resources.temporalTargets;
    if (!temporalTargets) {
      throw new Error("Temporal path targets have not been allocated.");
    }
    const currentTime = scene[0]?.visualTime ?? 0;
    const temporalAnchorRateHz = root.motionMode === "anchored" ? 10 : 15;
    const visualStep = Math.max(
      Math.abs(root.speed * root.filamentPlaybackRate) / temporalAnchorRateHz,
      1 / 240,
    );
    const entry = scene[0];
    const settingsChanged = temporalHeroCacheIdentityChanged(
      resources,
      scene,
      settingsKey,
    );
    const anchorIndex = selectTemporalPathAnchorIndex(
      currentTime,
      visualStep,
      settingsChanged,
      root.motionMode,
    );

    const commitCacheIdentity = () => {
      resources.temporalAnchorIndex = anchorIndex;
      resources.temporalSettingsReference = root;
      resources.temporalSettingsKey = settingsKey;
      resources.temporalPaletteTexture = entry?.style.palette ?? null;
      resources.temporalProfilesTexture = entry?.style.profiles ?? null;
      resources.temporalSizeRevision = resourceState.sizeRevision;
    };

    const cacheAction = selectTemporalPathCacheAction(
      resources.temporalAnchorIndex,
      anchorIndex,
      resources.temporalSecondBankReady,
      settingsChanged,
    );
    if (cacheAction === "render-primary") {
      renderPreparedPathBank(
        resources,
        scene,
        resources.framebuffers,
        anchorIndex * visualStep,
      );
      commitCacheIdentity();
      resources.temporalSecondBankReady = false;
      return { mix: 0, ready: false };
    }

    if (cacheAction === "render-secondary") {
      renderPreparedPathBank(
        resources,
        scene,
        temporalTargets.framebuffers,
        (anchorIndex + 1) * visualStep,
      );
      resources.temporalSecondBankReady = true;
    } else if (cacheAction === "swap-render-secondary") {
      swapTemporalPathBanks(resources);
      resources.temporalAnchorIndex = anchorIndex;
      renderPreparedPathBank(
        resources,
        scene,
        temporalTargets.framebuffers,
        (anchorIndex + 1) * visualStep,
      );
    }
    return {
      mix: Math.max(
        0,
        Math.min(1, (currentTime - anchorIndex * visualStep) / visualStep),
      ),
      ready: true,
    };
  };

  const drawUnavailablePath = (settings: Settings) => {
    bindSceneTarget(settings);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    if (settings.theme === "light") gl.clearColor(1, 1, 1, 1);
    else gl.clearColor(0.008, 0.011, 0.016, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const drawPathScene = (
    root: Settings,
    scene: readonly Settings[],
    frameDelta: number,
  ) => {
    const resources = ensurePathResources(root);
    if (!resources || !exactGl) {
      drawUnavailablePath(root);
      return;
    }
    try {
      allocatePathTargets(resources, root);
    } catch (error) {
      failPathResources(resources, error);
      drawUnavailablePath(root);
      return;
    }
    preparedSceneFrames.length = scene.length;
    for (let index = 0; index < scene.length; index++) {
      const settings = scene[index]!;
      const visualTime = localVisualTime(settings);
      const geometry = updateGeometryState(settings, visualTime, frameDelta);
      const rawFollowBlend =
        settings.pathMode === "follow"
          ? 1
          : hasConditionalFollow(settings)
            ? settings.follow.transitionDuration > 0
              ? (geometry.followState?.sourceBlend ?? 0)
              : geometry.followState
                ? 1
                : 0
            : 0;
      const followBlend =
        rawFollowBlend * rawFollowBlend * (3 - 2 * rawFollowBlend);
      let entry = preparedSceneFrames[index];
      if (!entry) {
        entry = {
          settings,
          visualTime,
          geometry: geometry.state,
          followBlend,
          style: getStyleTextures(settings),
          modifiers: createRuntimeModifiers(),
          segmentOffsets: [0, 0, 0],
        };
        preparedSceneFrames[index] = entry;
      } else {
        entry.settings = settings;
        entry.visualTime = visualTime;
        entry.geometry = geometry.state;
        entry.followBlend = followBlend;
        entry.style = getStyleTextures(settings);
      }
      combineRuntimeModifiers(
        followModifiers(settings, geometry.followState, followModifierScratch),
        musicModifiers(settings, musicModifierScratch),
        entry.modifiers,
      );
    }
    uploadSceneGeometry(resources, preparedSceneFrames);
    const temporalSettingsKey = temporalPathSettingsKey(
      resources,
      root,
      preparedSceneFrames,
    );
    const temporalActive = temporalSettingsKey !== null;
    try {
      if (temporalActive) {
        ensureTemporalPathTargets(resources);
        preflightPathPrograms(resources, root, preparedSceneFrames, false);
        preflightPathPrograms(resources, root, preparedSceneFrames, true);
      } else {
        preflightPathPrograms(resources, root, preparedSceneFrames, false);
      }
    } catch (error) {
      failPathResources(resources, error);
      drawUnavailablePath(root);
      return;
    }
    reportPathResourcesReady(resources);
    if (temporalActive) {
      const temporalCache = updateTemporalHeroCache(
        resources,
        root,
        preparedSceneFrames,
        temporalSettingsKey,
      );
      compositePath(resources, root, temporalCache.mix, temporalCache.ready);
      return;
    }
    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;
    resources.temporalSecondBankReady = false;
    resources.temporalSettingsReference = null;
    resources.temporalSettingsKey = "";
    resources.temporalPaletteTexture = null;
    resources.temporalProfilesTexture = null;
    resources.temporalSizeRevision = -1;
    renderPreparedPathBank(
      resources,
      preparedSceneFrames,
      resources.framebuffers,
      null,
    );
    compositePath(resources, root);
  };

  return { drawPathScene };
}
