import { describe, expect, test } from "bun:test";
import { HERO_WAVE_DEFAULT_CONFIG } from "../config/defaults";
import {
  buildLongitudinalProfileTextureData,
  resolveSettings,
} from "../config/settings";
import { buildAdaptivePathSamples } from "../geometry/path-sampling";
import {
  buildDotMaskTextureData,
  getGlowProfileTextureData,
  getPathK0TextureData,
} from "../rendering/profile-textures";
import { createHeroOrganicTrajectory } from "../trajectory";

function digestBytes(values: Uint8Array) {
  let hash = 2_166_136_261;
  for (const value of values) {
    hash ^= value;
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash >>> 0;
}

function digestFloats(values: readonly number[]) {
  const rounded = new Int32Array(values.length);
  for (let index = 0; index < values.length; index++) {
    rounded[index] = Math.round((values[index] ?? 0) * 1_000_000);
  }
  return digestBytes(new Uint8Array(rounded.buffer));
}

describe("extracted renderer fixtures", () => {
  test("keeps precomputed material textures byte-identical", () => {
    const settings = resolveSettings({
      ...HERO_WAVE_DEFAULT_CONFIG,
      quality: "high",
    });
    const glow = getGlowProfileTextureData();
    const k0 = getPathK0TextureData();
    const profiles = buildLongitudinalProfileTextureData(settings.profiles);
    const mask = buildDotMaskTextureData(
      settings.dotMasks,
      settings.maskFeather,
      16 / 9,
    );

    expect([glow.profile0.length, digestBytes(glow.profile0)]).toEqual([
      4096, 1027615245,
    ]);
    expect([glow.profile1.length, digestBytes(glow.profile1)]).toEqual([
      4096, 2727676180,
    ]);
    expect([k0.length, digestBytes(new Uint8Array(k0.buffer))]).toEqual([
      4096, 3324346507,
    ]);
    expect([profiles.length, digestBytes(profiles)]).toEqual([
      2048, 2070822341,
    ]);
    expect([
      mask.width,
      mask.height,
      mask.data.length,
      digestBytes(mask.data),
    ]).toEqual([341, 192, 65472, 2561599093]);
  });

  test("keeps deterministic organic geometry numerically equivalent", () => {
    const settings = resolveSettings({
      ...HERO_WAVE_DEFAULT_CONFIG,
      quality: "high",
    });
    const trajectory = createHeroOrganicTrajectory(
      settings.trajectorySeed,
      settings.organic.pointCount,
      settings.organic,
    );
    const samples = buildAdaptivePathSamples(
      trajectory,
      settings.trajectoryClosed,
      1440,
      900,
      settings,
    );

    expect(trajectory).toHaveLength(12);
    expect(
      digestFloats(trajectory.flatMap(({ x, y, speed }) => [x, y, speed])),
    ).toBe(2655558783);
    expect(samples).toHaveLength(973);
    expect(
      digestFloats(
        samples.flatMap(({ x, y, speed, progress, arcProgress }) => [
          x,
          y,
          speed,
          progress,
          arcProgress,
        ]),
      ),
    ).toBe(3709622128);
  });
});
