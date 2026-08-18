import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`Expected source block was not found in ${path}`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected a unique source block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  "src/rendering/shaders.ts",
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  float active = step(1.0 - uTwinkleDensity, activeSeed);
  vec2 sparkleOffset = vec2(`,
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  if (activeSeed < 1.0 - uTwinkleDensity) return 0.0;
  vec2 sparkleOffset = vec2(`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  if (sparkleOrigin <= 0.0) return 0.0;
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  return active * pulse * star * sparkleOrigin;`,
  `  return pulse * star * sparkleOrigin;`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  float sparkle = glassTwinkle(gl_FragCoord.xy)
    * uTwinkle
    * (0.62 + thickness * 0.38)
    * sparkleRegion;`,
  `  float sparkle = 0.0;
  if (uTwinkle > 0.001 && sparkleRegion > 0.001) {
    sparkle = glassTwinkle(gl_FragCoord.xy)
      * uTwinkle
      * (0.62 + thickness * 0.38)
      * sparkleRegion;
  }`,
);

console.log("Applied exact twinkle shader optimization experiment.");
