import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const at = source.indexOf(before);
  if (at < 0) {
    throw new Error(
      `Expected block missing in ${path}: ${before.slice(0, 100)}`,
    );
  }
  if (source.indexOf(before, at + before.length) >= 0) {
    throw new Error(`Block not unique in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, at) + after + source.slice(at + before.length),
  );
}

await replaceOnce(
  "src/rendering/shaders.ts",
  `uniform float uBrightness;
uniform float uOpacity;`,
  `uniform float uBrightness;
uniform float uOpacity;
uniform float uDirectComposite;
uniform float uSceneOpacity;`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  if (mask <= 0.001 && (uTwinkle <= 0.001 || sparkleRegion <= 0.001)) {
    gl_FragColor = vec4(0.0);
    return;
  }`,
  `  if (mask <= 0.001 && (uTwinkle <= 0.001 || sparkleRegion <= 0.001)) {
    gl_FragColor = uDirectComposite > 0.5
      ? vec4(scene * uSceneOpacity, 1.0)
      : vec4(0.0);
    return;
  }`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  float glassAlpha = max(mask * uOpacity, clamp(sparkle * 0.72, 0.0, 1.0));
  gl_FragColor = vec4(glass * glassAlpha, glassAlpha);`,
  `  float glassAlpha = max(mask * uOpacity, clamp(sparkle * 0.72, 0.0, 1.0));
  vec4 effect = vec4(glass * glassAlpha, glassAlpha);
  if (uDirectComposite > 0.5) {
    effect = floor(clamp(effect, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
    gl_FragColor = vec4(
      scene * uSceneOpacity * (1.0 - effect.a) + effect.rgb,
      1.0
    );
  } else {
    gl_FragColor = effect;
  }`,
);
await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  "uOpacity",
] as const;`,
  `  "uOpacity",
  "uDirectComposite",
  "uSceneOpacity",
] as const;`,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const blurredScene = blurGlassScene(resources, settings);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      resources.effectTexture,
      0,
    );
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);`,
  `    const blurredScene = blurGlassScene(resources, settings);
    const sceneOpacity = settings.fadeInAffectsGlassText
      ? 1
      : getSceneFadeProgress();
    const directComposite =
      exactGl !== null && introProgress === 1 && sceneOpacity === 1;
    if (directComposite && exactGl) {
      exactGl.bindFramebuffer(exactGl.READ_FRAMEBUFFER, resources.framebuffer);
      exactGl.bindFramebuffer(exactGl.DRAW_FRAMEBUFFER, null);
      exactGl.blitFramebuffer(
        0,
        0,
        resourceState.canvasWidth,
        resourceState.canvasHeight,
        0,
        0,
        resourceState.canvasWidth,
        resourceState.canvasHeight,
        exactGl.COLOR_BUFFER_BIT,
        exactGl.NEAREST,
      );
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
      if (!effectBounds) return;
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        resources.effectTexture,
        0,
      );
      gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
      gl.disable(gl.BLEND);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(gl, resources.program, "uOpacity", settings.glassText.opacity);
    if (effectBounds) {`,
  `    uniform1f(gl, resources.program, "uOpacity", settings.glassText.opacity);
    uniform1f(
      gl,
      resources.program,
      "uDirectComposite",
      directComposite ? 1 : 0,
    );
    uniform1f(gl, resources.program, "uSceneOpacity", sceneOpacity);
    if (effectBounds) {`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `      gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    }

    const introBlurPhysicalPx =`,
  `      gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    }
    if (directComposite) return;

    const introBlurPhysicalPx =`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const sceneOpacity = settings.fadeInAffectsGlassText
      ? 1
      : getSceneFadeProgress();
    const canBlitScene =`,
  `    const canBlitScene =`,
);

console.log("Applied steady direct glass composite experiment.");
