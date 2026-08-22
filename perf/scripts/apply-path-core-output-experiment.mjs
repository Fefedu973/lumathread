import { readFile, writeFile } from "node:fs/promises";

const shaderPath = "src/rendering/shaders.ts";
const source = await readFile(shaderPath, "utf8");
const before = `export const PATH_INTEGRAL_FRAGMENT_SHADERS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    PATH_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
  ) as unknown as readonly [string, string, string];`;
const after = `const specializeCorePathOutput = (source: string) => {
  const replacements = [
    [\`layout(location = 1) out vec4 outReflection;\\n\`, \`\`],
    [
      \`  inout float coreSum,\\n  inout vec3 reflectionColorSum,\\n  inout float reflectionEnergySum\\n)\`,
      \`  inout float coreSum\\n)\`,
    ],
    [
      \`  float reflectionEnergy = (\\n      broad * 0.36 + body * 0.54 + ridge * 0.34\\n    ) * segmentAlpha * reflectionScale * arcWeight;\\n  vec3 reflectionColor = mix(waveColor, paleColor, 0.28);\\n  reflectionColorSum += reflectionColor * reflectionEnergy;\\n  reflectionEnergySum += reflectionEnergy;\\n\`,
      \`\`,
    ],
    [
      \`  vec3 reflectionColorSum = vec3(0.0);\\n  float reflectionEnergySum = 0.0;\\n\`,
      \`\`,
    ],
    [
      \`, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);\`,
      \`, waveSum, coreSum);\`,
    ],
    [
      \`  outReflection = vec4(\\n    reflectionColorSum,\\n    reflectionEnergySum\\n  );\\n\`,
      \`\`,
    ],
  ] as const;
  let specialized = source;
  for (const [search, replacement] of replacements) {
    if (!specialized.includes(search)) {
      throw new Error(\`Unable to specialize the core path shader: \${search}\`);
    }
    specialized = specialized.split(search).join(replacement);
  }
  return specialized;
};

const PATH_INTEGRAL_GENERATED_SHADERS = PATH_INTEGRAL_LAYER_EVALUATIONS.map(
  (evaluation) =>
    PATH_INTEGRAL_FRAGMENT_SHADER.replace(
      PATH_INTEGRAL_ALL_LAYER_EVALUATION,
      evaluation,
    ),
) as unknown as [string, string, string];

export const PATH_INTEGRAL_FRAGMENT_SHADERS = [
  PATH_INTEGRAL_GENERATED_SHADERS[0],
  PATH_INTEGRAL_GENERATED_SHADERS[1],
  specializeCorePathOutput(PATH_INTEGRAL_GENERATED_SHADERS[2]),
] as const;`;
const first = source.indexOf(before);
if (first < 0) {
  throw new Error("Expected path shader generation block was not found.");
}
if (source.indexOf(before, first + before.length) >= 0) {
  throw new Error("Expected a unique path shader generation block.");
}
await writeFile(
  shaderPath,
  source.slice(0, first) + after + source.slice(first + before.length),
);
console.log("Applied exact core-pass output specialization experiment.");
