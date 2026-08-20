import {
  HERO_GLOW_PROFILE_MAX_DISTANCE,
  HERO_PALETTE_TEXTURE_WIDTH,
  HERO_PATH_K0_MAX_ARGUMENT,
  HERO_PATH_K0_MIN_ARGUMENT,
} from "./constants";

/** WebGL shader sources. Kept byte-for-byte equivalent to the extracted renderer. */
export const FULLSCREEN_VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const TERRAIN_DOTS_VERTEX_SHADER = `
attribute vec2 aGrid;
uniform vec2 uRes;
uniform float uTime;
uniform float uWidth;
uniform float uDepth;
uniform float uAmplitude;
uniform float uPointSize;
uniform float uSpeed;
uniform float uViewAngle;
uniform float uCameraDistance;
uniform float uFrequency;
uniform float uDpr;
uniform float uFitCover;
uniform float uTwinkle;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uTerrainPointerDisplacement;
varying float vHeight;
varying float vDepthFade;
varying float vGeometryEdge;
varying float vReflection;
varying float vTwinkle;
varying float vPointerInfluence;

void main() {
  float normalizedX = (aGrid.x - 0.5) * 2.0;
  float waveX = normalizedX * uWidth * 0.5;
  float z = aGrid.y * uDepth;
  float phase = uTime * uSpeed * 6.28318530718;
  float primary = sin(waveX * uFrequency + z * 0.88 - phase);
  float secondary = sin(waveX * uFrequency * 0.47 - z * 1.31 + phase * 0.73);
  float detail = sin((waveX + z) * uFrequency * 1.86 - phase * 1.18);
  float height = (primary * 0.58 + secondary * 0.3 + detail * 0.12) * uAmplitude;
  float angle = radians(uViewAngle);
  float cosine = cos(angle);
  float sine = sin(angle);
  float aspect = max(uRes.x / max(uRes.y, 1.0), 0.01);
  float focal = 1.42;
  float baseViewY = height * cosine + z * sine;
  float baseViewZ = uCameraDistance + z * cosine - height * sine;
  float baseProjectedY = (baseViewY - 0.52) * focal / max(baseViewZ, 0.2) - 0.39;
  float baseCoveredHalfWidth = baseViewZ * aspect / focal * 1.04;
  float baseX = mix(waveX, normalizedX * baseCoveredHalfWidth, uFitCover);
  vec2 baseClip = vec2(
    baseX * focal / max(baseViewZ, 0.2) / aspect,
    baseProjectedY
  );
  vec2 pointerDeltaPx = (baseClip * 0.5 + 0.5 - uDotPointer) * uRes;
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  vPointerInfluence = uDotPointerActive * (
    1.0 - smoothstep(
      pointerInnerRadius,
      max(uDotPointerRadius, pointerInnerRadius + 0.001),
      length(pointerDeltaPx)
    )
  );
  height += uTerrainPointerDisplacement * vPointerInfluence;
  float primaryCosine = cos(waveX * uFrequency + z * 0.88 - phase);
  float secondaryCosine = cos(waveX * uFrequency * 0.47 - z * 1.31 + phase * 0.73);
  float detailCosine = cos((waveX + z) * uFrequency * 1.86 - phase * 1.18);
  float slopeX = (
    primaryCosine * uFrequency * 0.58 +
    secondaryCosine * uFrequency * 0.47 * 0.3 +
    detailCosine * uFrequency * 1.86 * 0.12
  ) * uAmplitude;
  float slopeZ = (
    primaryCosine * 0.88 * 0.58 -
    secondaryCosine * 1.31 * 0.3 +
    detailCosine * uFrequency * 1.86 * 0.12
  ) * uAmplitude;
  vec3 surfaceNormal = normalize(vec3(-slopeX, 1.0, -slopeZ));
  vec3 lightDirection = normalize(vec3(-0.42, 0.82, -0.38));
  vec3 viewDirection = normalize(vec3(0.0, 0.72, -1.0));
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float diffuseReflection = max(dot(surfaceNormal, lightDirection), 0.0);
  float specularReflection = pow(
    max(dot(surfaceNormal, halfDirection), 0.0),
    28.0
  );
  vReflection = clamp(
    diffuseReflection * 0.22 + specularReflection * 1.35,
    0.0,
    1.0
  );

  float dotSeed = fract(
    sin(dot(aGrid, vec2(127.1, 311.7))) * 43758.5453123
  );
  float twinklePhase = uTime * (1.15 + dotSeed * 2.4) * 6.28318530718;
  vTwinkle = 0.5 + 0.5 * sin(twinklePhase + dotSeed * 19.73);

  float viewY = height * cosine + z * sine;
  float viewZ = uCameraDistance + z * cosine - height * sine;
  float coveredHalfWidth = viewZ * aspect / focal * 1.04;
  float x = mix(waveX, normalizedX * coveredHalfWidth, uFitCover);
  float projectedY = (viewY - 0.52) * focal / max(viewZ, 0.2) - 0.39;
  float nearViewZ = max(uCameraDistance, 0.2);
  float farViewZ = max(uCameraDistance + uDepth * cosine, 0.2);
  float nearY = -0.52 * focal / nearViewZ - 0.39;
  float farY = (uDepth * sine - 0.52) * focal / farViewZ - 0.39;
  float verticalSpan = max(abs(farY - nearY), 0.001);
  float coverScaleY = 2.08 / verticalSpan;
  float coveredY = (projectedY - (nearY + farY) * 0.5) * coverScaleY;
  vec2 clip = vec2(
    x * focal / max(viewZ, 0.2) / aspect,
    mix(projectedY, coveredY, uFitCover)
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = clamp(
    uPointSize * uDpr * (4.6 / max(viewZ, 0.2)) *
      (1.0 + abs(height) * 0.3) *
      mix(1.0, mix(0.82, 1.28, vTwinkle), uTwinkle),
    0.75,
    12.0 * uDpr
  );
  vHeight = clamp(height / max(uAmplitude, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
  vDepthFade = 1.0 - smoothstep(0.62, 1.0, aGrid.y);
  vGeometryEdge = min(
    min(aGrid.x, 1.0 - aGrid.x),
    min(aGrid.y, 1.0 - aGrid.y)
  );
}
`;

