import { describe, expect, test } from "bun:test";
import {
  evaluateFadeEasing,
  resolveFadeEasingPoints,
  resolveFadeInEasing,
} from "../animation/easing";
import { buildHeroPaletteTextureData, hexToVec3 } from "../rendering/color";
import { HERO_PALETTE_TEXTURE_WIDTH } from "../rendering/constants";
import type { HeroWaveColorStop } from "../types";

const BLACK_TO_RED: readonly HeroWaveColorStop[] = [
  { id: "black", color: "#000000", offset: 0 },
  { id: "red", color: "#ff0000", offset: 1 },
];

function pixel(data: Uint8Array, index: number) {
  return Array.from(data.slice(index * 4, index * 4 + 4));
}

describe("palette texture helpers", () => {
  test("parses long and shorthand hexadecimal colors", () => {
    expect(hexToVec3("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(hexToVec3("#0f8")).toEqual([0, 1, 136 / 255]);
  });

  test("falls back to white for invalid colors", () => {
    expect(hexToVec3("not-a-color")).toEqual([1, 1, 1]);
  });

  test("keeps the historical clamp and cyclic texture halves", () => {
    const data = buildHeroPaletteTextureData(BLACK_TO_RED);
    const half = HERO_PALETTE_TEXTURE_WIDTH / 2;
    expect(data).toHaveLength(HERO_PALETTE_TEXTURE_WIDTH * 4);
    expect(pixel(data, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(data, half - 1)).toEqual([255, 0, 0, 255]);
    expect(pixel(data, half)).toEqual([0, 0, 0, 255]);
  });

  test("reverses the clamped palette without changing its endpoints", () => {
    const data = buildHeroPaletteTextureData(BLACK_TO_RED, "srgb", true);
    const half = HERO_PALETTE_TEXTURE_WIDTH / 2;
    expect(pixel(data, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(data, half - 1)).toEqual([0, 0, 0, 255]);
  });

  test("uses the explicit fallback when the configured palette is empty", () => {
    const data = buildHeroPaletteTextureData([], "oklab", false, BLACK_TO_RED);
    const half = HERO_PALETTE_TEXTURE_WIDTH / 2;
    expect(pixel(data, 0)).toEqual([0, 0, 0, 255]);
    expect(pixel(data, half - 1)).toEqual([255, 0, 0, 255]);
  });
});

describe("fade easing helpers", () => {
  test("preserves named CSS easing and serializes custom points", () => {
    expect(resolveFadeInEasing("ease-out", "linear")).toBe("ease-out");
    expect(resolveFadeInEasing([0.2, 0.3, 0.8, 0.9], "linear")).toBe(
      "cubic-bezier(0.2, 0.3, 0.8, 0.9)",
    );
  });

  test("resolves named presets and clamps malformed custom coordinates", () => {
    expect(resolveFadeEasingPoints("linear", [0, 0, 1, 1])).toEqual([
      0, 0, 1, 1,
    ]);
    expect(resolveFadeEasingPoints([-2, -8, 3, 9], [0, 0, 1, 1])).toEqual([
      0, -4, 1, 4,
    ]);
  });

  test("evaluates linear easing without changing progress", () => {
    for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
      expect(evaluateFadeEasing(progress, [0, 0, 1, 1])).toBeCloseTo(
        progress,
        3,
      );
    }
  });
});
