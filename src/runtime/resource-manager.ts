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
    const allocateFloatTexture = (
      texture: WebGLTexture,
      width: number,
      height: number,
    ) => {
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
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      for (const waveTexture of [
        resources.waveTextures[pass]!,
        resources.temporalWaveTextures[pass]!,
      ]) {
        allocateFloatTexture(
          waveTexture,
          desired.widths[pass]!,
          desired.heights[pass]!,
        );
      }
      if (pass < HERO_PATH_PASS_CORE) {
        for (const reflectionTexture of [
          resources.reflectionTextures[pass]!,
          resources.temporalReflectionTextures[pass]!,
        ]) {
          allocateFloatTexture(
            reflectionTexture,
            desired.widths[pass]!,
            desired.heights[pass]!,
          );
        }
      }
    }
    resources.passWidths = desired.widths;
    resources.passHeights = desired.heights;
    const attachPathBank = (
      framebuffers: PathResources["framebuffers"],
      waveTextures: PathResources["waveTextures"],
      reflectionTextures: PathResources["reflectionTextures"],
    ) => {
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, framebuffers[pass]!);
        exactGl.framebufferTexture2D(
          exactGl.FRAMEBUFFER,
          exactGl.COLOR_ATTACHMENT0,
          exactGl.TEXTURE_2D,
          waveTextures[pass]!,
          0,
        );
        if (pass < HERO_PATH_PASS_CORE) {
          exactGl.framebufferTexture2D(
            exactGl.FRAMEBUFFER,
            exactGl.COLOR_ATTACHMENT1,
            exactGl.TEXTURE_2D,
            reflectionTextures[pass]!,
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
    attachPathBank(
      resources.framebuffers,
      resources.waveTextures,
      resources.reflectionTextures,
    );
    attachPathBank(
      resources.temporalFramebuffers,
      resources.temporalWaveTextures,
      resources.temporalReflectionTextures,
    );
    resources.temporalAnchorIndex = Number.MIN_SAFE_INTEGER;
    resources.temporalSettingsReference = null;
    resources.temporalSettingsKey = "";
    resources.temporalPaletteTexture = null;
    resources.temporalProfilesTexture = null;
    resources.temporalSizeRevision = -1;
    exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
    return true;
  };

  const destroyPathResources = (resources: PathResources | null) => {
    if (!resources || !exactGl) return;
    for (const program of resources.integralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    for (const program of resources.sourceIntegralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    exactGl.deleteProgram(resources.compositeProgram.program);
    exactGl.deleteProgram(resources.baseCompositeProgram.program);
    exactGl.deleteProgram(resources.staticCompositeProgram.program);
    exactGl.deleteProgram(resources.staticBaseCompositeProgram.program);
    exactGl.deleteProgram(resources.idleDotsProgram.program);
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
    for (const framebuffer of resources.temporalFramebuffers) {
      exactGl.deleteFramebuffer(framebuffer);
    }
    for (const texture of resources.waveTextures)
      exactGl.deleteTexture(texture);
    for (const texture of resources.reflectionTextures)
      exactGl.deleteTexture(texture);
    for (const texture of resources.temporalWaveTextures)
      exactGl.deleteTexture(texture);
    for (const texture of resources.temporalReflectionTextures)
      exactGl.deleteTexture(texture);
    exactGl.deleteTexture(resources.k0Texture);
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
    const integralPrograms: ProgramBundle[] = [];
    const sourceIntegralPrograms: ProgramBundle[] = [];
    let compositeProgram: ProgramBundle | null = null;
    let baseCompositeProgram: ProgramBundle | null = null;
    let staticCompositeProgram: ProgramBundle | null = null;
    let staticBaseCompositeProgram: ProgramBundle | null = null;
    let idleDotsProgram: ProgramBundle | null = null;
    let pointerDotsProgram: ProgramBundle | null = null;
    let quadBuffer: WebGLBuffer | null = null;
    const segmentBuffers: WebGLBuffer[] = [];
    const framebuffers: WebGLFramebuffer[] = [];
    const waveTextures: WebGLTexture[] = [];
    const reflectionTextures: WebGLTexture[] = [];
    const temporalFramebuffers: WebGLFramebuffer[] = [];
    const temporalWaveTextures: WebGLTexture[] = [];
    const temporalReflectionTextures: WebGLTexture[] = [];
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
      for (const fragmentShader of PATH_INTEGRAL_FRAGMENT_SHADERS) {
        integralPrograms.push(
          createProgramBundle(
            exactGl,
            PATH_INTEGRAL_VERTEX_SHADER,
            fragmentShader,
            [
              "aCorner",
              "aSegmentStart",
              "aSegmentEnd",
              "aProgressRange",
              "aEndpointWeights",
            ],
            PATH_INTEGRAL_UNIFORMS,
          ),
        );
      }
      for (const fragmentShader of PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS) {
        sourceIntegralPrograms.push(
          createProgramBundle(
            exactGl,
            PATH_SOURCE_INTEGRAL_VERTEX_SHADER,
            fragmentShader,
            [
              "aCorner",
              "aSegmentStart",
              "aSegmentEnd",
              "aProgressRange",
              "aEndpointWeights",
            ],
            PATH_INTEGRAL_UNIFORMS,
          ),
        );
      }
      compositeProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      baseCompositeProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      staticCompositeProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      staticBaseCompositeProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      idleDotsProgram = createProgramBundle(
        exactGl,
        PATH_DOTS_IDLE_VERTEX_SHADER,
        PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER,
        [],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      pointerDotsProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
      quadBuffer = exactGl.createBuffer();
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const framebuffer = exactGl.createFramebuffer();
        const temporalFramebuffer = exactGl.createFramebuffer();
        if (!framebuffer || !temporalFramebuffer) {
          throw new Error("Unable to allocate an exact path framebuffer.");
        }
        framebuffers.push(framebuffer);
        temporalFramebuffers.push(temporalFramebuffer);
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
        temporalWaveTextures.push(createFloatTarget());
      }
      reflectionTextures.push(createFloatTarget(), createFloatTarget());
      temporalReflectionTextures.push(createFloatTarget(), createFloatTarget());
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
        integralPrograms: [
          integralPrograms[0]!,
          integralPrograms[1]!,
          integralPrograms[2]!,
        ],
        sourceIntegralPrograms: [
          sourceIntegralPrograms[0]!,
          sourceIntegralPrograms[1]!,
          sourceIntegralPrograms[2]!,
        ],
        compositeProgram,
        baseCompositeProgram,
        staticCompositeProgram,
        staticBaseCompositeProgram,
        idleDotsProgram,
        pointerDotsProgram,
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
        temporalFramebuffers: [
          temporalFramebuffers[0]!,
          temporalFramebuffers[1]!,
          temporalFramebuffers[2]!,
        ],
        temporalWaveTextures: [
          temporalWaveTextures[0]!,
          temporalWaveTextures[1]!,
          temporalWaveTextures[2]!,
        ],
        temporalReflectionTextures: [
          temporalReflectionTextures[0]!,
          temporalReflectionTextures[1]!,
        ],
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
      reportStatus({
        renderer: "hdr",
        supported: true,
        webglVersion: 2,
      });
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
      for (const program of integralPrograms) {
        exactGl.deleteProgram(program.program);
      }
      for (const program of sourceIntegralPrograms) {
        exactGl.deleteProgram(program.program);
      }
      if (compositeProgram) exactGl.deleteProgram(compositeProgram.program);
      if (baseCompositeProgram)
        exactGl.deleteProgram(baseCompositeProgram.program);
      if (staticCompositeProgram)
        exactGl.deleteProgram(staticCompositeProgram.program);
      if (staticBaseCompositeProgram)
        exactGl.deleteProgram(staticBaseCompositeProgram.program);
      if (idleDotsProgram) exactGl.deleteProgram(idleDotsProgram.program);
      if (pointerDotsProgram) exactGl.deleteProgram(pointerDotsProgram.program);
      if (quadBuffer) exactGl.deleteBuffer(quadBuffer);
      for (const buffer of new Set(segmentBuffers)) {
        exactGl.deleteBuffer(buffer);
      }
      for (const framebuffer of framebuffers) {
        exactGl.deleteFramebuffer(framebuffer);
      }
      for (const framebuffer of temporalFramebuffers) {
        exactGl.deleteFramebuffer(framebuffer);
      }
      for (const texture of waveTextures) exactGl.deleteTexture(texture);
      for (const texture of reflectionTextures) exactGl.deleteTexture(texture);
      for (const texture of temporalWaveTextures)
        exactGl.deleteTexture(texture);
      for (const texture of temporalReflectionTextures)
        exactGl.deleteTexture(texture);
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
    destroyPathResources,
    ensurePathResources,
  };
}
