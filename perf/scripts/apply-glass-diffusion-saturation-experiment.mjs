import { readFile, writeFile } from "node:fs/promises";

const shaderPath = "src/rendering/shaders.ts";
const source = await readFile(shaderPath, "utf8");
const before = `  vec2 chroma = normal * (0.3 + edge * 0.7) * uChromaticAberration * pixel;
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
`;
const after = `  vec3 diffused = texture2D(uBlurScene, sampleUv).rgb;
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
  vec3 refracted;
  if (diffusionMix >= 1.0) {
    refracted = diffused + diffusionBloom;
  } else {
    vec2 chroma = normal * (0.3 + edge * 0.7)
      * uChromaticAberration * pixel;
    vec3 sharp = dispersedSample(sampleUv, chroma, pixel);
    float jitter = (
      hash21(gl_FragCoord.xy + floor(uTime * 17.0)) - 0.5
    ) * 2.0;
    float blurRadius = 1.0
      + uBlur * 12.0
      + uFrost * (2.0 + uRoughness * 9.0)
      + jitter;
    vec2 blurOffset = pixel * max(blurRadius, 0.5);
    vec3 blurred = sharp * 0.2;
    blurred += dispersedSample(
      sampleUv + vec2(blurOffset.x, 0.0),
      chroma,
      pixel
    ) * 0.12;
    blurred += dispersedSample(
      sampleUv - vec2(blurOffset.x, 0.0),
      chroma,
      pixel
    ) * 0.12;
    blurred += dispersedSample(
      sampleUv + vec2(0.0, blurOffset.y),
      chroma,
      pixel
    ) * 0.12;
    blurred += dispersedSample(
      sampleUv - vec2(0.0, blurOffset.y),
      chroma,
      pixel
    ) * 0.12;
    blurred += dispersedSample(sampleUv + blurOffset * 0.7, chroma, pixel) * 0.08;
    blurred += dispersedSample(sampleUv - blurOffset * 0.7, chroma, pixel) * 0.08;
    blurred += dispersedSample(
      sampleUv + vec2(blurOffset.x, -blurOffset.y) * 0.7,
      chroma,
      pixel
    ) * 0.08;
    blurred += dispersedSample(
      sampleUv + vec2(-blurOffset.x, blurOffset.y) * 0.7,
      chroma,
      pixel
    ) * 0.08;
    float blurMix = clamp(
      uBlur + uFrost * (0.42 + uRoughness * 0.38),
      0.0,
      1.0
    ) * (1.0 - edge * 0.55);
    refracted = mix(sharp, blurred, blurMix);
    refracted = mix(refracted, diffused, diffusionMix) + diffusionBloom;
  }
`;
const first = source.indexOf(before);
if (first < 0) {
  throw new Error("Expected glass diffusion block was not found.");
}
if (source.indexOf(before, first + before.length) >= 0) {
  throw new Error("Expected a unique glass diffusion block.");
}
await writeFile(
  shaderPath,
  source.slice(0, first) + after + source.slice(first + before.length),
);
console.log("Applied exact saturated-diffusion early-out experiment.");
