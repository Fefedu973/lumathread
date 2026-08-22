import {
  HERO_PALETTE_TEXTURE_WIDTH,
  HERO_PATH_K0_MAX_ARGUMENT,
  HERO_PATH_K0_MIN_ARGUMENT,
} from "./constants";
import { COMMON_THEME_GLSL } from "./shaders";

/** WebGL2 path shader sources and their production specializations. */
export const FULLSCREEN_VERTEX_SHADER_300 = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const PATH_SOURCE_INTEGRAL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aCorner;
in vec2 aSegmentStart;
in vec2 aSegmentEnd;
in vec2 aProgressRange;
in vec2 aEndpointWeights;

uniform vec2 uTargetResolution;
uniform vec2 uCanvasResolution;
uniform float uSupportRadiusPositivePx;
uniform float uSupportRadiusNegativePx;
uniform float uSupportRadiusBasePx;
uniform sampler2D uPalette;
uniform sampler2D uProfiles;
uniform mat3 uHueMatrix;
uniform float uQuadraturePoints;
uniform float uTime;
uniform float uCurveTravel;
uniform float uEnvelopeStationary;
uniform float uStationaryCenter;
uniform float uSegmentLength;
uniform float uTailTaper;
uniform float uHeadTaper;
uniform float uPathClosed;
uniform float uClosedLoopTaper;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uPaletteOffset;
uniform float uPaletteWrap;
uniform float uVelocityWidthScale;
uniform float uVelocityGlowScale;
uniform float uVelocityReflectionScale;
uniform float uVisibility;

const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};

flat out vec4 vSourceFrame;
flat out vec4 vShape;
flat out vec4 vEnergy;
flat out float vReflectionScale;
flat out vec3 vWaveColor;
flat out vec3 vPaleColor;
flat out vec3 vCoreColor;
flat out vec3 vReflectionColor;

float segmentCenter(float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  float outsidePadding = 0.06;
  float firstCenter = -0.5 * lengthValue - outsidePadding;
  float cycleLength = 1.0 + lengthValue + 2.0 * outsidePadding;
  float centeredOffset = 0.5 - firstCenter;
  float travelingCenter = firstCenter + mod(
    time * uCurveTravel + centeredOffset,
    cycleLength
  );
  return mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
}

float segmentPositionForValue(float value, float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  return (
    value - (segmentCenter(time) - 0.5 * lengthValue)
  ) / lengthValue;
}

float pathSegmentPosition(float progress, float time) {
  if (uPathClosed < 0.5) {
    return segmentPositionForValue(progress, time);
  }
  float lengthValue = min(max(uSegmentLength, 0.05), 0.98);
  float travelingCenter = fract(time * uCurveTravel + 0.5);
  float center = mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
  float delta = mod(progress - center + 0.5, 1.0) - 0.5;
  return delta / lengthValue + 0.5;
}

float segmentEnvelope(float position) {
  float tail = smoothstep(0.0, max(uTailTaper, 0.001), position);
  float head = 1.0 - smoothstep(
    1.0 - max(uHeadTaper, 0.001),
    1.0,
    position
  );
  return tail * head;
}

float mirrorCoordinate(float value) {
  float wrapped = mod(value, 2.0);
  if (wrapped < 0.0) wrapped += 2.0;
  return wrapped <= 1.0 ? wrapped : 2.0 - wrapped;
}

float wrappedPaletteCoordinate(float value) {
  if (uPaletteWrap > 1.5) return mirrorCoordinate(value);
  if (uPaletteWrap > 0.5) return fract(value);
  return clamp(value, 0.0, 1.0);
}

