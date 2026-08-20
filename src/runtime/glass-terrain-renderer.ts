import { clamp } from "../math";
import { evaluateFadeEasing } from "../animation/easing";
import { hexToVec3 } from "../rendering/color";

import type { Settings } from "../config/settings";

import {
  type ProgramBundle,
  type GlassTextResources,
  uniform1f,
  uniform1i,
  uniform2f,
} from "../rendering/webgl-resources";

import {
  HERO_GLASS_SDF_RANGE_CSS_PX,
  HERO_GLASS_MASK_MAX_DIMENSION,
  encodeGlassSignedDistance,
  renderGlassTextMask,
} from "../rendering/glass-mask";

import type { DrawControllerOptions } from "./draw-types";
import type { createDrawCommon } from "./draw-common";

export function createGlassTerrainRenderer(
  {
    gl,
    exactGl,
    resourceState,
    maskTexture,
    pointerState,
    getClockTime,
    getSceneFadeProgress,
    isRunning,
    requestFrame,
    activateProgram,
    resourceManager,
  }: DrawControllerOptions,
  common: ReturnType<typeof createDrawCommon>,
) {
  const { updateMaskTexture, bindFullscreen } = common;
  const {
    ensureTerrainResources,
    updateTerrainGeometry,
    bindSceneTarget,
    glassIsActive,
    ensureGlassResources,
  } = resourceManager;

  const glassStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const compositeStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const blurStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const dotInteractionStaticUniformKeys = new WeakMap<ProgramBundle, string>();

  const updateGlassTextMask = (
    resources: GlassTextResources,
    settings: Settings,
  ) => {
    const maskSettingsKey = [
      settings.glassText.shape,
      settings.glassText.text,
      settings.glassText.svgPath,
      ...settings.glassText.svgViewBox,
      settings.glassText.fontFamily,
      settings.glassText.fontWeight,
      settings.glassText.fontSize,
      settings.glassText.lineHeight,
      settings.glassText.letterSpacing,
      settings.glassText.textAlign,
      settings.glassText.baselineOffset,
      settings.glassText.textWrap,
      settings.glassText.centerX,
      settings.glassText.centerY,
      settings.glassText.maxWidth,
      settings.glassText.maxHeight,
    ].join("\u001f");
    if (
      resources.maskSettingsKey === maskSettingsKey &&
      resources.maskSizeRevision === resourceState.sizeRevision
    ) {
      return;
    }
    const maskScale = Math.min(
      1,
      HERO_GLASS_MASK_MAX_DIMENSION /
        Math.max(resourceState.canvasWidth, resourceState.canvasHeight, 1),
    );
    const maskWidth = Math.max(
      1,
      Math.round(resourceState.canvasWidth * maskScale),
    );
    const maskHeight = Math.max(
      1,
      Math.round(resourceState.canvasHeight * maskScale),
    );
    renderGlassTextMask(
      resources.maskCanvas,
      settings.glassText,
      maskWidth,
      maskHeight,
      resourceState.dpr * maskScale,
    );
    resources.maskBounds = encodeGlassSignedDistance(
      resources.maskCanvas,
      HERO_GLASS_SDF_RANGE_CSS_PX * resourceState.dpr * maskScale,
    );
    resources.maskWidth = maskWidth;
    resources.maskHeight = maskHeight;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, resources.maskTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    if (exactGl) {
      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.RGBA8,
        exactGl.RGBA,
        exactGl.UNSIGNED_BYTE,
        resources.maskCanvas,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        resources.maskCanvas,
      );
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    resources.maskSettingsKey = maskSettingsKey;
    resources.maskSizeRevision = resourceState.sizeRevision;

    const fontRequestKey =
      settings.glassText.shape === "text"
        ? `${settings.glassText.fontWeight}:${settings.glassText.fontSize}:${settings.glassText.fontFamily}`
        : "";
    if (
      settings.glassText.shape === "text" &&
      resources.fontRequestKey !== fontRequestKey &&
      typeof document.fonts?.load === "function"
    ) {
      resources.fontRequestKey = fontRequestKey;
      void document.fonts
        .load(
          `${settings.glassText.fontWeight} ${settings.glassText.fontSize}px ${settings.glassText.fontFamily}`,
          settings.glassText.text,
        )
        .then(() => {
          if (!isRunning() || resourceState.glassResources !== resources)
            return;
          resources.maskSettingsKey = "";
          requestFrame();
        });
    }
  };

  const resolveGlassEffectBounds = (
    resources: GlassTextResources,
    settings: Settings,
  ) => {
    const bounds = resources.maskBounds;
    if (!bounds || resources.maskWidth <= 0 || resources.maskHeight <= 0) {
      return null;
    }
    const scaleX = resourceState.canvasWidth / resources.maskWidth;
    const scaleY = resourceState.canvasHeight / resources.maskHeight;
    const sampleReach = Math.ceil(
      Math.max(scaleX, scaleY) * (2 + Math.max(settings.glassText.bevel, 0)),
    );
    const sparkleReach =
      settings.glassText.twinkle > 0.001
        ? Math.ceil(
            Math.max(
              settings.glassText.twinkleSize * resourceState.dpr * 0.85,
              6,
            ) + 3,
          )
        : 0;
    const padding = sampleReach + sparkleReach;
    const left = Math.max(0, Math.floor(bounds.left * scaleX) - padding);
    const top = Math.max(0, Math.floor(bounds.top * scaleY) - padding);
    const right = Math.min(
      resourceState.canvasWidth,
      Math.ceil(bounds.right * scaleX) + padding,
    );
    const bottom = Math.min(
      resourceState.canvasHeight,
      Math.ceil(bounds.bottom * scaleY) + padding,
    );
    if (right <= left || bottom <= top) return null;
    return {
      x: left,
      y: resourceState.canvasHeight - bottom,
      width: right - left,
      height: bottom - top,
    };
  };

  const applyDotInteractionUniforms = (
    context: WebGLRenderingContext,
    bundle: ProgramBundle,
    settings: Settings,
  ) => {
    const interaction = settings.dotInteraction;
    const active =
      settings.dotsEnabled &&
      interaction.enabled &&
      pointerState.dotPointerActive;
    uniform2f(
      context,
      bundle,
      "uDotPointer",
      pointerState.dotPointerX,
      pointerState.dotPointerY,
    );
    uniform1f(context, bundle, "uDotPointerActive", active ? 1 : 0);

    const pointerColor = hexToVec3(interaction.color);
    const staticKey = [
      resourceState.dpr,
      interaction.radius,
      interaction.softness,
      interaction.brightness,
      pointerColor[0],
      pointerColor[1],
      pointerColor[2],
      interaction.colorStrength,
      interaction.magnification,
      interaction.terrainDisplacement,
    ].join("|");
    if (dotInteractionStaticUniformKeys.get(bundle) === staticKey) return;

    uniform1f(
      context,
      bundle,
      "uDotPointerRadius",
      interaction.radius * resourceState.dpr,
    );
    uniform1f(context, bundle, "uDotPointerSoftness", interaction.softness);
    uniform1f(context, bundle, "uDotPointerBrightness", interaction.brightness);
    context.uniform3f(
      bundle.uniforms.uDotPointerColor ?? null,
      ...pointerColor,
    );
    uniform1f(
      context,
      bundle,
      "uDotPointerColorStrength",
      interaction.colorStrength,
    );
    uniform1f(
      context,
      bundle,
      "uDotPointerMagnification",
      interaction.magnification,
    );
    uniform1f(
      context,
      bundle,
      "uTerrainPointerDisplacement",
      interaction.terrainDisplacement,
    );
    dotInteractionStaticUniformKeys.set(bundle, staticKey);
  };

  const drawTerrainDots = (settings: Settings) => {
    if (!settings.dotsEnabled || settings.dotMode !== "terrain") return;
    const resources = ensureTerrainResources();
    if (!resources) return;
    updateTerrainGeometry(resources, settings.terrainDots);
    updateMaskTexture(settings);
    bindSceneTarget(settings);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    activateProgram(resources.program.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
    const location = resources.program.attributes.aGrid ?? -1;
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    uniform1i(gl, resources.program, "uDotMask", 5);
    uniform2f(
      gl,
      resources.program,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1f(gl, resources.program, "uTime", getClockTime());
    uniform1f(gl, resources.program, "uWidth", settings.terrainDots.width);
    uniform1f(gl, resources.program, "uDepth", settings.terrainDots.depth);
    uniform1f(
      gl,
      resources.program,
      "uAmplitude",
      settings.terrainDots.amplitude,
    );
    uniform1f(
      gl,
      resources.program,
      "uPointSize",
      settings.terrainDots.pointSize,
    );
    uniform1f(gl, resources.program, "uSpeed", settings.terrainDots.speed);
    uniform1f(
      gl,
      resources.program,
      "uViewAngle",
      settings.terrainDots.viewAngle,
    );
    uniform1f(
      gl,
      resources.program,
      "uCameraDistance",
      settings.terrainDots.cameraDistance,
    );
    uniform1f(
      gl,
      resources.program,
      "uFrequency",
      settings.terrainDots.frequency,
    );
    uniform1f(gl, resources.program, "uDpr", resourceState.dpr);
    uniform1f(
      gl,
      resources.program,
      "uFitCover",
      settings.terrainDots.fit === "cover" ? 1 : 0,
    );
    uniform1f(gl, resources.program, "uTwinkle", settings.twinkle);
    uniform1f(gl, resources.program, "uReflect", settings.reflect);
    const low = hexToVec3(settings.terrainDots.colorLow);
    const high = hexToVec3(settings.terrainDots.colorHigh);
    gl.uniform3f(resources.program.uniforms.uColorLow ?? null, ...low);
    gl.uniform3f(resources.program.uniforms.uColorHigh ?? null, ...high);
    uniform1f(gl, resources.program, "uOpacity", settings.terrainDots.opacity);
    uniform1f(
      gl,
      resources.program,
      "uContentFade",
      settings.terrainDots.contentFade,
    );
    uniform1f(
      gl,
      resources.program,
      "uEdgeFade",
      settings.terrainDots.edgeFade,
    );
    uniform1f(
      gl,
      resources.program,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(gl, resources.program, settings);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, resources.pointCount);
    gl.disable(gl.BLEND);
  };

  const blurGlassScene = (
    resources: GlassTextResources,
    settings: Settings,
  ) => {
    const strength = Math.max(
      settings.glassText.blur,
      settings.glassText.frost,
      settings.glassText.diffusion,
    );
    if (strength <= 0.0001) return resources.sceneTexture;

    const drawBlurPass = (
      source: WebGLTexture,
      target: WebGLFramebuffer,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      uniform2f(
        gl,
        resources.blurProgram,
        "uDirection",
        directionX,
        directionY,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    gl.viewport(0, 0, resources.blurWidth, resources.blurHeight);
    gl.disable(gl.BLEND);
    activateProgram(resources.blurProgram.program);
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
    const baseStep =
      0.45 +
      settings.glassText.blur * 1.2 +
      settings.glassText.frost * 1.8 +
      settings.glassText.diffusion * 2.8;
    let source = resources.sceneTexture;
    for (let iteration = 0; iteration < iterations; iteration++) {
      const step = baseStep * (1 + iteration * 0.28);
      drawBlurPass(
        source,
        resources.blurFramebuffers[0],
        step / resources.blurWidth,
        0,
      );
      drawBlurPass(
        resources.blurTextures[0],
        resources.blurFramebuffers[1],
        0,
        step / resources.blurHeight,
      );
      source = resources.blurTextures[1];
    }
    return resources.blurTextures[1];
  };

  const blurGlassEffect = (
    resources: GlassTextResources,
    radiusPhysicalPx: number,
  ) => {
    if (radiusPhysicalPx <= 0.001) return resources.effectTexture;
    const drawPass = (
      source: WebGLTexture,
      target: WebGLFramebuffer,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      uniform2f(
        gl,
        resources.blurProgram,
        "uDirection",
        directionX,
        directionY,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    gl.viewport(0, 0, resources.blurWidth, resources.blurHeight);
    gl.disable(gl.BLEND);
    activateProgram(resources.blurProgram.program);
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
    drawPass(
      resources.effectTexture,
      resources.blurFramebuffers[0],
      normalizedRadius / Math.max(resourceState.canvasWidth, 1),
      0,
    );
    drawPass(
      resources.blurTextures[0],
      resources.blurFramebuffers[1],
      0,
      normalizedRadius / Math.max(resourceState.canvasHeight, 1),
    );
    return resources.blurTextures[1];
  };

  const isFixedDomeGlass = (settings: Settings) => {
    const glass = settings.glassText;
    return (
      glass.surfaceModel === "volumetric" &&
      glass.bevelMode === "dome" &&
      Math.abs(glass.bevel) <= 0.000001 &&
      Math.abs(glass.ribStrength) <= 0.000001 &&
      Math.abs(glass.liquidStrength) <= 0.000001 &&
      Math.abs(glass.distortion) <= 0.000001 &&
      Math.abs(glass.roughness) <= 0.000001 &&
      Math.abs(glass.edgeWrap) <= 0.000001 &&
      Math.abs(glass.magnificationX) <= 0.000001 &&
      Math.abs(glass.magnificationY) <= 0.000001 &&
      Math.abs(glass.displacementX) <= 0.000001 &&
      Math.abs(glass.displacementY) <= 0.000001
    );
  };

  const isSaturatedDiffusionGlass = (settings: Settings) => {
    const glass = settings.glassText;
    const minimumDiffusionMix =
      glass.diffusion * 0.58 +
      glass.blur * 0.34 +
      glass.frost * (0.22 + glass.roughness * 0.36);
    return minimumDiffusionMix >= 1.000001;
  };

  const resolveGlassProgram = (
    resources: GlassTextResources,
    settings: Settings,
  ) => {
    if (!isFixedDomeGlass(settings)) return resources.program;
    return isSaturatedDiffusionGlass(settings)
      ? resources.fixedDomeSaturatedProgram
      : resources.fixedDomeProgram;
  };

  const compositeGlassText = (settings: Settings) => {
    if (!glassIsActive(settings)) {
      resourceState.glassIntroStartedAt = null;
      return;
    }
    if (resourceState.glassIntroStartedAt === null) {
      resourceState.glassIntroStartedAt = getClockTime();
    }
    const introStartedAt = resourceState.glassIntroStartedAt;
    const resources = ensureGlassResources();
    if (!resources) return;
    const glassProgram = resolveGlassProgram(resources, settings);
    updateGlassTextMask(resources, settings);
    const effectBounds = resolveGlassEffectBounds(resources, settings);
    const introElapsedMs = Math.max(
      0,
      (getClockTime() - introStartedAt) * 1000 - settings.glassText.introDelay,
    );
    const introLinear =
      settings.glassText.introDuration <= 0
        ? 1
        : clamp(introElapsedMs / settings.glassText.introDuration, 0, 1);
    const introProgress = evaluateFadeEasing(
      introLinear,
      settings.glassText.introEasing,
    );
    const blurredScene = blurGlassScene(resources, settings);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.effectFramebuffer);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    activateProgram(glassProgram.program);
    bindFullscreen(glassProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, resources.maskTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredScene);
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
      settings.glassText.tint,
      settings.glassText.tintStrength,
      settings.glassText.saturation,
      settings.glassText.brightness,
      settings.glassText.opacity,
    ].join("|");
    const updateGlassStaticUniforms =
      glassStaticUniformKeys.get(glassProgram) !== glassStaticKey;
    if (updateGlassStaticUniforms) {
      uniform1i(gl, glassProgram, "uScene", 0);
      uniform1i(gl, glassProgram, "uTextMask", 1);
      uniform1i(gl, glassProgram, "uBlurScene", 2);
      uniform2f(
        gl,
        glassProgram,
        "uRes",
        resourceState.canvasWidth,
        resourceState.canvasHeight,
      );
      uniform1f(
        gl,
        glassProgram,
        "uRefraction",
        settings.glassText.refraction * resourceState.dpr,
      );
      uniform1f(
        gl,
        glassProgram,
        "uEdgeWrap",
        settings.glassText.edgeWrap * resourceState.dpr,
      );
      uniform1f(
        gl,
        glassProgram,
        "uSurfaceModel",
        settings.glassText.surfaceModel === "volumetric" ? 1 : 0,
      );
      uniform1f(
        gl,
        glassProgram,
        "uBevelMode",
        settings.glassText.bevelMode === "dome" ? 1 : 0,
      );
      uniform1f(
        gl,
        glassProgram,
        "uSurfaceDepth",
        settings.glassText.surfaceDepth * resourceState.dpr,
      );
      uniform1f(gl, glassProgram, "uIor", settings.glassText.ior);
      uniform2f(
        gl,
        glassProgram,
        "uMagnification",
        settings.glassText.magnificationX,
        settings.glassText.magnificationY,
      );
      uniform2f(
        gl,
        glassProgram,
        "uDisplacement",
        settings.glassText.displacementX * resourceState.dpr,
        settings.glassText.displacementY * resourceState.dpr,
      );
      uniform1f(gl, glassProgram, "uDiffusion", settings.glassText.diffusion);
      uniform1f(
        gl,
        glassProgram,
        "uSdfRange",
        HERO_GLASS_SDF_RANGE_CSS_PX * resourceState.dpr,
      );
      uniform1f(gl, glassProgram, "uBlur", settings.glassText.blur);
      uniform1f(
        gl,
        glassProgram,
        "uMicroDistortion",
        settings.glassText.distortion,
      );
      uniform1f(
        gl,
        glassProgram,
        "uChromaticAberration",
        settings.glassText.chromaticAberration * resourceState.dpr,
      );
      uniform1f(gl, glassProgram, "uFrost", settings.glassText.frost);
      uniform1f(gl, glassProgram, "uRoughness", settings.glassText.roughness);
      uniform1f(gl, glassProgram, "uBevel", settings.glassText.bevel);
      uniform1f(
        gl,
        glassProgram,
        "uRibStrength",
        settings.glassText.ribStrength,
      );
      uniform1f(
        gl,
        glassProgram,
        "uRibWidth",
        settings.glassText.ribWidth * resourceState.dpr,
      );
      uniform1f(gl, glassProgram, "uRibAngle", settings.glassText.ribAngle);
      uniform1f(
        gl,
        glassProgram,
        "uLiquidStrength",
        settings.glassText.liquidStrength,
      );
      uniform1f(
        gl,
        glassProgram,
        "uLiquidScale",
        settings.glassText.liquidScale,
      );
      uniform1f(
        gl,
        glassProgram,
        "uLiquidSpeed",
        settings.glassText.liquidSpeed,
      );
      uniform1f(
        gl,
        glassProgram,
        "uEdgeStrength",
        settings.glassText.edgeStrength,
      );
      uniform1f(gl, glassProgram, "uSpecular", settings.glassText.specular);
      uniform1f(gl, glassProgram, "uFresnel", settings.glassText.fresnel);
      uniform1f(gl, glassProgram, "uTwinkle", settings.glassText.twinkle);
      uniform1f(
        gl,
        glassProgram,
        "uTwinkleDensity",
        settings.glassText.twinkleDensity,
      );
      uniform1f(
        gl,
        glassProgram,
        "uTwinkleSpeed",
        settings.glassText.twinkleSpeed,
      );
      uniform1f(
        gl,
        glassProgram,
        "uTwinkleSize",
        settings.glassText.twinkleSize * resourceState.dpr,
      );
      const tint = hexToVec3(settings.glassText.tint);
      gl.uniform3f(glassProgram.uniforms.uTint ?? null, ...tint);
      uniform1f(
        gl,
        glassProgram,
        "uTintStrength",
        settings.glassText.tintStrength,
      );
      uniform1f(gl, glassProgram, "uSaturation", settings.glassText.saturation);
      uniform1f(gl, glassProgram, "uBrightness", settings.glassText.brightness);
      uniform1f(gl, glassProgram, "uOpacity", settings.glassText.opacity);
      glassStaticUniformKeys.set(glassProgram, glassStaticKey);
    }
    uniform1f(gl, glassProgram, "uTime", getClockTime());
    if (effectBounds) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }

    const introBlurPhysicalPx =
      settings.glassText.introBlur * resourceState.dpr * (1 - introProgress);
    const blurredEffect = blurGlassEffect(resources, introBlurPhysicalPx);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    activateProgram(resources.compositeProgram.program);
    bindFullscreen(resources.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, resources.effectTexture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredEffect);
    const compositeStaticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
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
      compositeStaticUniformKeys.set(
        resources.compositeProgram,
        compositeStaticKey,
      );
    }
    uniform1f(
      gl,
      resources.compositeProgram,
      "uSceneOpacity",
      settings.fadeInAffectsGlassText ? 1 : getSceneFadeProgress(),
    );
    uniform1f(gl, resources.compositeProgram, "uProgress", introProgress);
    uniform1f(
      gl,
      resources.compositeProgram,
      "uBlurMix",
      introBlurPhysicalPx > 0.001 ? clamp((1 - introProgress) * 2, 0, 1) : 0,
    );
    uniform1f(
      gl,
      resources.compositeProgram,
      "uOffsetY",
      settings.glassText.introOffsetY * resourceState.dpr,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return { applyDotInteractionUniforms, drawTerrainDots, compositeGlassText };
}
