import {
  FULLSCREEN_VERTEX_SHADER,
  GLASS_BLUR_FRAGMENT_SHADER,
  GLASS_COMPOSITE_FRAGMENT_SHADER,
  GLASS_TEXT_FRAGMENT_SHADER,
  GLASS_TEXT_FIXED_DOME_FRAGMENT_SHADER,
  GLASS_TEXT_FIXED_DOME_SATURATED_FRAGMENT_SHADER,
  TERRAIN_DOTS_FRAGMENT_SHADER,
  TERRAIN_DOTS_VERTEX_SHADER,
} from "../rendering/shaders";
import {
  FULLSCREEN_VERTEX_SHADER_300,
  PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
  PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,
  PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER,
  PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER,
  PATH_DOTS_IDLE_VERTEX_SHADER,
  PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER,
  PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER,
  PATH_INTEGRAL_FRAGMENT_SHADERS,
  PATH_INTEGRAL_VERTEX_SHADER,
  PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS,
  PATH_SOURCE_INTEGRAL_VERTEX_SHADER,
} from "../rendering/path-shaders";
import type { HeroWaveRendererStatus } from "../types";
import { clamp } from "../math";

import {
  HERO_PATH_PASS_CORE,
  HERO_PATH_PASS_COUNT,
  HERO_PATH_K0_LUT_WIDTH,
  type ResolvedTerrainDots,
  type ResolvedBackgroundImage,
  type Settings,
} from "../config/settings";

import { getPathK0TextureData } from "../rendering/profile-textures";

import {
  type ProgramBundle,
  type TerrainDotsResources,
  type GlassTextResources,
  TERRAIN_DOTS_UNIFORMS,
  GLASS_TEXT_UNIFORMS,
  GLASS_BLUR_UNIFORMS,
  GLASS_COMPOSITE_UNIFORMS,
  type PathResources,
  type PathTargetBank,
  PATH_INTEGRAL_UNIFORMS,
  PATH_INTEGRAL_COMPOSITE_UNIFORMS,
  createProgramBundle,
  createTexture,
} from "../rendering/webgl-resources";

export interface HeroWaveResourceState {
  pathResources: PathResources | null | undefined;
  terrainResources: TerrainDotsResources | null | undefined;
  glassResources: GlassTextResources | null | undefined;
  glassIntroStartedAt: number | null;
  pathRendererErrorLogged: boolean;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  sizeRevision: number;
  maskHash: number;
  maskSizeRevision: number;
  maskSettingsReference: Settings | null;
  backgroundCanvas: HTMLCanvasElement;
  backgroundImageElement: HTMLImageElement | null;
  backgroundImageSource: string;
  backgroundImageFit: ResolvedBackgroundImage["fit"] | "";
  backgroundImageSizeRevision: number;
  backgroundImageRequest: number;
}

export interface ResourceManagerOptions {
  gl: WebGLRenderingContext;
  exactGl: WebGL2RenderingContext | null;
  resourceState: HeroWaveResourceState;
  withPrecision: (source: string) => string;
  reportError: (error: unknown, prefix: string) => void;
  reportStatus: (status: HeroWaveRendererStatus) => void;
}