vec3 spatialPalette(float position) {
  float wrapped = wrappedPaletteCoordinate(position - uPaletteOffset);
  float palettePosition;
  if (uPaletteWrap > 0.5 && uPaletteWrap < 1.5) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  } else {
    palettePosition = mix(
      0.5 * PALETTE_TEXEL,
      0.5 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  }
  return texture(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void sampleProfiles(
  float position,
  out float widthScale,
  out float opacityScale,
  out float intensityScale,
  out float glowScale,
  out float upperGlowSpreadScale,
  out float lowerGlowSpreadScale,
  out float reflectionScale,
  out float colorPositionOffset
) {
  float coordinate = clamp(position, 0.0, 1.0);
  vec4 primary = texture(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture(uProfiles, vec2(coordinate, 0.75));
  widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  opacityScale = primary.g * 4.0;
  intensityScale = primary.b * 4.0;
  glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  colorPositionOffset = secondary.g * 4.0 - 2.0;
}

void quadratureSource(out float sourceParameter, out float quadratureWeight) {
  int count = uQuadraturePoints > 3.0 ? 4 : 2;
  int index = gl_InstanceID % count;
  if (count == 4) {
    if (index == 0) {
      sourceParameter = 0.0694318442;
      quadratureWeight = 0.1739274226;
    } else if (index == 1) {
      sourceParameter = 0.3300094782;
      quadratureWeight = 0.3260725774;
    } else if (index == 2) {
      sourceParameter = 0.6699905218;
      quadratureWeight = 0.3260725774;
    } else {
      sourceParameter = 0.9305681558;
      quadratureWeight = 0.1739274226;
    }
  } else if (index == 0) {
    sourceParameter = 0.2113248654;
    quadratureWeight = 0.5;
  } else {
    sourceParameter = 0.7886751346;
    quadratureWeight = 0.5;
  }
}

void main() {
  float sourceParameter;
  float quadratureWeight;
  quadratureSource(sourceParameter, quadratureWeight);

  vec2 segmentStartPx = aSegmentStart * uTargetResolution;
  vec2 segmentEndPx = aSegmentEnd * uTargetResolution;
  vec2 segmentVectorPx = segmentEndPx - segmentStartPx;
  float segmentLengthPx = length(segmentVectorPx);
  vec2 tangentPx = segmentVectorPx / max(segmentLengthPx, 0.000001);
  vec2 sourcePointPx = segmentStartPx + segmentVectorPx * sourceParameter;
  float progress = mix(aProgressRange.x, aProgressRange.y, sourceParameter);
  float endpointWeight = mix(
    aEndpointWeights.x,
    aEndpointWeights.y,
    sourceParameter
  );

  float fullClosedLoop = step(0.5, uPathClosed)
    * (1.0 - step(0.5, uClosedLoopTaper));
  float position = mix(
    pathSegmentPosition(progress, uTime),
    progress,
    fullClosedLoop
  );
  float widthScale;
  float opacityScale;
  float intensityScale;
  float glowScale;
  float upperGlowSpreadScale;
  float lowerGlowSpreadScale;
  float reflectionScale;
  float colorPositionOffset;
  sampleProfiles(
    position,
    widthScale,
    opacityScale,
    intensityScale,
    glowScale,
    upperGlowSpreadScale,
    lowerGlowSpreadScale,
    reflectionScale,
    colorPositionOffset
  );
  float geometricAlpha = mix(
    pow(segmentEnvelope(position), 0.55),
    1.0,
    fullClosedLoop
  ) * endpointWeight;
  float segmentAlpha = geometricAlpha * opacityScale * uVisibility;
  float taperWidth = mix(0.025, 1.0, geometricAlpha) * widthScale;
  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  float arcWeight = segmentLengthPx * quadratureWeight;
  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  vec3 paleColor = mix(waveColor, vec3(0.90, 1.0, 0.98), 0.18);
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);

  vSourceFrame = vec4(sourcePointPx, tangentPx);
  vShape = vec4(
    taperWidth * uTargetResolution.y,
    max(uBandSpread * glowScale, 0.001),
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05)
  );
  vEnergy = vec4(intensityScale, longitudinal, segmentAlpha, arcWeight);
  vReflectionScale = reflectionScale;
  vWaveColor = waveColor;
  vPaleColor = paleColor;
  vCoreColor = coreColor;
  vReflectionColor = mix(waveColor, paleColor, 0.28);

  if (segmentLengthPx <= 0.000001 || segmentAlpha <= 0.000001) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }

  vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
  float sourceSupportCommon = uSupportRadiusBasePx * widthScale * glowScale;
  float positiveRadius = min(
    max(uSupportRadiusPositivePx, 1.0),
    max(
      sourceSupportCommon
        * max(uUpperGlowSpread * upperGlowSpreadScale, 0.02)
        + 0.5,
      1.0
    )
  );
  float negativeRadius = min(
    max(uSupportRadiusNegativePx, 1.0),
    max(
      sourceSupportCommon
        * max(uLowerGlowSpread * lowerGlowSpreadScale, 0.02)
        + 0.5,
      1.0
    )
  );
  float alongRadius = max(positiveRadius, negativeRadius);
  float acrossRadius = aCorner.y > 0.0
    ? positiveRadius
    : negativeRadius;
  vec2 positionPx = sourcePointPx
    + tangentPx * aCorner.x * alongRadius
    + normalPx * aCorner.y * acrossRadius;
  gl_Position = vec4(
    positionPx / uTargetResolution * 2.0 - 1.0,
    0.0,
    1.0
  );
}
`;

export const PATH_SOURCE_INTEGRAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

flat in vec4 vSourceFrame;
flat in vec4 vShape;
flat in vec4 vEnergy;
flat in float vReflectionScale;
flat in vec3 vWaveColor;
flat in vec3 vPaleColor;
flat in vec3 vCoreColor;
flat in vec3 vReflectionColor;

layout(location = 0) out vec4 outWave;
layout(location = 1) out vec4 outReflection;

uniform vec2 uTargetResolution;
uniform vec2 uCanvasResolution;
uniform sampler2D uK0Lut;
uniform mat3 uHueMatrix;
uniform vec4 uLayerMask0;
uniform vec2 uLayerMask1;
uniform float uBrightness;
uniform float uGlowAsymmetry;
uniform vec4 uMaterialWeights0;
uniform vec4 uMaterialWeights1;

const float PI = 3.14159265358979323846;
const float K0_MAX_ARGUMENT = ${HERO_PATH_K0_MAX_ARGUMENT.toFixed(8)};
const float K0_MIN_ARGUMENT = ${HERO_PATH_K0_MIN_ARGUMENT.toFixed(8)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float sampleK0(float argument) {
  if (argument >= K0_MAX_ARGUMENT) return 0.0;
  float normalized = sqrt(
    clamp(
      max(argument, K0_MIN_ARGUMENT) / K0_MAX_ARGUMENT,
      0.0,
      1.0
    )
  );
  return texture(uK0Lut, vec2(normalized, 0.5)).r;
}

float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

void main() {
  vec2 offset = gl_FragCoord.xy - vSourceFrame.xy;
  vec2 tangent = vSourceFrame.zw;
  float signedPerpendicular =
    tangent.x * offset.y - tangent.y * offset.x;
  float perpendicularDistance = abs(signedPerpendicular);
  float sideDirection = signedPerpendicular >= 0.0 ? 1.0 : -1.0;
  float normalizedPerpendicular =
    perpendicularDistance / max(vShape.x, 0.000001);
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, normalizedPerpendicular);
  float directionalSpread = mix(vShape.z, vShape.w, upperSide);
  float profileSpread = vShape.y * directionalSpread * vShape.x;
  float pixelRadius = 0.08;
  float radialDistance = sqrt(
    dot(offset, offset) + pixelRadius * pixelRadius
  );

  float atmosphere = uLayerMask0.x
    * lineKernel(4.6, radialDistance, profileSpread);
  float broad = uLayerMask0.y
    * lineKernel(6.2, radialDistance, profileSpread);
  float body = uLayerMask0.z
    * lineKernel(11.0, radialDistance, profileSpread);
  float ridge = uLayerMask0.w
    * lineKernel(20.0, radialDistance, profileSpread);
  float core = uLayerMask1.x
    * lineKernel(92.0, radialDistance, profileSpread);
  float veil = uLayerMask1.y
    * lineKernel(25.0, radialDistance, profileSpread);

  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, normalizedPerpendicular);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, normalizedPerpendicular);
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;

  vec3 sourceWave = (
      vWaveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + vWaveColor * broad * uMaterialWeights0.y * outerBloom
      + vWaveColor * body * uMaterialWeights0.z * bodyBloom
      + vPaleColor * ridge * uMaterialWeights0.w
      + vCoreColor * core * uMaterialWeights1.x
      + vWaveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * vEnergy.x
      * vEnergy.y * vEnergy.z * vEnergy.w;
  sourceWave = uHueMatrix * sourceWave;
  float waveLuminance = dot(sourceWave, LUMA);
  float saturationBase = 1.0 - clamp(core * vEnergy.w, 0.0, 1.0);
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), sourceWave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  vec3 wave = saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
  float reflectionEnergy = (
      broad * 0.36 + body * 0.54 + ridge * 0.34
    ) * vEnergy.z * vReflectionScale * vEnergy.w;

  outWave = vec4(wave, core * vEnergy.w);
  outReflection = vec4(
    vReflectionColor * reflectionEnergy,
    reflectionEnergy
  );
}
`;

