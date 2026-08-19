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

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  segmentBuffers: [WebGLBuffer, WebGLBuffer, WebGLBuffer];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer, WebGLFramebuffer];`,
  `  segmentBuffers: [WebGLBuffer, WebGLBuffer, WebGLBuffer];
  sourceIntegralVaos: [
    WebGLVertexArrayObject | null,
    WebGLVertexArrayObject | null,
    WebGLVertexArrayObject | null,
  ];
  sourceIntegralVaoKeys: [number, number, number];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer, WebGLFramebuffer];`,
  "path VAO resource fields",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    exactGl.deleteBuffer(resources.quadBuffer);
    for (const buffer of resources.segmentBuffers) exactGl.deleteBuffer(buffer);`,
  `    exactGl.deleteBuffer(resources.quadBuffer);
    for (const vao of resources.sourceIntegralVaos) {
      if (vao) exactGl.deleteVertexArray(vao);
    }
    for (const buffer of resources.segmentBuffers) exactGl.deleteBuffer(buffer);`,
  "path VAO destruction",
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        segmentBuffers: [
          segmentBuffers[0]!,
          segmentBuffers[1]!,
          segmentBuffers[2]!,
        ],
        framebuffers: [framebuffers[0]!, framebuffers[1]!, framebuffers[2]!],`,
  `        segmentBuffers: [
          segmentBuffers[0]!,
          segmentBuffers[1]!,
          segmentBuffers[2]!,
        ],
        sourceIntegralVaos: [null, null, null],
        sourceIntegralVaoKeys: [-1, -1, -1],
        framebuffers: [framebuffers[0]!, framebuffers[1]!, framebuffers[2]!],`,
  "path VAO initialization",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    bindIntegralGeometry(
      resources,
      pass,
      bundle,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count * quadraturePoints,
    );`,
  `    if (sourceInstanced) {
      const vaoKey = entry.segmentOffsets[pass] * 8 + quadraturePoints;
      let vao = resources.sourceIntegralVaos[pass];
      if (!vao) {
        vao = exactGl.createVertexArray();
        if (!vao) {
          throw new Error("Unable to allocate the source-integral VAO.");
        }
        resources.sourceIntegralVaos[pass] = vao;
      }
      if (resources.sourceIntegralVaoKeys[pass] !== vaoKey) {
        exactGl.bindVertexArray(vao);
        bindIntegralGeometry(
          resources,
          pass,
          bundle,
          entry.segmentOffsets[pass],
          quadraturePoints,
        );
        exactGl.bindVertexArray(null);
        resources.sourceIntegralVaoKeys[pass] = vaoKey;
      }
      exactGl.bindVertexArray(vao);
      exactGl.drawArraysInstanced(
        exactGl.TRIANGLES,
        0,
        HERO_PATH_QUAD_VERTEX_COUNT,
        count * quadraturePoints,
      );
      exactGl.bindVertexArray(null);
      return;
    }
    bindIntegralGeometry(
      resources,
      pass,
      bundle,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );
    exactGl.drawArraysInstanced(
      exactGl.TRIANGLES,
      0,
      HERO_PATH_QUAD_VERTEX_COUNT,
      count * quadraturePoints,
    );`,
  "source-integral draw binding",
);

console.log("Applied cached source-integral VAO experiment.");
