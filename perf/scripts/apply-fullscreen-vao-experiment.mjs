import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label) {
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
}

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);`,
  `  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  if (attributeNames.includes("aPos")) {
    gl.bindAttribLocation(program, 0, "aPos");
  }
  gl.linkProgram(program);`,
  "fixed fullscreen attribute binding",
);

await replaceOnce(
  "src/runtime/draw-common.ts",
  `}: DrawControllerOptions) {
  const updateMaskTexture = (settings: Settings) => {`,
  `}: DrawControllerOptions) {
  const fullscreenVao = exactGl?.createVertexArray() ?? null;
  if (exactGl && !fullscreenVao) {
    throw new Error("Unable to allocate the shared fullscreen VAO.");
  }
  if (exactGl && fullscreenVao) {
    exactGl.bindVertexArray(fullscreenVao);
    exactGl.bindBuffer(exactGl.ARRAY_BUFFER, fullscreenBuffer);
    exactGl.enableVertexAttribArray(0);
    exactGl.vertexAttribPointer(0, 2, exactGl.FLOAT, false, 0, 0);
    exactGl.bindVertexArray(null);
  }

  const updateMaskTexture = (settings: Settings) => {`,
  "shared fullscreen VAO allocation",
);

await replaceOnce(
  "src/runtime/draw-common.ts",
  `  const bindFullscreen = (bundle: ProgramBundle) => {
    const location = bundle.attributes.aPos ?? -1;
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }
  };`,
  `  const bindFullscreen = (bundle: ProgramBundle) => {
    const location = bundle.attributes.aPos ?? -1;
    if (exactGl && fullscreenVao && location === 0) {
      exactGl.bindVertexArray(fullscreenVao);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    if (location >= 0) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    }
  };`,
  "fullscreen geometry binding",
);

await replaceOnce(
  "src/runtime/draw-common.ts",
  `    fillHueMatrix,
  };
}`,
  `    fillHueMatrix,
    destroy: () => {
      if (exactGl && fullscreenVao) exactGl.deleteVertexArray(fullscreenVao);
    },
  };
}`,
  "draw-common cleanup",
);

await replaceOnce(
  "src/runtime/draw-controller.ts",
  `    compositeGlassText: glassTerrain.compositeGlassText,
    localVisualTime: common.localVisualTime,
  };`,
  `    compositeGlassText: glassTerrain.compositeGlassText,
    localVisualTime: common.localVisualTime,
    destroy: common.destroy,
  };`,
  "draw-controller cleanup export",
);

await replaceOnce(
  "src/runtime/path-renderer.ts",
  `    bindIntegralGeometry(
      resources,
      pass,
      bundle,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );`,
  `    exactGl.bindVertexArray(null);
    bindIntegralGeometry(
      resources,
      pass,
      bundle,
      entry.segmentOffsets[pass],
      quadraturePoints,
    );`,
  "generic integral default-VAO restore",
);

await replaceOnce(
  "src/runtime/use-hero-wave-renderer.ts",
  `      compositeGlassText,
      localVisualTime,
    } = drawController;`,
  `      compositeGlassText,
      localVisualTime,
      destroy: destroyDrawController,
    } = drawController;`,
  "draw-controller cleanup destructuring",
);

await replaceOnce(
  "src/runtime/use-hero-wave-renderer.ts",
  `      destroyGlassResources(resourceState.glassResources ?? null);
      if (exactGl) {`,
  `      destroyGlassResources(resourceState.glassResources ?? null);
      destroyDrawController();
      if (exactGl) {`,
  "draw-controller cleanup call",
);

console.log("Applied shared WebGL2 fullscreen VAO experiment.");
