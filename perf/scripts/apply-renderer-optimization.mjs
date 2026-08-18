import { readFile, writeFile } from "node:fs/promises";

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

await replaceOnce(
  "src/rendering/shaders.ts",
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  float active = step(1.0 - uTwinkleDensity, activeSeed);
  vec2 sparkleOffset = vec2(`,
  `  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  if (activeSeed < 1.0 - uTwinkleDensity) return 0.0;
  vec2 sparkleOffset = vec2(`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
  `  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  if (sparkleOrigin <= 0.0) return 0.0;
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  return active * pulse * star * sparkleOrigin;`,
  `  return pulse * star * sparkleOrigin;`,
);
await replaceOnce(
  "src/rendering/shaders.ts",
  `  float sparkle = glassTwinkle(gl_FragCoord.xy)
    * uTwinkle
    * (0.62 + thickness * 0.38)
    * sparkleRegion;`,
  `  float sparkle = 0.0;
  if (uTwinkle > 0.001 && sparkleRegion > 0.001) {
    sparkle = glassTwinkle(gl_FragCoord.xy)
      * uTwinkle
      * (0.62 + thickness * 0.38)
      * sparkleRegion;
  }`,
);

await replaceOnce(
  "src/rendering/glass-mask.ts",
  `export const HERO_GLASS_MASK_MAX_DIMENSION = 1280;
export const HERO_GLASS_CHAMFER_DIAGONAL = Math.SQRT2;`,
  `export const HERO_GLASS_MASK_MAX_DIMENSION = 1280;
export const HERO_GLASS_CHAMFER_DIAGONAL = Math.SQRT2;

export interface GlassMaskBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}`,
);
await replaceOnce(
  "src/rendering/glass-mask.ts",
  `export function encodeGlassSignedDistance(
  canvas: HTMLCanvasElement,
  rangePixels: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < alpha.length; index++) {
    alpha[index] = image.data[index * 4 + 3] ?? 0;
  }
  const distanceToInside = buildChamferDistance(
    alpha,
    canvas.width,
    canvas.height,
    true,
  );
  const distanceToOutside = buildChamferDistance(
    alpha,
    canvas.width,
    canvas.height,
    false,
  );
  const safeRange = Math.max(rangePixels, 1);
  for (let index = 0; index < alpha.length; index++) {
    const offset = index * 4;
    const inside = (alpha[index] ?? 0) >= 128;
    const signedDistance = inside
      ? (distanceToOutside[index] ?? 0)
      : -(distanceToInside[index] ?? 0);
    image.data[offset] = alpha[index] ?? 0;
    image.data[offset + 1] = Math.round(
      clamp(0.5 + signedDistance / (safeRange * 2), 0, 1) * 255,
    );
    image.data[offset + 2] = 0;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}`,
  `export function encodeGlassSignedDistance(
  canvas: HTMLCanvasElement,
  rangePixels: number,
): GlassMaskBounds | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const width = canvas.width;
  const height = canvas.height;
  const image = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let index = 0; index < alpha.length; index++) {
    const alphaValue = image.data[index * 4 + 3] ?? 0;
    alpha[index] = alphaValue;
    if (alphaValue <= 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }
  const distanceToInside = buildChamferDistance(alpha, width, height, true);
  const distanceToOutside = buildChamferDistance(alpha, width, height, false);
  const safeRange = Math.max(rangePixels, 1);
  for (let index = 0; index < alpha.length; index++) {
    const offset = index * 4;
    const inside = (alpha[index] ?? 0) >= 128;
    const signedDistance = inside
      ? (distanceToOutside[index] ?? 0)
      : -(distanceToInside[index] ?? 0);
    image.data[offset] = alpha[index] ?? 0;
    image.data[offset + 1] = Math.round(
      clamp(0.5 + signedDistance / (safeRange * 2), 0, 1) * 255,
    );
    image.data[offset + 2] = 0;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return right > left && bottom > top
    ? { left, top, right, bottom }
    : null;
}`,
);

await replaceOnce(
  "src/rendering/webgl-resources.ts",
  `  maskWidth: number;
  maskHeight: number;
  width: number;`,
  `  maskWidth: number;
  maskHeight: number;
  maskBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
  width: number;`,
);

await replaceOnce(
  "src/runtime/resource-manager.ts",
  `    resources.maskSettingsKey = "";
    resources.maskSizeRevision = -1;
    return true;`,
  `    resources.maskSettingsKey = "";
    resources.maskSizeRevision = -1;
    resources.maskBounds = null;
    return true;`,
);
await replaceOnce(
  "src/runtime/resource-manager.ts",
  `        maskWidth: 0,
        maskHeight: 0,
        width: 0,`,
  `        maskWidth: 0,
        maskHeight: 0,
        maskBounds: null,
        width: 0,`,
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    encodeGlassSignedDistance(
      resources.maskCanvas,
      HERO_GLASS_SDF_RANGE_CSS_PX * resourceState.dpr * maskScale,
    );`,
  `    resources.maskBounds = encodeGlassSignedDistance(
      resources.maskCanvas,
      HERO_GLASS_SDF_RANGE_CSS_PX * resourceState.dpr * maskScale,
    );`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `  const applyDotInteractionUniforms = (`,
  `  const resolveGlassEffectBounds = (
    resources: GlassTextResources,
    settings: Settings,
  ) => {
    const bounds = resources.maskBounds;
    if (!bounds || resources.maskWidth <= 0 || resources.maskHeight <= 0) {
      return null;
    }
    const scaleX = resourceState.canvasWidth / resources.maskWidth;
    const scaleY = resourceState.canvasHeight / resources.maskHeight;
    const samplingPadding = Math.ceil(Math.max(scaleX, scaleY) * 2);
    const sparklePadding =
      settings.glassText.twinkle > 0.001
        ? Math.ceil(
            Math.max(
              settings.glassText.twinkleSize * resourceState.dpr * 0.85,
              6,
            ) + 2,
          )
        : 0;
    const padding = samplingPadding + sparklePadding;
    const left = Math.max(0, Math.floor(bounds.left * scaleX) - padding);
    const top = Math.max(0, Math.floor(bounds.top * scaleY) - padding);
    const right = Math.min(
      resourceState.canvasWidth,
      Math.ceil(bounds.right * scaleX) + padding,
    );
    const bottom = Math.min(
      resourceState.canvasHeight,
      Math.ceil(bounds.bottom * scaleY) + padding,
    );
    if (right <= left || bottom <= top) return null;
    return {
      x: left,
      y: resourceState.canvasHeight - bottom,
      width: right - left,
      height: bottom - top,
    };
  };

  const applyDotInteractionUniforms = (`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    updateGlassTextMask(resources, settings);
    const introElapsedMs = Math.max(`,
  `    updateGlassTextMask(resources, settings);
    const effectBounds = resolveGlassEffectBounds(resources, settings);
    const introElapsedMs = Math.max(`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);`,
  `    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(gl, resources.program, "uOpacity", settings.glassText.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const introBlurPhysicalPx =`,
  `    uniform1f(gl, resources.program, "uOpacity", settings.glassText.opacity);
    if (effectBounds) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }

    const introBlurPhysicalPx =`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const blurredEffect = blurGlassEffect(resources, introBlurPhysicalPx);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);`,
  `    const blurredEffect = blurGlassEffect(resources, introBlurPhysicalPx);
    const sceneOpacity = settings.fadeInAffectsGlassText
      ? 1
      : getSceneFadeProgress();
    const canBlitScene =
      exactGl !== null && introProgress === 1 && sceneOpacity === 1;
    if (canBlitScene) {
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
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, resourceState.canvasWidth, resourceState.canvasHeight);`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `      settings.fadeInAffectsGlassText ? 1 : getSceneFadeProgress(),
    );`,
  `      sceneOpacity,
    );`,
);
await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return { applyDotInteractionUniforms, drawTerrainDots, compositeGlassText };`,
  `    if (canBlitScene && effectBounds) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        effectBounds.x,
        effectBounds.y,
        effectBounds.width,
        effectBounds.height,
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (canBlitScene) gl.disable(gl.SCISSOR_TEST);
  };

  return { applyDotInteractionUniforms, drawTerrainDots, compositeGlassText };`,
);

console.log("Applied exact glass renderer optimization experiment.");
