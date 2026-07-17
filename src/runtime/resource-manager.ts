import {
  FULLSCREEN_VERTEX_SHADER,
  FULLSCREEN_VERTEX_SHADER_300,
  GLASS_BLUR_FRAGMENT_SHADER,
  GLASS_COMPOSITE_FRAGMENT_SHADER,
  GLASS_TEXT_FRAGMENT_SHADER,
  PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
  PATH_INTEGRAL_FRAGMENT_SHADERS,
  PATH_INTEGRAL_VERTEX_SHADER,
  TERRAIN_DOTS_FRAGMENT_SHADER,
  TERRAIN_DOTS_VERTEX_SHADER,
} from "../rendering/shaders";
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
    gl.deleteProgram(resources.blurProgram.program);
    gl.deleteProgram(resources.compositeProgram.program);
    gl.deleteFramebuffer(resources.framebuffer);
    gl.deleteFramebuffer(resources.blurFramebuffer);
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
    gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      exactGl ? exactGl.RGBA8 : gl.RGBA,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindTexture(gl.TEXTURE_2D, resources.effectTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      exactGl ? exactGl.RGBA8 : gl.RGBA,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.sceneTexture,
      0,
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Incomplete glass scene framebuffer: ${status}`);
    }
    for (const texture of resources.blurTextures) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        resources.blurWidth,
        resources.blurHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const blurStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (blurStatus !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Incomplete glass blur framebuffer: ${blurStatus}`);
      }
    }
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.effectTexture,
      0,
    );
    const effectStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (effectStatus !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error(`Incomplete glass effect framebuffer: ${effectStatus}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    resources.maskSettingsKey = "";
    resources.maskSizeRevision = -1;
    return true;
  };

  const ensureGlassResources = () => {
    if (resourceState.glassResources !== undefined)
      return resourceState.glassResources;
    let program: ProgramBundle | null = null;
    let blurProgram: ProgramBundle | null = null;
    let compositeProgram: ProgramBundle | null = null;
    let framebuffer: WebGLFramebuffer | null = null;
    let blurFramebuffer: WebGLFramebuffer | null = null;
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
      framebuffer = gl.createFramebuffer();
      blurFramebuffer = gl.createFramebuffer();
      sceneTexture = createTexture(gl, 0, gl.LINEAR, gl.LINEAR);
      effectTexture = createTexture(gl, 7, gl.LINEAR, gl.LINEAR);
      blurTextureA = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
      blurTextureB = createTexture(gl, 3, gl.LINEAR, gl.LINEAR);
      textMaskTexture = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
      if (!framebuffer || !blurFramebuffer)
        throw new Error("Unable to allocate the glass framebuffer.");
      const resources: GlassTextResources = {
        program,
        blurProgram,
        compositeProgram,
        framebuffer,
        blurFramebuffer,
        sceneTexture,
        effectTexture,
        blurTextures: [blurTextureA, blurTextureB],
        maskTexture: textMaskTexture,
        maskCanvas: document.createElement("canvas"),
        maskWidth: 0,
        maskHeight: 0,
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
      if (blurProgram) gl.deleteProgram(blurProgram.program);
      if (compositeProgram) gl.deleteProgram(compositeProgram.program);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (blurFramebuffer) gl.deleteFramebuffer(blurFramebuffer);
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
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
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
      allocateFloatTexture(
        resources.waveTextures[pass]!,
        desired.widths[pass]!,
        desired.heights[pass]!,
      );
      if (pass < HERO_PATH_PASS_CORE) {
        allocateFloatTexture(
          resources.reflectionTextures[pass]!,
          desired.widths[pass]!,
          desired.heights[pass]!,
        );
      }
    }
    resources.passWidths = desired.widths;
    resources.passHeights = desired.heights;
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      exactGl.bindFramebuffer(
        exactGl.FRAMEBUFFER,
        resources.framebuffers[pass]!,
      );
      exactGl.framebufferTexture2D(
        exactGl.FRAMEBUFFER,
        exactGl.COLOR_ATTACHMENT0,
        exactGl.TEXTURE_2D,
        resources.waveTextures[pass]!,
        0,
      );
      if (pass < HERO_PATH_PASS_CORE) {
        exactGl.framebufferTexture2D(
          exactGl.FRAMEBUFFER,
          exactGl.COLOR_ATTACHMENT1,
          exactGl.TEXTURE_2D,
          resources.reflectionTextures[pass]!,
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
    exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
    return true;
  };

  const destroyPathResources = (resources: PathResources | null) => {
    if (!resources || !exactGl) return;
    for (const program of resources.integralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    exactGl.deleteProgram(resources.compositeProgram.program);
    exactGl.deleteBuffer(resources.quadBuffer);
    for (const buffer of resources.segmentBuffers) exactGl.deleteBuffer(buffer);
    for (const framebuffer of resources.framebuffers) {
      exactGl.deleteFramebuffer(framebuffer);
    }
    for (const texture of resources.waveTextures)
      exactGl.deleteTexture(texture);
    for (const texture of resources.reflectionTextures)
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
    let compositeProgram: ProgramBundle | null = null;
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
      compositeProgram = createProgramBundle(
        exactGl,
        FULLSCREEN_VERTEX_SHADER_300,
        PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
        ["aPos"],
        PATH_INTEGRAL_COMPOSITE_UNIFORMS,
      );
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
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const buffer = exactGl.createBuffer();
        if (!buffer) throw new Error("Unable to allocate a segment buffer.");
        exactGl.bindBuffer(exactGl.ARRAY_BUFFER, buffer);
        exactGl.bufferData(exactGl.ARRAY_BUFFER, 0, exactGl.STREAM_DRAW);
        segmentBuffers.push(buffer);
      }
      const createFloatTarget = () =>
        createTexture(exactGl, 0, exactGl.LINEAR, exactGl.LINEAR);
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++)
        waveTextures.push(createFloatTarget());
      reflectionTextures.push(createFloatTarget(), createFloatTarget());
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
        compositeProgram,
        quadBuffer,
        segmentBuffers: [
          segmentBuffers[0]!,
          segmentBuffers[1]!,
          segmentBuffers[2]!,
        ],
        framebuffers: [framebuffers[0]!, framebuffers[1]!, framebuffers[2]!],
        waveTextures: [waveTextures[0]!, waveTextures[1]!, waveTextures[2]!],
        reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
        k0Texture,
        passWidths: [0, 0, 0],
        passHeights: [0, 0, 0],
        stagingData: [
          new Float32Array(0),
          new Float32Array(0),
          new Float32Array(0),
        ],
        uploadedSceneHashes: [-1, -1, -1],
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
      if (compositeProgram) exactGl.deleteProgram(compositeProgram.program);
      if (quadBuffer) exactGl.deleteBuffer(quadBuffer);
      for (const buffer of segmentBuffers) exactGl.deleteBuffer(buffer);
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
    destroyPathResources,
    ensurePathResources,
  };
}
