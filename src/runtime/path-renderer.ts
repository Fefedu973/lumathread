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

export function createPathRenderer(
  {
    gl,
    exactGl,
    resourceState,
    backgroundTexture,
    hueMatrix,
    zeroFloat4,
    preparedSceneFrames,
    followModifierScratch,
    musicModifierScratch,
    getClockTime,
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
    attachIntegralPass,
    ensurePathResources,
    allocatePathTargets,
  } = resourceManager;
  const { updateGeometryState } = geometryController;
  const { musicModifiers, combineRuntimeModifiers } = musicController;
  const { followModifiers } = followController;

  const pathPassProfileRadius = (pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? HERO_PATH_FAR_PROFILE_RADIUS
      : pass === HERO_PATH_PASS_MID
        ? HERO_PATH_MID_PROFILE_RADIUS
        : HERO_PATH_CORE_PROFILE_RADIUS;

  const applyIntegralUniforms = (
    resources: PathResources,
    settings: Settings,
    style: FilamentStyleTextures,
    modifiers: FollowRuntimeModifiers,
    visualTime: number,
    pass: number,
    closed: boolean,
    followBlend: number,
  ) => {
    if (!exactGl) return;
    const bundle = resources.integralPrograms[pass]!;
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
    exactGl.activeTexture(exactGl.TEXTURE0);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.palette);
    exactGl.activeTexture(exactGl.TEXTURE1);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.k0Texture);
    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
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
    uniform1f(exactGl, bundle, "uSupportRadiusPositivePx", positiveRadius);
    uniform1f(exactGl, bundle, "uSupportRadiusNegativePx", negativeRadius);
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
      pass === HERO_PATH_PASS_FAR
        ? Math.min(settings.quality.quadrature, 2)
        : settings.quality.quadrature,
    );
    uniform1f(exactGl, bundle, "uTime", visualTime);
    uniform1f(exactGl, bundle, "uCurveTravel", settings.curveTravel);
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
    uniform1f(
      exactGl,
      bundle,
      "uBrightness",
      settings.intensity * modifiers.intensity,
    );
    uniform1f(exactGl, bundle, "uBandSpread", settings.glow);
    uniform1f(exactGl, bundle, "uUpperGlowSpread", settings.upperGlowSpread);
    uniform1f(exactGl, bundle, "uLowerGlowSpread", settings.lowerGlowSpread);
    uniform1f(exactGl, bundle, "uGlowAsymmetry", settings.glowAsymmetry);
    uniform1f(
      exactGl,
      bundle,
      "uPaletteOffset",
      paletteOffsetFor(settings, visualTime),
    );
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
    pass: number,
  ) => {
    if (!exactGl) return;
    let sceneHash = 2_166_136_261;
    let totalFloatCount = 0;
    for (const entry of scene) {
      const count = entry.geometry.segmentCounts[pass] ?? 0;
      entry.segmentOffsets[pass] = totalFloatCount;
      totalFloatCount += count * HERO_PATH_SEGMENT_STRIDE;
      sceneHash = hashString(sceneHash, entry.geometry.id);
      sceneHash = hashMix(sceneHash, entry.geometry.meshRevision);
      sceneHash = hashMix(sceneHash, count);
    }
    if (resources.uploadedSceneHashes[pass] === sceneHash) return;
    resources.uploadedSceneHashes[pass] = sceneHash;
    if (totalFloatCount <= 0) return;

    let staging = resources.stagingData[pass]!;
    staging = ensureFloatCapacity(staging, totalFloatCount);
    resources.stagingData[pass] = staging;
    let cursor = 0;
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

    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[pass]!);
    // Replacing the data store lets streaming backends avoid waiting for the
    // previous frame to finish reading the same storage.
    exactGl.bufferData(
      exactGl.ARRAY_BUFFER,
      staging.subarray(0, totalFloatCount),
      exactGl.STREAM_DRAW,
    );
  };

  const drawUploadedFilament = (
    resources: PathResources,
    entry: PreparedFilamentFrame,
    pass: number,
  ) => {
    if (!exactGl) return;
    const count = entry.geometry.segmentCounts[pass] ?? 0;
    if (count <= 0) return;
    bindIntegralGeometry(resources, pass, entry.segmentOffsets[pass]);
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count,
    );
  };

  const clearIntegralPass = (resources: PathResources, pass: number) => {
    if (!exactGl) return;
    attachIntegralPass(resources, pass);
    exactGl.clearBufferfv(exactGl.COLOR, 0, zeroFloat4);
    if (pass < HERO_PATH_PASS_CORE)
      exactGl.clearBufferfv(exactGl.COLOR, 1, zeroFloat4);
  };

  const compositePath = (resources: PathResources, settings: Settings) => {
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
    bindCompositeTextures(resources);
    activateProgram(resources.compositeProgram.program);
    bindFullscreen(resources.compositeProgram);
    uniform2f(
      exactGl,
      resources.compositeProgram,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1i(exactGl, resources.compositeProgram, "uFarWave", 0);
    uniform1i(exactGl, resources.compositeProgram, "uFarReflection", 1);
    uniform1i(exactGl, resources.compositeProgram, "uMidWave", 2);
    uniform1i(exactGl, resources.compositeProgram, "uMidReflection", 3);
    uniform1i(exactGl, resources.compositeProgram, "uCoreWave", 4);
    uniform1i(exactGl, resources.compositeProgram, "uDotMask", 5);
    exactGl.activeTexture(exactGl.TEXTURE6);
    exactGl.bindTexture(exactGl.TEXTURE_2D, backgroundTexture);
    uniform1i(exactGl, resources.compositeProgram, "uBackgroundImage", 6);
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uBackgroundOpacity",
      settings.backgroundImage.opacity,
    );
    uniform1f(exactGl, resources.compositeProgram, "uTime", getClockTime());
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uDotR",
      1.1 * resourceState.dpr,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uDotAlpha",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.dotOpacity
        : 0,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uTwinkle",
      settings.twinkle,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uReflect",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.reflect
        : 0,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uNoisePhase",
      (getClockTime() % 1) * 61.7,
    );
    uniform1f(
      exactGl,
      resources.compositeProgram,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(exactGl, resources.compositeProgram, settings);
    exactGl.drawArrays(exactGl.TRIANGLES, 0, 3);
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
    allocatePathTargets(resources, root);
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
    exactGl.enable(exactGl.BLEND);
    exactGl.blendEquation(exactGl.FUNC_ADD);
    exactGl.blendFunc(exactGl.ONE, exactGl.ONE);
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      activateProgram(resources.integralPrograms[pass]!.program);
      clearIntegralPass(resources, pass);
      uploadSceneGeometry(resources, preparedSceneFrames, pass);
      for (const entry of preparedSceneFrames) {
        if ((entry.geometry.segmentCounts[pass] ?? 0) <= 0) continue;
        applyIntegralUniforms(
          resources,
          entry.settings,
          entry.style,
          entry.modifiers,
          entry.visualTime,
          pass,
          entry.geometry.closed,
          entry.followBlend,
        );
        drawUploadedFilament(resources, entry, pass);
      }
    }
    exactGl.disable(exactGl.BLEND);
    compositePath(resources, root);
  };

  return { drawPathScene };
}