export const PATH_INTEGRAL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aCorner;
in vec2 aSegmentStart;
in vec2 aSegmentEnd;
in vec2 aProgressRange;
in vec2 aEndpointWeights;

uniform vec2 uTargetResolution;
uniform float uSupportRadiusPositivePx;
uniform float uSupportRadiusNegativePx;

flat out vec2 vSegmentStart;
flat out vec2 vSegmentEnd;
flat out vec2 vProgressRange;
flat out vec2 vEndpointWeights;

void main() {
  vec2 startPx = aSegmentStart * uTargetResolution;
  vec2 endPx = aSegmentEnd * uTargetResolution;
  vec2 direction = endPx - startPx;
  float directionLength = max(length(direction), 0.0001);
  vec2 tangent = direction / directionLength;
  vec2 normal = vec2(-tangent.y, tangent.x);
  float positiveRadius = max(uSupportRadiusPositivePx, 1.0);
  float negativeRadius = max(uSupportRadiusNegativePx, 1.0);
  float alongRadius = max(positiveRadius, negativeRadius);
  float acrossRadius = aCorner.y > 0.0
    ? positiveRadius
    : negativeRadius;
  vec2 base = aCorner.x < 0.0 ? startPx : endPx;
  vec2 positionPx = base
    + tangent * aCorner.x * alongRadius
    + normal * aCorner.y * acrossRadius;

  gl_Position = vec4(
    positionPx / uTargetResolution * 2.0 - 1.0,
    0.0,
    1.0
  );
  vSegmentStart = aSegmentStart;
  vSegmentEnd = aSegmentEnd;
  vProgressRange = aProgressRange;
  vEndpointWeights = aEndpointWeights;
}
`;

export const PATH_INTEGRAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

flat in vec2 vSegmentStart;
flat in vec2 vSegmentEnd;
flat in vec2 vProgressRange;
flat in vec2 vEndpointWeights;

layout(location = 0) out vec4 outWave;
layout(location = 1) out vec4 outReflection;

uniform vec2 uTargetResolution;
uniform vec2 uCanvasResolution;
uniform sampler2D uPalette;
uniform sampler2D uK0Lut;
uniform sampler2D uProfiles;
uniform mat3 uHueMatrix;
uniform vec4 uLayerMask0;
uniform vec2 uLayerMask1;
uniform float uQuadraturePoints;
uniform float uTime;
uniform float uCurveTravel;
uniform float uEnvelopeStationary;
uniform float uStationaryCenter;
uniform float uSegmentLength;
uniform float uTailTaper;
uniform float uHeadTaper;
uniform float uPathClosed;
uniform float uClosedLoopTaper;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;
uniform float uPaletteOffset;
uniform float uPaletteWrap;
uniform vec4 uMaterialWeights0;
uniform vec4 uMaterialWeights1;
uniform float uVelocityWidthScale;
uniform float uVelocityGlowScale;
uniform float uVelocityReflectionScale;
uniform float uVisibility;

const float PI = 3.14159265358979323846;
const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const float K0_MAX_ARGUMENT = ${HERO_PATH_K0_MAX_ARGUMENT.toFixed(8)};
const float K0_MIN_ARGUMENT = ${HERO_PATH_K0_MIN_ARGUMENT.toFixed(8)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float segmentCenter(float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  float outsidePadding = 0.06;
  float firstCenter = -0.5 * lengthValue - outsidePadding;
  float cycleLength = 1.0 + lengthValue + 2.0 * outsidePadding;
  float centeredOffset = 0.5 - firstCenter;
  float travelingCenter = firstCenter + mod(
    time * uCurveTravel + centeredOffset,
    cycleLength
  );
  return mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
}

float segmentPositionForValue(float value, float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  return (
    value - (segmentCenter(time) - 0.5 * lengthValue)
  ) / lengthValue;
}

float pathSegmentPosition(float progress, float time) {
  if (uPathClosed < 0.5) {
    return segmentPositionForValue(progress, time);
  }
  float lengthValue = min(max(uSegmentLength, 0.05), 0.98);
  float travelingCenter = fract(time * uCurveTravel + 0.5);
  float center = mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
  float delta = mod(progress - center + 0.5, 1.0) - 0.5;
  return delta / lengthValue + 0.5;
}

float segmentEnvelope(float position) {
  float tail = smoothstep(0.0, max(uTailTaper, 0.001), position);
  float head = 1.0 - smoothstep(
    1.0 - max(uHeadTaper, 0.001),
    1.0,
    position
  );
  return tail * head;
}

float mirrorCoordinate(float value) {
  float wrapped = mod(value, 2.0);
  if (wrapped < 0.0) wrapped += 2.0;
  return wrapped <= 1.0 ? wrapped : 2.0 - wrapped;
}

float wrappedPaletteCoordinate(float value) {
  if (uPaletteWrap > 1.5) return mirrorCoordinate(value);
  if (uPaletteWrap > 0.5) return fract(value);
  return clamp(value, 0.0, 1.0);
}

vec3 spatialPalette(float position) {
  float wrapped = wrappedPaletteCoordinate(position - uPaletteOffset);
  float palettePosition;
  if (uPaletteWrap > 0.5 && uPaletteWrap < 1.5) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  } else {
    palettePosition = mix(
      0.5 * PALETTE_TEXEL,
      0.5 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  }
  return texture(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void sampleProfiles(
  float position,
  out float widthScale,
  out float opacityScale,
  out float intensityScale,
  out float glowScale,
  out float upperGlowSpreadScale,
  out float lowerGlowSpreadScale,
  out float reflectionScale,
  out float colorPositionOffset
) {
  float coordinate = clamp(position, 0.0, 1.0);
  vec4 primary = texture(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture(uProfiles, vec2(coordinate, 0.75));
  widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  opacityScale = primary.g * 4.0;
  intensityScale = primary.b * 4.0;
  glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  colorPositionOffset = secondary.g * 4.0 - 2.0;
}

float sampleK0(float argument) {
  if (argument >= K0_MAX_ARGUMENT) return 0.0;
  float normalized = sqrt(
    clamp(
      max(argument, K0_MIN_ARGUMENT) / K0_MAX_ARGUMENT,
      0.0,
      1.0
    )
  );
  return texture(uK0Lut, vec2(normalized, 0.5)).r;
}

float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

void accumulateSource(
  float sourceParameter,
  float quadratureWeight,
  vec2 query,
  vec2 segmentStart,
  vec2 segmentVector,
  vec2 tangent,
  float segmentLength,
  inout vec3 waveSum,
  inout float coreSum,
  inout vec3 reflectionColorSum,
  inout float reflectionEnergySum
) {
  vec2 sourcePoint = segmentStart + segmentVector * sourceParameter;
  vec2 offset = query - sourcePoint;
  float signedPerpendicular =
    tangent.x * offset.y - tangent.y * offset.x;
  float perpendicularDistance = abs(signedPerpendicular);
  float sideDirection = signedPerpendicular >= 0.0 ? 1.0 : -1.0;
  float progress = mix(
    vProgressRange.x,
    vProgressRange.y,
    sourceParameter
  );
  float endpointWeight = mix(
    vEndpointWeights.x,
    vEndpointWeights.y,
    sourceParameter
  );

  float fullClosedLoop = step(0.5, uPathClosed)
    * (1.0 - step(0.5, uClosedLoopTaper));
  float position = mix(
    pathSegmentPosition(progress, uTime),
    progress,
    fullClosedLoop
  );
  float widthScale;
  float opacityScale;
  float intensityScale;
  float glowScale;
  float upperGlowSpreadScale;
  float lowerGlowSpreadScale;
  float reflectionScale;
  float colorPositionOffset;
  sampleProfiles(
    position,
    widthScale,
    opacityScale,
    intensityScale,
    glowScale,
    upperGlowSpreadScale,
    lowerGlowSpreadScale,
    reflectionScale,
    colorPositionOffset
  );
  float geometricAlpha = mix(
    pow(segmentEnvelope(position), 0.55),
    1.0,
    fullClosedLoop
  ) * endpointWeight;
  float segmentAlpha = geometricAlpha * opacityScale * uVisibility;
  if (segmentAlpha <= 0.000001) return;

  float taperWidth = mix(0.025, 1.0, geometricAlpha) * widthScale;
  float normalizedPerpendicular =
    perpendicularDistance / max(taperWidth, 0.000001);
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, normalizedPerpendicular);
  float directionalSpread = mix(
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05),
    upperSide
  );
  float profileSpread =
    max(uBandSpread * glowScale, 0.001)
    * directionalSpread * taperWidth;
  float pixelRadius = 0.08 / max(uTargetResolution.y, 1.0);
  float radialDistance = sqrt(
    dot(offset, offset) + pixelRadius * pixelRadius
  );

  float atmosphere = uLayerMask0.x
    * lineKernel(4.6, radialDistance, profileSpread);
  float broad = uLayerMask0.y
    * lineKernel(6.2, radialDistance, profileSpread);
  float body = uLayerMask0.z
    * lineKernel(11.0, radialDistance, profileSpread);
  float ridge = uLayerMask0.w
    * lineKernel(20.0, radialDistance, profileSpread);
  float core = uLayerMask1.x
    * lineKernel(92.0, radialDistance, profileSpread);
  float veil = uLayerMask1.y
    * lineKernel(25.0, radialDistance, profileSpread);
  float arcWeight = segmentLength * quadratureWeight;

  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  vec3 paleColor = mix(
    waveColor,
    vec3(0.90, 1.0, 0.98),
    0.18
  );
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);
  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, normalizedPerpendicular);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, normalizedPerpendicular);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;

  vec3 sourceWave = (
      waveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + waveColor * broad * uMaterialWeights0.y * outerBloom
      + waveColor * body * uMaterialWeights0.z * bodyBloom
      + paleColor * ridge * uMaterialWeights0.w
      + coreColor * core * uMaterialWeights1.x
      + waveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * intensityScale
      * longitudinal * segmentAlpha * arcWeight;
  sourceWave = uHueMatrix * sourceWave;
  float waveLuminance = dot(sourceWave, LUMA);
  float saturationBase = 1.0 - clamp(core * arcWeight, 0.0, 1.0);
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), sourceWave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  waveSum += saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
  coreSum += core * arcWeight;

  float reflectionEnergy = (
      broad * 0.36 + body * 0.54 + ridge * 0.34
    ) * segmentAlpha * reflectionScale * arcWeight;
  vec3 reflectionColor = mix(waveColor, paleColor, 0.28);
  reflectionColorSum += reflectionColor * reflectionEnergy;
  reflectionEnergySum += reflectionEnergy;
}

void main() {
  float aspect = uCanvasResolution.x
    / max(uCanvasResolution.y, 1.0);
  vec2 queryUv = gl_FragCoord.xy / uTargetResolution;
  vec2 query = vec2(queryUv.x * aspect, queryUv.y);
  vec2 start = vec2(vSegmentStart.x * aspect, vSegmentStart.y);
  vec2 end = vec2(vSegmentEnd.x * aspect, vSegmentEnd.y);
  vec2 segmentVector = end - start;
  float segmentLength = length(segmentVector);
  if (segmentLength <= 0.000001) discard;
  vec2 tangent = segmentVector / segmentLength;

  vec3 waveSum = vec3(0.0);
  float coreSum = 0.0;
  vec3 reflectionColorSum = vec3(0.0);
  float reflectionEnergySum = 0.0;

  if (uQuadraturePoints > 3.0) {
    accumulateSource(0.0694318442, 0.1739274226, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.3300094782, 0.3260725774, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.6699905218, 0.3260725774, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.9305681558, 0.1739274226, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
  } else {
    accumulateSource(0.2113248654, 0.5, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.7886751346, 0.5, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
  }

  outWave = vec4(waveSum, coreSum);
  outReflection = vec4(
    reflectionColorSum,
    reflectionEnergySum
  );
}
`;

