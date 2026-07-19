import { describe, expect, test } from "bun:test";
import {
  createResponsiveHeroOrbitPoints,
  HERO_ORBIT_SCALE,
  HERO_ORBIT_STRENGTH,
  HERO_ORBIT_WAVE_Y,
  type HeroOrbitLayout,
} from "../presets/hero-orbit";
import { getHeroTrajectoryVerticalScale } from "../trajectory";

function orbitBounds(layout: HeroOrbitLayout) {
  const points = createResponsiveHeroOrbitPoints(layout).slice(4, 13);
  const verticalScale = getHeroTrajectoryVerticalScale(
    HERO_ORBIT_SCALE,
    HERO_ORBIT_STRENGTH,
  );
  const bandHeight = 1 - HERO_ORBIT_WAVE_Y;
  const screenPoints = points.map((point) => ({
    x: point.x * layout.width,
    y: (1 - (point.y * verticalScale + bandHeight)) * layout.height,
  }));
  const xs = screenPoints.map((point) => point.x);
  const ys = screenPoints.map((point) => point.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

describe("responsive hero orbit", () => {
  test("keeps the designed orbit ratio across opposite viewport aspects", () => {
    const wide = orbitBounds({
      width: 1680,
      height: 760,
      contentLeft: 440,
      contentTop: 240,
      contentWidth: 800,
      contentHeight: 150,
    });
    const tall = orbitBounds({
      width: 760,
      height: 1200,
      contentLeft: 80,
      contentTop: 430,
      contentWidth: 600,
      contentHeight: 150,
    });

    expect(wide.width / wide.height).toBeCloseTo(1.7, 6);
    expect(tall.width / tall.height).toBeCloseTo(1.7, 6);
  });
});
