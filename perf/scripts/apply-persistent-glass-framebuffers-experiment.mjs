import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(
      `Expected block not found in ${path}: ${before.slice(0, 120)}`,
    );
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected a unique block in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

async function replaceAllExact(path, before, after, expectedCount) {
  const source = await readFile(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} matching blocks in ${path}, found ${count}`,
    );
  }
  await writeFile(path, source.split(before).join(after));
}

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  framebuffer: WebGLFramebuffer;
  blurFramebuffer: WebGLFramebuffer;`,
  `  sceneFramebuffer: WebGLFramebuffer;
  effectFramebuffer: WebGLFramebuffer;
  blurFramebuffers: [WebGLFramebuffer, WebGLFramebuffer];`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    gl.deleteFramebuffer(resources.framebuffer);
    gl.deleteFramebuffer(resources.blurFramebuffer);`,
  `    gl.deleteFramebuffer(resources.sceneFramebuffer);
    gl.deleteFramebuffer(resources.effectFramebuffer);
    for (const framebuffer of resources.blurFramebuffers) {
      gl.deleteFramebuffer(framebuffer);
    }`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      exactGl ? exactGl.RGBA8 : gl.RGBA,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindTexture(gl.TEXTURE_2D, resources.effectTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      exactGl ? exactGl.RGBA8 : gl.RGBA,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.sceneTexture,
      0,
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(\`Incomplete glass scene framebuffer: \${status}\`);
    }
    for (const texture of resources.blurTextures) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        resources.blurWidth,
        resources.blurHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const blurStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (blurStatus !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(\`Incomplete glass blur framebuffer: \${blurStatus}\`);
      }
    }
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.effectTexture,
      0,
    );
    const effectStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (effectStatus !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      throw new Error(\`Incomplete glass effect framebuffer: \${effectStatus}\`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);`,
  `    const allocateTexture = (
      texture: WebGLTexture,
      width: number,
      height: number,
    ) => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    };
    allocateTexture(
      resources.sceneTexture,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    allocateTexture(
      resources.effectTexture,
      resourceState.canvasWidth,
      resourceState.canvasHeight,
    );
    for (const texture of resources.blurTextures) {
      allocateTexture(texture, resources.blurWidth, resources.blurHeight);
    }

    const validateTarget = (
      framebuffer: WebGLFramebuffer,
      texture: WebGLTexture,
      label: string,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(\`Incomplete glass \${label} framebuffer: \${status}\`);
      }
    };
    validateTarget(
      resources.sceneFramebuffer,
      resources.sceneTexture,
      "scene",
    );
    validateTarget(
      resources.effectFramebuffer,
      resources.effectTexture,
      "effect",
    );
    validateTarget(
      resources.blurFramebuffers[0],
      resources.blurTextures[0],
      "blur A",
    );
    validateTarget(
      resources.blurFramebuffers[1],
      resources.blurTextures[1],
      "blur B",
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    let framebuffer: WebGLFramebuffer | null = null;
    let blurFramebuffer: WebGLFramebuffer | null = null;`,
  `    let sceneFramebuffer: WebGLFramebuffer | null = null;
    let effectFramebuffer: WebGLFramebuffer | null = null;
    let blurFramebufferA: WebGLFramebuffer | null = null;
    let blurFramebufferB: WebGLFramebuffer | null = null;`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      framebuffer = gl.createFramebuffer();
      blurFramebuffer = gl.createFramebuffer();`,
  `      sceneFramebuffer = gl.createFramebuffer();
      effectFramebuffer = gl.createFramebuffer();
      blurFramebufferA = gl.createFramebuffer();
      blurFramebufferB = gl.createFramebuffer();`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      if (!framebuffer || !blurFramebuffer)
        throw new Error("Unable to allocate the glass framebuffer.");`,
  `      if (
        !sceneFramebuffer ||
        !effectFramebuffer ||
        !blurFramebufferA ||
        !blurFramebufferB
      ) {
        throw new Error("Unable to allocate the glass framebuffers.");
      }`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        framebuffer,
        blurFramebuffer,`,
  `        sceneFramebuffer,
        effectFramebuffer,
        blurFramebuffers: [blurFramebufferA, blurFramebufferB],`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (blurFramebuffer) gl.deleteFramebuffer(blurFramebuffer);`,
  `      if (sceneFramebuffer) gl.deleteFramebuffer(sceneFramebuffer);
      if (effectFramebuffer) gl.deleteFramebuffer(effectFramebuffer);
      if (blurFramebufferA) gl.deleteFramebuffer(blurFramebufferA);
      if (blurFramebufferB) gl.deleteFramebuffer(blurFramebufferB);`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);`,
  `      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.sceneFramebuffer);`,
);

await replaceAllExact(
  "src/runtime/glass-terrain-renderer.ts",
  `    const drawBlurPass = (
      source: WebGLTexture,
      target: WebGLTexture,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target,
        0,
      );`,
  `    const drawBlurPass = (
      source: WebGLTexture,
      target: WebGLFramebuffer,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);`,
  1,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `        resources.blurTextures[0],
        step / resources.blurWidth,`,
  `        resources.blurFramebuffers[0],
        step / resources.blurWidth,`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `        resources.blurTextures[1],
        0,
        step / resources.blurHeight,`,
  `        resources.blurFramebuffers[1],
        0,
        step / resources.blurHeight,`,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const drawPass = (
      source: WebGLTexture,
      target: WebGLTexture,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target,
        0,
      );`,
  `    const drawPass = (
      source: WebGLTexture,
      target: WebGLFramebuffer,
      directionX: number,
      directionY: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);`,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `      resources.blurTextures[0],
      normalizedRadius / Math.max(resourceState.canvasWidth, 1),`,
  `      resources.blurFramebuffers[0],
      normalizedRadius / Math.max(resourceState.canvasWidth, 1),`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `      resources.blurTextures[1],
      0,
      normalizedRadius / Math.max(resourceState.canvasHeight, 1),`,
  `      resources.blurFramebuffers[1],
      0,
      normalizedRadius / Math.max(resourceState.canvasHeight, 1),`,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.effectTexture,
      0,
    );`,
  `    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.effectFramebuffer);`,
);

console.log("Applied persistent glass framebuffer experiment.");
