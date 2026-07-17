import type { Settings } from "../config/settings";

import { uniform1f, uniform1i, uniform2f } from "../rendering/webgl-resources";

import { paletteWrapUniform } from "../runtime/state";

import type { DrawControllerOptions } from "./draw-types";
import type { createDrawCommon } from "./draw-common";
import type { createGlassTerrainRenderer } from "./glass-terrain-renderer";

export function createSineRenderer(
  {
    gl,
    exactGl,
    resourceState,
    sineProgram,
    glowTexture0,
    glowTexture1,
    maskTexture,
    backgroundTexture,
    hueMatrix,
    musicModifierScratch,
    getStyleTextures,
    updateBackgroundImage,
    activateProgram,
    reportStatus,
    resourceManager,
    musicController,
  }: DrawControllerOptions,
  common: ReturnType<typeof createDrawCommon>,
  glassTerrain: ReturnType<typeof createGlassTerrainRenderer>,
) {
  const {
    updateMaskTexture,
    bindFullscreen,
    localVisualTime,
    paletteOffsetFor,
    fillHueMatrix,
  } = common;
  const { applyDotInteractionUniforms } = glassTerrain;
  const { bindSceneTarget } = resourceManager;
  const { musicModifiers } = musicController;

  const drawSine = (settings: Settings) => {
    const style = getStyleTextures(settings);
    updateMaskTexture(settings);
    updateBackgroundImage(settings);
    const visualTime = localVisualTime(settings);
    const runtimeModifiers = musicModifiers(settings, musicModifierScratch);
    bindSceneTarget(settings);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    activateProgram(sineProgram.program);
    bindFullscreen(sineProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, style.palette);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture1);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, style.profiles);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    uniform2f(
      gl,
      sineProgram,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1i(gl, sineProgram, "uPalette", 0);
    uniform1i(gl, sineProgram, "uGlowProfile0", 1);
    uniform1i(gl, sineProgram, "uGlowProfile1", 2);
    uniform1i(gl, sineProgram, "uProfiles", 4);
    uniform1i(gl, sineProgram, "uDotMask", 5);
    uniform1i(gl, sineProgram, "uBackgroundImage", 6);
    uniform1f(
      gl,
      sineProgram,
      "uBackgroundOpacity",
      settings.backgroundImage.opacity,
    );
    uniform1f(gl, sineProgram, "uTime", visualTime);
    uniform1f(
      gl,
      sineProgram,
      "uBrightness",
      settings.intensity * runtimeModifiers.intensity,
    );
    uniform1f(gl, sineProgram, "uBandHeight", 1 - settings.waveY);
    uniform1f(gl, sineProgram, "uCurveStrength", settings.curveStrength);
    uniform1f(gl, sineProgram, "uCurveScale", settings.curveScale);
    uniform1f(gl, sineProgram, "uCurveFrequency", settings.curveFrequency);
    uniform1f(gl, sineProgram, "uCurveTravel", settings.curveTravel);
    uniform1f(gl, sineProgram, "uCurveMotion", settings.curveMotion);
    uniform1f(
      gl,
      sineProgram,
      "uEnvelopeStationary",
      settings.motionMode === "travel" ? 0 : 1,
    );
    uniform1f(gl, sineProgram, "uStationaryCenter", 0.5);
    uniform1f(
      gl,
      sineProgram,
      "uGeometryAdvanceRatio",
      settings.motionMode === "propagate" && settings.propagation.enabled
        ? 1
        : settings.motionMode === "travel"
          ? settings.pathDrift
          : 0,
    );
    uniform1f(gl, sineProgram, "uSegmentLength", settings.segmentLength);
    uniform1f(gl, sineProgram, "uTailTaper", settings.tailTaper);
    uniform1f(gl, sineProgram, "uHeadTaper", settings.headTaper);
    uniform1f(gl, sineProgram, "uBandSpread", settings.glow);
    uniform1f(gl, sineProgram, "uUpperGlowSpread", settings.upperGlowSpread);
    uniform1f(gl, sineProgram, "uLowerGlowSpread", settings.lowerGlowSpread);
    uniform1f(gl, sineProgram, "uGlowAsymmetry", settings.glowAsymmetry);
    uniform1f(
      gl,
      sineProgram,
      "uPaletteOffset",
      paletteOffsetFor(settings, visualTime),
    );
    uniform1f(
      gl,
      sineProgram,
      "uPaletteWrap",
      paletteWrapUniform(settings.paletteWrap),
    );
    gl.uniform4f(
      sineProgram.uniforms.uMaterialWeights0 ?? null,
      settings.material.atmosphere,
      settings.material.broad,
      settings.material.body,
      settings.material.ridge,
    );
    gl.uniform4f(
      sineProgram.uniforms.uMaterialWeights1 ?? null,
      settings.material.core,
      settings.material.veil,
      settings.material.exposure,
      settings.material.saturation,
    );
    uniform1f(gl, sineProgram, "uVelocityWidthScale", runtimeModifiers.width);
    uniform1f(gl, sineProgram, "uVelocityGlowScale", runtimeModifiers.glow);
    uniform1f(
      gl,
      sineProgram,
      "uVelocityReflectionScale",
      runtimeModifiers.reflection,
    );
    uniform1f(gl, sineProgram, "uVisibility", 1);
    fillHueMatrix(settings, visualTime, runtimeModifiers.hueDegrees);
    gl.uniformMatrix3fv(
      sineProgram.uniforms.uHueMatrix ?? null,
      false,
      hueMatrix,
    );
    uniform1f(
      gl,
      sineProgram,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(gl, sineProgram, "uDotR", 1.1 * resourceState.dpr);
    uniform1f(
      gl,
      sineProgram,
      "uDotAlpha",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.dotOpacity
        : 0,
    );
    uniform1f(gl, sineProgram, "uTwinkle", settings.twinkle);
    uniform1f(
      gl,
      sineProgram,
      "uReflect",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.reflect
        : 0,
    );
    uniform1f(gl, sineProgram, "uNoisePhase", (visualTime % 1) * 61.7);
    uniform1f(
      gl,
      sineProgram,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(gl, sineProgram, settings);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    reportStatus({
      renderer: "sine",
      supported: true,
      webglVersion: exactGl ? 2 : 1,
    });
  };

  return { drawSine };
}