export const TERRAIN_DOTS_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uDotMask;
uniform vec2 uRes;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uOpacity;
uniform float uContentFade;
uniform float uEdgeFade;
uniform float uThemeMode;
uniform float uTwinkle;
uniform float uReflect;
uniform vec3 uDotPointerColor;
uniform float uDotPointerBrightness;
uniform float uDotPointerColorStrength;
varying float vHeight;
varying float vDepthFade;
varying float vGeometryEdge;
varying float vReflection;
varying float vTwinkle;
varying float vPointerInfluence;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float circle = 1.0 - smoothstep(0.45, 1.0, dot(point, point));
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  float mask = texture2D(uDotMask, uv).r;
  vec2 contentSpace = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.65);
  float contentClearance = smoothstep(0.12, 0.48, length(contentSpace));
  float contentMask = mix(1.0, contentClearance, uContentFade);
  float edgeMask = uEdgeFade > 0.0001
    ? smoothstep(0.0, uEdgeFade, vGeometryEdge)
    : 1.0;
  vec3 color = mix(uColorLow, uColorHigh, smoothstep(0.05, 0.95, vHeight));
  float reflected = clamp(vReflection * uReflect, 0.0, 1.0);
  vec3 reflectionColor = mix(uColorHigh, vec3(1.0), 0.62);
  color = mix(color, reflectionColor, reflected * 0.72);
  color = mix(
    color,
    uDotPointerColor,
    vPointerInfluence * uDotPointerColorStrength
  );
  float twinkle = mix(1.0, mix(0.58, 1.42, vTwinkle), uTwinkle);
  color = mix(color, vec3(0.08, 0.12, 0.16), uThemeMode * 0.72);
  float alpha = circle * mask * contentMask * edgeMask * uOpacity *
    mix(0.28, 1.0, vDepthFade) * twinkle * (1.0 + reflected * 0.45) *
    max(0.0, 1.0 + vPointerInfluence * uDotPointerBrightness);
  gl_FragColor = vec4(color, alpha);
}
`;

export const GLASS_BLUR_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uDirection;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec4 color = texture2D(uSource, uv) * 0.227027;
  color += texture2D(uSource, uv + uDirection * 1.384615) * 0.316216;
  color += texture2D(uSource, uv - uDirection * 1.384615) * 0.316216;
  color += texture2D(uSource, uv + uDirection * 3.230769) * 0.070270;
  color += texture2D(uSource, uv - uDirection * 3.230769) * 0.070270;
  gl_FragColor = color;
}
`;

