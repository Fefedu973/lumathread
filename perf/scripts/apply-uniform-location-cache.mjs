import { readFile, writeFile } from "node:fs/promises";

const path = "src/runtime/draw-common.ts";
const marker = "LUMATHREAD_UNIFORM_LOCATION_CACHE";
const source = await readFile(path, "utf8");

if (source.includes(marker)) {
  console.log("Uniform-location cache already applied.");
  process.exit(0);
}

const callPattern = /\b([A-Za-z_$][\w$]*)\.getUniformLocation\(/g;
const matches = [...source.matchAll(callPattern)];
if (matches.length === 0) {
  throw new Error(`No getUniformLocation calls were found in ${path}.`);
}

let transformed = source.replace(
  callPattern,
  (_match, contextName) => `getCachedUniformLocation(${contextName}, `,
);

const helper = `
// ${marker}
const uniformLocationCache = new WeakMap<
  WebGLProgram,
  Map<string, WebGLUniformLocation | null>
>();

function getCachedUniformLocation(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  let locations = uniformLocationCache.get(program);
  if (!locations) {
    locations = new Map<string, WebGLUniformLocation | null>();
    uniformLocationCache.set(program, locations);
  }
  if (locations.has(name)) return locations.get(name) ?? null;
  const location = context.getUniformLocation(program, name);
  locations.set(name, location);
  return location;
}
`;

const importPattern = /^(?:import[^;]+;\s*)+/;
const importMatch = transformed.match(importPattern);
if (importMatch) {
  transformed =
    transformed.slice(0, importMatch[0].length) +
    helper +
    transformed.slice(importMatch[0].length);
} else {
  transformed = helper + transformed;
}

await writeFile(path, transformed);
console.log(
  `Applied uniform-location cache to ${matches.length} call sites in ${path}.`,
);
