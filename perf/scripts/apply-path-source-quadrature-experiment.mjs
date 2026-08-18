import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../..", import.meta.url);
const shaderPath = fileURLToPath(new URL("src/rendering/shaders.ts", root));
const drawCommonPath = fileURLToPath(
  new URL("src/runtime/draw-common.ts", root),
);
const pathRendererPath = fileURLToPath(
  new URL("src/runtime/path-renderer.ts", root),
);
const vertexSource = await readFile(
  fileURLToPath(new URL("path-source-vertex.txt", import.meta.url)),
  "utf8",
);
const fragmentSource = await readFile(
  fileURLToPath(new URL("path-source-fragment.txt", import.meta.url)),
  "utf8",
);

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

{
  const source = await readFile(shaderPath, "utf8");
  const shaderStart = source.indexOf(
    "export const PATH_INTEGRAL_VERTEX_SHADER =",
  );
  const layerStart = source.indexOf(
    "const PATH_INTEGRAL_ALL_LAYER_EVALUATION =",
  );
  if (shaderStart < 0 || layerStart <= shaderStart) {
    throw new Error("Unable to locate the path integral shader block.");
  }
  let next =
    source.slice(0, shaderStart) +
    vertexSource.trimEnd() +
    "\n\n" +
    fragmentSource.trimEnd() +
    "\n\n" +
    source.slice(layerStart);
  const evaluationsStart = next.indexOf(
    "const PATH_INTEGRAL_LAYER_EVALUATIONS =",
  );
  const evaluationsEnd = next.indexOf(
    "/**\n * The generic shader remains exported",
    evaluationsStart,
  );
  if (evaluationsStart < 0 || evaluationsEnd <= evaluationsStart) {
    throw new Error("Unable to locate the path layer specializations.");
  }
  const evaluations = next
    .slice(evaluationsStart, evaluationsEnd)
    .replaceAll("  ) return;", "  ) discard;");
  next =
    next.slice(0, evaluationsStart) +
    evaluations +
    next.slice(evaluationsEnd);
  await writeFile(shaderPath, next);
}

await replaceOnce(
  drawCommonPath,
  `  const bindIntegralGeometry = (
    resources: PathResources,
    pass: number,
    segmentOffsetFloats = 0,
  ) => {`,
  `  const bindIntegralGeometry = (
    resources: PathResources,
    pass: number,
    segmentOffsetFloats = 0,
    instanceDivisor = 1,
  ) => {`,
);
await replaceOnce(
  drawCommonPath,
  `      exactGl.vertexAttribDivisor(location, 1);`,
  `      exactGl.vertexAttribDivisor(location, instanceDivisor);`,
);

const radiusHelper = `  const pathPassProfileRadius = (pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? HERO_PATH_FAR_PROFILE_RADIUS
      : pass === HERO_PATH_PASS_MID
        ? HERO_PATH_MID_PROFILE_RADIUS
        : HERO_PATH_CORE_PROFILE_RADIUS;
`;
await replaceOnce(
  pathRendererPath,
  radiusHelper,
  `${radiusHelper}
  const quadraturePointsForPass = (settings: Settings, pass: number) =>
    pass === HERO_PATH_PASS_FAR
      ? Math.min(settings.quality.quadrature, 2)
      : settings.quality.quadrature;
`,
);
await replaceOnce(
  pathRendererPath,
  `      pass === HERO_PATH_PASS_FAR
        ? Math.min(settings.quality.quadrature, 2)
        : settings.quality.quadrature,`,
  `      quadraturePointsForPass(settings, pass),`,
);
await replaceOnce(
  pathRendererPath,
  `    bindIntegralGeometry(resources, pass, entry.segmentOffsets[pass]);
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count,
    );`,
  `    const quadraturePoints = quadraturePointsForPass(entry.settings, pass);
    bindIntegralGeometry(
      resources,
      pass,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count * quadraturePoints,
    );`,
);

console.log("Applied source-instanced path quadrature experiment.");