export const GLASS_COMPOSITE_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uScene;
uniform sampler2D uEffect;
uniform sampler2D uBlurEffect;
uniform vec2 uResolution;
uniform float uSceneOpacity;
uniform float uProgress;
uniform float uBlurMix;
uniform float uOffsetY;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  // WebGL Y points upward while Motion's positive Y points downward.
  // Sampling above the current fragment displays the layer below its target.
  vec2 effectUv = uv + vec2(
    0.0,
    uOffsetY * (1.0 - uProgress) / max(uResolution.y, 1.0)
  );
  vec3 scene = texture2D(uScene, uv).rgb;
  vec4 sharpEffect = texture2D(uEffect, effectUv);
  vec4 blurredEffect = texture2D(uBlurEffect, effectUv);
  vec4 effect = mix(sharpEffect, blurredEffect, uBlurMix) * uProgress;
  gl_FragColor = vec4(
    scene * uSceneOpacity * (1.0 - effect.a) + effect.rgb,
    1.0
  );
}
`;

export const GLASS_TEXT_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uScene;
uniform sampler2D uBlurScene;
uniform sampler2D uTextMask;
uniform vec2 uRes;
uniform float uTime;
uniform float uRefraction;
uniform float uEdgeWrap;
uniform float uSurfaceModel;
uniform float uBevelMode;
uniform float uSurfaceDepth;
uniform float uIor;
uniform vec2 uMagnification;
uniform vec2 uDisplacement;
uniform float uDiffusion;
uniform float uSdfRange;
uniform float uBlur;
uniform float uMicroDistortion;
uniform float uChromaticAberration;
uniform float uFrost;
uniform float uRoughness;
uniform float uBevel;
uniform float uRibStrength;
uniform float uRibWidth;
uniform float uRibAngle;
uniform float uLiquidStrength;
uniform float uLiquidScale;
uniform float uLiquidSpeed;
uniform float uEdgeStrength;
uniform float uSpecular;
uniform float uFresnel;
uniform float uTwinkle;
uniform float uTwinkleDensity;
uniform float uTwinkleSpeed;
uniform float uTwinkleSize;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uSaturation;
uniform float uBrightness;
uniform float uOpacity;

float hash21(vec2 value) {
  value = fract(value * vec2(123.34, 456.21));
  value += dot(value, value + 45.32);
  return fract(value.x * value.y);
}

float glassTwinkleAtCell(vec2 gridPosition, vec2 cell) {
  vec2 localPosition = gridPosition - cell - 0.5;
  float cellSeed = hash21(cell + vec2(17.31, 41.73));
  float sparkleTime = uTime * uTwinkleSpeed + cellSeed * 5.0;
  float cycle = floor(sparkleTime);
  float phase = fract(sparkleTime);
  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  float active = step(1.0 - uTwinkleDensity, activeSeed);
  vec2 sparkleOffset = vec2(
    hash21(cell + vec2(cycle * 3.71, cycle * 11.23)),
    hash21(cell + vec2(cycle * 19.43, cycle * 5.17))
  ) - 0.5;
  vec2 delta = localPosition - sparkleOffset * 0.52;
  float cellSize = max(uTwinkleSize, 4.0);
  vec2 sparklePixel = (cell + 0.5 + sparkleOffset * 0.52) * cellSize;
  vec2 sparkleUv = clamp(sparklePixel / max(uRes, vec2(1.0)), 0.0, 1.0);
  float sparkleOriginDistance =
    (texture2D(uTextMask, sparkleUv).g - 0.5) * 2.0 * uSdfRange;
  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);
  float core = exp(-dot(delta, delta) * 520.0) * 2.25;
  float halo = exp(-dot(delta, delta) * 24.0) * 0.16;
  float horizontalRay = exp(-abs(delta.y) * 180.0)
    * exp(-abs(delta.x) * 5.0);
  float verticalRay = exp(-abs(delta.x) * 180.0)
    * exp(-abs(delta.y) * 5.0);
  vec2 diagonal = vec2(delta.x + delta.y, delta.x - delta.y) * 0.70710678;
  float diagonalA = exp(-abs(diagonal.y) * 150.0)
    * exp(-abs(diagonal.x) * 8.0);
  float diagonalB = exp(-abs(diagonal.x) * 150.0)
    * exp(-abs(diagonal.y) * 8.0);
  float star = core
    + halo
    + (horizontalRay + verticalRay) * 0.58
    + (diagonalA + diagonalB) * 0.16;
  return active * pulse * star * sparkleOrigin;
}

float glassTwinkle(vec2 fragmentPosition) {
  float cellSize = max(uTwinkleSize, 4.0);
  vec2 gridPosition = fragmentPosition / cellSize;
  vec2 cell = floor(gridPosition);
  float sparkle = 0.0;
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 0.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0,  0.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell);
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0,  0.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0,  1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 0.0,  1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0,  1.0));
  return sparkle;
}

float readSignedDistance(vec2 uv) {
  return (texture2D(uTextMask, uv).g - 0.5) * 2.0 * uSdfRange;
}

float surfaceHeight(float inside, float depth) {
  if (inside <= 0.0) return 0.0;
  if (inside >= depth) return depth;
  return sqrt(max(inside * (2.0 * depth - inside), 0.0));
}

vec3 dispersedSample(vec2 uv, vec2 chroma, vec2 pixel) {
  vec2 minimumUv = pixel;
  vec2 maximumUv = vec2(1.0) - pixel;
  return vec3(
    texture2D(uScene, clamp(uv + chroma, minimumUv, maximumUv)).r,
    texture2D(uScene, clamp(uv, minimumUv, maximumUv)).g,
    texture2D(uScene, clamp(uv - chroma, minimumUv, maximumUv)).b
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  vec2 pixel = 1.0 / max(uRes, vec2(1.0));
  vec3 scene = texture2D(uScene, uv).rgb;
  vec2 maskSample = texture2D(uTextMask, uv).rg;
  float signedDistance = (maskSample.g - 0.5) * 2.0 * uSdfRange;
  float mask = maskSample.r;
  float sparkleReach = max(uTwinkleSize * 0.85, 6.0);
  float sparkleRegion = smoothstep(-sparkleReach, -sparkleReach + 2.0, signedDistance);
  if (mask <= 0.001 && (uTwinkle <= 0.001 || sparkleRegion <= 0.001)) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float left = texture2D(uTextMask, uv - vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float right = texture2D(uTextMask, uv + vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float down = texture2D(uTextMask, uv - vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  float up = texture2D(uTextMask, uv + vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  vec2 gradient = vec2(right - left, up - down);
  float simpleEdge = clamp(length(gradient) * 2.8, 0.0, 1.0);
  vec2 simpleNormal = gradient / max(length(gradient), 0.0001);

  float inside = max(signedDistance, 0.0);
  float depthRadius = max(uSurfaceDepth, 1.0);
  vec2 sdfPixel = 2.0 / max(uRes, vec2(1.0));
  float dR = max(readSignedDistance(uv + vec2(sdfPixel.x, 0.0)), 0.0);
  float dL = max(readSignedDistance(uv - vec2(sdfPixel.x, 0.0)), 0.0);
  float dU = max(readSignedDistance(uv + vec2(0.0, sdfPixel.y)), 0.0);
  float dD = max(readSignedDistance(uv - vec2(0.0, sdfPixel.y)), 0.0);
  float hC = surfaceHeight(inside, depthRadius);
  vec2 heightGradient = vec2(
    surfaceHeight(dR, depthRadius) - surfaceHeight(dL, depthRadius),
    surfaceHeight(dU, depthRadius) - surfaceHeight(dD, depthRadius)
  ) * 0.25;
  vec2 boundedHeightGradient = heightGradient / (vec2(1.0) + abs(heightGradient));
  vec3 volumeNormal = normalize(vec3(-heightGradient * (0.7 + uBevel * 0.18), 1.0));
  float volumeEdge = 1.0 - smoothstep(0.0, depthRadius * 0.9, inside);
  float useVolume = step(0.5, uSurfaceModel);
  float edge = mix(simpleEdge, volumeEdge, useVolume);
  vec2 normal = mix(simpleNormal, -volumeNormal.xy, useVolume);
  vec3 surfaceNormal = normalize(mix(
    vec3(simpleNormal * (0.35 + uBevel), 1.0),
    volumeNormal,
    useVolume
  ));

  float angle = radians(uRibAngle);
  vec2 ribDirection = vec2(cos(angle), sin(angle));
  float ribPhase = dot(gl_FragCoord.xy, ribDirection) / max(uRibWidth, 1.0);
  float rib = sin(ribPhase * 6.28318530718) * uRibStrength;
  vec2 ribNormal = vec2(-ribDirection.y, ribDirection.x) * rib;
  float liquidPhase = uTime * uLiquidSpeed * 6.28318530718;
  vec2 liquid = vec2(
    sin((uv.y * 1.37 + uv.x * 0.31) * uLiquidScale * 6.28318530718 + liquidPhase),
    cos((uv.x * 1.21 - uv.y * 0.28) * uLiquidScale * 6.28318530718 - liquidPhase * 0.83)
  ) * uLiquidStrength;
  float refractivePower = 1.0 - 1.0 / max(uIor, 1.01);
  float thickness = clamp(hC / depthRadius, 0.0, 1.0);
  vec2 biconvexRefraction = boundedHeightGradient * uRefraction
    * refractivePower * (1.65 + thickness * 0.85);
  vec2 sdfGradient = normalize(vec2(dR - dL, dU - dD) + vec2(0.0001));
  vec2 domeRefraction = -sdfGradient * uRefraction * thickness * 0.62;
  vec2 volumeRefraction = mix(
    biconvexRefraction,
    domeRefraction,
    step(0.5, uBevelMode)
  );
  vec2 simpleRefraction = normal * edge * uRefraction;
  vec2 micro = (vec2(
    hash21(gl_FragCoord.xy * 0.083),
    hash21(gl_FragCoord.yx * 0.071 + vec2(31.7, 9.2))
  ) - 0.5) * uMicroDistortion * 8.0;
  float edgeWrapWidth = max(
    3.0,
    min(uSdfRange * 0.9, depthRadius * 0.85)
  );
  float edgeWrapEnvelope = 1.0 - smoothstep(0.0, edgeWrapWidth, inside);
  vec2 edgeWrapPx = -normal * uEdgeWrap
    * edgeWrapEnvelope * edgeWrapEnvelope;
  vec2 distortionPx = mix(simpleRefraction, volumeRefraction, useVolume)
    + (ribNormal + liquid) * uRefraction
    + edgeWrapPx
    + micro;
  float lensTransition = max(
    2.0,
    min(depthRadius * 0.35, uSdfRange * 0.4)
  );
  float lensDepth = smoothstep(0.0, lensTransition, inside) * useVolume;
  vec2 lensContraction = vec2(1.0) - vec2(1.0) /
    (vec2(1.0) + max(uMagnification, vec2(0.0)));
  vec2 magnificationUv = -(uv - vec2(0.5)) * lensContraction * lensDepth;
  vec2 displacementUv = vec2(uDisplacement.x, -uDisplacement.y) * pixel;
  vec2 sampleUv = clamp(
    uv + distortionPx * pixel + magnificationUv + displacementUv,
    pixel,
    vec2(1.0) - pixel
  );
  vec2 chroma = normal * (0.3 + edge * 0.7) * uChromaticAberration * pixel;
  vec3 sharp = dispersedSample(sampleUv, chroma, pixel);

  float jitter = (hash21(gl_FragCoord.xy + floor(uTime * 17.0)) - 0.5) * 2.0;
  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * (2.0 + uRoughness * 9.0) + jitter;
  vec2 blurOffset = pixel * max(blurRadius, 0.5);
  vec3 blurred = sharp * 0.2;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv - blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, -blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(-blurOffset.x, blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  float blurMix = clamp(uBlur + uFrost * (0.42 + uRoughness * 0.38), 0.0, 1.0)
    * (1.0 - edge * 0.55);
  vec3 refracted = mix(sharp, blurred, blurMix);
  vec3 diffused = texture2D(uBlurScene, sampleUv).rgb;
  float diffusionMix = clamp(
    uDiffusion * (0.58 + 0.42 * thickness)
      + uBlur * 0.34
      + uFrost * (0.22 + uRoughness * 0.36),
    0.0,
    1.0
  );
  float diffusedLuminance = dot(diffused, vec3(0.299, 0.587, 0.114));
  vec3 diffusionBloom = diffused
    * smoothstep(0.025, 0.55, diffusedLuminance)
    * uDiffusion * 0.48;
  refracted = mix(refracted, diffused, diffusionMix) + diffusionBloom;
  float luminance = dot(refracted, vec3(0.299, 0.587, 0.114));
  refracted = mix(vec3(luminance), refracted, 1.0 + uSaturation);
  refracted *= 1.0 + uBrightness;
  refracted = mix(refracted, refracted * uTint, uTintStrength);

  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 lightA = normalize(vec3(-0.38, 0.72, 0.58));
  vec3 lightB = normalize(vec3(0.52, -0.28, 0.8));
  vec3 lightC = normalize(vec3(0.05, 0.88, 0.46));
  float highlightA = pow(max(dot(surfaceNormal, normalize(lightA + viewDirection)), 0.0), 72.0);
  float highlightB = pow(max(dot(surfaceNormal, normalize(lightB + viewDirection)), 0.0), 44.0) * 0.35;
  float highlightC = pow(max(dot(surfaceNormal, normalize(lightC + viewDirection)), 0.0), 110.0) * 0.55;
  float highlight = (highlightA + highlightB + highlightC) * uSpecular;
  float fresnel = pow(1.0 - abs(surfaceNormal.z), 4.0) * uFresnel;
  float innerStroke = (1.0 - smoothstep(1.0, 3.5, inside))
    * (0.45 + 0.55 * clamp(surfaceNormal.y * 0.5 + 0.5, 0.0, 1.0));
  float rim = edge * uEdgeStrength * 0.22;
  float sparkle = glassTwinkle(gl_FragCoord.xy)
    * uTwinkle
    * (0.62 + thickness * 0.38)
    * sparkleRegion;
  vec3 glass = refracted;
  glass += vec3(highlight);
  glass += mix(vec3(1.0), uTint, 0.16) * sparkle;
  glass += uTint * (fresnel * 0.24 + rim + innerStroke * uEdgeStrength * 0.32);
  float glassAlpha = max(mask * uOpacity, clamp(sparkle * 0.72, 0.0, 1.0));
  gl_FragColor = vec4(glass * glassAlpha, glassAlpha);
}
`;

