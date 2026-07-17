import { describe, expect, test } from "bun:test";
import {
  average,
  FixedRing,
  percentileSorted,
  performanceTrendPercentPerMinute,
} from "../demo/benchmark-metrics";

describe("benchmark metric helpers", () => {
  test("keeps a fixed chronological window without growing over time", () => {
    const values = new FixedRing<number>(3);
    for (const value of [1, 2, 3, 4, 5]) values.push(value);
    expect(values.size).toBe(3);
    expect(values.toArray()).toEqual([3, 4, 5]);

    values.clear();
    expect(values.size).toBe(0);
    expect(values.toArray()).toEqual([]);
  });

  test("computes bounded summary statistics", () => {
    expect(percentileSorted([1, 2, 3, 4], 0.5)).toBe(3);
    expect(percentileSorted([1, 2, 3, 4], 0.95)).toBe(4);
    expect(average([])).toBeNull();
    expect(average([2, 4, 6])).toBe(4);
  });

  test("reports normalized long-run FPS drift", () => {
    const stable = Array.from({ length: 60 }, (_, elapsed) => ({
      elapsed,
      fps: 60,
    }));
    expect(performanceTrendPercentPerMinute(stable)).toBeCloseTo(0, 8);

    const declining = Array.from({ length: 60 }, (_, elapsed) => ({
      elapsed,
      fps: 60 - elapsed * 0.1,
    }));
    expect(performanceTrendPercentPerMinute(declining)).toBeCloseTo(-10.52, 1);
  });
});
