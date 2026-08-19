import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing ${label} in ${path}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Non-unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

const path = "src/runtime/path-renderer.ts";
let source = await readFile(path, "utf8");
const integralDeclaration = `  const integralStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n`;
if (source.includes(integralDeclaration)) {
  if (source.split(integralDeclaration).length - 1 !== 1) {
    throw new Error("Non-unique integral static uniform declaration");
  }
  source = source.replace(
    integralDeclaration,
    `${integralDeclaration}  const pathCompositeStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n  const flatDotStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n`,
  );
  await writeFile(path, source);
} else {
  await replaceOnce(
    path,
    `  const { followModifiers } = followController;\n\n  const pathPassProfileRadius`,
    `  const { followModifiers } = followController;\n\n  const pathCompositeStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n  const flatDotStaticUniformKeys = new WeakMap<ProgramBundle, string>();\n\n  const pathPassProfileRadius`,
    "path static uniform cache declarations",
  );
}

await replaceOnce(
  path,
  `  const applyFlatDotUniforms = (bundle: ProgramBundle, settings: Settings) => {
    if (!exactGl) return;
    uniform2f(
      exactGl,
      bundle,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1f(exactGl, bundle, "uTime", getClockTime());
    uniform1i(exactGl, bundle, "uFarReflection", 1);
    uniform1i(exactGl, bundle, "uMidReflection", 3);
    uniform1i(exactGl, bundle, "uDotMask", 5);
    uniform1f(
      exactGl,
      bundle,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(exactGl, bundle, "uDotR", 1.1 * resourceState.dpr);
    uniform1f(exactGl, bundle, "uDotAlpha", settings.dotOpacity);
    uniform1f(exactGl, bundle, "uTwinkle", settings.twinkle);
    uniform1f(exactGl, bundle, "uReflect", settings.reflect);
    uniform1f(
      exactGl,
      bundle,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(exactGl, bundle, settings);
  };`,
  `  const applyFlatDotUniforms = (bundle: ProgramBundle, settings: Settings) => {
    if (!exactGl) return;
    const staticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      resourceState.dpr,
      settings.dotSpacing,
      settings.dotOpacity,
      settings.twinkle,
      settings.reflect,
      settings.theme,
    ].join("|");
    if (flatDotStaticUniformKeys.get(bundle) !== staticKey) {
      uniform2f(
        exactGl,
        bundle,
        "uRes",
        resourceState.canvasWidth,
        resourceState.canvasHeight,
      );
      uniform1i(exactGl, bundle, "uFarReflection", 1);
      uniform1i(exactGl, bundle, "uMidReflection", 3);
      uniform1i(exactGl, bundle, "uDotMask", 5);
      uniform1f(
        exactGl,
        bundle,
        "uSpacing",
        settings.dotSpacing * resourceState.dpr,
      );
      uniform1f(exactGl, bundle, "uDotR", 1.1 * resourceState.dpr);
      uniform1f(exactGl, bundle, "uDotAlpha", settings.dotOpacity);
      uniform1f(exactGl, bundle, "uTwinkle", settings.twinkle);
      uniform1f(exactGl, bundle, "uReflect", settings.reflect);
      uniform1f(
        exactGl,
        bundle,
        "uThemeMode",
        settings.theme === "light" ? 1 : 0,
      );
      flatDotStaticUniformKeys.set(bundle, staticKey);
    }
    uniform1f(exactGl, bundle, "uTime", getClockTime());
    applyDotInteractionUniforms(exactGl, bundle, settings);
  };`,
  "flat-dot uniform split",
);