const PATH_INTEGRAL_ALL_LAYER_EVALUATION = `  float atmosphere = uLayerMask0.x
    * lineKernel(4.6, radialDistance, profileSpread);
  float broad = uLayerMask0.y
    * lineKernel(6.2, radialDistance, profileSpread);
  float body = uLayerMask0.z
    * lineKernel(11.0, radialDistance, profileSpread);
  float ridge = uLayerMask0.w
    * lineKernel(20.0, radialDistance, profileSpread);
  float core = uLayerMask1.x
    * lineKernel(92.0, radialDistance, profileSpread);
  float veil = uLayerMask1.y
    * lineKernel(25.0, radialDistance, profileSpread);`;

const PATH_INTEGRAL_LAYER_EVALUATIONS = [
  `  if (
    4.6 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = lineKernel(4.6, radialDistance, profileSpread);
  float broad = lineKernel(6.2, radialDistance, profileSpread);
  float body = lineKernel(11.0, radialDistance, profileSpread);
  float ridge = 0.0;
  float core = 0.0;
  float veil = 0.0;`,
  `  if (
    20.0 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = lineKernel(20.0, radialDistance, profileSpread);
  float core = 0.0;
  float veil = lineKernel(25.0, radialDistance, profileSpread);`,
  `  if (
    92.0 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = 0.0;
  float core = lineKernel(92.0, radialDistance, profileSpread);
  float veil = 0.0;`,
] as const;

