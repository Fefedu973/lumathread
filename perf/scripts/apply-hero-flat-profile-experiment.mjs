import { readFile, rm, writeFile } from "node:fs/promises";

await rm("perf/latest-consolidated", { recursive: true, force: true });

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing expected block in ${path}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected a unique block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

const shadersPath = "src/rendering/shaders.ts";
await replaceOnce(
  shadersPath,
  `export const PATH_INTEGRAL_FRAGMENT_SHADERS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];`,
  `export const PATH_INTEGRAL_FRAGMENT_SHADERS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];

const PATH_INTEGRAL_PROFILE_SAMPLE = \`  float widthScale;
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
  );\`;

const PATH_INTEGRAL_FLAT_PROFILE_SAMPLE = \`  const float encodedFlatPositive = 64.0 * 4.0 / 255.0;
  const float encodedFlatZero = 128.0 * 4.0 / 255.0 - 2.0;
  float widthScale = max(
    encodedFlatPositive * uVelocityWidthScale,
    0.0001
  );
  float opacityScale = encodedFlatPositive;
  float intensityScale = encodedFlatPositive;
  float glowScale = max(
    encodedFlatPositive * uVelocityGlowScale,
    0.0001
  );
  float upperGlowSpreadScale = encodedFlatPositive;
  float lowerGlowSpreadScale = encodedFlatPositive;
  float reflectionScale = encodedFlatPositive
    * uVelocityReflectionScale;
  float colorPositionOffset = encodedFlatZero;\`;

export const PATH_INTEGRAL_FLAT_PROFILE_FRAGMENT_SHADERS =
  PATH_INTEGRAL_FRAGMENT_SHADERS.map((fragmentShader) => {
    if (!fragmentShader.includes(PATH_INTEGRAL_PROFILE_SAMPLE)) {
      throw new Error("Unable to specialize flat path profiles.");
    }
    return fragmentShader.replace(
      PATH_INTEGRAL_PROFILE_SAMPLE,
      PATH_INTEGRAL_FLAT_PROFILE_SAMPLE,
    );
  }) as unknown as readonly [string, string, string];`,
);

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  integralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];
  sourceIntegralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];`,
  `  integralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];
  flatProfileIntegralPrograms: [
    ProgramBundle,
    ProgramBundle,
    ProgramBundle,
  ];
  sourceIntegralPrograms: [ProgramBundle, ProgramBundle, ProgramBundle];`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `  PATH_INTEGRAL_FRAGMENT_SHADERS,
  PATH_INTEGRAL_VERTEX_SHADER,`,
  `  PATH_INTEGRAL_FRAGMENT_SHADERS,
  PATH_INTEGRAL_FLAT_PROFILE_FRAGMENT_SHADERS,
  PATH_INTEGRAL_VERTEX_SHADER,`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    for (const program of resources.integralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    for (const program of resources.sourceIntegralPrograms) {`,
  `    for (const program of resources.integralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    for (const program of resources.flatProfileIntegralPrograms) {
      exactGl.deleteProgram(program.program);
    }
    for (const program of resources.sourceIntegralPrograms) {`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    const integralPrograms: ProgramBundle[] = [];
    const sourceIntegralPrograms: ProgramBundle[] = [];`,
  `    const integralPrograms: ProgramBundle[] = [];
    const flatProfileIntegralPrograms: ProgramBundle[] = [];
    const sourceIntegralPrograms: ProgramBundle[] = [];`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (const fragmentShader of PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS) {`,
  `      for (const fragmentShader of PATH_INTEGRAL_FLAT_PROFILE_FRAGMENT_SHADERS) {
        flatProfileIntegralPrograms.push(
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
      for (const fragmentShader of PATH_SOURCE_INTEGRAL_FRAGMENT_SHADERS) {`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        sourceIntegralPrograms: [
          sourceIntegralPrograms[0]!,
          sourceIntegralPrograms[1]!,
          sourceIntegralPrograms[2]!,
        ],`,
  `        flatProfileIntegralPrograms: [
          flatProfileIntegralPrograms[0]!,
          flatProfileIntegralPrograms[1]!,
          flatProfileIntegralPrograms[2]!,
        ],
        sourceIntegralPrograms: [
          sourceIntegralPrograms[0]!,
          sourceIntegralPrograms[1]!,
          sourceIntegralPrograms[2]!,
        ],`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      for (const program of integralPrograms) {
        exactGl.deleteProgram(program.program);
      }
      for (const program of sourceIntegralPrograms) {`,
  `      for (const program of integralPrograms) {
        exactGl.deleteProgram(program.program);
      }
      for (const program of flatProfileIntegralPrograms) {
        exactGl.deleteProgram(program.program);
      }
      for (const program of sourceIntegralPrograms) {`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const drawPathScene = (`,
  `  const profileIsFlat = (
    profile: Settings["profiles"][keyof Settings["profiles"]],
    fallback: number,
  ) => profile === "flat" || profile === fallback;

  const shouldUseFlatProfileIntegral = (settings: Settings) =>
    profileIsFlat(settings.profiles.width, 1) &&
    profileIsFlat(settings.profiles.opacity, 1) &&
    profileIsFlat(settings.profiles.intensity, 1) &&
    profileIsFlat(settings.profiles.glow, 1) &&
    profileIsFlat(settings.profiles.upperGlowSpread, 1) &&
    profileIsFlat(settings.profiles.lowerGlowSpread, 1) &&
    profileIsFlat(settings.profiles.reflection, 1) &&
    profileIsFlat(settings.profiles.colorPosition, 0);

  const drawPathScene = (`,
);
await replaceOnce(
  "src/runtime/path-renderer.ts",
  `        const bundle = sourceInstanced
          ? resources.sourceIntegralPrograms[pass]!
          : resources.integralPrograms[pass]!;`,
  `        const bundle = sourceInstanced
          ? resources.sourceIntegralPrograms[pass]!
          : shouldUseFlatProfileIntegral(entry.settings)
            ? resources.flatProfileIntegralPrograms[pass]!
            : resources.integralPrograms[pass]!;`,
);

console.log("Applied flat longitudinal-profile path shader specialization.");
