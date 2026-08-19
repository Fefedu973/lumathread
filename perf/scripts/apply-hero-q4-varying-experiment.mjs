import { readFile, writeFile } from "node:fs/promises";

const replaceOnce = async (path, before, after, label) => {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Unable to find ${label} in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
};

const shadersPath = "src/rendering/shaders.ts";
const shaderInsertionMarker = `export const PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER = \`#version 300 es`;
const q4Shaders = String.raw`export const PATH_SEGMENT_Q4_VERTEX_SHADER = \`#version 300 es
precision highp float;

in vec2 aCorner;
in vec2 aSegmentStart;
in vec2 aSegmentEnd;
in vec2 aProgressRange;
in vec2 aEndpointWeights;

uniform vec2 uTargetResolution;
uniform float uSupportRadiusPositivePx;
uniform float uSupportRadiusNegativePx;
uniform sampler2D uPalette;
uniform sampler2D uProfiles;
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

const float PALETTE_TEXEL = ${(1 / 1024).toFixed(10)};

flat out vec4 vSegmentFrame;
flat out vec4 vShape0;
flat out vec4 vShape1;
flat out vec4 vShape2;
flat out vec4 vShape3;
flat out vec4 vEnergy0;
flat out vec4 vEnergy1;
flat out vec4 vEnergy2;
flat out vec4 vEnergy3;
flat out vec4 vColor0;
flat out vec4 vColor1;
flat out vec4 vColor2;
flat out vec4 vColor3;

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

void populateSource(
  float sourceParameter,
  float quadratureWeight,
  float segmentLengthPx,
  out vec4 shape,
  out vec4 energy,
  out vec4 color
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
  float intensityScale = primary.b * 4.0;
  float glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  float lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  float upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  float reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  float colorPositionOffset = secondary.g * 4.0 - 2.0;
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
    smoothstep(0.08, 0.88, coordinate)
  );
  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  shape = vec4(
    taperWidth * uTargetResolution.y,
    max(uBandSpread * glowScale, 0.001),
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05)
  );
  energy = vec4(
    intensityScale,
    longitudinal,
    segmentAlpha,
    segmentLengthPx * quadratureWeight
  );
  color = vec4(waveColor, reflectionScale);
}

void main() {
  vec2 segmentStartPx = aSegmentStart * uTargetResolution;
  vec2 segmentEndPx = aSegmentEnd * uTargetResolution;
  vec2 segmentVectorPx = segmentEndPx - segmentStartPx;
  float segmentLengthPx = length(segmentVectorPx);
  vec2 tangentPx = segmentVectorPx / max(segmentLengthPx, 0.000001);
  vec2 normalPx = vec2(-tangentPx.y, tangentPx.x);
  float positiveRadius = max(uSupportRadiusPositivePx, 1.0);
  float negativeRadius = max(uSupportRadiusNegativePx, 1.0);
  float alongRadius = max(positiveRadius, negativeRadius);
  float acrossRadius = aCorner.y > 0.0
    ? positiveRadius
    : negativeRadius;
  vec2 base = aCorner.x < 0.0 ? segmentStartPx : segmentEndPx;
  vec2 positionPx = base
    + tangentPx * aCorner.x * alongRadius
    + normalPx * aCorner.y * acrossRadius;
  gl_Position = vec4(
    positionPx / uTargetResolution * 2.0 - 1.0,
    0.0,
    1.0
  );

  vSegmentFrame = vec4(segmentStartPx, segmentVectorPx);
  vShape0 = vec4(0.0);
  vShape1 = vec4(0.0);
  vShape2 = vec4(0.0);
  vShape3 = vec4(0.0);
  vEnergy0 = vec4(0.0);
  vEnergy1 = vec4(0.0);
  vEnergy2 = vec4(0.0);
  vEnergy3 = vec4(0.0);
  vColor0 = vec4(0.0);
  vColor1 = vec4(0.0);
  vColor2 = vec4(0.0);
  vColor3 = vec4(0.0);

  // Flat varyings are read from the provoking (last) vertex of each triangle.
  // The six-vertex quad has provoking vertices 2 and 5, so expensive profile
  // and palette reads run twice per segment rather than once per fragment.
  if (gl_VertexID == 2 || gl_VertexID == 5) {
    populateSource(
      0.0694318442,
      0.1739274226,
      segmentLengthPx,
      vShape0,
      vEnergy0,
      vColor0
    );
    populateSource(
      0.3300094782,
      0.3260725774,
      segmentLengthPx,
      vShape1,
      vEnergy1,
      vColor1
    );
    populateSource(
      0.6699905218,
      0.3260725774,
      segmentLengthPx,
      vShape2,
      vEnergy2,
      vColor2
    );
    populateSource(
      0.9305681558,
      0.1739274226,
      segmentLengthPx,
      vShape3,
      vEnergy3,
      vColor3
    );
  }
}
\`;

const PATH_SEGMENT_Q4_FRAGMENT_SHADER = \`#version 300 es
precision highp float;

flat in vec4 vSegmentFrame;
flat in vec4 vShape0;
flat in vec4 vShape1;
flat in vec4 vShape2;
flat in vec4 vShape3;
flat in vec4 vEnergy0;
flat in vec4 vEnergy1;
flat in vec4 vEnergy2;
flat in vec4 vEnergy3;
flat in vec4 vColor0;
flat in vec4 vColor1;
flat in vec4 vColor2;
flat in vec4 vColor3;

layout(location = 0) out vec4 outWave;
layout(location = 1) out vec4 outReflection;

uniform sampler2D uK0Lut;
uniform mat3 uHueMatrix;
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

void accumulatePrecomputedSource(
  float sourceParameter,
  vec4 shape,
  vec4 energy,
  vec4 color,
  inout vec3 waveSum,
  inout float coreSum,
  inout vec3 reflectionColorSum,
  inout float reflectionEnergySum
) {
  if (energy.z <= 0.000001) return;
  vec2 sourcePoint = vSegmentFrame.xy
    + vSegmentFrame.zw * sourceParameter;
  vec2 offset = gl_FragCoord.xy - sourcePoint;
  float segmentLengthPx = length(vSegmentFrame.zw);
  vec2 tangent = vSegmentFrame.zw / max(segmentLengthPx, 0.000001);
  float signedPerpendicular =
    tangent.x * offset.y - tangent.y * offset.x;
  float perpendicularDistance = abs(signedPerpendicular);
  float sideDirection = signedPerpendicular >= 0.0 ? 1.0 : -1.0;
  float normalizedPerpendicular =
    perpendicularDistance / max(shape.x, 0.000001);
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, normalizedPerpendicular);
  float directionalSpread = mix(shape.z, shape.w, upperSide);
  float profileSpread = shape.y * directionalSpread * shape.x;
  float radialDistance = sqrt(dot(offset, offset) + 0.08 * 0.08);

__PATH_SEGMENT_Q4_LAYER_EVALUATION__

  vec3 waveColor = color.rgb;
  vec3 paleColor = mix(
    waveColor,
    vec3(0.90, 1.0, 0.98),
    0.18
  );
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);
  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, normalizedPerpendicular);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, normalizedPerpendicular);
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;

  vec3 sourceWave = (
      waveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + waveColor * broad * uMaterialWeights0.y * outerBloom
      + waveColor * body * uMaterialWeights0.z * bodyBloom
      + paleColor * ridge * uMaterialWeights0.w
      + coreColor * core * uMaterialWeights1.x
      + waveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * energy.x
      * energy.y * energy.z * energy.w;
  sourceWave = uHueMatrix * sourceWave;
  float waveLuminance = dot(sourceWave, LUMA);
  float saturationBase = 1.0 - clamp(core * energy.w, 0.0, 1.0);
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), sourceWave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  waveSum += saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
  coreSum += core * energy.w;

  float reflectionEnergy = (
      broad * 0.36 + body * 0.54 + ridge * 0.34
    ) * energy.z * color.a * energy.w;
  vec3 reflectionColor = mix(waveColor, paleColor, 0.28);
  reflectionColorSum += reflectionColor * reflectionEnergy;
  reflectionEnergySum += reflectionEnergy;
}

void main() {
  vec3 waveSum = vec3(0.0);
  float coreSum = 0.0;
  vec3 reflectionColorSum = vec3(0.0);
  float reflectionEnergySum = 0.0;
  accumulatePrecomputedSource(
    0.0694318442,
    vShape0,
    vEnergy0,
    vColor0,
    waveSum,
    coreSum,
    reflectionColorSum,
    reflectionEnergySum
  );
  accumulatePrecomputedSource(
    0.3300094782,
    vShape1,
    vEnergy1,
    vColor1,
    waveSum,
    coreSum,
    reflectionColorSum,
    reflectionEnergySum
  );
  accumulatePrecomputedSource(
    0.6699905218,
    vShape2,
    vEnergy2,
    vColor2,
    waveSum,
    coreSum,
    reflectionColorSum,
    reflectionEnergySum
  );
  accumulatePrecomputedSource(
    0.9305681558,
    vShape3,
    vEnergy3,
    vColor3,
    waveSum,
    coreSum,
    reflectionColorSum,
    reflectionEnergySum
  );
  outWave = vec4(waveSum, coreSum);
  outReflection = vec4(reflectionColorSum, reflectionEnergySum);
}
\`;

export const PATH_SEGMENT_Q4_FRAGMENT_SHADERS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_SEGMENT_Q4_FRAGMENT_SHADER.replace(
      "__PATH_SEGMENT_Q4_LAYER_EVALUATION__",
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];

`;

