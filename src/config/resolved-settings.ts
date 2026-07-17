import type {
  HeroWaveCurveProfile,
  HeroWaveLongitudinalProfiles,
  HeroWaveMaterialInput,
  HeroWaveMaterialPreset,
  HeroWaveProfileInterpolation,
  HeroWaveProfileWrap,
  HeroWaveQualityConfig,
  HeroWaveQualityPreset,
  HeroWaveScalarProfile,
  HeroWaveSvgViewBox,
  HeroWaveSvgViewBoxObject,
} from "../types";
import { clamp, finite, finiteClamped } from "../math";

import {
  HERO_PROFILE_TEXTURE_WIDTH,
  HERO_PROFILE_TEXTURE_HEIGHT,
  HERO_MAX_PATH_SAMPLES,
  HERO_PATH_MAX_SUBDIVISION_DEPTH,
  HERO_MAX_DPR,
  catmullRomValue,
  INTERNAL_DEFAULTS,
} from "./defaults";

import type {
  ResolvedQuality,
  ResolvedMaterial,
  ResolvedProfileBounds,
} from "./models";

export * from "./models";

export const MATERIAL_PRESETS: Record<
  HeroWaveMaterialPreset,
  ResolvedMaterial
> = {
  "soft-aurora": {
    preset: "soft-aurora",
    atmosphere: 0.06,
    broad: 0.24,
    body: 0.3,
    ridge: 0.46,
    core: 0.28,
    veil: 0.04,
    exposure: 1,
    saturation: 1,
  },
  mist: {
    preset: "mist",
    atmosphere: 0.11,
    broad: 0.32,
    body: 0.34,
    ridge: 0.27,
    core: 0.12,
    veil: 0.09,
    exposure: 0.9,
    saturation: 0.78,
  },
  neon: {
    preset: "neon",
    atmosphere: 0.015,
    broad: 0.08,
    body: 0.17,
    ridge: 0.68,
    core: 0.72,
    veil: 0.025,
    exposure: 1.1,
    saturation: 1.25,
  },
  plasma: {
    preset: "plasma",
    atmosphere: 0.05,
    broad: 0.2,
    body: 0.36,
    ridge: 0.52,
    core: 0.38,
    veil: 0.08,
    exposure: 1.12,
    saturation: 1.35,
  },
};

export const QUALITY_PRESETS: Record<
  Exclude<HeroWaveQualityPreset, "auto">,
  ResolvedQuality
> = {
  ultra: {
    preset: "ultra",
    maxDpr: 2,
    maxFps: 0,
    flatnessPx: 0.05,
    maxChordPx: 1.5,
    maxSamples: HERO_MAX_PATH_SAMPLES,
    maxSubdivisionDepth: 20,
    farScale: 0.08,
    midScale: 0.34,
    coreScale: 1,
    farMaxDimension: 1536,
    midMaxDimension: 3072,
    coreMaxDimension: 6144,
    farMaxChordPx: 64,
    midMaxChordPx: 28,
    coreMaxChordPx: 6,
    farFlatnessPx: 2,
    midFlatnessPx: 0.45,
    coreFlatnessPx: 0.09,
    quadrature: 4,
  },
  high: {
    preset: "high",
    maxDpr: 1.5,
    maxFps: 60,
    flatnessPx: 0.08,
    maxChordPx: 2.5,
    maxSamples: HERO_MAX_PATH_SAMPLES,
    maxSubdivisionDepth: 18,
    farScale: 0.0625,
    midScale: 0.25,
    coreScale: 1,
    farMaxDimension: 1024,
    midMaxDimension: 2048,
    coreMaxDimension: 4096,
    farMaxChordPx: 96,
    midMaxChordPx: 48,
    coreMaxChordPx: 12,
    farFlatnessPx: 4,
    midFlatnessPx: 1,
    coreFlatnessPx: 0.2,
    quadrature: 4,
  },
  balanced: {
    preset: "balanced",
    maxDpr: 1.25,
    maxFps: 60,
    flatnessPx: 0.14,
    maxChordPx: 4,
    maxSamples: 24576,
    maxSubdivisionDepth: 17,
    farScale: 0.05,
    midScale: 0.2,
    coreScale: 0.8,
    farMaxDimension: 768,
    midMaxDimension: 1536,
    coreMaxDimension: 3072,
    farMaxChordPx: 120,
    midMaxChordPx: 64,
    coreMaxChordPx: 18,
    farFlatnessPx: 5,
    midFlatnessPx: 1.5,
    coreFlatnessPx: 0.32,
    quadrature: 2,
  },
  low: {
    preset: "low",
    maxDpr: 1,
    maxFps: 45,
    flatnessPx: 0.28,
    maxChordPx: 7,
    maxSamples: 16384,
    maxSubdivisionDepth: 15,
    farScale: 0.04,
    midScale: 0.125,
    coreScale: 0.55,
    farMaxDimension: 512,
    midMaxDimension: 1024,
    coreMaxDimension: 2048,
    farMaxChordPx: 160,
    midMaxChordPx: 90,
    coreMaxChordPx: 28,
    farFlatnessPx: 7,
    midFlatnessPx: 2.5,
    coreFlatnessPx: 0.6,
    quadrature: 2,
  },
};