function replaceRequiredShaderBlock(
  source: string,
  before: string,
  after: string,
  label: string,
) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Unable to specialize glass shader block: ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const GLASS_FIXED_DOME_BEFORE_0 = `  float left = texture2D(uTextMask, uv - vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float right = texture2D(uTextMask, uv + vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float down = texture2D(uTextMask, uv - vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  float up = texture2D(uTextMask, uv + vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  vec2 gradient = vec2(right - left, up - down);
  float simpleEdge = clamp(length(gradient) * 2.8, 0.0, 1.0);
  vec2 simpleNormal = gradient / max(length(gradient), 0.0001);

  float inside = max(signedDistance, 0.0);
  float depthRadius = max(uSurfaceDepth, 1.0);
  vec2 sdfPixel = 2.0 / max(uRes, vec2(1.0));
  float dR = max(readSignedDistance(uv + vec2(sdfPixel.x, 0.0)), 0.0);
  float dL = max(readSignedDistance(uv - vec2(sdfPixel.x, 0.0)), 0.0);
  float dU = max(readSignedDistance(uv + vec2(0.0, sdfPixel.y)), 0.0);
  float dD = max(readSignedDistance(uv - vec2(0.0, sdfPixel.y)), 0.0);
  float hC = surfaceHeight(inside, depthRadius);
  vec2 heightGradient = vec2(
    surfaceHeight(dR, depthRadius) - surfaceHeight(dL, depthRadius),
    surfaceHeight(dU, depthRadius) - surfaceHeight(dD, depthRadius)
  ) * 0.25;
  vec2 boundedHeightGradient = heightGradient / (vec2(1.0) + abs(heightGradient));
  vec3 volumeNormal = normalize(vec3(-heightGradient * (0.7 + uBevel * 0.18), 1.0));
  float volumeEdge = 1.0 - smoothstep(0.0, depthRadius * 0.9, inside);
  float useVolume = step(0.5, uSurfaceModel);
  float edge = mix(simpleEdge, volumeEdge, useVolume);
  vec2 normal = mix(simpleNormal, -volumeNormal.xy, useVolume);
  vec3 surfaceNormal = normalize(mix(
    vec3(simpleNormal * (0.35 + uBevel), 1.0),
    volumeNormal,
    useVolume
  ));`;
