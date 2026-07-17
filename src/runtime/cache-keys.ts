import { clamp, finite } from "../math";
import {
  MAX_HERO_DOT_MASKS,
  type HeroDotMask,
  type HeroTrajectoryPoint,
  type HeroWaveColorStop,
  type HeroWaveLongitudinalProfiles,
  type HeroWavePaletteInterpolation,
} from "../types";

export function hashMix(hash: number, value: number) {
  return Math.imul(hash ^ (value | 0), 16_777_619) >>> 0;
}

export function hashFloat(hash: number, value: number, precision = 100_000) {
  return hashMix(hash, Math.round(finite(value, 0) * precision));
}

export function hashString(hash: number, value: string) {
  let result = hash;
  for (let index = 0; index < value.length; index++) {
    result = hashMix(result, value.charCodeAt(index));
  }
  return result;
}

export function hashColors(
  colors: readonly HeroWaveColorStop[],
  interpolation: HeroWavePaletteInterpolation = "srgb",
  reverse = false,
) {
  let hash = hashMix(2_166_136_261, colors.length);
  hash = hashString(hash, interpolation);
  hash = hashMix(hash, reverse ? 1 : 0);
  for (const stop of colors) {
    hash = hashString(hash, stop.color.trim().toLowerCase());
    hash = hashFloat(hash, finite(stop.offset, -1));
    hash = hashString(hash, stop.easing ?? "linear");
  }
  return hash;
}

export function hashMasks(masks: readonly HeroDotMask[], feather: number) {
  let hash = hashFloat(2_166_136_261, feather, 10_000);
  const count = Math.min(masks.length, MAX_HERO_DOT_MASKS);
  hash = hashMix(hash, count);
  for (let index = 0; index < count; index++) {
    const mask = masks[index];
    if (!mask) continue;
    hash = hashFloat(hash, mask.x);
    hash = hashFloat(hash, mask.y);
    hash = hashFloat(hash, mask.radius);
    hash = hashFloat(hash, clamp(finite(mask.feather, feather), 0.001, 1));
  }
  return hash;
}

export function hashTrajectory(points: readonly HeroTrajectoryPoint[]) {
  let hash = hashMix(2_166_136_261, points.length);
  for (const point of points) {
    hash = hashFloat(hash, point.x);
    hash = hashFloat(hash, point.y);
    hash = hashFloat(hash, point.speed, 10_000);
    hash = hashFloat(hash, finite(point.inX, -99));
    hash = hashFloat(hash, finite(point.inY, -99));
    hash = hashFloat(hash, finite(point.outX, -99));
    hash = hashFloat(hash, finite(point.outY, -99));
  }
  return hash;
}

export function hashUnknown(value: unknown, seed = 2_166_136_261): number {
  if (value === null || value === undefined) return hashMix(seed, 0);
  if (typeof value === "number") return hashFloat(seed, value);
  if (typeof value === "boolean") return hashMix(seed, value ? 1 : 2);
  if (typeof value === "string") return hashString(seed, value);
  if (typeof value === "function") return hashString(seed, "function");
  if (Array.isArray(value)) {
    let hash = hashMix(seed, value.length);
    for (const entry of value) hash = hashUnknown(entry, hash);
    return hash;
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as unknown as ArrayLike<number>;
    let hash = hashMix(seed, view.length);
    for (let index = 0; index < view.length; index++) {
      hash = hashFloat(hash, view[index] ?? 0);
    }
    return hash;
  }
  if (typeof value === "object") {
    let hash = seed;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      if (key === "callback") continue;
      hash = hashString(hash, key);
      hash = hashUnknown(record[key], hash);
    }
    return hash;
  }
  return hashString(seed, typeof value);
}

export function hashProfiles(profiles: Required<HeroWaveLongitudinalProfiles>) {
  return hashUnknown(profiles);
}
