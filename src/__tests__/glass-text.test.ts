import { describe, expect, test } from "bun:test";
import {
  applyGlassTextDomSnapshot,
  groupGlassTextCharacters,
  type GlassTextDomSnapshot,
} from "../dom/glass-text-target";
import { resolveSettings } from "../config/settings";
import { GLASS_COMPOSITE_FRAGMENT_SHADER } from "../rendering/shaders";
import type { HeroWaveGlassTextConfig } from "../types";

const snapshot: GlassTextDomSnapshot = {
  text: "Live DOM\ntitle",
  fontFamily: "Geist",
  fontWeight: "650",
  fontSize: 72,
  lineHeight: 1.05,
  letterSpacing: -1.5,
  textAlign: "left",
  baselineOffset: 58,
  centerX: 0.42,
  centerY: 0.31,
  maxWidth: 0.64,
  maxHeight: 0.18,
};

const trackedConfig: HeroWaveGlassTextConfig = {
  enabled: true,
  text: "Fallback",
  fontSize: 48,
  dom: { target: { current: null } },
};

describe("glass text configuration", () => {
  test("resolves the glass-only blur fade independently of the canvas fade", () => {
    const settings = resolveSettings({
      fadeInDuration: 1500,
      glassText: {
        enabled: true,
        text: "Glass",
        intro: {
          delay: 125,
          duration: 640,
          blur: 14,
          offsetY: -18,
          easing: [0.21, 0.47, 0.32, 0.98],
        },
      },
    });

    expect(settings.fadeInDuration).toBe(1500);
    expect(settings.glassText).toMatchObject({
      introDelay: 125,
      introDuration: 640,
      introBlur: 14,
      introOffsetY: -18,
      introEasing: [0.21, 0.47, 0.32, 0.98],
    });
  });

  test("keeps glass outside the scene fade unless explicitly requested", () => {
    const independent = resolveSettings({
      fadeInDuration: 900,
      fadeInEasing: [0.1, 0.2, 0.8, 0.9],
      glassText: { enabled: true, text: "Glass" },
    });
    const linked = resolveSettings({
      fadeInAffectsGlassText: true,
      glassText: { enabled: true, text: "Glass" },
    });

    expect(independent.fadeInAffectsGlassText).toBe(false);
    expect(independent.fadeInEasingPoints).toEqual([0.1, 0.2, 0.8, 0.9]);
    expect(linked.fadeInAffectsGlassText).toBe(true);
    expect(GLASS_COMPOSITE_FRAGMENT_SHADER).toContain("scene * uSceneOpacity");
  });

  test("maps DOM content, typography, and bounds into the text mask", () => {
    expect(applyGlassTextDomSnapshot(trackedConfig, snapshot)).toMatchObject({
      enabled: true,
      shape: "text",
      text: "Live DOM\ntitle",
      wrap: "explicit",
      fontFamily: "Geist",
      fontWeight: "650",
      fontSize: 72,
      lineHeight: 1.05,
      letterSpacing: -1.5,
      textAlign: "left",
      baselineOffset: 58,
      center: { x: 0.42, y: 0.31 },
      maxWidth: 0.64,
      maxHeight: 0.18,
    });
  });

  test("preserves browser-created visual line breaks", () => {
    const samples = [
      ...Array.from("Balanced heading ", (value) => ({
        value,
        centerY: 20,
        forcedBreak: false,
      })),
      ...Array.from("second line", (value) => ({
        value,
        centerY: 56,
        forcedBreak: false,
      })),
    ];

    expect(groupGlassTextCharacters(samples, 36)).toEqual([
      "Balanced heading",
      "second line",
    ]);
  });

  test("can retain manual content and typography while tracking DOM bounds", () => {
    const resolved = applyGlassTextDomSnapshot(
      {
        ...trackedConfig,
        dom: {
          target: { current: null },
          syncContent: false,
          syncTypography: false,
        },
      },
      snapshot,
    );

    expect(resolved.text).toBe("Fallback");
    expect(resolved.fontSize).toBe(48);
    expect(resolved.textAlign).toBeUndefined();
    expect(resolved.baselineOffset).toBeUndefined();
    expect(resolved.center).toEqual({ x: 0.42, y: 0.31 });
  });

  test("resolves explicit text alignment and baseline controls", () => {
    const settings = resolveSettings({
      glassText: {
        enabled: true,
        text: "Aligned glass",
        textAlign: "left",
        baselineOffset: 84,
      },
    });

    expect(settings.glassText.textAlign).toBe("left");
    expect(settings.glassText.baselineOffset).toBe(84);
  });

  test("keeps tracked glass disabled until the DOM target has valid bounds", () => {
    expect(applyGlassTextDomSnapshot(trackedConfig, null).enabled).toBe(false);
  });

  test("ignores DOM tracking for SVG glass masks", () => {
    const svgConfig: HeroWaveGlassTextConfig = {
      enabled: true,
      shape: "svg",
      svgPath: "M 0 0 H 100 V 100 H 0 Z",
      dom: { target: "#unused-dom-target" },
    };

    expect(applyGlassTextDomSnapshot(svgConfig, null)).toBe(svgConfig);
  });
});
