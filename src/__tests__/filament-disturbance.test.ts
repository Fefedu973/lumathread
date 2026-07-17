import { describe, expect, test } from "bun:test";
import {
  applyFilamentDisturbances,
  findClosestFilamentLocation,
  pruneFilamentDisturbanceImpulses,
  type FilamentDisturbanceImpulse,
  type FilamentPathSample,
  type ResolvedFilamentPointerConfig,
} from "../interaction/filament-disturbance";

const CONFIG: ResolvedFilamentPointerConfig = {
  enabled: true,
  target: "canvas",
  pointerTypes: ["mouse"],
  radius: 80,
  strength: 0.1,
  propagationSpeed: 0.5,
  frequency: 1,
  damping: 1,
  spatialDecay: 0,
  duration: 3,
  cooldown: 0.05,
  maxImpulses: 8,
  direction: "push",
};

function horizontalSamples(): FilamentPathSample[] {
  return [0, 0.25, 0.5, 0.75, 1].map((progress) => ({
    x: progress,
    y: 0.5,
    speed: 1,
    progress,
    arcProgress: progress,
  }));
}

describe("filament pointer disturbance", () => {
  test("finds the closest path progress in CSS-pixel space", () => {
    const closest = findClosestFilamentLocation(
      horizontalSamples(),
      false,
      0.375,
      0.6,
      1000,
      500,
    );
    expect(closest?.distanceCssPx).toBeCloseTo(50, 8);
    expect(closest?.progress).toBeCloseTo(0.375, 8);
    expect(closest?.normalSign).toBe(1);
  });

  test("reports the opposite normal side below a path", () => {
    const closest = findClosestFilamentLocation(
      horizontalSamples(),
      false,
      0.5,
      0.4,
      1000,
      500,
    );
    expect(closest?.normalSign).toBe(-1);
  });

  test("returns null when a path cannot form a segment", () => {
    expect(
      findClosestFilamentLocation(
        horizontalSamples().slice(0, 1),
        false,
        0,
        0,
        1,
        1,
      ),
    ).toBeNull();
  });

  test("copies the source exactly without active impulses", () => {
    const source = horizontalSamples();
    const target: FilamentPathSample[] = [];
    applyFilamentDisturbances(source, false, 1000, 500, 1, CONFIG, [], target);
    expect(target).toEqual(source);
    expect(target).not.toBe(source);
  });

  test("waits for the wave front before moving a distant sample", () => {
    const source = horizontalSamples();
    const impulse: FilamentDisturbanceImpulse = {
      progress: 0,
      startedAt: 0,
      strength: 0.1,
      normalSign: 1,
    };
    const before: FilamentPathSample[] = [];
    const after: FilamentPathSample[] = [];
    applyFilamentDisturbances(
      source,
      false,
      1000,
      500,
      0.99,
      CONFIG,
      [impulse],
      before,
    );
    applyFilamentDisturbances(
      source,
      false,
      1000,
      500,
      1,
      CONFIG,
      [impulse],
      after,
    );
    expect(before[2]?.y).toBe(0.5);
    expect(after[2]?.y).toBeGreaterThan(0.5);
  });

  test("uses the shorter seam distance for a closed path", () => {
    const source = horizontalSamples();
    const impulse: FilamentDisturbanceImpulse = {
      progress: 0.95,
      startedAt: 0,
      strength: 0.1,
      normalSign: 1,
    };
    const open: FilamentPathSample[] = [];
    const closed: FilamentPathSample[] = [];
    applyFilamentDisturbances(
      source,
      false,
      1000,
      500,
      0.2,
      CONFIG,
      [impulse],
      open,
    );
    applyFilamentDisturbances(
      source,
      true,
      1000,
      500,
      0.2,
      CONFIG,
      [impulse],
      closed,
    );
    expect(open[0]?.y).toBe(0.5);
    expect(closed[0]?.y).not.toBe(0.5);
  });

  test("supports closed paths whose endpoint is not duplicated", () => {
    const source = horizontalSamples().slice(0, -1);
    const impulse: FilamentDisturbanceImpulse = {
      progress: 0.95,
      startedAt: 0,
      strength: 0.1,
      normalSign: 1,
    };
    const closed: FilamentPathSample[] = [];
    applyFilamentDisturbances(
      source,
      true,
      1000,
      500,
      0.2,
      CONFIG,
      [impulse],
      closed,
    );
    expect(closed).toHaveLength(source.length);
    expect(closed[0]?.y).not.toBe(0.5);
    expect(closed.every((sample) => Number.isFinite(sample.x + sample.y))).toBe(
      true,
    );
  });

  test("does not add a redundant segment for duplicate closing points", () => {
    const source = [
      { x: 0.2, y: 0.2, speed: 1, progress: 0, arcProgress: 0 },
      { x: 0.8, y: 0.2, speed: 1, progress: 0.33, arcProgress: 0.33 },
      { x: 0.5, y: 0.8, speed: 1, progress: 0.66, arcProgress: 0.66 },
      { x: 0.2, y: 0.2, speed: 1, progress: 1, arcProgress: 1 },
    ];
    const closest = findClosestFilamentLocation(
      source,
      true,
      0.2,
      0.2,
      1000,
      500,
    );
    expect(closest?.distanceCssPx).toBeCloseTo(0, 8);
    expect(closest?.progress).toBeCloseTo(0, 8);
  });

  test("damping reduces the same point over time", () => {
    const source = horizontalSamples();
    const impulse: FilamentDisturbanceImpulse = {
      progress: 0.5,
      startedAt: 0,
      strength: 0.1,
      normalSign: 1,
    };
    const early: FilamentPathSample[] = [];
    const late: FilamentPathSample[] = [];
    const nonOscillating = { ...CONFIG, frequency: 0.0001 };
    applyFilamentDisturbances(
      source,
      false,
      1000,
      500,
      0,
      nonOscillating,
      [impulse],
      early,
    );
    applyFilamentDisturbances(
      source,
      false,
      1000,
      500,
      1,
      nonOscillating,
      [impulse],
      late,
    );
    expect(Math.abs((late[2]?.y ?? 0) - 0.5)).toBeLessThan(
      Math.abs((early[2]?.y ?? 0) - 0.5),
    );
  });

  test("prunes only expired impulses while preserving order", () => {
    const impulses: FilamentDisturbanceImpulse[] = [
      { progress: 0.1, startedAt: 0, strength: 1, normalSign: 1 },
      { progress: 0.2, startedAt: 2, strength: 1, normalSign: -1 },
      { progress: 0.3, startedAt: 3, strength: 1, normalSign: 1 },
    ];
    pruneFilamentDisturbanceImpulses(impulses, 4, 2.5);
    expect(impulses.map((impulse) => impulse.progress)).toEqual([0.2, 0.3]);
  });
});