export function wrapProfilePosition(value: number, wrap: HeroWaveProfileWrap) {
  if (wrap === "repeat") return ((value % 1) + 1) % 1;
  if (wrap === "mirror") {
    const wrapped = ((value % 2) + 2) % 2;
    return wrapped <= 1 ? wrapped : 2 - wrapped;
  }
  return clamp(value, 0, 1);
}
export function smoothProfileAmount(amount: number) {
  const clamped = clamp(amount, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
export function sampleProfileArray(
  values: readonly number[] | Float32Array,
  progress: number,
  interpolation: HeroWaveProfileInterpolation,
  wrap: HeroWaveProfileWrap,
) {
  if (values.length === 0) return 0;
  if (values.length === 1) return finite(values[0], 0);
  const normalized = wrapProfilePosition(progress, wrap);
  const sampleCount = values.length;
  const position =
    wrap === "repeat"
      ? normalized * sampleCount
      : normalized * (sampleCount - 1);
  const leftIndex = Math.floor(position);
  const amount = position - leftIndex;
  const resolveIndex = (index: number) => {
    if (wrap === "repeat")
      return ((index % sampleCount) + sampleCount) % sampleCount;
    if (wrap === "mirror") {
      const period = Math.max((sampleCount - 1) * 2, 1);
      const wrappedIndex = ((index % period) + period) % period;
      return wrappedIndex <= sampleCount - 1
        ? wrappedIndex
        : period - wrappedIndex;
    }
    return clamp(index, 0, sampleCount - 1);
  };
  const at = (index: number) => finite(values[resolveIndex(index)], 0);
  if (interpolation === "cubic") {
    return catmullRomValue(
      at(leftIndex - 1),
      at(leftIndex),
      at(leftIndex + 1),
      at(leftIndex + 2),
      amount,
    );
  }
  const eased =
    interpolation === "smooth" ? smoothProfileAmount(amount) : amount;
  const left = at(leftIndex);
  const right = at(leftIndex + 1);
  return left + (right - left) * eased;
}

export interface PreparedCurveKey {
  position: number;
  value: number;
  inTangent: number;
  outTangent: number;
}

export const preparedCurveProfiles = new WeakMap<
  HeroWaveCurveProfile,
  readonly PreparedCurveKey[]
>();

export function preparedCurveKeys(profile: HeroWaveCurveProfile) {
  const cached = preparedCurveProfiles.get(profile);
  if (cached) return cached;
  const keys = profile.keys
    .map((key) => ({
      position: clamp(finite(key.position, 0), 0, 1),
      value: finite(key.value, 0),
      inTangent: finite(key.inTangent, 0),
      outTangent: finite(key.outTangent, 0),
    }))
    .sort((a, b) => a.position - b.position);
  preparedCurveProfiles.set(profile, keys);
  return keys;
}

export function evaluateCurveProfile(
  profile: HeroWaveCurveProfile,
  progress: number,
) {
  const keys = preparedCurveKeys(profile);
  if (keys.length === 0) return 0;
  if (keys.length === 1) return keys[0]!.value;

  const wrap = profile.wrap ?? "clamp";
  const p = wrapProfilePosition(progress, wrap);
  let left = keys[0]!;
  let right = keys[1]!;
  let leftPosition = left.position;
  let rightPosition = right.position;
  let adjustedPosition = p;

  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const crossesRepeatSeam =
    wrap === "repeat" && (p < first.position || p > last.position);

  if (crossesRepeatSeam) {
    left = last;
    right = first;
    leftPosition = last.position;
    rightPosition = first.position + 1;
    if (adjustedPosition < first.position) adjustedPosition += 1;
  } else {
    let rightIndex = 1;
    while (rightIndex < keys.length && p > keys[rightIndex]!.position) {
      rightIndex += 1;
    }
    right = keys[Math.min(keys.length - 1, rightIndex)]!;
    left = keys[Math.max(0, rightIndex - 1)] ?? right;
    leftPosition = left.position;
    rightPosition = right.position;
  }

  const span = Math.max(rightPosition - leftPosition, 0.000001);
  const amount = clamp((adjustedPosition - leftPosition) / span, 0, 1);
  const interpolation = profile.interpolation ?? "cubic";
  if (interpolation === "linear") {
    return left.value + (right.value - left.value) * amount;
  }
  if (interpolation === "smooth") {
    return (
      left.value + (right.value - left.value) * smoothProfileAmount(amount)
    );
  }
  const a2 = amount * amount;
  const a3 = a2 * amount;
  const leftTangent = left.outTangent * span;
  const rightTangent = right.inTangent * span;
  return (
    (2 * a3 - 3 * a2 + 1) * left.value +
    (a3 - 2 * a2 + amount) * leftTangent +
    (-2 * a3 + 3 * a2) * right.value +
    (a3 - a2) * rightTangent
  );
}

export function evaluateScalarProfile(
  profile: HeroWaveScalarProfile | undefined,
  progress: number,
  fallback: number,
) {
  if (profile === undefined) return fallback;
  if (typeof profile === "number") return finite(profile, fallback);
  if (profile === "flat") return fallback;
  const p = clamp(progress, 0, 1);
  if (profile === "sin2") return Math.sin(Math.PI * p) ** 2;
  if (profile === "smoothstep") return smoothProfileAmount(p);
  if (profile === "bell") {
    const centered = (p - 0.5) / 0.22;
    return Math.exp(-0.5 * centered * centered);
  }
  if (profile === "head") return smoothProfileAmount(p);
  if (profile === "tail") return 1 - smoothProfileAmount(p);
  if (profile.type === "curve") return evaluateCurveProfile(profile, p);
  return sampleProfileArray(
    profile.values,
    p,
    profile.interpolation ?? "cubic",
    profile.wrap ?? "clamp",
  );
}
export function buildLongitudinalProfileTextureData(
  profiles: Required<HeroWaveLongitudinalProfiles>,
) {
  const data = new Uint8Array(
    HERO_PROFILE_TEXTURE_WIDTH * HERO_PROFILE_TEXTURE_HEIGHT * 4,
  );
  const encodePositive = (value: number) =>
    Math.round(clamp(value / 4, 0, 1) * 255);
  const encodeSigned = (value: number) =>
    Math.round(clamp((value + 2) / 4, 0, 1) * 255);
  for (let index = 0; index < HERO_PROFILE_TEXTURE_WIDTH; index++) {
    const progress = index / Math.max(HERO_PROFILE_TEXTURE_WIDTH - 1, 1);
    const firstOffset = index * 4;
    data[firstOffset] = encodePositive(
      evaluateScalarProfile(profiles.width, progress, 1),
    );
    data[firstOffset + 1] = encodePositive(
      evaluateScalarProfile(profiles.opacity, progress, 1),
    );
    data[firstOffset + 2] = encodePositive(
      evaluateScalarProfile(profiles.intensity, progress, 1),
    );
    data[firstOffset + 3] = encodePositive(
      evaluateScalarProfile(profiles.glow, progress, 1),
    );
    const secondOffset = (HERO_PROFILE_TEXTURE_WIDTH + index) * 4;
    data[secondOffset] = encodePositive(
      evaluateScalarProfile(profiles.reflection, progress, 1),
    );
    data[secondOffset + 1] = encodeSigned(
      evaluateScalarProfile(profiles.colorPosition, progress, 0),
    );
    data[secondOffset + 2] = encodePositive(
      evaluateScalarProfile(profiles.upperGlowSpread, progress, 1),
    );
    data[secondOffset + 3] = encodePositive(
      evaluateScalarProfile(profiles.lowerGlowSpread, progress, 1),
    );
  }
  return data;
}

export function resolveAutoQualityPreset(): Exclude<
  HeroWaveQualityPreset,
  "auto"
> {
  if (typeof navigator === "undefined") return "high";
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  if ((memory !== undefined && memory <= 4) || cores <= 4) return "balanced";
  if (memory !== undefined && memory >= 8 && cores >= 8) return "high";
  return "balanced";
}
export function resolveQuality(
  input: HeroWaveQualityPreset | HeroWaveQualityConfig | undefined,
): ResolvedQuality {
  const object = typeof input === "object" && input ? input : undefined;
  const requestedPreset =
    typeof input === "string" ? input : (object?.preset ?? "auto");
  const concretePreset =
    requestedPreset === "auto" ? resolveAutoQualityPreset() : requestedPreset;
  const base = QUALITY_PRESETS[concretePreset];
  return {
    preset: requestedPreset,
    maxDpr: finiteClamped(object?.maxDpr, base.maxDpr, 0.5, HERO_MAX_DPR),
    maxFps:
      object?.maxFps === 0
        ? 0
        : finiteClamped(object?.maxFps, base.maxFps, 1, 240),
    flatnessPx: finiteClamped(object?.flatnessPx, base.flatnessPx, 0.01, 4),
    maxChordPx: finiteClamped(object?.maxChordPx, base.maxChordPx, 0.25, 64),
    maxSamples: Math.trunc(
      finiteClamped(
        object?.maxSamples,
        base.maxSamples,
        512,
        HERO_MAX_PATH_SAMPLES,
      ),
    ),
    maxSubdivisionDepth: Math.trunc(
      finiteClamped(
        object?.maxSubdivisionDepth,
        base.maxSubdivisionDepth,
        6,
        HERO_PATH_MAX_SUBDIVISION_DEPTH,
      ),
    ),
    farScale: finiteClamped(object?.farScale, base.farScale, 0.015625, 1),
    midScale: finiteClamped(object?.midScale, base.midScale, 0.03125, 1),
    coreScale: finiteClamped(object?.coreScale, base.coreScale, 0.125, 1),
    farMaxDimension: Math.trunc(
      finiteClamped(object?.farMaxDimension, base.farMaxDimension, 128, 8192),
    ),
    midMaxDimension: Math.trunc(
      finiteClamped(object?.midMaxDimension, base.midMaxDimension, 256, 8192),
    ),
    coreMaxDimension: Math.trunc(
      finiteClamped(object?.coreMaxDimension, base.coreMaxDimension, 512, 8192),
    ),
    farMaxChordPx: finiteClamped(
      object?.farMaxChordPx,
      base.farMaxChordPx,
      4,
      512,
    ),
    midMaxChordPx: finiteClamped(
      object?.midMaxChordPx,
      base.midMaxChordPx,
      2,
      256,
    ),
    coreMaxChordPx: finiteClamped(
      object?.coreMaxChordPx,
      base.coreMaxChordPx,
      1,
      128,
    ),
    farFlatnessPx: finiteClamped(
      object?.farFlatnessPx,
      base.farFlatnessPx,
      0.05,
      32,
    ),
    midFlatnessPx: finiteClamped(
      object?.midFlatnessPx,
      base.midFlatnessPx,
      0.025,
      16,
    ),
    coreFlatnessPx: finiteClamped(
      object?.coreFlatnessPx,
      base.coreFlatnessPx,
      0.01,
      8,
    ),
    quadrature:
      object?.quadrature === 2 || object?.quadrature === 4
        ? object.quadrature
        : base.quadrature,
  };
}
export function resolveMaterial(
  input: HeroWaveMaterialInput | undefined,
  inherited?: ResolvedMaterial,
): ResolvedMaterial {
  const config = typeof input === "string" ? { preset: input } : input;
  const preset =
    config?.preset ?? inherited?.preset ?? INTERNAL_DEFAULTS.materialPreset;
  const presetBase = MATERIAL_PRESETS[preset];
  const base =
    inherited && inherited.preset === preset ? inherited : presetBase;
  return {
    preset,
    atmosphere: finiteClamped(config?.atmosphere, base.atmosphere, 0, 4),
    broad: finiteClamped(config?.broad, base.broad, 0, 4),
    body: finiteClamped(config?.body, base.body, 0, 4),
    ridge: finiteClamped(config?.ridge, base.ridge, 0, 4),
    core: finiteClamped(config?.core, base.core, 0, 4),
    veil: finiteClamped(config?.veil, base.veil, 0, 4),
    exposure: finiteClamped(config?.exposure, base.exposure, 0, 8),
    saturation: finiteClamped(config?.saturation, base.saturation, 0, 4),
  };
}

export function resolveProfileBounds(
  profiles: Required<HeroWaveLongitudinalProfiles>,
): ResolvedProfileBounds {
  let maximumWidth = 1;
  let maximumGlow = 1;
  let maximumUpperGlowSpread = 1;
  let maximumLowerGlowSpread = 1;
  for (let index = 0; index < HERO_PROFILE_TEXTURE_WIDTH; index++) {
    const progress = index / Math.max(HERO_PROFILE_TEXTURE_WIDTH - 1, 1);
    maximumWidth = Math.max(
      maximumWidth,
      evaluateScalarProfile(profiles.width, progress, 1),
    );
    maximumGlow = Math.max(
      maximumGlow,
      evaluateScalarProfile(profiles.glow, progress, 1),
    );
    maximumUpperGlowSpread = Math.max(
      maximumUpperGlowSpread,
      evaluateScalarProfile(profiles.upperGlowSpread, progress, 1),
    );
    maximumLowerGlowSpread = Math.max(
      maximumLowerGlowSpread,
      evaluateScalarProfile(profiles.lowerGlowSpread, progress, 1),
    );
  }
  return {
    maximumWidth: clamp(maximumWidth, 0.01, 4),
    maximumGlow: clamp(maximumGlow, 0.01, 4),
    maximumUpperGlowSpread: clamp(maximumUpperGlowSpread, 0.01, 4),
    maximumLowerGlowSpread: clamp(maximumLowerGlowSpread, 0.01, 4),
  };
}

export function normalizeSvgViewBox(
  input: HeroWaveSvgViewBox | undefined,
): readonly [number, number, number, number] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input)) {
    return [
      finite(input[0], 0),
      finite(input[1], 0),
      Math.max(finite(input[2], 1), 0.000001),
      Math.max(finite(input[3], 1), 0.000001),
    ];
  }
  const object = input as HeroWaveSvgViewBoxObject;
  return [
    finite(object.minX, 0),
    finite(object.minY, 0),
    Math.max(finite(object.width, 1), 0.000001),
    Math.max(finite(object.height, 1), 0.000001),
  ];
}
