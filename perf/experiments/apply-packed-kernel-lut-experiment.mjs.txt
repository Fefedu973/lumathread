import { readFile, writeFile } from 'node:fs/promises';
const width=Number(process.argv[2]??'8192');
if (![4096,8192,16384].includes(width)) throw new Error('bad width');
async function replaceOnce(path,before,after){const s=await readFile(path,'utf8'); const i=s.indexOf(before); if(i<0) throw new Error(`missing ${path}: ${before.slice(0,80)}`); if(s.indexOf(before,i+before.length)>=0) throw new Error(`dupe ${path}`); await writeFile(path,s.slice(0,i)+after+s.slice(i+before.length));}
const profile='src/rendering/profile-textures.ts';
await replaceOnce(profile,
`export let cachedPathK0TextureData: Float32Array | null = null;

export function getPathK0TextureData() {
  cachedPathK0TextureData ??= buildPathK0TextureData();
  return cachedPathK0TextureData;
}`,
`export let cachedPathK0TextureData: Float32Array | null = null;

export function getPathK0TextureData() {
  cachedPathK0TextureData ??= buildPathK0TextureData();
  return cachedPathK0TextureData;
}

export const HERO_PATH_SOURCE_KERNEL_LUT_WIDTH = ${width};
export const HERO_PATH_SOURCE_KERNEL_LUT_ROWS = 3;
const HERO_PATH_SOURCE_KERNEL_Q_MAX = HERO_PATH_K0_MAX_ARGUMENT / 4.6;

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

export function buildPathSourceKernelTextureData() {
  const width = HERO_PATH_SOURCE_KERNEL_LUT_WIDTH;
  const data = new Float32Array(
    width * HERO_PATH_SOURCE_KERNEL_LUT_ROWS * 4,
  );
  const source = getPathK0TextureData();
  const write = (row: number, index: number, channel: number, coefficient: number, q: number) => {
    data[(row * width + index) * 4 + channel] =
      (coefficient / Math.PI) * sampleFrozenPathK0(coefficient * q, source);
  };
  for (let index = 0; index < width; index++) {
    const normalized = (index + 0.5) / width;
    const q = HERO_PATH_SOURCE_KERNEL_Q_MAX * normalized * normalized;
    write(0, index, 0, 4.6, q);
    write(0, index, 1, 6.2, q);
    write(0, index, 2, 11, q);
    write(1, index, 0, 20, q);
    write(1, index, 1, 25, q);
    write(2, index, 0, 92, q);
  }
  return data;
}

export let cachedPathSourceKernelTextureData: Float32Array | null = null;

export function getPathSourceKernelTextureData() {
  cachedPathSourceKernelTextureData ??= buildPathSourceKernelTextureData();
  return cachedPathSourceKernelTextureData;
}`);

await replaceOnce('src/rendering/webgl-resources.ts',
`  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  passWidths: [number, number, number];`,
`  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  sourceKernelTexture: WebGLTexture;
  passWidths: [number, number, number];`);
await replaceOnce('src/rendering/webgl-resources.ts',
`  "uK0Lut",
  "uProfiles",`,
`  "uK0Lut",
  "uSourceKernelLut",
  "uProfiles",`);

const rm='src/runtime/resource-manager.ts';
await replaceOnce(rm,
`import { getPathK0TextureData } from "../rendering/profile-textures";`,
`import {
  HERO_PATH_SOURCE_KERNEL_LUT_ROWS,
  HERO_PATH_SOURCE_KERNEL_LUT_WIDTH,
  getPathK0TextureData,
  getPathSourceKernelTextureData,
} from "../rendering/profile-textures";`);
await replaceOnce(rm,
`    exactGl.deleteTexture(resources.k0Texture);
  };`,
`    exactGl.deleteTexture(resources.k0Texture);
    exactGl.deleteTexture(resources.sourceKernelTexture);
  };`);
await replaceOnce(rm,
`    let k0Texture: WebGLTexture | null = null;
    try {`,
`    let k0Texture: WebGLTexture | null = null;
    let sourceKernelTexture: WebGLTexture | null = null;
    try {`);
