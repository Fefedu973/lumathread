import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const path = "src/runtime/path-renderer.ts";
const marker = "LUMATHREAD_PATH_ATTRIBUTE_STATE_CACHE";
const source = await readFile(path, "utf8");

if (source.includes(marker)) {
  throw new Error("Path attribute-state cache experiment is already applied.");
}

const sourceFile = ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const targetMethods = new Set([
  "bindBuffer",
  "enableVertexAttribArray",
  "disableVertexAttribArray",
  "vertexAttribPointer",
  "vertexAttribIPointer",
  "vertexAttribDivisor",
]);

const replacements = [];
const bodies = new Map();
let matchedCalls = 0;

const findFunctionBody = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)) &&
      current.body &&
      ts.isBlock(current.body)
    ) {
      return current.body;
    }
  }
  return null;
};

const visit = (node) => {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "gl"
  ) {
    const method = node.expression.name.text;
    if (targetMethods.has(method)) {
      const body = findFunctionBody(node);
      if (!body) {
        throw new Error(`Could not find a function body for gl.${method}().`);
      }
      bodies.set(body.pos, body);

      const args = node.arguments.map((argument) =>
        argument.getText(sourceFile),
      );
      let replacement;
      if (
        method === "bindBuffer" &&
        args.length === 2 &&
        args[0].replaceAll(" ", "") === "gl.ARRAY_BUFFER"
      ) {
        replacement = `pathAttributeState.bindArrayBuffer(${args[1]})`;
      } else if (method !== "bindBuffer") {
        replacement = `pathAttributeState.${method}(${args.join(", ")})`;
      }

      if (replacement) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.end,
          text: replacement,
        });
        matchedCalls += 1;
      }
    }
  }
  ts.forEachChild(node, visit);
};

visit(sourceFile);

if (matchedCalls === 0 || bodies.size === 0) {
  throw new Error("No path attribute-state calls were found to cache.");
}

const helper = `
// ${marker}: exact per-entry deduplication of repeated path attribute state.
type PathVertexPointerState = {
  readonly buffer: WebGLBuffer | null;
  readonly size: number;
  readonly type: number;
  readonly normalized: boolean;
  readonly stride: number;
  readonly offset: number;
  readonly integer: boolean;
};

class PathAttributeStateCache {
  private arrayBuffer: WebGLBuffer | null | undefined;
  private readonly enabled = new Set<number>();
  private readonly pointers = new Map<number, PathVertexPointerState>();
  private readonly divisors = new Map<number, number>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  reset() {
    // Other renderer stages may have mutated the global WebGL state since the
    // previous path call. Unknown-on-entry keeps the optimization exact while
    // still deduplicating all repeated setup inside this invocation.
    this.arrayBuffer = undefined;
    this.enabled.clear();
    this.pointers.clear();
    this.divisors.clear();
  }

  bindArrayBuffer(buffer: WebGLBuffer | null) {
    if (this.arrayBuffer === buffer) return;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.arrayBuffer = buffer;
  }

  enableVertexAttribArray(index: number) {
    if (this.enabled.has(index)) return;
    this.gl.enableVertexAttribArray(index);
    this.enabled.add(index);
  }

  disableVertexAttribArray(index: number) {
    if (!this.enabled.has(index)) {
      // Unknown-on-entry means the attribute can still be enabled globally.
      this.gl.disableVertexAttribArray(index);
      return;
    }
    this.gl.disableVertexAttribArray(index);
    this.enabled.delete(index);
  }

  private pointerEquals(
    current: PathVertexPointerState | undefined,
    next: PathVertexPointerState,
  ) {
    return (
      current?.buffer === next.buffer &&
      current.size === next.size &&
      current.type === next.type &&
      current.normalized === next.normalized &&
      current.stride === next.stride &&
      current.offset === next.offset &&
      current.integer === next.integer
    );
  }

  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ) {
    const next: PathVertexPointerState = {
      buffer: this.arrayBuffer ?? null,
      size,
      type,
      normalized,
      stride,
      offset,
      integer: false,
    };
    if (this.pointerEquals(this.pointers.get(index), next)) return;
    this.gl.vertexAttribPointer(index, size, type, normalized, stride, offset);
    this.pointers.set(index, next);
  }

  vertexAttribIPointer(
    index: number,
    size: number,
    type: number,
    stride: number,
    offset: number,
  ) {
    const next: PathVertexPointerState = {
      buffer: this.arrayBuffer ?? null,
      size,
      type,
      normalized: false,
      stride,
      offset,
      integer: true,
    };
    if (this.pointerEquals(this.pointers.get(index), next)) return;
    this.gl.vertexAttribIPointer(index, size, type, stride, offset);
    this.pointers.set(index, next);
  }

  vertexAttribDivisor(index: number, divisor: number) {
    if (this.divisors.get(index) === divisor) return;
    this.gl.vertexAttribDivisor(index, divisor);
    this.divisors.set(index, divisor);
  }
}

const pathAttributeStateCaches = new WeakMap<
  WebGL2RenderingContext,
  PathAttributeStateCache
>();

function getPathAttributeStateCache(gl: WebGL2RenderingContext) {
  let cache = pathAttributeStateCaches.get(gl);
  if (!cache) {
    cache = new PathAttributeStateCache(gl);
    pathAttributeStateCaches.set(gl, cache);
  }
  return cache;
}
`;

let importEnd = 0;
for (const statement of sourceFile.statements) {
  if (ts.isImportDeclaration(statement)) importEnd = statement.end;
}
if (importEnd === 0) {
  throw new Error("Could not find the import boundary in path-renderer.ts.");
}

const edits = [...replacements];
for (const body of bodies.values()) {
  edits.push({
    start: body.getStart(sourceFile) + 1,
    end: body.getStart(sourceFile) + 1,
    text: `\n  const pathAttributeState = getPathAttributeStateCache(gl);\n  pathAttributeState.reset();`,
  });
}
edits.push({ start: importEnd, end: importEnd, text: helper });

edits.sort((left, right) => right.start - left.start || right.end - left.end);
let output = source;
for (const edit of edits) {
  output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
}

await writeFile(path, output);
console.log(
  `Applied exact path attribute-state cache to ${matchedCalls} WebGL calls in ${bodies.size} function(s).`,
);
