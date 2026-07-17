import { describe, expect, test } from "bun:test";
import {
  createHeroOrganicTrajectory,
  getHeroTrajectoryVerticalScale,
  HERO_DEFAULT_TRAJECTORY,
} from "../trajectory";
import { MIN_HERO_TRAJECTORY_POINTS } from "../types";

describe("trajectory helpers", () => {
  test("keeps the historical vertical scale equation", () => {
    expect(getHeroTrajectoryVerticalScale(0.62, 1)).toBeCloseTo(0.2356, 12);
    expect(getHeroTrajectoryVerticalScale(0, 0)).toBe(0.02);
  });

  test("preserves the canonical default trajectory", () => {
    expect(HERO_DEFAULT_TRAJECTORY).toHaveLength(8);
    expect(HERO_DEFAULT_TRAJECTORY[0]).toEqual({
      id: "trajectory-0",
      x: 0.04,
      y: 0.52,
      speed: 1,
    });
    expect(HERO_DEFAULT_TRAJECTORY.at(-1)?.x).toBe(0.96);
  });

  test("organic paths are deterministic for a seed", () => {
    expect(createHeroOrganicTrajectory(731, 18)).toEqual(
      createHeroOrganicTrajectory(731, 18),
    );
    expect(createHeroOrganicTrajectory(731, 18)).not.toEqual(
      createHeroOrganicTrajectory(732, 18),
    );
  });

  test("the explicit option seed overrides the positional seed", () => {
    expect(createHeroOrganicTrajectory(1, 12, { seed: 99 })).toEqual(
      createHeroOrganicTrajectory(2, 12, { seed: 99 }),
    );
  });

  test("enforces the minimum control-point count", () => {
    expect(createHeroOrganicTrajectory(1, 1)).toHaveLength(
      MIN_HERO_TRAJECTORY_POINTS,
    );
  });

  test("allows an explicit point-count override", () => {
    expect(createHeroOrganicTrajectory(1, 8, { pointCount: 23 })).toHaveLength(
      23,
    );
  });

  test("keeps generated values inside renderer safety bounds", () => {
    const points = createHeroOrganicTrajectory(9281, 256, {
      amplitude: 100,
      horizontalJitter: 100,
      speedVariation: 100,
    });
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(-0.25);
      expect(point.x).toBeLessThanOrEqual(1.25);
      expect(point.y).toBeGreaterThanOrEqual(-4);
      expect(point.y).toBeLessThanOrEqual(4);
      expect(point.speed).toBeGreaterThanOrEqual(0.05);
      expect(point.speed).toBeLessThanOrEqual(16);
    }
  });

  test("falls back cleanly from non-finite organic options", () => {
    const points = createHeroOrganicTrajectory(Number.NaN, 12, {
      amplitude: Number.NaN,
      turns: Number.POSITIVE_INFINITY,
      roughness: Number.NaN,
    });
    expect(points).toHaveLength(12);
    expect(points.every((point) => Number.isFinite(point.x + point.y))).toBe(
      true,
    );
  });
});
