import { readFile, writeFile } from "node:fs/promises";

const lutWidth = Number(process.argv[2] ?? "8192");
if (![4096, 8192, 16384].includes(lutWidth)) {
  throw new Error(`Unsupported packed-kernel LUT width: ${lutWidth}`);
}

const replaceOnce = async (path, before, after, label) => {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Unable to find ${label} in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
};

const replaceAllExact = async (path, before, after, expected, label) => {
  const source = await readFile(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(
      `Expected ${expected} ${label} occurrence(s) in ${path}, found ${count}`,
    );
  }
  await writeFile(path, source.split(before).join(after));
};

await replaceOnce(
  "src/rendering/profile-textures.ts",
  `export function getPathK0TextureData() {
  cachedPathK0TextureData ??= buildPathK0TextureData();
  return cachedPathK0TextureData;
}`,
  `export function getPathK0TextureData() {
  cachedPathK0TextureData ??= buildPathK0TextureData();
  return cachedPathK0TextureData;
}

export const HERO_PATH_PACKED_KERNEL_LUT_WIDTH = ${lutWidth};
export const HERO_PATH_PACKED_KERNEL_LUT_ROWS = 3;
const HERO_PATH_PACKED_KERNEL_Q_MAX = HERO_PATH_K0_MAX_ARGUMENT / 4.6;

function sampleFrozenPathK0(argument: number, source: Float32Array) {
  if (argument >= HERO_PATH_K0_MAX_ARGUMENT) return 0;
  const normalized = Math.sqrt(
    clamp(
      Math.max(argument, HERO_PATH_K0_MIN_ARGUMENT) /
        HERO_PATH_K0_MAX_ARGUMENT,
      0,
      1,
    ),
  );
  const index = Math.min(
    source.length - 1,
    Math.floor(normalized * source.length),
  );
  return source[index] ?? 0;
}

export function buildPathPackedKernelTextureData() {
  const width = HERO_PATH_PACKED_KERNEL_LUT_WIDTH;
  const data = new Float32Array(
    width * HERO_PATH_PACKED_KERNEL_LUT_ROWS * 4,
  );
  const source = getPathK0TextureData();
  const write = (
    row: number,
    index: number,
    channel: number,
    coefficient: number,
    q: number,
  ) => {
    data[(row * width + index) * 4 + channel] =
      (coefficient / Math.PI) * sampleFrozenPathK0(coefficient * q, source);
  };
  for (let index = 0; index < width; index++) {
    const normalized = (index + 0.5) / width;
    const q = HERO_PATH_PACKED_KERNEL_Q_MAX * normalized * normalized;
    write(0, index, 0, 4.6, q);
    write(0, index, 1, 6.2, q);
    write(0, index, 2, 11, q);
    write(1, index, 0, 20, q);
    write(1, index, 1, 25, q);
    write(2, index, 0, 92, q);
  }
  return data;
}

export let cachedPathPackedKernelTextureData: Float32Array | null = null;

export function getPathPackedKernelTextureData() {
  cachedPathPackedKernelTextureData ??= buildPathPackedKernelTextureData();
  return cachedPathPackedKernelTextureData;
}`,
  "K0 texture data getter",
);

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  passWidths: [number, number, number];`,
  `  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  packedKernelTexture: WebGLTexture;
  passWidths: [number, number, number];`,
  "PathResources K0 texture field",
);
await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  "uK0Lut",
  "uProfiles",`,
  `  "uK0Lut",
  "uPackedKernelLut",
  "uProfiles",`,
  "path uniform names",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `import { getPathK0TextureData } from "../rendering/profile-textures";`,
  `import {
  HERO_PATH_PACKED_KERNEL_LUT_ROWS,
  HERO_PATH_PACKED_KERNEL_LUT_WIDTH,
  getPathK0TextureData,
  getPathPackedKernelTextureData,
} from "../rendering/profile-textures";`,
  "profile texture import",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    exactGl.deleteTexture(resources.k0Texture);
  };`,
  `    exactGl.deleteTexture(resources.k0Texture);
    exactGl.deleteTexture(resources.packedKernelTexture);
  };`,
  "path texture cleanup",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    let k0Texture: WebGLTexture | null = null;
    try {`,
  `    let k0Texture: WebGLTexture | null = null;
    let packedKernelTexture: WebGLTexture | null = null;
    try {`,
  "path texture declarations",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.R32F,
        HERO_PATH_K0_LUT_WIDTH,
        1,
        0,
        exactGl.RED,
        exactGl.FLOAT,
        getPathK0TextureData(),
      );
      const resources: PathResources = {`,
  `      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.R32F,
        HERO_PATH_K0_LUT_WIDTH,
        1,
        0,
        exactGl.RED,
        exactGl.FLOAT,
        getPathK0TextureData(),
      );
      packedKernelTexture = createTexture(
        exactGl,
        1,
        exactGl.NEAREST,
        exactGl.NEAREST,
      );
      exactGl.bindTexture(exactGl.TEXTURE_2D, packedKernelTexture);
      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.RGBA32F,
        HERO_PATH_PACKED_KERNEL_LUT_WIDTH,
        HERO_PATH_PACKED_KERNEL_LUT_ROWS,
        0,
        exactGl.RGBA,
        exactGl.FLOAT,
        getPathPackedKernelTextureData(),
      );
      const resources: PathResources = {`,
  "packed-kernel texture allocation",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
        k0Texture,
        passWidths: [0, 0, 0],`,
  `        reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
        k0Texture,
        packedKernelTexture,
        passWidths: [0, 0, 0],`,
  "packed-kernel resource assignment",
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      if (k0Texture) exactGl.deleteTexture(k0Texture);
      resourceState.pathResources = null;`,
  `      if (k0Texture) exactGl.deleteTexture(k0Texture);
      if (packedKernelTexture) exactGl.deleteTexture(packedKernelTexture);
      resourceState.pathResources = null;`,
  "packed-kernel failure cleanup",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
    if (updateStaticUniforms) {
      uniform1i(exactGl, bundle, "uPalette", 0);
      uniform1i(exactGl, bundle, "uK0Lut", 1);
      uniform1i(exactGl, bundle, "uProfiles", 2);`,
  `    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
    exactGl.activeTexture(exactGl.TEXTURE3);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.packedKernelTexture);
    if (updateStaticUniforms) {
      uniform1i(exactGl, bundle, "uPalette", 0);
      uniform1i(exactGl, bundle, "uK0Lut", 1);
      uniform1i(exactGl, bundle, "uProfiles", 2);
      uniform1i(exactGl, bundle, "uPackedKernelLut", 3);`,
  "packed-kernel texture binding",
);

