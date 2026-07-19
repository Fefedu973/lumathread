import { describe, expect, test } from "bun:test";
import {
  DEMO_PALETTE,
  profilesPreset,
  svgPreset,
  terrainPreset,
} from "../components/demo/presets";

describe("homepage demo presets", () => {
  test("uses a seamless cyclic palette for longitudinal profiles", () => {
    const stops = DEMO_PALETTE.stops ?? [];
    expect(stops.length).toBeGreaterThan(3);
    expect([stops[0]?.color, stops.at(-1)?.color]).toEqual([
      "#315bff",
      "#315bff",
    ]);
    expect(profilesPreset("dark").palette).toBe(DEMO_PALETTE);
  });

  test("keeps the terrain close, fitted, and monochrome", () => {
    const terrain = terrainPreset("dark");
    expect(terrain.dots?.terrain).toMatchObject({
      amplitude: 0.45,
      cameraDistance: 2.1,
      fit: "cover",
      colorLow: "#ffffff",
      colorHigh: "#ffffff",
    });
    expect(
      terrain.palette?.stops?.every((stop) => stop.color === "#ffffff"),
    ).toBe(true);
  });

  test("shows the four PlayStation-style SVG paths", () => {
    const filaments = svgPreset("dark").filaments ?? [];
    expect(filaments).toHaveLength(4);
    expect(
      filaments.every(
        (filament) =>
          filament.path?.mode === "svg" &&
          filament.path.closed === true &&
          filament.path.closedLoopTaper === false,
      ),
    ).toBe(true);
  });
});
