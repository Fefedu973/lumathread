import { readFile, writeFile } from "node:fs/promises";

const shaderPath = "src/rendering/shaders.ts";

async function replaceOnce(before, after) {
  const source = await readFile(shaderPath, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`Expected twinkle block not found: ${before.slice(0, 100)}`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected a unique twinkle block: ${before.slice(0, 100)}`);
  }
  await writeFile(
    shaderPath,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  float active = step(1.0 - uTwinkleDensity, activeSeed);
  vec2 sparkleOffset = vec2(`,
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  if (activeSeed < 1.0 - uTwinkleDensity) return 0.0;
  vec2 sparkleOffset = vec2(`,
);
await replaceOnce(
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  if (sparkleOrigin <= 0.0) return 0.0;
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
);
await replaceOnce(
  `  return active * pulse * star * sparkleOrigin;`,
  `  return pulse * star * sparkleOrigin;`,
);
await replaceOnce(
  `  float sparkle = glassTwinkle(gl_FragCoord.xy)
    * uTwinkle
    * (0.62 + thickness * 0.38)
    * sparkleRegion;`,
  `  float sparkle = 0.0;
  if (uTwinkle > 0.0 && sparkleRegion > 0.0) {
    sparkle = glassTwinkle(gl_FragCoord.xy)
      * uTwinkle
      * (0.62 + thickness * 0.38)
      * sparkleRegion;
  }`,
);

console.log("Applied exact glass twinkle branch experiment.");
