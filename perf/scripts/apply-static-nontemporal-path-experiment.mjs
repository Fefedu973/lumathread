import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(
      `Missing expected block in ${path}: ${before.slice(0, 80)}`,
    );
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

const shaderPath = "src/rendering/shaders.ts";
const staticSpecializations = `

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
        __BT__Unable to specialize static path shader \${label}: expected block is missing.__BT__,
      );
    }
    result = next;
  }
  return result;
}

const STATIC_WAVE_REPLACEMENTS = [
  [
    __BT__  vec4 farWave = mix(
    texture(uFarWave, uv),
    texture(uFarWaveNext, uv),
    uTemporalMix
  );__BT__,
    __BT__  vec4 farWave = texture(uFarWave, uv);__BT__,
  ],
  [
    __BT__  vec4 midWave = mix(
    texture(uMidWave, uv),
    texture(uMidWaveNext, uv),
    uTemporalMix
  );__BT__,
    __BT__  vec4 midWave = texture(uMidWave, uv);__BT__,
  ],
  [
    __BT__  vec4 coreWave = mix(
    texture(uCoreWave, uv),
    texture(uCoreWaveNext, uv),
    uTemporalMix
  );__BT__,
    __BT__  vec4 coreWave = texture(uCoreWave, uv);__BT__,
  ],
  [
    __BT__  vec4 farReflection = mix(
    texture(uFarReflection, uv),
    texture(uFarReflectionNext, uv),
    uTemporalMix
  );__BT__,
    __BT__  vec4 farReflection = texture(uFarReflection, uv);__BT__,
  ],
  [
    __BT__  vec4 midReflection = mix(
    texture(uMidReflection, uv),
    texture(uMidReflectionNext, uv),
    uTemporalMix
  );__BT__,
    __BT__  vec4 midReflection = texture(uMidReflection, uv);__BT__,
  ],
] as const;

const STATIC_BASE_WAVE_REPLACEMENTS = [
  [
    __BT__  vec3 wave = mix(
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
    );__BT__,
    __BT__  vec3 wave = texture(uFarWave, uv).rgb
    + texture(uMidWave, uv).rgb
    + texture(uCoreWave, uv).rgb;__BT__,
  ],
] as const;

const STATIC_DOT_REFLECTION_REPLACEMENTS = [
  [
    __BT__  vec4 reflection = mix(
      texture(uFarReflection, uv),
      texture(uFarReflectionNext, uv),
      uTemporalMix
    )
    + mix(
      texture(uMidReflection, uv),
      texture(uMidReflectionNext, uv),
      uTemporalMix
    );__BT__,
    __BT__  vec4 reflection = texture(uFarReflection, uv)
    + texture(uMidReflection, uv);__BT__,
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
`.replaceAll("__BT__", "`");
const shaders = await readFile(shaderPath, "utf8");
if (shaders.includes("PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER")) {
  throw new Error("Static path shader specialization already exists.");
}
await writeFile(shaderPath, shaders + staticSpecializations);

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  compositeProgram: ProgramBundle;\n  baseCompositeProgram: ProgramBundle;`,
  `  compositeProgram: ProgramBundle;\n  baseCompositeProgram: ProgramBundle;\n  staticCompositeProgram: ProgramBundle;\n  staticBaseCompositeProgram: ProgramBundle;`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `  PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,\n  PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,\n  PATH_DOTS_IDLE_VERTEX_SHADER,\n  PATH_DOTS_IDLE_FRAGMENT_SHADER,\n  PATH_DOTS_POINTER_FRAGMENT_SHADER,`,
  `  PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,\n  PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,\n  PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER,\n  PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER,\n  PATH_DOTS_IDLE_VERTEX_SHADER,\n  PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER,\n  PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER,`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    exactGl.deleteProgram(resources.compositeProgram.program);\n    exactGl.deleteProgram(resources.baseCompositeProgram.program);`,
  `    exactGl.deleteProgram(resources.compositeProgram.program);\n    exactGl.deleteProgram(resources.baseCompositeProgram.program);\n    exactGl.deleteProgram(resources.staticCompositeProgram.program);\n    exactGl.deleteProgram(resources.staticBaseCompositeProgram.program);`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    let compositeProgram: ProgramBundle | null = null;\n    let baseCompositeProgram: ProgramBundle | null = null;\n    let idleDotsProgram: ProgramBundle | null = null;`,
  `    let compositeProgram: ProgramBundle | null = null;\n    let baseCompositeProgram: ProgramBundle | null = null;\n    let staticCompositeProgram: ProgramBundle | null = null;\n    let staticBaseCompositeProgram: ProgramBundle | null = null;\n    let idleDotsProgram: ProgramBundle | null = null;`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      baseCompositeProgram = createProgramBundle(\n        exactGl,\n        FULLSCREEN_VERTEX_SHADER_300,\n        PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,\n        ["aPos"],\n        PATH_INTEGRAL_COMPOSITE_UNIFORMS,\n      );\n      idleDotsProgram = createProgramBundle(\n        exactGl,\n        PATH_DOTS_IDLE_VERTEX_SHADER,\n        PATH_DOTS_IDLE_FRAGMENT_SHADER,`,
  `      baseCompositeProgram = createProgramBundle(\n        exactGl,\n        FULLSCREEN_VERTEX_SHADER_300,\n        PATH_INTEGRAL_BASE_COMPOSITE_FRAGMENT_SHADER,\n        ["aPos"],\n        PATH_INTEGRAL_COMPOSITE_UNIFORMS,\n      );\n      staticCompositeProgram = createProgramBundle(\n        exactGl,\n        FULLSCREEN_VERTEX_SHADER_300,\n        PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER,\n        ["aPos"],\n        PATH_INTEGRAL_COMPOSITE_UNIFORMS,\n      );\n      staticBaseCompositeProgram = createProgramBundle(\n        exactGl,\n        FULLSCREEN_VERTEX_SHADER_300,\n        PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER,\n        ["aPos"],\n        PATH_INTEGRAL_COMPOSITE_UNIFORMS,\n      );\n      idleDotsProgram = createProgramBundle(\n        exactGl,\n        PATH_DOTS_IDLE_VERTEX_SHADER,\n        PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER,`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        PATH_DOTS_POINTER_FRAGMENT_SHADER,`,
  `        PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER,`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        compositeProgram,\n        baseCompositeProgram,\n        idleDotsProgram,`,
  `        compositeProgram,\n        baseCompositeProgram,\n        staticCompositeProgram,\n        staticBaseCompositeProgram,\n        idleDotsProgram,`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      if (baseCompositeProgram)\n        exactGl.deleteProgram(baseCompositeProgram.program);\n      if (idleDotsProgram)`,
  `      if (baseCompositeProgram)\n        exactGl.deleteProgram(baseCompositeProgram.program);\n      if (staticCompositeProgram)\n        exactGl.deleteProgram(staticCompositeProgram.program);\n      if (staticBaseCompositeProgram)\n        exactGl.deleteProgram(staticBaseCompositeProgram.program);\n      if (idleDotsProgram)`,
);

await replaceOnce(
  "src/runtime/draw-common.ts",
  `    exactGl.activeTexture(exactGl.TEXTURE7);\n    exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[0]);\n    exactGl.activeTexture(exactGl.TEXTURE8);\n    exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[0]);\n    exactGl.activeTexture(exactGl.TEXTURE9);\n    exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[1]);\n    exactGl.activeTexture(exactGl.TEXTURE10);\n    exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[1]);\n    exactGl.activeTexture(exactGl.TEXTURE11);\n    exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[2]);`,
  `    if (useTemporalBank) {\n      exactGl.activeTexture(exactGl.TEXTURE7);\n      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[0]);\n      exactGl.activeTexture(exactGl.TEXTURE8);\n      exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[0]);\n      exactGl.activeTexture(exactGl.TEXTURE9);\n      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[1]);\n      exactGl.activeTexture(exactGl.TEXTURE10);\n      exactGl.bindTexture(exactGl.TEXTURE_2D, nextReflectionTextures[1]);\n      exactGl.activeTexture(exactGl.TEXTURE11);\n      exactGl.bindTexture(exactGl.TEXTURE_2D, nextWaveTextures[2]);\n    }`,
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1i(exactGl, bundle, "uFarReflectionNext", 7);\n    uniform1i(exactGl, bundle, "uMidReflectionNext", 9);\n    uniform1f(exactGl, bundle, "uTemporalMix", 0);\n`,
  ``,
);
await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    const compositeProgram = splitFlatDots\n      ? resources.baseCompositeProgram\n      : resources.compositeProgram;`,
  `    const compositeProgram = temporalActive\n      ? splitFlatDots\n        ? resources.baseCompositeProgram\n        : resources.compositeProgram\n      : splitFlatDots\n        ? resources.staticBaseCompositeProgram\n        : resources.staticCompositeProgram;`,
);
await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    uniform1i(exactGl, compositeProgram, "uFarWaveNext", 7);\n    uniform1i(exactGl, compositeProgram, "uFarReflectionNext", 8);\n    uniform1i(exactGl, compositeProgram, "uMidWaveNext", 9);\n    uniform1i(exactGl, compositeProgram, "uMidReflectionNext", 10);\n    uniform1i(exactGl, compositeProgram, "uCoreWaveNext", 11);\n    uniform1f(exactGl, compositeProgram, "uTemporalMix", temporalMix);`,
  `    if (temporalActive) {\n      uniform1i(exactGl, compositeProgram, "uFarWaveNext", 7);\n      uniform1i(exactGl, compositeProgram, "uFarReflectionNext", 8);\n      uniform1i(exactGl, compositeProgram, "uMidWaveNext", 9);\n      uniform1i(exactGl, compositeProgram, "uMidReflectionNext", 10);\n      uniform1i(exactGl, compositeProgram, "uCoreWaveNext", 11);\n      uniform1f(exactGl, compositeProgram, "uTemporalMix", temporalMix);\n    }`,
);

console.log("Applied static non-temporal path composite specialization.");
