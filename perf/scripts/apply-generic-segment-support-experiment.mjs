import { readFile, writeFile } from "node:fs/promises";

const path = "src/rendering/shaders.ts";
let source = await readFile(path, "utf8");
const startMarker =
  "export const PATH_INTEGRAL_VERTEX_SHADER = `#version 300 es";
const endMarker = "`;\n\nexport const PATH_INTEGRAL_FRAGMENT_SHADER";
const start = source.indexOf(startMarker);
if (start < 0) {
  throw new Error("Unable to find generic integral vertex shader start");
}
const end = source.indexOf(endMarker, start);
if (end < 0) {
  throw new Error("Unable to find generic integral vertex shader end");
}
if (source.indexOf(startMarker, start + startMarker.length) >= 0) {
  throw new Error("Expected a unique generic integral vertex shader");
}

const shader = `export const PATH_INTEGRAL_VERTEX_SHADER = \`#version 300 es
precision highp float;

in vec2 aCorner;
in vec2 aSegmentStart;
in vec2 aSegmentEnd;
in vec2 aProgressRange;
in vec2 aEndpointWeights;

uniform vec2 uTargetResolution;
uniform float uSupportRadiusPositivePx;
uniform float uSupportRadiusNegativePx;
uniform float uSupportRadiusBasePx;
uniform sampler2D uProfiles;
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
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uVelocityWidthScale;
uniform float uVelocityGlowScale;
uniform float uVisibility;

flat out vec2 vSegmentStart;
flat out vec2 vSegmentEnd;
flat out vec2 vProgressRange;
flat out vec2 vEndpointWeights;

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

void accumulateSupport(
  float sourceParameter,
  inout float positiveRadius,
  inout float negativeRadius,
  inout float activeSource
) {
  float progress = mix(
    aProgressRange.x,
    aProgressRange.y,
    sourceParameter
  );
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
  float coordinate = clamp(position, 0.0, 1.0);
  vec4 primary = texture(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture(uProfiles, vec2(coordinate, 0.75));
  float widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  float opacityScale = primary.g * 4.0;
  float glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  float upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  float lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  float geometricAlpha = mix(
    pow(segmentEnvelope(position), 0.55),
    1.0,
    fullClosedLoop
  ) * endpointWeight;
  float segmentAlpha = geometricAlpha * opacityScale * uVisibility;
  if (segmentAlpha <= 0.000001) return;

  activeSource = 1.0;
  float commonRadius = uSupportRadiusBasePx * widthScale * glowScale;
  positiveRadius = max(
    positiveRadius,
    commonRadius
      * max(uUpperGlowSpread * upperGlowSpreadScale, 0.02)
      + 0.5
  );
  negativeRadius = max(
    negativeRadius,
    commonRadius
      * max(uLowerGlowSpread * lowerGlowSpreadScale, 0.02)
      + 0.5
  );
}

void main() {
  vSegmentStart = aSegmentStart;
  vSegmentEnd = aSegmentEnd;
  vProgressRange = aProgressRange;
  vEndpointWeights = aEndpointWeights;

  float localPositiveRadius = 0.0;
  float localNegativeRadius = 0.0;
  float activeSource = 0.0;
  if (uQuadraturePoints > 3.0) {
    accumulateSupport(
      0.0694318442,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
    accumulateSupport(
      0.3300094782,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
    accumulateSupport(
      0.6699905218,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
    accumulateSupport(
      0.9305681558,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
  } else {
    accumulateSupport(
      0.2113248654,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
    accumulateSupport(
      0.7886751346,
      localPositiveRadius,
      localNegativeRadius,
      activeSource
    );
  }

  if (activeSource < 0.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }

  vec2 startPx = aSegmentStart * uTargetResolution;
  vec2 endPx = aSegmentEnd * uTargetResolution;
  vec2 direction = endPx - startPx;
  float directionLength = max(length(direction), 0.0001);
  vec2 tangent = direction / directionLength;
  vec2 normal = vec2(-tangent.y, tangent.x);
  float positiveRadius = min(
    max(uSupportRadiusPositivePx, 1.0),
    max(localPositiveRadius, 1.0)
  );
  float negativeRadius = min(
    max(uSupportRadiusNegativePx, 1.0),
    max(localNegativeRadius, 1.0)
  );
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
}
\`;
`;

source = source.slice(0, start) + shader + source.slice(end + 2);
await writeFile(path, source);
console.log("Applied generic per-segment quadrature support bounds.");
