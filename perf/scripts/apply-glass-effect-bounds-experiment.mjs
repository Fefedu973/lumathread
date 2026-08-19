import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label} in ${path}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Non-unique ${label} in ${path}`);
  }
  await writeFile(
    path,
    source.slice(0, first) + after + source.slice(first + before.length),
  );
}

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
  "glass mask constants",
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
  }`,
  "glass SDF alpha extraction",
);

await replaceOnce(
  "src/rendering/glass-mask.ts",
  `  context.putImageData(image, 0, 0);
}`,
  `  context.putImageData(image, 0, 0);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}`,
  "glass SDF return",
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
  "glass resource mask dimensions",
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
  "glass target invalidation",
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
  "glass resource initialization",
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
  "glass mask SDF call",
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
    const sampleReach = Math.ceil(
      Math.max(scaleX, scaleY) * (2 + Math.max(settings.glassText.bevel, 0)),
    );
    const sparkleReach =
      settings.glassText.twinkle > 0.001
        ? Math.ceil(
            Math.max(
              settings.glassText.twinkleSize * resourceState.dpr * 0.85,
              6,
            ) + 3,
          )
        : 0;
    const padding = sampleReach + sparkleReach;
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
  "glass bounds helper insertion",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    const glassProgram = resolveGlassProgram(resources, settings);
    updateGlassTextMask(resources, settings);
    const introElapsedMs = Math.max(`,
  `    const glassProgram = resolveGlassProgram(resources, settings);
    updateGlassTextMask(resources, settings);
    const effectBounds = resolveGlassEffectBounds(resources, settings);
    const introElapsedMs = Math.max(`,
  "glass effect bounds resolution",
);

await replaceOnce(
  "src/runtime/glass-terrain-renderer.ts",
  `    uniform1f(gl, glassProgram, "uOpacity", settings.glassText.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);`,
  `    uniform1f(gl, glassProgram, "uOpacity", settings.glassText.opacity);
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
    }`,
  "bounded glass effect draw",
);

console.log("Applied exact glass-effect scissor bounds experiment.");