export function createResourceManager({
  gl,
  exactGl,
  resourceState,
  withPrecision,
  reportError,
  reportStatus,
}: ResourceManagerOptions) {
  const destroyTerrainResources = (resources: TerrainDotsResources | null) => {
    if (!resources) return;
    gl.deleteProgram(resources.program.program);
    gl.deleteBuffer(resources.buffer);
  };

  const ensureTerrainResources = () => {
    if (resourceState.terrainResources !== undefined)
      return resourceState.terrainResources;
    let program: ProgramBundle | null = null;
    let buffer: WebGLBuffer | null = null;
    try {
      program = createProgramBundle(
        gl,
        TERRAIN_DOTS_VERTEX_SHADER,
        withPrecision(TERRAIN_DOTS_FRAGMENT_SHADER),
        ["aGrid"],
        TERRAIN_DOTS_UNIFORMS,
      );
      buffer = gl.createBuffer();
      if (!buffer)
        throw new Error("Unable to allocate the terrain grid buffer.");
      resourceState.terrainResources = {
        program,
        buffer,
        columns: 0,
        rows: 0,
        pointCount: 0,
      };
    } catch (error) {
      reportError(error, "HeroWaveBackground terrain dots renderer");
      if (program) gl.deleteProgram(program.program);
      if (buffer) gl.deleteBuffer(buffer);
      resourceState.terrainResources = null;
    }
    return resourceState.terrainResources;
  };

  const updateTerrainGeometry = (
    resources: TerrainDotsResources,
    settings: ResolvedTerrainDots,
  ) => {
    const rows = settings.rows;
    const columns =
      settings.fit === "cover"
        ? Math.round(
            clamp(
              rows *
                (resourceState.canvasWidth /
                  Math.max(resourceState.canvasHeight, 1)),
              8,
              320,
            ),
          )
        : settings.columns;
    if (resources.columns === columns && resources.rows === rows) {
      return;
    }
    const points = new Float32Array(columns * rows * 2);
    let cursor = 0;
    for (let row = 0; row < rows; row++) {
      const y = row / Math.max(rows - 1, 1);
      for (let column = 0; column < columns; column++) {
        points[cursor++] = column / Math.max(columns - 1, 1);
        points[cursor++] = y;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    resources.columns = columns;
    resources.rows = rows;
    resources.pointCount = columns * rows;
  };

  const destroyGlassResources = (resources: GlassTextResources | null) => {
    if (!resources) return;
    gl.deleteProgram(resources.program.program);
    gl.deleteProgram(resources.fixedDomeProgram.program);
    gl.deleteProgram(resources.fixedDomeSaturatedProgram.program);
    gl.deleteProgram(resources.blurProgram.program);
    gl.deleteProgram(resources.compositeProgram.program);
    gl.deleteFramebuffer(resources.sceneFramebuffer);
    gl.deleteFramebuffer(resources.effectFramebuffer);
    for (const framebuffer of resources.blurFramebuffers) {
      gl.deleteFramebuffer(framebuffer);
    }
    gl.deleteTexture(resources.sceneTexture);
    gl.deleteTexture(resources.effectTexture);
    gl.deleteTexture(resources.blurTextures[0]);
    gl.deleteTexture(resources.blurTextures[1]);
    gl.deleteTexture(resources.maskTexture);
  };

  const allocateGlassTargets = (resources: GlassTextResources) => {
    if (
      resources.width === resourceState.canvasWidth &&
      resources.height === resourceState.canvasHeight
    ) {
      return false;
    }
    resources.width = resourceState.canvasWidth;
    resources.height = resourceState.canvasHeight;
    resources.blurWidth = Math.max(
      1,
      Math.round(resourceState.canvasWidth * 0.25),
    );
    resources.blurHeight = Math.max(
      1,
      Math.round(resourceState.canvasHeight * 0.25),
    );
    const allocateTexture = (
      texture: WebGLTexture,
      width: number,
      height: number,
    ) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    };
    allocateTexture(
      resources.sceneTexture,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    allocateTexture(
      resources.effectTexture,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    for (const texture of resources.blurTextures) {
      allocateTexture(texture, resources.blurWidth, resources.blurHeight);
    }

    const validateTarget = (
      framebuffer: WebGLFramebuffer,
      texture: WebGLTexture,
      label: string,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Incomplete glass ${label} framebuffer: ${status}`);
      }
    };
    validateTarget(resources.sceneFramebuffer, resources.sceneTexture, "scene");
    validateTarget(
      resources.effectFramebuffer,
      resources.effectTexture,
      "effect",
    );
    validateTarget(
      resources.blurFramebuffers[0],
      resources.blurTextures[0],
      "blur A",
    );
    validateTarget(
      resources.blurFramebuffers[1],
      resources.blurTextures[1],
      "blur B",
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    resources.maskSettingsKey = "";
    resources.maskSizeRevision = -1;
    resources.maskBounds = null;
    return true;
  };

  const ensureGlassResources = () => {
    if (resourceState.glassResources !== undefined)
      return resourceState.glassResources;
    let program: ProgramBundle | null = null;
    let fixedDomeProgram: ProgramBundle | null = null;
    let fixedDomeSaturatedProgram: ProgramBundle | null = null;
    let blurProgram: ProgramBundle | null = null;
    let compositeProgram: ProgramBundle | null = null;
    let sceneFramebuffer: WebGLFramebuffer | null = null;
    let effectFramebuffer: WebGLFramebuffer | null = null;
    let blurFramebufferA: WebGLFramebuffer | null = null;
    let blurFramebufferB: WebGLFramebuffer | null = null;
    let sceneTexture: WebGLTexture | null = null;
    let effectTexture: WebGLTexture | null = null;
    let blurTextureA: WebGLTexture | null = null;
    let blurTextureB: WebGLTexture | null = null;
    let textMaskTexture: WebGLTexture | null = null;
    try {
      program = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(GLASS_TEXT_FRAGMENT_SHADER),
        ["aPos"],
        GLASS_TEXT_UNIFORMS,
      );
      fixedDomeProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(GLASS_TEXT_FIXED_DOME_FRAGMENT_SHADER),
        ["aPos"],
        GLASS_TEXT_UNIFORMS,
      );
      fixedDomeSaturatedProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(GLASS_TEXT_FIXED_DOME_SATURATED_FRAGMENT_SHADER),
        ["aPos"],
        GLASS_TEXT_UNIFORMS,
      );
      blurProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(GLASS_BLUR_FRAGMENT_SHADER),
        ["aPos"],
        GLASS_BLUR_UNIFORMS,
      );
      compositeProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(GLASS_COMPOSITE_FRAGMENT_SHADER),
        ["aPos"],
        GLASS_COMPOSITE_UNIFORMS,
      );
      sceneFramebuffer = gl.createFramebuffer();
      effectFramebuffer = gl.createFramebuffer();
      blurFramebufferA = gl.createFramebuffer();
      blurFramebufferB = gl.createFramebuffer();
      sceneTexture = createTexture(gl, 0, gl.LINEAR, gl.LINEAR);
      effectTexture = createTexture(gl, 7, gl.LINEAR, gl.LINEAR);
      blurTextureA = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
      blurTextureB = createTexture(gl, 3, gl.LINEAR, gl.LINEAR);
      textMaskTexture = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
      if (
        !sceneFramebuffer ||
        !effectFramebuffer ||
        !blurFramebufferA ||
        !blurFramebufferB
      ) {
        throw new Error("Unable to allocate the glass framebuffers.");
      }
      const resources: GlassTextResources = {
        program,
        fixedDomeProgram,
        fixedDomeSaturatedProgram,
        blurProgram,
        compositeProgram,
        sceneFramebuffer,
        effectFramebuffer,
        blurFramebuffers: [blurFramebufferA, blurFramebufferB],
        sceneTexture,
        effectTexture,
        blurTextures: [blurTextureA, blurTextureB],
        maskTexture: textMaskTexture,
        maskCanvas: document.createElement("canvas"),
        maskWidth: 0,
        maskHeight: 0,
        maskBounds: null,
        width: 0,
        height: 0,
        blurWidth: 0,
        blurHeight: 0,
        maskSettingsKey: "",
        maskSizeRevision: -1,
        fontRequestKey: "",
      };
      allocateGlassTargets(resources);
      resourceState.glassResources = resources;
    } catch (error) {
      reportError(error, "HeroWaveBackground glass text renderer");
      if (program) gl.deleteProgram(program.program);
      if (fixedDomeProgram) gl.deleteProgram(fixedDomeProgram.program);
      if (fixedDomeSaturatedProgram)
        gl.deleteProgram(fixedDomeSaturatedProgram.program);
      if (blurProgram) gl.deleteProgram(blurProgram.program);
      if (compositeProgram) gl.deleteProgram(compositeProgram.program);
      if (sceneFramebuffer) gl.deleteFramebuffer(sceneFramebuffer);
      if (effectFramebuffer) gl.deleteFramebuffer(effectFramebuffer);
      if (blurFramebufferA) gl.deleteFramebuffer(blurFramebufferA);
      if (blurFramebufferB) gl.deleteFramebuffer(blurFramebufferB);
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      if (effectTexture) gl.deleteTexture(effectTexture);
      if (blurTextureA) gl.deleteTexture(blurTextureA);
      if (blurTextureB) gl.deleteTexture(blurTextureB);
      if (textMaskTexture) gl.deleteTexture(textMaskTexture);
      resourceState.glassResources = null;
    }
    return resourceState.glassResources;
  };

  const glassIsActive = (settings: Settings) =>
    settings.glassText.enabled &&
    (settings.glassText.shape === "svg"
      ? settings.glassText.svgPath.trim().length > 0
      : settings.glassText.text.trim().length > 0);

  const bindSceneTarget = (settings: Settings) => {
    const resources = glassIsActive(settings) ? ensureGlassResources() : null;
    if (resources) {
      allocateGlassTargets(resources);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.sceneFramebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return resources;
  };

  const desiredIntegralPassSizes = (settings: Settings) => {
    const quality = settings.quality;
    const baseScales = [
      quality.farScale,
      quality.midScale,
      quality.coreScale,
    ] as const;
    const maximumDimensions = [
      quality.farMaxDimension,
      quality.midMaxDimension,
      quality.coreMaxDimension,
    ] as const;
    const longestSide = Math.max(
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      1,
    );
    const scales = baseScales.map((baseScale, index) =>
      Math.min(baseScale, maximumDimensions[index]! / longestSide),
    );
    return {
      widths: scales.map((scale) =>
        Math.max(1, Math.round(resourceState.canvasWidth * scale)),
      ) as [number, number, number],
      heights: scales.map((scale) =>
        Math.max(1, Math.round(resourceState.canvasHeight * scale)),
      ) as [number, number, number],
    };
  };

  const attachIntegralPass = (resources: PathResources, pass: number) => {
    if (!exactGl) return;
    exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, resources.framebuffers[pass]!);
    exactGl.viewport(
      0,
      0,
      resources.passWidths[pass]!,
      resources.passHeights[pass]!,
    );
  };

  const resetTemporalPathCache = (resources: PathResources) => {
    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;
    resources.temporalSecondBankReady = false;
    resources.temporalSettingsReference = null;
    resources.temporalSettingsKey = "";
    resources.temporalPaletteTexture = null;
    resources.temporalProfilesTexture = null;
    resources.temporalSizeRevision = -1;
  };

  const allocateFloatPathTexture = (
    texture: WebGLTexture,
    width: number,
    height: number,
  ) => {
    if (!exactGl) return;
    exactGl.bindTexture(exactGl.TEXTURE_2D, texture);
    exactGl.texImage2D(
      exactGl.TEXTURE_2D,
      0,
      exactGl.RGBA16F,
      width,
      height,
      0,
      exactGl.RGBA,
      exactGl.HALF_FLOAT,
      null,
    );
  };

  const allocatePathTargetBank = (
    bank: PathTargetBank,
    widths: PathResources["passWidths"],
    heights: PathResources["passHeights"],
  ) => {
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      allocateFloatPathTexture(
        bank.waveTextures[pass]!,
        widths[pass]!,
        heights[pass]!,
      );
      if (pass < HERO_PATH_PASS_CORE) {
        allocateFloatPathTexture(
          bank.reflectionTextures[pass]!,
          widths[pass]!,
          heights[pass]!,
        );
      }
    }
  };

  const attachPathTargetBank = (bank: PathTargetBank) => {
    if (!exactGl) return;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, bank.framebuffers[pass]!);
      exactGl.framebufferTexture2D(
        exactGl.FRAMEBUFFER,
        exactGl.COLOR_ATTACHMENT0,
        exactGl.TEXTURE_2D,
        bank.waveTextures[pass]!,
        0,
      );
      if (pass < HERO_PATH_PASS_CORE) {
        exactGl.framebufferTexture2D(
          exactGl.FRAMEBUFFER,
          exactGl.COLOR_ATTACHMENT1,
          exactGl.TEXTURE_2D,
          bank.reflectionTextures[pass]!,
          0,
        );
        exactGl.drawBuffers([
          exactGl.COLOR_ATTACHMENT0,
          exactGl.COLOR_ATTACHMENT1,
        ]);
      } else {
        exactGl.drawBuffers([exactGl.COLOR_ATTACHMENT0]);
      }
      const status = exactGl.checkFramebufferStatus(exactGl.FRAMEBUFFER);
      if (status !== exactGl.FRAMEBUFFER_COMPLETE) {
        throw new Error(
          `Incomplete floating-point path framebuffer: ${status}`,
        );
      }
    }
  };

  const allocatePathTargets = (
    resources: PathResources,
    settings: Settings,
  ) => {
    if (!exactGl) return false;
    if (
      resources.targetSettingsReference === settings &&
      resources.targetSizeRevision === resourceState.sizeRevision
    ) {
      return false;
    }
    const desired = desiredIntegralPassSizes(settings);
    const unchanged = desired.widths.every(
      (width, index) =>
        width === resources.passWidths[index] &&
        desired.heights[index] === resources.passHeights[index],
    );
    resources.targetSettingsReference = settings;
    resources.targetSizeRevision = resourceState.sizeRevision;
    if (unchanged) return false;
    allocatePathTargetBank(resources, desired.widths, desired.heights);
    if (resources.temporalTargets) {
      allocatePathTargetBank(
        resources.temporalTargets,
        desired.widths,
        desired.heights,
      );
    }
    resources.passWidths = desired.widths;
    resources.passHeights = desired.heights;
    attachPathTargetBank(resources);
    if (resources.temporalTargets) {
      attachPathTargetBank(resources.temporalTargets);
    }
    resetTemporalPathCache(resources);
    exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
    return true;
  };

  const ensureTemporalPathTargets = (resources: PathResources) => {
    if (resources.temporalTargets) return resources.temporalTargets;
    if (!exactGl) throw new Error("Exact paths require WebGL2.");
    const framebuffers: WebGLFramebuffer[] = [];
    const waveTextures: WebGLTexture[] = [];
    const reflectionTextures: WebGLTexture[] = [];
    try {
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const framebuffer = exactGl.createFramebuffer();
        if (!framebuffer) {
          throw new Error("Unable to allocate a temporal path framebuffer.");
        }
        framebuffers.push(framebuffer);
      }
      const createFloatTarget = () =>
        createTexture(exactGl, 0, exactGl.LINEAR, exactGl.LINEAR);
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        waveTextures.push(createFloatTarget());
      }
      reflectionTextures.push(createFloatTarget());
      reflectionTextures.push(createFloatTarget());
      const targets: PathTargetBank = {
        framebuffers: [framebuffers[0]!, framebuffers[1]!, framebuffers[2]!],
        waveTextures: [waveTextures[0]!, waveTextures[1]!, waveTextures[2]!],
        reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
      };
      allocatePathTargetBank(
        targets,
        resources.passWidths,
        resources.passHeights,
      );
      attachPathTargetBank(targets);
      resources.temporalTargets = targets;
      resetTemporalPathCache(resources);
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
      return targets;
    } catch (error) {
      for (const framebuffer of framebuffers) {
        exactGl.deleteFramebuffer(framebuffer);
      }
      for (const texture of waveTextures) exactGl.deleteTexture(texture);
      for (const texture of reflectionTextures) exactGl.deleteTexture(texture);
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
      throw error;
    }
  };

  const readyPathResources = new WeakSet<PathResources>();

  const destroyPathResources = (resources: PathResources | null) => {
    if (!resources || !exactGl) return;
    for (const program of resources.integralPrograms) {
      if (program) exactGl.deleteProgram(program.program);
    }
    for (const program of resources.sourceIntegralPrograms) {
      if (program) exactGl.deleteProgram(program.program);
    }
    if (resources.compositeProgram)
      exactGl.deleteProgram(resources.compositeProgram.program);
    if (resources.baseCompositeProgram)
      exactGl.deleteProgram(resources.baseCompositeProgram.program);
    if (resources.staticCompositeProgram)
      exactGl.deleteProgram(resources.staticCompositeProgram.program);
    if (resources.staticBaseCompositeProgram)
      exactGl.deleteProgram(resources.staticBaseCompositeProgram.program);
    if (resources.idleDotsProgram)
      exactGl.deleteProgram(resources.idleDotsProgram.program);
    if (resources.pointerDotsProgram)
      exactGl.deleteProgram(resources.pointerDotsProgram.program);
    exactGl.deleteBuffer(resources.quadBuffer);
    for (const vao of resources.sourceIntegralVaos) {
      if (vao) exactGl.deleteVertexArray(vao);
    }
    for (const buffer of new Set(resources.segmentBuffers)) {
      exactGl.deleteBuffer(buffer);
    }
    for (const framebuffer of resources.framebuffers) {
      exactGl.deleteFramebuffer(framebuffer);
    }
    for (const texture of resources.waveTextures)
      exactGl.deleteTexture(texture);
    for (const texture of resources.reflectionTextures)
      exactGl.deleteTexture(texture);
    if (resources.temporalTargets) {
      for (const framebuffer of resources.temporalTargets.framebuffers) {
        exactGl.deleteFramebuffer(framebuffer);
      }
      for (const texture of resources.temporalTargets.waveTextures) {
        exactGl.deleteTexture(texture);
      }
      for (const texture of resources.temporalTargets.reflectionTextures) {
        exactGl.deleteTexture(texture);
      }
      resources.temporalTargets = null;
    }
    exactGl.deleteTexture(resources.k0Texture);
    readyPathResources.delete(resources);
  };

  const failPathResources = (resources: PathResources, error: unknown) => {
    reportError(error, "HeroWaveBackground exact multi-contribution renderer");
    const reason = error instanceof Error ? error.message : String(error);
    exactGl?.useProgram(null);
    destroyPathResources(resources);
    if (resourceState.pathResources === resources) {
      resourceState.pathResources = null;
    }
    resourceState.pathRendererErrorLogged = true;
    reportStatus({
      renderer: "unavailable",
      supported: false,
      reason,
      webglVersion: 2,
    });
  };

  const reportPathResourcesReady = (resources: PathResources) => {
    if (
      resourceState.pathResources !== resources ||
      readyPathResources.has(resources)
    ) {
      return;
    }
    readyPathResources.add(resources);
    reportStatus({
      renderer: "hdr",
      supported: true,
      webglVersion: 2,
    });
  };

  const integralAttributeNames = [
    "aCorner",
    "aSegmentStart",
    "aSegmentEnd",
    "aProgressRange",
    "aEndpointWeights",
  ] as const;

  const ensurePathIntegralProgram = (
    resources: PathResources,
    pass: number,
    sourceInstanced: boolean,
  ) => {
    if (!exactGl) throw new Error("Exact paths require WebGL2.");
    const programs = sourceInstanced
      ? resources.sourceIntegralPrograms
      : resources.integralPrograms;
    const cached = programs[pass];
    if (cached) return cached;
    const fragmentShader = sourceInstanced
      ? PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS[pass]
      : PATH_INTEGRAL_FRAGMENT_SHADERS[pass];
    if (!fragmentShader) {
      throw new Error(`Invalid exact path render pass: ${pass}.`);
    }
    const program = createProgramBundle(
      exactGl,
      sourceInstanced
        ? PATH_SOURCE_INTEGRAL_VERTEX_SHADER
        : PATH_INTEGRAL_VERTEX_SHADER,
      fragmentShader,
      integralAttributeNames,
      PATH_INTEGRAL_UNIFORMS,
    );
    programs[pass] = program;
    return program;
  };

  const ensurePathCompositeProgram = (
    resources: PathResources,
    temporalActive: boolean,
    baseOnly: boolean,
  ) => {
    if (!exactGl) throw new Error("Exact paths require WebGL2.");
    const key = temporalActive
      ? baseOnly
        ? "baseCompositeProgram"
        : "compositeProgram"
      : baseOnly
        ? "staticBaseCompositeProgram"
        : "staticCompositeProgram";
    const cached = resources[key];
    if (cached) return cached;
    const fragmentShader = temporalActive
      ? baseOnly
        ? PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER
        : PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER
      : baseOnly
        ? PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER
        : PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER;
    const program = createProgramBundle(
      exactGl,
      FULLSCREEN_VERTEX_SHADER_300,
      fragmentShader,
      ["aPos"],
      PATH_INTEGRAL_COMPOSITE_UNIFORMS,
    );
    resources[key] = program;
    return program;
  };

  const ensurePathDotsProgram = (
    resources: PathResources,
    pointer: boolean,
  ) => {
    if (!exactGl) throw new Error("Exact paths require WebGL2.");
    const key = pointer ? "pointerDotsProgram" : "idleDotsProgram";
    const cached = resources[key];
    if (cached) return cached;
    const program = createProgramBundle(
      exactGl,
      pointer ? FULLSCREEN_VERTEX_SHADER_300 : PATH_DOTS_IDLE_VERTEX_SHADER,
      pointer
        ? PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER
        : PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER,
      pointer ? ["aPos"] : [],
      PATH_INTEGRAL_COMPOSITE_UNIFORMS,
    );
    resources[key] = program;
    return program;
  };

  const ensurePathResources = (settings: Settings) => {
    if (resourceState.pathResources !== undefined)
      return resourceState.pathResources;
    if (!exactGl) {
      const reason = "Exact paths require WebGL2.";
      if (!resourceState.pathRendererErrorLogged) {
        reportError(new Error(reason), "HeroWaveBackground HDR renderer");
        resourceState.pathRendererErrorLogged = true;
      }
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason,
        webglVersion: 1,
      });
      resourceState.pathResources = null;
      return resourceState.pathResources;
    }
    let quadBuffer: WebGLBuffer | null = null;
    const segmentBuffers: WebGLBuffer[] = [];
    const framebuffers: WebGLFramebuffer[] = [];
    const waveTextures: WebGLTexture[] = [];
    const reflectionTextures: WebGLTexture[] = [];
    let k0Texture: WebGLTexture | null = null;
    try {
      const colorBufferFloat = exactGl.getExtension("EXT_color_buffer_float");
      const floatBlend = exactGl.getExtension("EXT_float_blend");
      if (!colorBufferFloat || !floatBlend) {
        throw new Error(
          "The exact renderer requires EXT_color_buffer_float and EXT_float_blend.",
        );
      }
      if (
        exactGl.getParameter(exactGl.MAX_DRAW_BUFFERS) < 2 ||
        exactGl.getParameter(exactGl.MAX_COLOR_ATTACHMENTS) < 2
      ) {
        throw new Error(
          "The exact renderer requires two floating-point draw buffers.",
        );
      }
      quadBuffer = exactGl.createBuffer();
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const framebuffer = exactGl.createFramebuffer();
        if (!framebuffer) {
          throw new Error("Unable to allocate an exact path framebuffer.");
        }
        framebuffers.push(framebuffer);
      }
      if (!quadBuffer) {
        throw new Error("Unable to allocate exact path resources.");
      }
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, quadBuffer);
      exactGl.bufferData(
        exactGl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
        exactGl.STATIC_DRAW,
      );
      const sharedSegmentBuffer = exactGl.createBuffer();
      if (!sharedSegmentBuffer) {
        throw new Error("Unable to allocate the shared segment buffer.");
      }
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, sharedSegmentBuffer);
      exactGl.bufferData(exactGl.ARRAY_BUFFER, 0, exactGl.STREAM_DRAW);
      segmentBuffers.push(
        sharedSegmentBuffer,
        sharedSegmentBuffer,
        sharedSegmentBuffer,
      );
      const createFloatTarget = () =>
        createTexture(exactGl, 0, exactGl.LINEAR, exactGl.LINEAR);
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        waveTextures.push(createFloatTarget());
      }
      reflectionTextures.push(createFloatTarget());
      reflectionTextures.push(createFloatTarget());
      k0Texture = createTexture(exactGl, 1, exactGl.NEAREST, exactGl.NEAREST);
      exactGl.bindTexture(exactGl.TEXTURE_2D, k0Texture);
      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.R32F,
        HERO_PATH_K0_LUT_WIDTH,
        1,
        0,
        exactGl.RED,
        exactGl.FLOAT,
        getPathK0TextureData(),
      );
      const resources: PathResources = {
        integralPrograms: [null, null, null],
        sourceIntegralPrograms: [null, null, null],
        compositeProgram: null,
        baseCompositeProgram: null,
        staticCompositeProgram: null,
        staticBaseCompositeProgram: null,
        idleDotsProgram: null,
        pointerDotsProgram: null,
        quadBuffer,
        segmentBuffers: [
          segmentBuffers[0]!,
          segmentBuffers[1]!,
          segmentBuffers[2]!,
        ],
        sourceIntegralVaos: [null, null, null],
        sourceIntegralVaoKeys: [-1, -1, -1],
        framebuffers: [framebuffers[0]!, framebuffers[1]!, framebuffers[2]!],
        waveTextures: [waveTextures[0]!, waveTextures[1]!, waveTextures[2]!],
        reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
        temporalTargets: null,
        k0Texture,
        passWidths: [0, 0, 0],
        passHeights: [0, 0, 0],
        stagingData: [
          new Float32Array(0),
          new Float32Array(0),
          new Float32Array(0),
        ],
        uploadedSceneHashes: [-1, -1, -1],
        temporalAnchorIndex: Number.MIN_SAFE_INTEGER,
        temporalSecondBankReady: false,
        temporalSettingsReference: null,
        temporalSettingsKey: "",
        temporalPaletteTexture: null,
        temporalProfilesTexture: null,
        temporalSizeRevision: -1,
        targetSettingsReference: null,
        targetSizeRevision: -1,
      };
      allocatePathTargets(resources, settings);
      resourceState.pathResources = resources;
    } catch (error) {
      reportError(
        error,
        "HeroWaveBackground exact multi-contribution renderer",
      );
      const reason = error instanceof Error ? error.message : String(error);
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason,
        webglVersion: 2,
      });
      if (quadBuffer) exactGl.deleteBuffer(quadBuffer);
      for (const buffer of new Set(segmentBuffers)) {
        exactGl.deleteBuffer(buffer);
      }
      for (const framebuffer of framebuffers) {
        exactGl.deleteFramebuffer(framebuffer);
      }
      for (const texture of waveTextures) exactGl.deleteTexture(texture);
      for (const texture of reflectionTextures) exactGl.deleteTexture(texture);
      if (k0Texture) exactGl.deleteTexture(k0Texture);
      resourceState.pathResources = null;
    }
    return resourceState.pathResources;
  };

  return {
    destroyTerrainResources,
    ensureTerrainResources,
    updateTerrainGeometry,
    destroyGlassResources,
    allocateGlassTargets,
    ensureGlassResources,
    glassIsActive,
    bindSceneTarget,
    desiredIntegralPassSizes,
    attachIntegralPass,
    allocatePathTargets,
    ensureTemporalPathTargets,
    destroyPathResources,
    failPathResources,
    reportPathResourcesReady,
    ensurePathIntegralProgram,
    ensurePathCompositeProgram,
    ensurePathDotsProgram,
    ensurePathResources,
  };
}
