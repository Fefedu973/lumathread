import { readFile, writeFile } from "node:fs/promises";

const requested = Number(process.argv[2] ?? "3");
if (requested !== 2 && requested !== 3) {
  throw new Error(
    `Expected quadrature point count 2 or 3, received ${requested}`,
  );
}

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const index = source.indexOf(before);
  if (index < 0) {
    throw new Error(`Expected source block was not found in ${path}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected a unique source block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, index) + after + source.slice(index + before.length),
  );
}

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `  const quadraturePointsForPass = (settings: Settings, pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? Math.min(settings.quality.quadrature, 2)
      : settings.quality.quadrature;`,
  `  const quadraturePointsForPass = (settings: Settings, pass: number) => {
    if (pass === HERO_PATH_PASS_FAR) {
      return Math.min(settings.quality.quadrature, 2);
    }
    if (shouldUseSourceInstancedQuadrature(settings)) return ${requested};
    return settings.quality.quadrature;
  };`,
);

await replaceOnce(
  "src/rendering/shaders.ts",
  `void quadratureSource(out float sourceParameter, out float quadratureWeight) {
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
}`,
  `void quadratureSource(out float sourceParameter, out float quadratureWeight) {
  int count = 2;
  if (uQuadraturePoints > 3.5) {
    count = 4;
  } else if (uQuadraturePoints > 2.5) {
    count = 3;
  }
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
  } else if (count == 3) {
    if (index == 0) {
      sourceParameter = 0.1127016654;
      quadratureWeight = 0.2777777778;
    } else if (index == 1) {
      sourceParameter = 0.5;
      quadratureWeight = 0.4444444444;
    } else {
      sourceParameter = 0.8872983346;
      quadratureWeight = 0.2777777778;
    }
  } else if (index == 0) {
    sourceParameter = 0.2113248654;
    quadratureWeight = 0.5;
  } else {
    sourceParameter = 0.7886751346;
    quadratureWeight = 0.5;
  }
}`,
);

console.log(`Applied ${requested}-point CTA Gauss-Legendre quadrature.`);