const GLASS_FIXED_DOME_AFTER_0 = `  float inside = max(signedDistance, 0.0);
  float depthRadius = max(uSurfaceDepth, 1.0);
  vec2 sdfPixel = 2.0 / max(uRes, vec2(1.0));
  float dR = max(readSignedDistance(uv + vec2(sdfPixel.x, 0.0)), 0.0);
  float dL = max(readSignedDistance(uv - vec2(sdfPixel.x, 0.0)), 0.0);
  float dU = max(readSignedDistance(uv + vec2(0.0, sdfPixel.y)), 0.0);
  float dD = max(readSignedDistance(uv - vec2(0.0, sdfPixel.y)), 0.0);
  float hC = surfaceHeight(inside, depthRadius);
  vec2 heightGradient = vec2(
    surfaceHeight(dR, depthRadius) - surfaceHeight(dL, depthRadius),
    surfaceHeight(dU, depthRadius) - surfaceHeight(dD, depthRadius)
  ) * 0.25;
  vec3 volumeNormal = normalize(vec3(-heightGradient * 0.7, 1.0));
  float edge = 1.0 - smoothstep(0.0, depthRadius * 0.9, inside);
  vec2 normal = -volumeNormal.xy;
  vec3 surfaceNormal = normalize(volumeNormal);`;