await replaceOnce(rm,
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
      sourceKernelTexture = createTexture(
        exactGl,
        1,
        exactGl.NEAREST,
        exactGl.NEAREST,
      );
      exactGl.bindTexture(exactGl.TEXTURE_2D, sourceKernelTexture);
      exactGl.texImage2D(
        exactGl.TEXTURE_2D,
        0,
        exactGl.RGBA32F,
        HERO_PATH_SOURCE_KERNEL_LUT_WIDTH,
        HERO_PATH_SOURCE_KERNEL_LUT_ROWS,
        0,
        exactGl.RGBA,
        exactGl.FLOAT,
        getPathSourceKernelTextureData(),
      );
      const resources: PathResources = {`);
await replaceOnce(rm,
`        k0Texture,
        passWidths: [0, 0, 0],`,
`        k0Texture,
        sourceKernelTexture,
        passWidths: [0, 0, 0],`);
await replaceOnce(rm,
`      if (k0Texture) exactGl.deleteTexture(k0Texture);
      resourceState.pathResources = null;`,
`      if (k0Texture) exactGl.deleteTexture(k0Texture);
      if (sourceKernelTexture) exactGl.deleteTexture(sourceKernelTexture);
      resourceState.pathResources = null;`);

const pr='src/runtime/path-renderer.ts';
await replaceOnce(pr,
`    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
    uniform1i(exactGl, bundle, "uPalette", 0);
    uniform1i(exactGl, bundle, "uK0Lut", 1);
    uniform1i(exactGl, bundle, "uProfiles", 2);`,
`    exactGl.activeTexture(exactGl.TEXTURE2);
    exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
    exactGl.activeTexture(exactGl.TEXTURE3);
    exactGl.bindTexture(exactGl.TEXTURE_2D, resources.sourceKernelTexture);
    uniform1i(exactGl, bundle, "uPalette", 0);
    uniform1i(exactGl, bundle, "uK0Lut", 1);
    uniform1i(exactGl, bundle, "uProfiles", 2);
    uniform1i(exactGl, bundle, "uSourceKernelLut", 3);`);

const sh='src/rendering/shaders.ts';
await replaceOnce(sh,
`uniform sampler2D uK0Lut;
uniform mat3 uHueMatrix;`,
`uniform sampler2D uK0Lut;
uniform sampler2D uSourceKernelLut;
uniform mat3 uHueMatrix;`);
await replaceOnce(sh,
`float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

void main() {`,
`float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

vec4 sourceKernelRow(float row, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float q = radius / safeSpread;
  float qMax = K0_MAX_ARGUMENT / 4.6;
  if (q >= qMax) return vec4(0.0);
  float coordinate = sqrt(clamp(q / qMax, 0.0, 1.0));
  return texture(
    uSourceKernelLut,
    vec2(coordinate, (row + 0.5) / 3.0)
  ) / safeSpread;
}

void main() {`);
await replaceOnce(sh,
`const PATH_SOURCE_INTEGRAL_LAYER_EVALUATIONS =
  PATH_INTEGRAL_LAYER_EVALUATIONS.map((evaluation) =>
    evaluation.replaceAll("  ) return;", "  ) discard;"),
  );`,
`const PATH_SOURCE_INTEGRAL_LAYER_EVALUATIONS = [
  \`  vec4 packedKernels = sourceKernelRow(
    0.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) discard;
  float atmosphere = packedKernels.r;
  float broad = packedKernels.g;
  float body = packedKernels.b;
  float ridge = 0.0;
  float core = 0.0;
  float veil = 0.0;\`,
  \`  vec4 packedKernels = sourceKernelRow(
    1.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) discard;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = packedKernels.r;
  float core = 0.0;
  float veil = packedKernels.g;\`,
  \`  vec4 packedKernels = sourceKernelRow(
    2.0,
    radialDistance,
    profileSpread
  );
  if (packedKernels.r <= 0.0) discard;
  float atmosphere = 0.0;
  float broad = 0.0;
  float body = 0.0;
  float ridge = 0.0;
  float core = packedKernels.r;
  float veil = 0.0;\`,
] as const;`);
console.log(`Applied ${width}-sample packed source-kernel LUT.`);