await replaceOnce(
  shadersPath,
  shaderInsertionMarker,
  q4Shaders + shaderInsertionMarker,
  "path composite shader marker",
);

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  sourceIntegralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];
  compositeProgram: ProgramBundle;`,
  `  sourceIntegralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];
  segmentQ4Programs: [ProgramBundle, ProgramBundle, ProgramBundle];
  compositeProgram: ProgramBundle;`,
  "PathResources q4 program field",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `  PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS,
  PATH_SOURCE_INTEGRAL_VERTEX_SHADER,`,
  `  PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS,
  PATH_SOURCE_INTEGRAL_VERTEX_SHADER,
  PATH_SEGMENT_Q4_FRAGMENT_SHADERS,
  PATH_SEGMENT_Q4_VERTEX_SHADER,`,
  "q4 shader imports",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    for (const bundle of resources.sourceIntegralPrograms) {
      exactGl.deleteProgram(bundle.program);
    }
    exactGl.deleteProgram(resources.compositeProgram.program);`,
  `    for (const bundle of resources.sourceIntegralPrograms) {
      exactGl.deleteProgram(bundle.program);
    }
    for (const bundle of resources.segmentQ4Programs) {
      exactGl.deleteProgram(bundle.program);
    }
    exactGl.deleteProgram(resources.compositeProgram.program);`,
  "q4 program cleanup",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    const integralPrograms: ProgramBundle[] = [];
    const sourceIntegralPrograms: ProgramBundle[] = [];
    let compositeProgram: ProgramBundle | null = null;`,
  `    const integralPrograms: ProgramBundle[] = [];
    const sourceIntegralPrograms: ProgramBundle[] = [];
    const segmentQ4Programs: ProgramBundle[] = [];
    let compositeProgram: ProgramBundle | null = null;`,
  "q4 program declaration",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (const fragmentShader of PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS) {
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
      compositeProgram = createProgramBundle(`,
  `      for (const fragmentShader of PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS) {
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
      for (const fragmentShader of PATH_SEGMENT_Q4_FRAGMENT_SHADERS) {
        segmentQ4Programs.push(
          createProgramBundle(
            exactGl,
            PATH_SEGMENT_Q4_VERTEX_SHADER,
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
      compositeProgram = createProgramBundle(`,
  "q4 program compilation",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        sourceIntegralPrograms: [
          sourceIntegralPrograms[0]!,
          sourceIntegralPrograms[1]!,
          sourceIntegralPrograms[2]!,
        ],
        compositeProgram,`,
  `        sourceIntegralPrograms: [
          sourceIntegralPrograms[0]!,
          sourceIntegralPrograms[1]!,
          sourceIntegralPrograms[2]!,
        ],
        segmentQ4Programs: [
          segmentQ4Programs[0]!,
          segmentQ4Programs[1]!,
          segmentQ4Programs[2]!,
        ],
        compositeProgram,`,
  "q4 program resource assignment",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (const bundle of sourceIntegralPrograms) {
        exactGl.deleteProgram(bundle.program);
      }
      if (compositeProgram) exactGl.deleteProgram(compositeProgram.program);`,
  `      for (const bundle of sourceIntegralPrograms) {
        exactGl.deleteProgram(bundle.program);
      }
      for (const bundle of segmentQ4Programs) {
        exactGl.deleteProgram(bundle.program);
      }
      if (compositeProgram) exactGl.deleteProgram(compositeProgram.program);`,
  "q4 failure cleanup",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const shouldUseSourceInstancedQuadrature = (settings: Settings) =>
    settings.motionMode === "anchored" &&
    settings.quality.quadrature >= 4 &&
    settings.segmentLength >= 0.999 &&
    settings.headTaper <= 0.001001;`,
  `  const shouldUseSourceInstancedQuadrature = (settings: Settings) =>
    settings.motionMode === "anchored" &&
    settings.quality.quadrature >= 4 &&
    settings.segmentLength >= 0.999 &&
    settings.headTaper <= 0.001001;

  const shouldUseSegmentQ4Varyings = (settings: Settings, pass: number) =>
    settings.motionMode === "travel" &&
    settings.quality.quadrature >= 4 &&
    settings.segmentLength >= 0.999 &&
    pass >= HERO_PATH_PASS_MID;`,
  "q4 runtime selector",
);
await replaceOnce(
  "src/runtime/path-renderer.ts",
  `        const sourceInstanced = shouldUseSourceInstancedQuadrature(
          entry.settings,
        );
        const bundle = sourceInstanced
          ? resources.sourceIntegralPrograms[pass]!
          : resources.integralPrograms[pass]!;`,
  `        const sourceInstanced = shouldUseSourceInstancedQuadrature(
          entry.settings,
        );
        const segmentQ4Varyings =
          !sourceInstanced && shouldUseSegmentQ4Varyings(entry.settings, pass);
        const bundle = sourceInstanced
          ? resources.sourceIntegralPrograms[pass]!
          : segmentQ4Varyings
            ? resources.segmentQ4Programs[pass]!
            : resources.integralPrograms[pass]!;`,
  "q4 runtime program selection",
);

console.log("Applied q4 flat-varying segment integral experiment.");
