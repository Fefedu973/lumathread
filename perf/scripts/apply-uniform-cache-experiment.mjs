import { readFile, writeFile } from "node:fs/promises";

const resourcePath = "src/rendering/webgl-resources.ts";

async function replaceOnce(before, after) {
  const source = await readFile(resourcePath, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(
      `Expected uniform-cache block not found: ${before.slice(0, 100)}`,
    );
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(
      `Expected a unique uniform-cache block: ${before.slice(0, 100)}`,
    );
  }
  await writeFile(
    resourcePath,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

await replaceOnce(
  `export interface ProgramBundle {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}`,
  `export interface ProgramBundle {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
  uniformCache: Map<string, number | readonly [number, number]>;
}`,
);

await replaceOnce(
  `  return { program, attributes, uniforms };`,
  `  return { program, attributes, uniforms, uniformCache: new Map() };`,
);

await replaceOnce(
  `export function uniform1f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1f(bundle.uniforms[name] ?? null, value);
}`,
  `export function uniform1f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  const key = \`1f:\${name}\`;
  if (Object.is(bundle.uniformCache.get(key), value)) return;
  gl.uniform1f(bundle.uniforms[name] ?? null, value);
  bundle.uniformCache.set(key, value);
}`,
);

await replaceOnce(
  `export function uniform1i(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1i(bundle.uniforms[name] ?? null, value);
}`,
  `export function uniform1i(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  const key = \`1i:\${name}\`;
  if (Object.is(bundle.uniformCache.get(key), value)) return;
  gl.uniform1i(bundle.uniforms[name] ?? null, value);
  bundle.uniformCache.set(key, value);
}`,
);

await replaceOnce(
  `export function uniform2f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  x: number,
  y: number,
) {
  gl.uniform2f(bundle.uniforms[name] ?? null, x, y);
}`,
  `export function uniform2f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  x: number,
  y: number,
) {
  const key = \`2f:\${name}\`;
  const cached = bundle.uniformCache.get(key);
  if (
    Array.isArray(cached) &&
    Object.is(cached[0], x) &&
    Object.is(cached[1], y)
  ) {
    return;
  }
  gl.uniform2f(bundle.uniforms[name] ?? null, x, y);
  bundle.uniformCache.set(key, [x, y]);
}`,
);

console.log("Applied exact scalar/vector uniform cache experiment.");