/**
 * The generic shader remains exported as the frozen parity reference. Runtime
 * rendering uses compile-time layer specialization so each HDR pass evaluates
 * only the kernels it can actually contribute.
 */
export const PATH_INTEGRAL_FRAGMENT_SHADERS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];

const PATH_SOURCE_INTEGRAL_LAYER_EVALUATIONS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    evaluation.replaceAll("  ) return;", "  ) discard;"),
  );

export const PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS =
  PATH_SOURCE_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_SOURCE_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];

export const PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uFarWave;
uniform sampler2D uFarReflection;
uniform sampler2D uMidWave;
uniform sampler2D uMidReflection;
uniform sampler2D uCoreWave;
uniform sampler2D uFarWaveNext;
uniform sampler2D uFarReflectionNext;
uniform sampler2D uMidWaveNext;
uniform sampler2D uMidReflectionNext;
uniform sampler2D uCoreWaveNext;
uniform float uTemporalMix;
uniform sampler2D uDotMask;
uniform float uSpacing;
uniform float uDotR;
uniform float uDotAlpha;
uniform float uTwinkle;
uniform float uReflect;
uniform float uNoisePhase;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uDotPointerBrightness;
uniform vec3 uDotPointerColor;
uniform float uDotPointerColorStrength;
uniform float uDotPointerMagnification;
uniform sampler2D uBackgroundImage;
uniform float uBackgroundOpacity;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