const GLASS_FIXED_DOME_BEFORE_1 = `  float angle = radians(uRibAngle);
  vec2 ribDirection = vec2(cos(angle), sin(angle));
  float ribPhase = dot(gl_FragCoord.xy, ribDirection) / max(uRibWidth, 1.0);
  float rib = sin(ribPhase * 6.28318530718) * uRibStrength;
  vec2 ribNormal = vec2(-ribDirection.y, ribDirection.x) * rib;
  float liquidPhase = uTime * uLiquidSpeed * 6.28318530718;
  vec2 liquid = vec2(
    sin((uv.y * 1.37 + uv.x * 0.31) * uLiquidScale * 6.28318530718 + liquidPhase),
    cos((uv.x * 1.21 - uv.y * 0.28) * uLiquidScale * 6.28318530718 - liquidPhase * 0.83)
  ) * uLiquidStrength;
  float refractivePower = 1.0 - 1.0 / max(uIor, 1.01);
  float thickness = clamp(hC / depthRadius, 0.0, 1.0);
  vec2 biconvexRefraction = boundedHeightGradient * uRefraction
    * refractivePower * (1.65 + thickness * 0.85);
  vec2 sdfGradient = normalize(vec2(dR - dL, dU - dD) + vec2(0.0001));
  vec2 domeRefraction = -sdfGradient * uRefraction * thickness * 0.62;
  vec2 volumeRefraction = mix(
    biconvexRefraction,
    domeRefraction,
    step(0.5, uBevelMode)
  );
  vec2 simpleRefraction = normal * edge * uRefraction;
  vec2 micro = (vec2(
    hash21(gl_FragCoord.xy * 0.083),
    hash21(gl_FragCoord.yx * 0.071 + vec2(31.7, 9.2))
  ) - 0.5) * uMicroDistortion * 8.0;
  float edgeWrapWidth = max(
    3.0,
    min(uSdfRange * 0.9, depthRadius * 0.85)
  );
  float edgeWrapEnvelope = 1.0 - smoothstep(0.0, edgeWrapWidth, inside);
  vec2 edgeWrapPx = -normal * uEdgeWrap
    * edgeWrapEnvelope * edgeWrapEnvelope;
  vec2 distortionPx = mix(simpleRefraction, volumeRefraction, useVolume)
    + (ribNormal + liquid) * uRefraction
    + edgeWrapPx
    + micro;
  float lensTransition = max(
    2.0,
    min(depthRadius * 0.35, uSdfRange * 0.4)
  );
  float lensDepth = smoothstep(0.0, lensTransition, inside) * useVolume;
  vec2 lensContraction = vec2(1.0) - vec2(1.0) /
    (vec2(1.0) + max(uMagnification, vec2(0.0)));
  vec2 magnificationUv = -(uv - vec2(0.5)) * lensContraction * lensDepth;
  vec2 displacementUv = vec2(uDisplacement.x, -uDisplacement.y) * pixel;
  vec2 sampleUv = clamp(
    uv + distortionPx * pixel + magnificationUv + displacementUv,
    pixel,
    vec2(1.0) - pixel
  );`;
const GLASS_FIXED_DOME_AFTER_1 = `  float thickness = clamp(hC / depthRadius, 0.0, 1.0);
  vec2 sdfGradient = normalize(vec2(dR - dL, dU - dD) + vec2(0.0001));
  vec2 distortionPx = -sdfGradient * uRefraction * thickness * 0.62;
  vec2 sampleUv = clamp(
    uv + distortionPx * pixel,
    pixel,
    vec2(1.0) - pixel
  );`;

const GLASS_FIXED_DOME_BEFORE_2 = `  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * (2.0 + uRoughness * 9.0) + jitter;`;
const GLASS_FIXED_DOME_AFTER_2 = `  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * 2.0 + jitter;`;

const GLASS_FIXED_DOME_BEFORE_3 = `  float blurMix = clamp(uBlur + uFrost * (0.42 + uRoughness * 0.38), 0.0, 1.0)
    * (1.0 - edge * 0.55);`;
const GLASS_FIXED_DOME_AFTER_3 = `  float blurMix = clamp(uBlur + uFrost * 0.42, 0.0, 1.0)
    * (1.0 - edge * 0.55);`;

const GLASS_FIXED_DOME_BEFORE_4 = `      + uFrost * (0.22 + uRoughness * 0.36),`;
const GLASS_FIXED_DOME_AFTER_4 = `      + uFrost * 0.22,`;

export const GLASS_TEXT_FIXED_DOME_FRAGMENT_SHADER = replaceRequiredShaderBlock(
  replaceRequiredShaderBlock(
    replaceRequiredShaderBlock(
      replaceRequiredShaderBlock(
        replaceRequiredShaderBlock(
          GLASS_TEXT_FRAGMENT_SHADER,
          GLASS_FIXED_DOME_BEFORE_0,
          GLASS_FIXED_DOME_AFTER_0,
          "fixed-dome-0",
        ),
        GLASS_FIXED_DOME_BEFORE_1,
        GLASS_FIXED_DOME_AFTER_1,
        "fixed-dome-1",
      ),
      GLASS_FIXED_DOME_BEFORE_2,
      GLASS_FIXED_DOME_AFTER_2,
      "fixed-dome-2",
    ),
    GLASS_FIXED_DOME_BEFORE_3,
    GLASS_FIXED_DOME_AFTER_3,
    "fixed-dome-3",
  ),
  GLASS_FIXED_DOME_BEFORE_4,
  GLASS_FIXED_DOME_AFTER_4,
  "fixed-dome-4",
);

