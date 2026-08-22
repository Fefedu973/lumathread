import { readFile, writeFile } from "node:fs/promises";

const shaderPath = "src/rendering/shaders.ts";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(
      `Expected block not found in ${path}: ${before.slice(0, 80)}`,
    );
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}: ${before.slice(0, 80)}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  shaderPath,
  `  float left = texture2D(uTextMask, uv - vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
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
  ));`,
  `  float inside = max(signedDistance, 0.0);
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
  vec3 surfaceNormal = normalize(volumeNormal);`,
);

await replaceOnce(
  shaderPath,
  `  float angle = radians(uRibAngle);
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
  );`,
  `  float thickness = clamp(hC / depthRadius, 0.0, 1.0);
  vec2 sdfGradient = normalize(vec2(dR - dL, dU - dD) + vec2(0.0001));
  vec2 distortionPx = -sdfGradient * uRefraction * thickness * 0.62;
  vec2 sampleUv = clamp(
    uv + distortionPx * pixel,
    pixel,
    vec2(1.0) - pixel
  );`,
);

await replaceOnce(
  shaderPath,
  `  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * (2.0 + uRoughness * 9.0) + jitter;`,
  `  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * 2.0 + jitter;`,
);
await replaceOnce(
  shaderPath,
  `  float blurMix = clamp(uBlur + uFrost * (0.42 + uRoughness * 0.38), 0.0, 1.0)
    * (1.0 - edge * 0.55);`,
  `  float blurMix = clamp(uBlur + uFrost * 0.42, 0.0, 1.0)
    * (1.0 - edge * 0.55);`,
);
await replaceOnce(
  shaderPath,
  `      + uFrost * (0.22 + uRoughness * 0.36),`,
  `      + uFrost * 0.22,`,
);

console.log("Applied fixed volumetric dome glass specialization experiment.");