${COMMON_THEME_GLSL}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec4 composeDots(
  vec2 fragmentCoordinate,
  vec2 uv,
  float reflectionEnergy,
  vec3 reflectionColor
) {
  vec2 pointerCoordinate = uDotPointer * uRes;
  float pointerDistance = length(fragmentCoordinate - pointerCoordinate);
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  float pointerInfluence = uDotPointerActive * (
    1.0 - smoothstep(
      pointerInnerRadius,
      max(uDotPointerRadius, pointerInnerRadius + 0.001),
      pointerDistance
    )
  );
  float magnification = mix(
    1.0,
    max(uDotPointerMagnification, 0.25),
    pointerInfluence
  );
  vec2 sampledCoordinate = pointerCoordinate +
    (fragmentCoordinate - pointerCoordinate) / magnification;
  vec2 grid = mix(fragmentCoordinate, sampledCoordinate, pointerInfluence)
    / uSpacing;
  vec2 cellId = floor(grid);
  vec2 cellPosition = (fract(grid) - 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2))
      + random1 * 6.2831
  );
  pulse *= pulse;
  float twinklePulse = mix(pulse, 1.0 - pulse, lightThemeMix());
  float dotScale = (1.0 + 0.5 * uTwinkle * twinklePulse) * magnification;
  float dotAmplitude = mix(
    0.55,
    0.35 + 0.65 * twinklePulse,
    uTwinkle
  );
  float sigma = max(uDotR * dotScale, 0.0001);
  float dotSignal = exp(
    -radiusSquared / (2.0 * sigma * sigma)
  ) * dotAmplitude;
  float dotMask = texture(uDotMask, uv).r;
  float reflected = clamp(
    reflectionEnergy * uReflect,
    0.0,
    1.0
  );
  vec3 dotColor = mix(
    vec3(0.62, 0.66, 0.72),
    reflectionColor,
    0.10 + 0.85 * reflected
  );
  dotColor = mix(
    dotColor,
    uDotPointerColor,
    pointerInfluence * uDotPointerColorStrength
  );
  float dotLuminance =
    uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  float dotEnergy = dotSignal * dotLuminance *
    max(0.0, 1.0 + pointerInfluence * uDotPointerBrightness);
  vec3 darkContribution = dotColor * dotEnergy;
  vec3 lightDotColor = mix(
    vec3(0.30, 0.32, 0.36),
    lightThemeTintColor(reflectionColor),
    0.10 + 0.72 * reflected
  );
  float lightCoverage = clamp(dotEnergy * 1.55, 0.0, 0.82);
  float lightTheme = lightThemeMix();
  return vec4(
    mix(darkContribution, lightDotColor, lightTheme),
    lightCoverage * lightTheme
  );
}

float displayNoise(vec2 fragmentCoordinate) {
  return (
    hash21(fragmentCoordinate + uNoisePhase) - 0.5
  ) / 255.0 * 2.0;
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;
  vec4 farWave = mix(
    texture(uFarWave, uv),
    texture(uFarWaveNext, uv),
    uTemporalMix
  );
  vec4 midWave = mix(
    texture(uMidWave, uv),
    texture(uMidWaveNext, uv),
    uTemporalMix
  );
  vec4 coreWave = mix(
    texture(uCoreWave, uv),
    texture(uCoreWaveNext, uv),
    uTemporalMix
  );
  vec3 wave = farWave.rgb + midWave.rgb + coreWave.rgb;

  vec4 farReflection = mix(
    texture(uFarReflection, uv),
    texture(uFarReflectionNext, uv),
    uTemporalMix
  );
  vec4 midReflection = mix(
    texture(uMidReflection, uv),
    texture(uMidReflectionNext, uv),
    uTemporalMix
  );
  vec4 reflection = farReflection + midReflection;
  float reflectionEnergy = reflection.a;
  vec3 reflectionColor = reflectionEnergy > 0.000001
    ? reflection.rgb / reflectionEnergy
    : vec3(0.90, 0.95, 1.0);

  vec4 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  float lightTheme = lightThemeMix();
  vec4 imageBackground = texture(uBackgroundImage, uv);
  vec3 background = mix(
    themeBackground(uv),
    imageBackground.rgb,
    imageBackground.a * uBackgroundOpacity
  );
  vec3 color = composeThemedWave(background, wave);
  color += dots.rgb * (1.0 - lightTheme);
  color = mix(color, dots.rgb, dots.a);
  color += displayNoise(fragmentCoordinate) * (1.0 - lightTheme);
  fragmentColor = vec4(color, 1.0);
}
`;

export const PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 uRes;
uniform sampler2D uFarWave;
uniform sampler2D uMidWave;
uniform sampler2D uCoreWave;
uniform sampler2D uFarWaveNext;
uniform sampler2D uMidWaveNext;
uniform sampler2D uCoreWaveNext;
uniform float uTemporalMix;
uniform float uNoisePhase;
uniform sampler2D uBackgroundImage;
uniform float uBackgroundOpacity;

${COMMON_THEME_GLSL}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float displayNoise(vec2 fragmentCoordinate) {
  return (
    hash21(fragmentCoordinate + uNoisePhase) - 0.5
  ) / 255.0 * 2.0;
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;
  vec3 wave = mix(
      texture(uFarWave, uv).rgb,
      texture(uFarWaveNext, uv).rgb,
      uTemporalMix
    )
    + mix(
      texture(uMidWave, uv).rgb,
      texture(uMidWaveNext, uv).rgb,
      uTemporalMix
    )
    + mix(
      texture(uCoreWave, uv).rgb,
      texture(uCoreWaveNext, uv).rgb,
      uTemporalMix
    );
  float lightTheme = lightThemeMix();
  vec4 imageBackground = texture(uBackgroundImage, uv);
  vec3 background = mix(
    themeBackground(uv),
    imageBackground.rgb,
    imageBackground.a * uBackgroundOpacity
  );
  vec3 color = composeThemedWave(background, wave);
  color += displayNoise(fragmentCoordinate) * (1.0 - lightTheme);
  fragmentColor = vec4(color, 1.0);
}
`;

export const PATH_DOTS_IDLE_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uSpacing;
uniform float uDotR;
uniform float uTwinkle;
uniform float uThemeMode;