const GLASS_SATURATED_DIFFUSION_BEFORE = `  vec2 chroma = normal * (0.3 + edge * 0.7) * uChromaticAberration * pixel;
  vec3 sharp = dispersedSample(sampleUv, chroma, pixel);

  float jitter = (hash21(gl_FragCoord.xy + floor(uTime * 17.0)) - 0.5) * 2.0;
  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * 2.0 + jitter;
  vec2 blurOffset = pixel * max(blurRadius, 0.5);
  vec3 blurred = sharp * 0.2;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv - blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, -blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(-blurOffset.x, blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  float blurMix = clamp(uBlur + uFrost * 0.42, 0.0, 1.0)
    * (1.0 - edge * 0.55);
  vec3 refracted = mix(sharp, blurred, blurMix);
  vec3 diffused = texture2D(uBlurScene, sampleUv).rgb;
  float diffusionMix = clamp(
    uDiffusion * (0.58 + 0.42 * thickness)
      + uBlur * 0.34
      + uFrost * 0.22,
    0.0,
    1.0
  );
  float diffusedLuminance = dot(diffused, vec3(0.299, 0.587, 0.114));
  vec3 diffusionBloom = diffused
    * smoothstep(0.025, 0.55, diffusedLuminance)
    * uDiffusion * 0.48;
  refracted = mix(refracted, diffused, diffusionMix) + diffusionBloom;
`;
const GLASS_SATURATED_DIFFUSION_AFTER = `  vec3 diffused = texture2D(uBlurScene, sampleUv).rgb;
  float diffusedLuminance = dot(diffused, vec3(0.299, 0.587, 0.114));
  vec3 diffusionBloom = diffused
    * smoothstep(0.025, 0.55, diffusedLuminance)
    * uDiffusion * 0.48;
  vec3 refracted = diffused + diffusionBloom;
`;

export const GLASS_TEXT_FIXED_DOME_SATURATED_FRAGMENT_SHADER =
  replaceRequiredShaderBlock(
    GLASS_TEXT_FIXED_DOME_FRAGMENT_SHADER,
    GLASS_SATURATED_DIFFUSION_BEFORE,
    GLASS_SATURATED_DIFFUSION_AFTER,
    "saturated-diffusion",
  );

export const COMMON_SEGMENT_GLSL = `
uniform float uTime;
uniform float uCurveTravel;
uniform float uEnvelopeStationary;
uniform float uStationaryCenter;
uniform float uSegmentLength;
uniform float uTailTaper;
uniform float uHeadTaper;

float segmentCenter(float time) {
  float length = max(uSegmentLength, 0.05);
  float outsidePadding = 0.06;
  float firstCenter = -0.5 * length - outsidePadding;
  float cycleLength = 1.0 + length + 2.0 * outsidePadding;
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
  float length = max(uSegmentLength, 0.05);
  return (value - (segmentCenter(time) - 0.5 * length)) / length;
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
`;

export const COMMON_GLOW_GLSL = `
uniform sampler2D uPalette;
uniform sampler2D uGlowProfile0;
uniform sampler2D uGlowProfile1;
uniform sampler2D uProfiles;
uniform mat3 uHueMatrix;
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

const float GLOW_PROFILE_MAX_DISTANCE = ${HERO_GLOW_PROFILE_MAX_DISTANCE.toFixed(8)};
const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

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
  return texture2D(uPalette, vec2(palettePosition, 0.5)).rgb;
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
  vec4 primary = texture2D(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture2D(uProfiles, vec2(coordinate, 0.75));
  widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  opacityScale = primary.g * 4.0;
  intensityScale = primary.b * 4.0;
  glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  colorPositionOffset = secondary.g * 4.0 - 2.0;
}

vec3 filamentContribution(
  float normalizedDistance,
  float sideDirection,
  float position,
  float segmentAlpha,
  out float reflectionEnergy,
  out vec3 reflectionColor
) {
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
  float localDistance = normalizedDistance / widthScale;
  float visibleAlpha = segmentAlpha * opacityScale * uVisibility;
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, localDistance);
  float directionalSpread = mix(
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05),
    upperSide
  );
  float profileDistance = abs(localDistance)
    / directionalSpread
    / max(uBandSpread * glowScale, 0.001);
  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  vec3 paleColor = mix(waveColor, vec3(0.90, 1.0, 0.98), 0.18);
  reflectionColor = mix(waveColor, paleColor, 0.28);

  if (
    visibleAlpha <= 0.000001 ||
    profileDistance >= GLOW_PROFILE_MAX_DISTANCE
  ) {
    reflectionEnergy = 0.0;
    return vec3(0.0);
  }

  float profileU = profileDistance / GLOW_PROFILE_MAX_DISTANCE;
  vec4 profile0 = texture2D(uGlowProfile0, vec2(profileU, 0.5));
  vec4 profile1 = texture2D(uGlowProfile1, vec2(profileU, 0.5));
  profile0 *= profile0;
  profile1 *= profile1;

  float atmosphere = profile0.r;
  float broad = profile0.g;
  float body = profile0.b;
  float ridge = profile0.a;
  float core = profile1.r;
  float veil = profile1.g;
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);
  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, localDistance);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, localDistance);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;
  vec3 wave = (
      waveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + waveColor * broad * uMaterialWeights0.y * outerBloom
      + waveColor * body * uMaterialWeights0.z * bodyBloom
      + paleColor * ridge * uMaterialWeights0.w
      + coreColor * core * uMaterialWeights1.x
      + waveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * intensityScale
      * longitudinal * visibleAlpha;
  wave = uHueMatrix * wave;

  float waveLuminance = dot(wave, LUMA);
  float saturationBase = 1.0 - core;
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), wave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  reflectionEnergy = profile1.b * visibleAlpha * reflectionScale;
  return saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
}
`;

