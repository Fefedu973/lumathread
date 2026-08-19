import { readFile, writeFile } from "node:fs/promises";

const path = "src/runtime/glass-terrain-renderer.ts";
let source = await readFile(path, "utf8");

const replaceOnce = (before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Non-unique ${label}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
};

const replaceAllExact = (before, after, expectedCount, label) => {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ${label} blocks, found ${count}`);
  }
  source = source.split(before).join(after);
};

const indent = (value, spaces = 2) => {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
};

replaceOnce(
  `  const {
    ensureTerrainResources,
    updateTerrainGeometry,
    bindSceneTarget,
    glassIsActive,
    ensureGlassResources,
  } = resourceManager;
`,
  `  const {
    ensureTerrainResources,
    updateTerrainGeometry,
    bindSceneTarget,
    glassIsActive,
    ensureGlassResources,
  } = resourceManager;

  const glassStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const compositeStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const blurStaticUniformKeys = new WeakMap<ProgramBundle, string>();
  const dotInteractionStaticUniformKeys = new WeakMap<ProgramBundle, string>();
`,
  "glass uniform cache declarations",
);

const interactionStartMarker = `  const applyDotInteractionUniforms = (`;
const interactionEndMarker = `

  const drawTerrainDots = (`;
const interactionStart = source.indexOf(interactionStartMarker);
const interactionEnd = source.indexOf(interactionEndMarker, interactionStart);
if (interactionStart < 0 || interactionEnd < 0) {
  throw new Error("Unable to locate dot interaction uniform helper");
}
const interactionReplacement = `  const applyDotInteractionUniforms = (
    context: WebGLRenderingContext,
    bundle: ProgramBundle,
    settings: Settings,
  ) => {
    const interaction = settings.dotInteraction;
    const active =
      settings.dotsEnabled &&
      interaction.enabled &&
      pointerState.dotPointerActive;
    uniform2f(
      context,
      bundle,
      "uDotPointer",
      pointerState.dotPointerX,
      pointerState.dotPointerY,
    );
    uniform1f(context, bundle, "uDotPointerActive", active ? 1 : 0);

    const pointerColor = hexToVec3(interaction.color);
    const staticKey = [
      resourceState.dpr,
      interaction.radius,
      interaction.softness,
      interaction.brightness,
      pointerColor[0],
      pointerColor[1],
      pointerColor[2],
      interaction.colorStrength,
      interaction.magnification,
      interaction.terrainDisplacement,
    ].join("|");
    if (dotInteractionStaticUniformKeys.get(bundle) === staticKey) return;

    uniform1f(
      context,
      bundle,
      "uDotPointerRadius",
      interaction.radius * resourceState.dpr,
    );
    uniform1f(context, bundle, "uDotPointerSoftness", interaction.softness);
    uniform1f(context, bundle, "uDotPointerBrightness", interaction.brightness);
    context.uniform3f(
      bundle.uniforms.uDotPointerColor ?? null,
      ...pointerColor,
    );
    uniform1f(
      context,
      bundle,
      "uDotPointerColorStrength",
      interaction.colorStrength,
    );
    uniform1f(
      context,
      bundle,
      "uDotPointerMagnification",
      interaction.magnification,
    );
    uniform1f(
      context,
      bundle,
      "uTerrainPointerDisplacement",
      interaction.terrainDisplacement,
    );
    dotInteractionStaticUniformKeys.set(bundle, staticKey);
  };`;
source =
  source.slice(0, interactionStart) +
  interactionReplacement +
  source.slice(interactionEnd);

replaceAllExact(
  `      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      uniform2f(
`,
  `      uniform2f(
`,
  2,
  "repeated blur static uniforms",
);

replaceOnce(
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
`,
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const blurStaticKey = [resources.blurWidth, resources.blurHeight].join("|");
    if (blurStaticUniformKeys.get(resources.blurProgram) !== blurStaticKey) {
      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      blurStaticUniformKeys.set(resources.blurProgram, blurStaticKey);
    }
    const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
`,
  "scene blur cache initialization",
);

replaceOnce(
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const normalizedRadius = radiusPhysicalPx * 0.55;
`,
  `    activateProgram(resources.blurProgram.program);
    bindFullscreen(resources.blurProgram);
    const blurStaticKey = [resources.blurWidth, resources.blurHeight].join("|");
    if (blurStaticUniformKeys.get(resources.blurProgram) !== blurStaticKey) {
      uniform1i(gl, resources.blurProgram, "uSource", 0);
      uniform2f(
        gl,
        resources.blurProgram,
        "uResolution",
        resources.blurWidth,
        resources.blurHeight,
      );
      blurStaticUniformKeys.set(resources.blurProgram, blurStaticKey);
    }
    const normalizedRadius = radiusPhysicalPx * 0.55;
`,
  "effect blur cache initialization",
);

const glassStartMarker = `    uniform1i(gl, glassProgram, "uScene", 0);\n`;
const glassTimeMarker = `    uniform1f(gl, glassProgram, "uTime", getClockTime());\n`;
const glassEffectMarker = `    if (effectBounds) {\n`;
const glassStart = source.indexOf(glassStartMarker);
const glassTime = source.indexOf(glassTimeMarker, glassStart);
const glassEffect = source.indexOf(glassEffectMarker, glassTime);
if (glassStart < 0 || glassTime < 0 || glassEffect < 0) {
  throw new Error("Unable to locate glass uniform ranges");
}
const glassBeforeTime = source.slice(glassStart, glassTime);
const glassAfterTime = source.slice(
  glassTime + glassTimeMarker.length,
  glassEffect,
);
const glassStaticPrefix = `    const glassStaticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      resourceState.dpr,
      settings.glassText.refraction,
      settings.glassText.edgeWrap,
      settings.glassText.surfaceModel,
      settings.glassText.bevelMode,
      settings.glassText.surfaceDepth,
      settings.glassText.ior,
      settings.glassText.magnificationX,
      settings.glassText.magnificationY,
      settings.glassText.displacementX,
      settings.glassText.displacementY,
      settings.glassText.diffusion,
      settings.glassText.blur,
      settings.glassText.distortion,
      settings.glassText.chromaticAberration,
      settings.glassText.frost,
      settings.glassText.roughness,
      settings.glassText.bevel,
      settings.glassText.ribStrength,
      settings.glassText.ribWidth,
      settings.glassText.ribAngle,
      settings.glassText.liquidStrength,
      settings.glassText.liquidScale,
      settings.glassText.liquidSpeed,
      settings.glassText.edgeStrength,
      settings.glassText.specular,
      settings.glassText.fresnel,
      settings.glassText.twinkle,
      settings.glassText.twinkleDensity,
      settings.glassText.twinkleSpeed,
      settings.glassText.twinkleSize,
      settings.glassText.tint,
      settings.glassText.tintStrength,
      settings.glassText.saturation,
      settings.glassText.brightness,
      settings.glassText.opacity,
    ].join("|");
    const updateGlassStaticUniforms =
      glassStaticUniformKeys.get(glassProgram) !== glassStaticKey;
    if (updateGlassStaticUniforms) {
`;
const glassReplacement =
  glassStaticPrefix +
  indent(glassBeforeTime, 2) +
  indent(glassAfterTime, 2) +
  `      glassStaticUniformKeys.set(glassProgram, glassStaticKey);\n` +
  `    }\n` +
  glassTimeMarker;
source =
  source.slice(0, glassStart) +
  glassReplacement +
  source.slice(glassEffect);

const compositeStartMarker = `    uniform1i(gl, resources.compositeProgram, "uScene", 0);\n`;
const compositeDynamicMarker = `    uniform1f(
      gl,
      resources.compositeProgram,
      "uSceneOpacity",
`;
const compositeStart = source.indexOf(compositeStartMarker);
const compositeDynamic = source.indexOf(
  compositeDynamicMarker,
  compositeStart,
);
if (compositeStart < 0 || compositeDynamic < 0) {
  throw new Error("Unable to locate composite static uniform range");
}
const compositeStatic = source.slice(compositeStart, compositeDynamic);
const compositeKeyPrefix = `    const compositeStaticKey = [
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    ].join("|");
    if (
      compositeStaticUniformKeys.get(resources.compositeProgram) !==
      compositeStaticKey
    ) {
`;
const compositeReplacement =
  compositeKeyPrefix +
  indent(compositeStatic, 2) +
  `      compositeStaticUniformKeys.set(\n` +
  `        resources.compositeProgram,\n` +
  `        compositeStaticKey,\n` +
  `      );\n` +
  `    }\n`;
source =
  source.slice(0, compositeStart) +
  compositeReplacement +
  source.slice(compositeDynamic);

await writeFile(path, source);
console.log("Applied glass, blur, composite, and dot static-uniform caches.");