await replaceOnce(
  path,
  `    activateProgram(compositeProgram.program);
    bindFullscreen(compositeProgram);
    uniform2f(
      exactGl,
      compositeProgram,
      "uRes",
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    uniform1i(exactGl, compositeProgram, "uFarWave", 0);
    uniform1i(exactGl, compositeProgram, "uFarReflection", 1);
    uniform1i(exactGl, compositeProgram, "uMidWave", 2);
    uniform1i(exactGl, compositeProgram, "uMidReflection", 3);
    uniform1i(exactGl, compositeProgram, "uCoreWave", 4);
    uniform1i(exactGl, compositeProgram, "uDotMask", 5);
    exactGl.activeTexture(exactGl.TEXTURE6);
    exactGl.bindTexture(exactGl.TEXTURE_2D, backgroundTexture);
    uniform1i(exactGl, compositeProgram, "uBackgroundImage", 6);
    uniform1f(
      exactGl,
      compositeProgram,
      "uBackgroundOpacity",
      settings.backgroundImage.opacity,
    );
    uniform1f(exactGl, compositeProgram, "uTime", getClockTime());
    uniform1f(
      exactGl,
      compositeProgram,
      "uSpacing",
      settings.dotSpacing * resourceState.dpr,
    );
    uniform1f(exactGl, compositeProgram, "uDotR", 1.1 * resourceState.dpr);
    uniform1f(
      exactGl,
      compositeProgram,
      "uDotAlpha",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.dotOpacity
        : 0,
    );
    uniform1f(exactGl, compositeProgram, "uTwinkle", settings.twinkle);
    uniform1f(
      exactGl,
      compositeProgram,
      "uReflect",
      settings.dotsEnabled && settings.dotMode === "flat"
        ? settings.reflect
        : 0,
    );
    uniform1f(
      exactGl,
      compositeProgram,
      "uNoisePhase",
      (getClockTime() % 1) * 61.7,
    );
    uniform1f(
      exactGl,
      compositeProgram,
      "uThemeMode",
      settings.theme === "light" ? 1 : 0,
    );
    applyDotInteractionUniforms(exactGl, compositeProgram, settings);`,
  `    activateProgram(compositeProgram.program);
    bindFullscreen(compositeProgram);
    exactGl.activeTexture(exactGl.TEXTURE6);
    exactGl.bindTexture(exactGl.TEXTURE_2D, backgroundTexture);
    const staticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      resourceState.dpr,
      settings.backgroundImage.opacity,
      settings.dotSpacing,
      settings.dotsEnabled ? 1 : 0,
      settings.dotMode,
      settings.dotOpacity,
      settings.twinkle,
      settings.reflect,
      settings.theme,
    ].join("|");
    if (pathCompositeStaticUniformKeys.get(compositeProgram) !== staticKey) {
      uniform2f(
        exactGl,
        compositeProgram,
        "uRes",
        resourceState.canvasWidth,
        resourceState.canvasHeight,
      );
      uniform1i(exactGl, compositeProgram, "uFarWave", 0);
      uniform1i(exactGl, compositeProgram, "uFarReflection", 1);
      uniform1i(exactGl, compositeProgram, "uMidWave", 2);
      uniform1i(exactGl, compositeProgram, "uMidReflection", 3);
      uniform1i(exactGl, compositeProgram, "uCoreWave", 4);
      uniform1i(exactGl, compositeProgram, "uDotMask", 5);
      uniform1i(exactGl, compositeProgram, "uBackgroundImage", 6);
      uniform1f(
        exactGl,
        compositeProgram,
        "uBackgroundOpacity",
        settings.backgroundImage.opacity,
      );
      uniform1f(
        exactGl,
        compositeProgram,
        "uSpacing",
        settings.dotSpacing * resourceState.dpr,
      );
      uniform1f(exactGl, compositeProgram, "uDotR", 1.1 * resourceState.dpr);
      uniform1f(
        exactGl,
        compositeProgram,
        "uDotAlpha",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.dotOpacity
          : 0,
      );
      uniform1f(exactGl, compositeProgram, "uTwinkle", settings.twinkle);
      uniform1f(
        exactGl,
        compositeProgram,
        "uReflect",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.reflect
          : 0,
      );
      uniform1f(
        exactGl,
        compositeProgram,
        "uThemeMode",
        settings.theme === "light" ? 1 : 0,
      );
      pathCompositeStaticUniformKeys.set(compositeProgram, staticKey);
    }
    uniform1f(exactGl, compositeProgram, "uTime", getClockTime());
    uniform1f(
      exactGl,
      compositeProgram,
      "uNoisePhase",
      (getClockTime() % 1) * 61.7,
    );
    applyDotInteractionUniforms(exactGl, compositeProgram, settings);`,
  "path composite static uniform split",
);

console.log("Applied path composite and flat-dot static-uniform caches.");