await replaceAllExact(
  "src/rendering/shaders.ts",
  `uniform sampler2D uK0Lut;`,
  `uniform sampler2D uK0Lut;
uniform sampler2D uPackedKernelLut;`,
  2,
  "K0 sampler declaration",
);
await replaceAllExact(
  "src/rendering/shaders.ts",
  `float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}`,
  `float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

vec4 packedKernelRow(float row, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float q = radius / safeSpread;
  float qMax = K0_MAX_ARGUMENT / 4.6;
  if (q >= qMax) return vec4(0.0);
  float coordinate = sqrt(clamp(q / qMax, 0.0, 1.0));
  return texture(
    uPackedKernelLut,
    vec2(coordinate, (row + 0.5) / 3.0)
  ) / safeSpread;
}`,
  2,
  "line-kernel helper",
);

const originalEvaluations = `const PATH_INTEGRAL_LAYER_EVALUATIONS = [
  \`  if (
    4.6 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = lineKernel(4.6, radialDistance, profileSpread);
  float broad = lineKernel(6.2, radialDistance, profileSpread);
  float body = lineKernel(11.0, radialDistance, profileSpread);
  float ridge = 0.0;
  float core = 0.0;
  float veil = 0.0;\`,
  \`  if (
    20.0 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = lineKernel(20.0, radialDistance, profileSpread);
  float core = 0.0;
  float veil = lineKernel(25.0, radialDistance, profileSpread);\`,
  \`  if (
    92.0 * radialDistance / max(profileSpread, 0.00001)
      >= K0_MAX_ARGUMENT
  ) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = 0.0;
  float core = lineKernel(92.0, radialDistance, profileSpread);
  float veil = 0.0;\`,
] as const;`;
const packedEvaluations = `const PATH_INTEGRAL_LAYER_EVALUATIONS = [
  \`  vec4 packedKernels = packedKernelRow(
    0.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) return;
  float atmosphere = packedKernels.r;
  float broad = packedKernels.g;
  float body = packedKernels.b;
  float ridge = 0.0;
  float core = 0.0;
  float veil = 0.0;\`,
  \`  vec4 packedKernels = packedKernelRow(
    1.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = packedKernels.r;
  float core = 0.0;
  float veil = packedKernels.g;\`,
  \`  vec4 packedKernels = packedKernelRow(
    2.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) return;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = 0.0;
  float core = packedKernels.r;
  float veil = 0.0;\`,
] as const;`;
await replaceOnce(
  "src/rendering/shaders.ts",
  originalEvaluations,
  packedEvaluations,
  "integral layer evaluations",
);

console.log(`Applied ${lutWidth}-sample packed integral-kernel LUT.`);