flat out vec2 vCellId;
flat out float vSigma;
flat out float vDotAmplitude;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec2 cornerForVertex(int index) {
  if (index == 0) return vec2(-1.0, -1.0);
  if (index == 1) return vec2( 1.0, -1.0);
  if (index == 2) return vec2( 1.0,  1.0);
  if (index == 3) return vec2(-1.0, -1.0);
  if (index == 4) return vec2( 1.0,  1.0);
  return vec2(-1.0, 1.0);
}

void main() {
  float spacing = max(uSpacing, 1.0);
  int columns = max(1, int(ceil(uRes.x / spacing)));
  int cellX = gl_InstanceID - (gl_InstanceID / columns) * columns;
  int cellY = gl_InstanceID / columns;
  vec2 cellId = vec2(float(cellX), float(cellY));
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2))
      + random1 * 6.2831
  );
  pulse *= pulse;
  float lightTheme = clamp(uThemeMode, 0.0, 1.0);
  float twinklePulse = mix(pulse, 1.0 - pulse, lightTheme);
  float dotScale = 1.0 + 0.5 * uTwinkle * twinklePulse;
  float sigma = max(uDotR * dotScale, 0.0001);
  float dotAmplitude = mix(
    0.55,
    0.35 + 0.65 * twinklePulse,
    uTwinkle
  );
  // Five sigma leaves less than 3e-6 of the peak energy outside the quad.
  float halfExtent = min(spacing * 0.5, max(1.0, sigma * 5.0));
  vec2 center = (cellId + 0.5) * spacing;
  vec2 position = center + cornerForVertex(gl_VertexID) * halfExtent;
  gl_Position = vec4(position / max(uRes, vec2(1.0)) * 2.0 - 1.0, 0.0, 1.0);
  vCellId = cellId;
  vSigma = sigma;
  vDotAmplitude = dotAmplitude;
}
`;

export const PATH_DOTS_IDLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 uRes;
uniform sampler2D uFarReflection;
uniform sampler2D uMidReflection;
uniform sampler2D uFarReflectionNext;
uniform sampler2D uMidReflectionNext;
uniform float uTemporalMix;
uniform sampler2D uDotMask;
uniform float uSpacing;
uniform float uDotAlpha;
uniform float uReflect;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;

flat in vec2 vCellId;
flat in float vSigma;
flat in float vDotAmplitude;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

${COMMON_THEME_GLSL}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 pointerCoordinate = uDotPointer * uRes;
  if (
    uDotPointerActive > 0.5 &&
    length(fragmentCoordinate - pointerCoordinate) < uDotPointerRadius
  ) {
    discard;
  }
  vec2 uv = fragmentCoordinate / uRes;
  vec2 cellPosition = fragmentCoordinate - (vCellId + 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float dotSignal = exp(
    -radiusSquared / (2.0 * vSigma * vSigma)
  ) * vDotAmplitude;
  vec4 reflection = mix(
      texture(uFarReflection, uv),
      texture(uFarReflectionNext, uv),
      uTemporalMix
    )
    + mix(
      texture(uMidReflection, uv),
      texture(uMidReflectionNext, uv),
      uTemporalMix
    );
  float reflectionEnergy = reflection.a;
  vec3 reflectionColor = reflectionEnergy > 0.000001
    ? reflection.rgb / reflectionEnergy
    : vec3(0.90, 0.95, 1.0);
  float dotMask = texture(uDotMask, uv).r;
  float reflected = clamp(reflectionEnergy * uReflect, 0.0, 1.0);
  vec3 dotColor = mix(
    vec3(0.62, 0.66, 0.72),
    reflectionColor,
    0.10 + 0.85 * reflected
  );
  float dotLuminance = uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  float dotEnergy = dotSignal * dotLuminance;
  vec3 darkContribution = dotColor * dotEnergy;
  vec3 lightDotColor = mix(
    vec3(0.30, 0.32, 0.36),
    lightThemeTintColor(reflectionColor),
    0.10 + 0.72 * reflected
  );
  float lightCoverage = clamp(dotEnergy * 1.55, 0.0, 0.82);
  float lightTheme = lightThemeMix();
  fragmentColor = vec4(
    mix(darkContribution, lightDotColor, lightTheme),
    lightCoverage * lightTheme
  );
}
`;

export const PATH_DOTS_POINTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uFarReflection;
uniform sampler2D uMidReflection;
uniform sampler2D uFarReflectionNext;
uniform sampler2D uMidReflectionNext;
uniform float uTemporalMix;
uniform sampler2D uDotMask;
uniform float uSpacing;
uniform float uDotR;
uniform float uDotAlpha;
uniform float uTwinkle;
uniform float uReflect;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uDotPointerBrightness;
uniform vec3 uDotPointerColor;
uniform float uDotPointerColorStrength;
uniform float uDotPointerMagnification;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

