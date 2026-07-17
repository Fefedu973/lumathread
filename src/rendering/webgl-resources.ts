import type { Settings } from "../config/settings";

export function buildHueMatrix(angle: number, target: Float32Array) {
  const axis = 1 / Math.sqrt(3);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const common = (1 - cosine) * axis * axis;
  target[0] = cosine + common;
  target[1] = common + axis * sine;
  target[2] = common - axis * sine;
  target[3] = common - axis * sine;
  target[4] = cosine + common;
  target[5] = common + axis * sine;
  target[6] = common + axis * sine;
  target[7] = common - axis * sine;
  target[8] = cosine + common;
}

export interface ProgramBundle {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export interface TerrainDotsResources {
  program: ProgramBundle;
  buffer: WebGLBuffer;
  columns: number;
  rows: number;
  pointCount: number;
}

export interface GlassTextResources {
  program: ProgramBundle;
  blurProgram: ProgramBundle;
  compositeProgram: ProgramBundle;
  framebuffer: WebGLFramebuffer;
  blurFramebuffer: WebGLFramebuffer;
  sceneTexture: WebGLTexture;
  effectTexture: WebGLTexture;
  blurTextures: [WebGLTexture, WebGLTexture];
  maskTexture: WebGLTexture;
  maskCanvas: HTMLCanvasElement;
  maskWidth: number;
  maskHeight: number;
  width: number;
  height: number;
  blurWidth: number;
  blurHeight: number;
  maskSettingsKey: string;
  maskSizeRevision: number;
  fontRequestKey: string;
}

export const TERRAIN_DOTS_UNIFORMS = [
  "uRes",
  "uTime",
  "uWidth",
  "uDepth",
  "uAmplitude",
  "uPointSize",
  "uSpeed",
  "uViewAngle",
  "uCameraDistance",
  "uFrequency",
  "uDpr",
  "uFitCover",
  "uTwinkle",
  "uReflect",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uTerrainPointerDisplacement",
  "uDotMask",
  "uColorLow",
  "uColorHigh",
  "uOpacity",
  "uContentFade",
  "uEdgeFade",
  "uThemeMode",
] as const;

export const GLASS_TEXT_UNIFORMS = [
  "uScene",
  "uBlurScene",
  "uTextMask",
  "uRes",
  "uTime",
  "uRefraction",
  "uEdgeWrap",
  "uSurfaceModel",
  "uBevelMode",
  "uSurfaceDepth",
  "uIor",
  "uMagnification",
  "uDisplacement",
  "uDiffusion",
  "uSdfRange",
  "uBlur",
  "uMicroDistortion",
  "uChromaticAberration",
  "uFrost",
  "uRoughness",
  "uBevel",
  "uRibStrength",
  "uRibWidth",
  "uRibAngle",
  "uLiquidStrength",
  "uLiquidScale",
  "uLiquidSpeed",
  "uEdgeStrength",
  "uSpecular",
  "uFresnel",
  "uTwinkle",
  "uTwinkleDensity",
  "uTwinkleSpeed",
  "uTwinkleSize",
  "uTint",
  "uTintStrength",
  "uSaturation",
  "uBrightness",
  "uOpacity",
] as const;

export const GLASS_BLUR_UNIFORMS = [
  "uSource",
  "uResolution",
  "uDirection",
] as const;
export const GLASS_COMPOSITE_UNIFORMS = [
  "uScene",
  "uEffect",
  "uBlurEffect",
  "uResolution",
  "uProgress",
  "uBlurMix",
  "uOffsetY",
] as const;

export interface PathResources {
  integralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];
  compositeProgram: ProgramBundle;
  quadBuffer: WebGLBuffer;
  segmentBuffers: [WebGLBuffer, WebGLBuffer, WebGLBuffer];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer, WebGLFramebuffer];
  waveTextures: [WebGLTexture, WebGLTexture, WebGLTexture];
  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  passWidths: [number, number, number];
  passHeights: [number, number, number];
  stagingData: [Float32Array, Float32Array, Float32Array];
  uploadedSceneHashes: [number, number, number];
  targetSettingsReference: Settings | null;
  targetSizeRevision: number;
}

export const SINE_UNIFORMS = [
  "uRes",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPalette",
  "uGlowProfile0",
  "uGlowProfile1",
  "uProfiles",
  "uHueMatrix",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uPaletteOffset",
  "uPaletteWrap",
  "uMaterialWeights0",
  "uMaterialWeights1",
  "uVelocityWidthScale",
  "uVelocityGlowScale",
  "uVelocityReflectionScale",
  "uVisibility",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uDotPointerMagnification",
  "uThemeMode",
  "uBandHeight",
  "uCurveStrength",
  "uCurveScale",
  "uCurveFrequency",
  "uCurveMotion",
  "uGeometryAdvanceRatio",
  "uBackgroundImage",
  "uBackgroundOpacity",
] as const;

export const PATH_INTEGRAL_UNIFORMS = [
  "uTargetResolution",
  "uCanvasResolution",
  "uSupportRadiusPositivePx",
  "uSupportRadiusNegativePx",
  "uPalette",
  "uK0Lut",
  "uProfiles",
  "uHueMatrix",
  "uLayerMask0",
  "uLayerMask1",
  "uQuadraturePoints",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPathClosed",
  "uClosedLoopTaper",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uPaletteOffset",
  "uPaletteWrap",
  "uMaterialWeights0",
  "uMaterialWeights1",
  "uVelocityWidthScale",
  "uVelocityGlowScale",
  "uVelocityReflectionScale",
  "uVisibility",
] as const;

export const PATH_INTEGRAL_COMPOSITE_UNIFORMS = [
  "uRes",
  "uTime",
  "uFarWave",
  "uFarReflection",
  "uMidWave",
  "uMidReflection",
  "uCoreWave",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uDotPointerMagnification",
  "uThemeMode",
  "uBackgroundImage",
  "uBackgroundOpacity",
] as const;

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function createProgramBundle(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributeNames: readonly string[],
  uniformNames: readonly string[],
): ProgramBundle {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error("Unable to allocate a WebGL program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  const attributes: Record<string, number> = {};
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of attributeNames) {
    attributes[name] = gl.getAttribLocation(program, name);
  }
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, attributes, uniforms };
}

export function createTexture(
  gl: WebGLRenderingContext,
  unit: number,
  minFilter: number,
  magFilter: number,
) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to allocate a WebGL texture.");
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function uniform1f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1f(bundle.uniforms[name] ?? null, value);
}

export function uniform1i(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1i(bundle.uniforms[name] ?? null, value);
}

export function uniform2f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  x: number,
  y: number,
) {
  gl.uniform2f(bundle.uniforms[name] ?? null, x, y);
}
