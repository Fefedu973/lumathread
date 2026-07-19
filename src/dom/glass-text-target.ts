import type {
  HeroWaveDomTarget,
  HeroWaveGlassTextConfig,
  HeroWaveGlassTextDomConfig,
} from "../types";

export interface GlassTextDomSnapshot {
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: "center" | "left";
  baselineOffset: number;
  centerX: number;
  centerY: number;
  maxWidth: number;
  maxHeight: number;
}

function finiteCssNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function transformText(text: string, transform: string) {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") {
    return text.replace(
      /(^|\s)(\S)/gu,
      (_match, spacing, character) => `${spacing}${character.toUpperCase()}`,
    );
  }
  return text;
}

export interface GlassTextCharacterSample {
  value: string;
  centerY: number | null;
  forcedBreak: boolean;
}

export function groupGlassTextCharacters(
  characters: readonly GlassTextCharacterSample[],
  lineHeight: number,
) {
  const lines: string[] = [];
  let line = "";
  let lineCenterY: number | null = null;
  const lineThreshold = Math.max(1, lineHeight * 0.55);
  const commit = (preserveEmpty = false) => {
    const normalized = line.replace(/\s+/gu, " ").trim();
    if (normalized || preserveEmpty) lines.push(normalized);
    line = "";
    lineCenterY = null;
  };

  for (const character of characters) {
    if (character.forcedBreak) {
      commit(true);
      continue;
    }
    if (
      character.centerY !== null &&
      lineCenterY !== null &&
      Math.abs(character.centerY - lineCenterY) > lineThreshold
    ) {
      commit();
    }
    if (character.centerY !== null && lineCenterY === null) {
      lineCenterY = character.centerY;
    }
    line += character.value;
  }
  commit();

  return lines;
}

function renderedDomText(element: HTMLElement, lineHeight: number) {
  const characters: GlassTextCharacterSample[] = [];
  const range = document.createRange();

  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const value = node.textContent ?? "";
      let offset = 0;
      for (const character of value) {
        const length = character.length;
        if (character === "\r") {
          offset += length;
          continue;
        }
        if (character === "\n") {
          characters.push({ value: "", centerY: null, forcedBreak: true });
          offset += length;
          continue;
        }
        range.setStart(node, offset);
        range.setEnd(node, offset + length);
        const rect = Array.from(range.getClientRects()).find(
          (candidate) => candidate.height > 0,
        );
        characters.push({
          value: character,
          centerY: rect ? rect.top + rect.height * 0.5 : null,
          forcedBreak: false,
        });
        offset += length;
      }
      return;
    }
    if (node.nodeName === "BR") {
      characters.push({ value: "", centerY: null, forcedBreak: true });
      return;
    }
    for (const child of node.childNodes) visit(child);
  };

  visit(element);
  const lines = groupGlassTextCharacters(characters, lineHeight);

  return lines.length > 0
    ? lines.join("\n")
    : element.innerText || element.textContent || "";
}

function targetPadding(config: HeroWaveGlassTextDomConfig) {
  if (typeof config.padding === "number") {
    const value = Math.max(0, config.padding);
    return { x: value, y: value };
  }
  return {
    x: Math.max(0, config.padding?.x ?? 0),
    y: Math.max(0, config.padding?.y ?? 0),
  };
}

function measuredTextAlign(style: CSSStyleDeclaration): "center" | "left" {
  if (style.textAlign === "left") return "left";
  if (style.textAlign === "start" && style.direction !== "rtl") return "left";
  return "center";
}

function measureFirstLineBaseline(element: HTMLElement, targetRect: DOMRect) {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;";
  element.insertBefore(probe, element.firstChild);
  const baselineOffset = probe.getBoundingClientRect().bottom - targetRect.top;
  probe.remove();
  return Number.isFinite(baselineOffset) && baselineOffset > 0
    ? baselineOffset
    : 0;
}

export function resolveGlassTextDomTarget(
  target: HeroWaveDomTarget | null | undefined,
): HTMLElement | null {
  if (typeof document === "undefined" || !target) return null;
  if (typeof target === "string") {
    try {
      const candidate = document.querySelector(target);
      return candidate instanceof HTMLElement ? candidate : null;
    } catch {
      return null;
    }
  }
  if (target instanceof HTMLElement) return target;
  return target.current instanceof HTMLElement ? target.current : null;
}

export function measureGlassTextDomTarget(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  config: HeroWaveGlassTextDomConfig,
): GlassTextDomSnapshot | null {
  const canvasRect = canvas.getBoundingClientRect();
  const targetRect = element.getBoundingClientRect();
  if (
    canvasRect.width <= 0 ||
    canvasRect.height <= 0 ||
    targetRect.width <= 0 ||
    targetRect.height <= 0
  ) {
    return null;
  }

  const style = window.getComputedStyle(element);
  const fontSize = finiteCssNumber(style.fontSize, 16);
  const lineHeightPx = finiteCssNumber(style.lineHeight, fontSize * 1.2);
  const padding = targetPadding(config);
  const renderedText = renderedDomText(element, lineHeightPx);
  const baselineOffset = measureFirstLineBaseline(element, targetRect);

  return {
    text: transformText(renderedText.trim(), style.textTransform),
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize,
    lineHeight: lineHeightPx / Math.max(fontSize, 0.0001),
    letterSpacing: finiteCssNumber(style.letterSpacing, 0),
    textAlign: measuredTextAlign(style),
    baselineOffset,
    centerX:
      (targetRect.left + targetRect.width * 0.5 - canvasRect.left) /
      canvasRect.width,
    centerY:
      (targetRect.top + targetRect.height * 0.5 - canvasRect.top) /
      canvasRect.height,
    maxWidth: (targetRect.width + padding.x * 2) / canvasRect.width,
    maxHeight: (targetRect.height + padding.y * 2) / canvasRect.height,
  };
}

export function sameGlassTextDomSnapshot(
  left: GlassTextDomSnapshot | null,
  right: GlassTextDomSnapshot | null,
) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (
    left.text !== right.text ||
    left.fontFamily !== right.fontFamily ||
    left.fontWeight !== right.fontWeight ||
    left.textAlign !== right.textAlign
  ) {
    return false;
  }
  const numericKeys = [
    "fontSize",
    "lineHeight",
    "letterSpacing",
    "baselineOffset",
    "centerX",
    "centerY",
    "maxWidth",
    "maxHeight",
  ] as const;
  return numericKeys.every((key) => Math.abs(left[key] - right[key]) <= 0.0001);
}

export function applyGlassTextDomSnapshot(
  config: HeroWaveGlassTextConfig,
  snapshot: GlassTextDomSnapshot | null,
): HeroWaveGlassTextConfig {
  if (!config.dom || config.shape === "svg") return config;
  if (!snapshot) return { ...config, enabled: false };

  const syncedContent = config.dom.syncContent !== false;
  const syncedTypography = config.dom.syncTypography !== false;
  return {
    ...config,
    shape: "text",
    text: syncedContent ? snapshot.text : config.text,
    wrap: syncedContent ? "explicit" : config.wrap,
    ...(syncedTypography
      ? {
          fontFamily: snapshot.fontFamily,
          fontWeight: snapshot.fontWeight,
          fontSize: snapshot.fontSize,
          lineHeight: snapshot.lineHeight,
          letterSpacing: snapshot.letterSpacing,
          textAlign: snapshot.textAlign,
          baselineOffset: snapshot.baselineOffset,
        }
      : {}),
    center: { x: snapshot.centerX, y: snapshot.centerY },
    maxWidth: snapshot.maxWidth,
    maxHeight: snapshot.maxHeight,
  };
}