${COMMON_THEME_GLSL}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 pointerCoordinate = uDotPointer * uRes;
  float pointerDistance = length(fragmentCoordinate - pointerCoordinate);
  if (uDotPointerActive <= 0.5 || pointerDistance >= uDotPointerRadius) {
    discard;
  }
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  float pointerInfluence = 1.0 - smoothstep(
    pointerInnerRadius,
    max(uDotPointerRadius, pointerInnerRadius + 0.001),
    pointerDistance
  );
  float magnification = mix(
    1.0,
    max(uDotPointerMagnification, 0.25),
    pointerInfluence
  );
  vec2 sampledCoordinate = pointerCoordinate
    + (fragmentCoordinate - pointerCoordinate) / magnification;
  vec2 grid = mix(fragmentCoordinate, sampledCoordinate, pointerInfluence)
    / uSpacing;
  vec2 cellId = floor(grid);
  vec2 cellPosition = (fract(grid) - 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2))
      + random1 * 6.2831
  );
  pulse *= pulse;
  float twinklePulse = mix(pulse, 1.0 - pulse, lightThemeMix());
  float dotScale = (1.0 + 0.5 * uTwinkle * twinklePulse) * magnification;
  float dotAmplitude = mix(0.55, 0.35 + 0.65 * twinklePulse, uTwinkle);
  float sigma = max(uDotR * dotScale, 0.0001);
  float dotSignal = exp(-radiusSquared / (2.0 * sigma * sigma)) * dotAmplitude;
  vec2 uv = fragmentCoordinate / uRes;
  vec4 reflection = mix(
      texture(uFarReflection, uv),
      texture(uFarReflectionNext, uv),
      uTemporalMix
    )
    + mix(
      texture(uMidReflection, uv),
      texture(uMidReflectionNext, uv),
      uTemporalMix
    );
  float reflectionEnergy = reflection.a;
  vec3 reflectionColor = reflectionEnergy > 0.000001
    ? reflection.rgb / reflectionEnergy
    : vec3(0.90, 0.95, 1.0);
  float dotMask = texture(uDotMask, uv).r;
  float reflected = clamp(reflectionEnergy * uReflect, 0.0, 1.0);
  vec3 dotColor = mix(
    vec3(0.62, 0.66, 0.72),
    reflectionColor,
    0.10 + 0.85 * reflected
  );
  dotColor = mix(
    dotColor,
    uDotPointerColor,
    pointerInfluence * uDotPointerColorStrength
  );
  float dotLuminance = uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  float dotEnergy = dotSignal * dotLuminance
    * max(0.0, 1.0 + pointerInfluence * uDotPointerBrightness);
  vec3 darkContribution = dotColor * dotEnergy;
  vec3 lightDotColor = mix(
    vec3(0.30, 0.32, 0.36),
    lightThemeTintColor(reflectionColor),
    0.10 + 0.72 * reflected
  );
  float lightCoverage = clamp(dotEnergy * 1.55, 0.0, 0.82);
  float lightTheme = lightThemeMix();
  fragmentColor = vec4(
    mix(darkContribution, lightDotColor, lightTheme),
    lightCoverage * lightTheme
  );
}
`;

function specializeStaticPathShader(
  source: string,
  replacements: readonly (readonly [string, string])[],
  label: string,
) {
  let result = source;
  for (const [before, after] of replacements) {
    const next = result.replace(before, after);
    if (next === result) {
      throw new Error(
        `Unable to specialize static path shader ${label}: expected block is missing.`,
      );
    }
    result = next;
  }
  return result;
}

const STATIC_WAVE_REPLACEMENTS = [
  [
    `  vec4 farWave = mix(
    texture(uFarWave, uv),
    texture(uFarWaveNext, uv),
    uTemporalMix
  );`,
    `  vec4 farWave = texture(uFarWave, uv);`,
  ],
  [
    `  vec4 midWave = mix(
    texture(uMidWave, uv),
    texture(uMidWaveNext, uv),
    uTemporalMix
  );`,
    `  vec4 midWave = texture(uMidWave, uv);`,
  ],
  [
    `  vec4 coreWave = mix(
    texture(uCoreWave, uv),
    texture(uCoreWaveNext, uv),
    uTemporalMix
  );`,
    `  vec4 coreWave = texture(uCoreWave, uv);`,
  ],
  [
    `  vec4 farReflection = mix(
    texture(uFarReflection, uv),
    texture(uFarReflectionNext, uv),
    uTemporalMix
  );`,
    `  vec4 farReflection = texture(uFarReflection, uv);`,
  ],
  [
    `  vec4 midReflection = mix(
    texture(uMidReflection, uv),
    texture(uMidReflectionNext, uv),
    uTemporalMix
  );`,
    `  vec4 midReflection = texture(uMidReflection, uv);`,
  ],
] as const;

const STATIC_BASE_WAVE_REPLACEMENTS = [
  [
    `  vec3 wave = mix(
      texture(uFarWave, uv).rgb,
      texture(uFarWaveNext, uv).rgb,
      uTemporalMix
    )
    + mix(
      texture(uMidWave, uv).rgb,
      texture(uMidWaveNext, uv).rgb,
      uTemporalMix
    )
    + mix(
      texture(uCoreWave, uv).rgb,
      texture(uCoreWaveNext, uv).rgb,
      uTemporalMix
    );`,
    `  vec3 wave = texture(uFarWave, uv).rgb
    + texture(uMidWave, uv).rgb
    + texture(uCoreWave, uv).rgb;`,
  ],
] as const;

const STATIC_DOT_REFLECTION_REPLACEMENTS = [
  [
    `  vec4 reflection = mix(
      texture(uFarReflection, uv),
      texture(uFarReflectionNext, uv),
      uTemporalMix
    )
    + mix(
      texture(uMidReflection, uv),
      texture(uMidReflectionNext, uv),
      uTemporalMix
    );`,
    `  vec4 reflection = texture(uFarReflection, uv)
    + texture(uMidReflection, uv);`,
  ],
] as const;

export const PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER =
  specializeStaticPathShader(
    PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
    STATIC_WAVE_REPLACEMENTS,
    "full composite",
  );

export const PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER =
  specializeStaticPathShader(
    PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,
    STATIC_BASE_WAVE_REPLACEMENTS,
    "base composite",
  );

export const PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER = specializeStaticPathShader(
  PATH_DOTS_IDLE_FRAGMENT_SHADER,
  STATIC_DOT_REFLECTION_REPLACEMENTS,
  "idle dots",
);

export const PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER =
  specializeStaticPathShader(
    PATH_DOTS_POINTER_FRAGMENT_SHADER,
    STATIC_DOT_REFLECTION_REPLACEMENTS,
    "pointer dots",
  );
