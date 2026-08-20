import { clamp } from "../math";
import type { ResolvedGlassText } from "../config/settings";

export { HERO_GLASS_SDF_RANGE_CSS_PX } from "../config/settings";

export function trackedTextWidth(
  context: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
  nativeLetterSpacing = false,
) {
  if (nativeLetterSpacing) return context.measureText(text).width;
  return (
    context.measureText(text).width +
    Math.max(0, text.length - 1) * letterSpacing
  );
}

export function wrapGlassText(
  context: CanvasRenderingContext2D,
  text: string,
  maximumWidth: number,
  letterSpacing: number,
  nativeLetterSpacing = false,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (
        line &&
        trackedTextWidth(
          context,
          candidate,
          letterSpacing,
          nativeLetterSpacing,
        ) > maximumWidth
      ) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

export function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  left: number,
  baselineY: number,
  letterSpacing: number,
  nativeLetterSpacing = false,
) {
  if (nativeLetterSpacing) {
    context.fillText(text, left, baselineY);
    return;
  }
  let x = left;
  for (const character of text) {
    context.fillText(character, x, baselineY);
    x += context.measureText(character).width + letterSpacing;
  }
}

export function configureCanvasLetterSpacing(
  context: CanvasRenderingContext2D,
  letterSpacing: number,
) {
  if (typeof Reflect.get(context, "letterSpacing") !== "string") return false;
  Reflect.set(context, "letterSpacing", `${letterSpacing}px`);
  return true;
}

export const HERO_GLASS_MASK_MAX_DIMENSION = 1280;
export const HERO_GLASS_CHAMFER_DIAGONAL = Math.SQRT2;

export interface GlassMaskBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function buildChamferDistance(
  alpha: Uint8Array,
  width: number,
  height: number,
  targetInside: boolean,
) {
  const distance = new Float32Array(width * height);
  for (let index = 0; index < distance.length; index++) {
    const inside = (alpha[index] ?? 0) >= 128;
    distance[index] = inside === targetInside ? 0 : Number.POSITIVE_INFINITY;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      let value = distance[index] ?? Number.POSITIVE_INFINITY;
      if (x > 0) value = Math.min(value, (distance[index - 1] ?? value) + 1);
      if (y > 0)
        value = Math.min(value, (distance[index - width] ?? value) + 1);
      if (x > 0 && y > 0) {
        value = Math.min(
          value,
          (distance[index - width - 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      if (x + 1 < width && y > 0) {
        value = Math.min(
          value,
          (distance[index - width + 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      distance[index] = value;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = y * width + x;
      let value = distance[index] ?? Number.POSITIVE_INFINITY;
      if (x + 1 < width)
        value = Math.min(value, (distance[index + 1] ?? value) + 1);
      if (y + 1 < height)
        value = Math.min(value, (distance[index + width] ?? value) + 1);
      if (x + 1 < width && y + 1 < height) {
        value = Math.min(
          value,
          (distance[index + width + 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      if (x > 0 && y + 1 < height) {
        value = Math.min(
          value,
          (distance[index + width - 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      distance[index] = value;
    }
  }
  return distance;
}

export function encodeGlassSignedDistance(
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
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

export function renderGlassTextMask(
  canvas: HTMLCanvasElement,
  settings: ResolvedGlassText,
  width: number,
  height: number,
  dpr: number,
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!settings.enabled) return;

  const maximumWidth = width * settings.maxWidth;
  const maximumHeight = height * settings.maxHeight;
  if (settings.shape === "svg") {
    if (!settings.svgPath.trim()) return;
    const [minX, minY, viewWidth, viewHeight] = settings.svgViewBox;
    const scale = Math.min(
      maximumWidth / Math.max(viewWidth, 0.000001),
      maximumHeight / Math.max(viewHeight, 0.000001),
    );
    context.save();
    try {
      const path = new Path2D(settings.svgPath);
      context.translate(width * settings.centerX, height * settings.centerY);
      context.scale(scale, scale);
      context.translate(-minX - viewWidth * 0.5, -minY - viewHeight * 0.5);
      context.fillStyle = "#ffffff";
      context.fill(path);
    } catch {
      // Invalid SVG path data produces an empty mask without breaking rendering.
    } finally {
      context.restore();
    }
    return;
  }
  if (!settings.text.trim()) return;
  const letterSpacing = settings.letterSpacing * dpr;
  const nativeLetterSpacing = configureCanvasLetterSpacing(
    context,
    letterSpacing,
  );
  const layoutAtSize = (fontSize: number) => {
    context.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`;
    const lines =
      settings.textWrap === "explicit"
        ? settings.text.split("\n")
        : wrapGlassText(
            context,
            settings.text,
            maximumWidth,
            letterSpacing,
            nativeLetterSpacing,
          );
    const lineHeight = fontSize * settings.lineHeight;
    const textWidth = lines.reduce(
      (maximum, line) =>
        Math.max(
          maximum,
          trackedTextWidth(context, line, letterSpacing, nativeLetterSpacing),
        ),
      0,
    );
    return {
      fontSize,
      lines,
      lineHeight,
      textWidth,
      height: lines.length * lineHeight,
    };
  };

  let lower = Math.min(8 * dpr, settings.fontSize * dpr);
  let upper = settings.fontSize * dpr;
  let layout = layoutAtSize(upper);
  for (let iteration = 0; iteration < 10; iteration++) {
    if (layout.textWidth <= maximumWidth && layout.height <= maximumHeight) {
      lower = layout.fontSize;
    } else {
      upper = layout.fontSize;
    }
    layout = layoutAtSize((lower + upper) * 0.5);
  }
  if (layout.textWidth > maximumWidth || layout.height > maximumHeight) {
    layout = layoutAtSize(lower);
  }

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const top = height * settings.centerY - layout.height * 0.5;
  const probeMetrics = context.measureText("Hg");
  const ascent = probeMetrics.fontBoundingBoxAscent;
  const descent = probeMetrics.fontBoundingBoxDescent;
  const baselineOffset =
    settings.baselineOffset > 0
      ? (settings.baselineOffset * layout.fontSize) / settings.fontSize
      : Number.isFinite(ascent) && Number.isFinite(descent)
        ? (layout.lineHeight - (ascent + descent)) * 0.5 + ascent
        : layout.fontSize * 0.79;
  const blockLeft = width * settings.centerX - maximumWidth * 0.5;
  layout.lines.forEach((line, index) => {
    const lineWidth = trackedTextWidth(
      context,
      line,
      letterSpacing,
      nativeLetterSpacing,
    );
    const lineLeft =
      settings.textAlign === "left"
        ? blockLeft
        : width * settings.centerX - lineWidth * 0.5;
    drawTrackedText(
      context,
      line,
      lineLeft,
      top + index * layout.lineHeight + baselineOffset,
      letterSpacing,
      nativeLetterSpacing,
    );
  });
}
