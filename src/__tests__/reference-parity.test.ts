import { describe, expect, test } from "bun:test";
import {
  HERO_WAVE_DEFAULT_CONFIG,
  createHeroOrganicTrajectory,
  HERO_DEFAULT_TRAJECTORY,
} from "../hero-wave-background";
import {
  HERO_WAVE_DEFAULT_CONFIG as REFERENCE_DEFAULT_CONFIG,
  createHeroOrganicTrajectory as createReferenceOrganicTrajectory,
  HERO_DEFAULT_TRAJECTORY as REFERENCE_DEFAULT_TRAJECTORY,
} from "../benchmark/reference/hero-wave-background";
import * as currentShaders from "../rendering/shaders";
import * as referenceShaders from "../benchmark/reference/rendering/shaders";

describe("frozen renderer parity", () => {
  test("keeps every public default unchanged", () => {
    expect(HERO_WAVE_DEFAULT_CONFIG).toEqual(REFERENCE_DEFAULT_CONFIG);
  });

  test("keeps the canonical path unchanged", () => {
    expect(HERO_DEFAULT_TRAJECTORY).toEqual(REFERENCE_DEFAULT_TRAJECTORY);
  });

  test("keeps deterministic organic paths unchanged across representative seeds", () => {
    for (const seed of [-1003, -1, 0, 1, 731, 982_451]) {
      for (const count of [4, 8, 12, 31]) {
        expect(createHeroOrganicTrajectory(seed, count)).toEqual(
          createReferenceOrganicTrajectory(seed, count),
        );
      }
    }
  });

  test("keeps all shader programs byte-for-byte equivalent", () => {
    expect(Object.keys(currentShaders).sort()).toEqual(
      Object.keys(referenceShaders).sort(),
    );
    for (const name of Object.keys(currentShaders)) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: parity must cover every exported shader without a hand-maintained list.
      expect(currentShaders[name as keyof typeof currentShaders]).toBe(
        // biome-ignore lint/performance/noDynamicNamespaceImportAccess: use the same exhaustive export key on the frozen reference.
        referenceShaders[name as keyof typeof referenceShaders],
      );
    }
  });

  test("does not emit unresolved shader interpolations", () => {
    for (const shader of Object.values(currentShaders)) {
      expect(shader).not.toContain("undefined");
      expect(shader).not.toContain("NaN");
      expect(shader.length).toBeGreaterThan(50);
    }
  });
});