export const COMMON_THEME_GLSL = `
uniform float uThemeMode;

float lightThemeMix() {
  return step(0.5, uThemeMode);
}

vec3 themeBackground(vec2 uv) {
  vec3 darkBackground = mix(
    vec3(0.008, 0.011, 0.016),
    vec3(0.016, 0.021, 0.030),
    uv.y
  );
  return mix(darkBackground, vec3(1.0), lightThemeMix());
}

vec3 lightThemeTintColor(vec3 sourceColor) {
  vec3 positive = max(sourceColor, vec3(0.0));
  float peak = max(max(positive.r, positive.g), positive.b);
  if (peak <= 0.000001) {
    return vec3(0.30, 0.32, 0.36);
  }

  vec3 chroma = positive / peak;
  float chromaLuminance = clamp(
    dot(chroma, vec3(0.2126, 0.7152, 0.0722)),
    0.0,
    1.0
  );
  // Bright cyan and green disappear against the light canvas when they are
  // pushed toward white. Preserve their hue while capping luminance so the
  // filament and its reflected dots retain contrast in the light theme.
  float contrastScale = min(1.0, 0.46 / max(chromaLuminance, 0.0001));
  return clamp(chroma * contrastScale, vec3(0.035), vec3(0.92));
}

vec3 composeThemedWave(vec3 background, vec3 wave) {
  vec3 darkResult = background + wave;
  vec3 positive = max(wave, vec3(0.0));
  float peak = max(max(positive.r, positive.g), positive.b);
  float coverage = clamp(1.0 - exp(-peak * 1.08), 0.0, 0.86);
  float coreHighlight = smoothstep(0.55, 2.4, peak);
  vec3 luminousTint = mix(
    lightThemeTintColor(positive),
    lightThemeTintColor(positive) * 0.72,
    coreHighlight * 0.28
  );
  vec3 lightResult = mix(
    background,
    luminousTint,
    coverage
  );
  return mix(darkResult, lightResult, lightThemeMix());
}
`;

export const COMMON_DOTS_GLSL = `
uniform vec2 uRes;
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
    uTime * (6.2831 / (2.0 + 3.0 * random2)) + random1 * 6.2831
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
  float dotSignal = exp(-radiusSquared / (2.0 * sigma * sigma))
    * dotAmplitude;
  float dotMask = texture2D(uDotMask, uv).r;
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
  return (hash21(fragmentCoordinate + uNoisePhase) - 0.5) / 255.0 * 2.0;
}
`;

export const SINE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

${COMMON_SEGMENT_GLSL}
${COMMON_GLOW_GLSL}
${COMMON_THEME_GLSL}
${COMMON_DOTS_GLSL}

uniform float uBandHeight;
uniform float uCurveStrength;
uniform float uCurveScale;
uniform float uCurveFrequency;
uniform float uCurveMotion;
uniform float uGeometryAdvanceRatio;
uniform sampler2D uBackgroundImage;
uniform float uBackgroundOpacity;

const float TAU = 6.28318530718;

vec2 movingCurveAndSlope(float x, float time) {
  float frequency = max(uCurveFrequency, 0.05);
  float morphAmount = clamp(uCurveMotion, 0.0, 1.0);
  float advance = time * uCurveTravel * uGeometryAdvanceRatio;
  float pathX = x - advance * (0.12 + 0.10 * morphAmount);

  float bendArgument = TAU * (frequency * 0.42 * pathX + 0.27)
    + advance * 0.875;
  float bendSin = sin(bendArgument);
  float bendCos = cos(bendArgument);
  float phase = frequency * pathX - 0.03
    + bendSin * 0.065 * morphAmount;
  float phaseDerivative = frequency
    + bendCos * TAU * frequency * 0.42 * 0.065 * morphAmount;
  float phaseArgument = TAU * phase;
  float phaseSin = sin(phaseArgument);
  float phaseCos = cos(phaseArgument);

  float swellArgument = TAU * (frequency * 0.28 * pathX - 0.12)
    - advance * 1.125;
  float swellSin = sin(swellArgument);
  float swellCos = cos(swellArgument);
  float swell = 1.0 + 0.08 * morphAmount * swellSin;
  float swellDerivative = 0.08 * morphAmount * swellCos
    * TAU * frequency * 0.28;
  float sineShape = phaseSin * swell;
  float shapeDerivative = phaseCos * TAU * phaseDerivative * swell
    + phaseSin * swellDerivative;
  float verticalDrift = sin(advance * 1.125) * 0.025 * uCurveMotion;
  float scaledAmplitude = 0.38 * uCurveScale;
  float center = uBandHeight
    + uCurveStrength * (sineShape * scaledAmplitude + verticalDrift);
  float slope = uCurveStrength * shapeDerivative * scaledAmplitude;
  return vec2(center, slope);
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;
  float position = segmentPositionForValue(uv.x, uTime);
  float segmentAlpha = pow(segmentEnvelope(position), 0.55);
  float taperWidth = mix(0.025, 1.0, segmentAlpha);
  vec2 curve = movingCurveAndSlope(uv.x, uTime);
  float aspect = uRes.x / max(uRes.y, 1.0);
  float slopeInHeightSpace = curve.y / max(aspect, 0.0001);
  float signedDistance = (uv.y - curve.x)
    / sqrt(1.0 + slopeInHeightSpace * slopeInHeightSpace);
  float side = signedDistance >= 0.0 ? 1.0 : -1.0;

  float reflectionEnergy;
  vec3 reflectionColor;
  vec3 wave = filamentContribution(
    abs(signedDistance) / taperWidth,
    side,
    position,
    segmentAlpha,
    reflectionEnergy,
    reflectionColor
  );
  vec4 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  float lightTheme = lightThemeMix();
  vec4 imageBackground = texture2D(uBackgroundImage, uv);
  vec3 background = mix(
    themeBackground(uv),
    imageBackground.rgb,
    imageBackground.a * uBackgroundOpacity
  );
  vec3 color = composeThemedWave(background, wave);
  color += dots.rgb * (1.0 - lightTheme);
  color = mix(color, dots.rgb, dots.a);
  color += displayNoise(fragmentCoordinate) * (1.0 - lightTheme);
  gl_FragColor = vec4(color, 1.0);
}
`;

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
