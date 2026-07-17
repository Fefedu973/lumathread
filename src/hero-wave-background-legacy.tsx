"use client";

/**
 * Hero background inspired by react-bits SoftAurora, rendered in raw WebGL1
 * (no ogl dependency), composed with the DotPattern dot grid in the same
 * shader so the dots can reflect the filament's color.
 *
 * The finite ridge advances as one smooth piece: its geometry, palette and
 * tapered envelope share the same moving coordinate system.
 */
import { useEffect, useRef, useState } from "react";

export interface HeroDotMask {
  /** Stable lab/editor identifier; it is not consumed by the shader. */
  id: string;
  /** Horizontal center, 0 = left and 1 = right. */
  x: number;
  /** Vertical center, 0 = bottom and 1 = top. */
  y: number;
  /** Radius relative to viewport height. */
  radius: number;
}

export interface HeroWaveColorStop {
  /** Stable lab/editor identifier; it is not consumed by the shader. */
  id: string;
  color: string;
}

export const MAX_HERO_DOT_MASKS = 8;
export const HERO_TRAJECTORY_POINT_COUNT = 8;
export const MIN_HERO_TRAJECTORY_POINTS = 4;
export const HERO_TRAJECTORY_VERTICAL_LIMIT = 64;
const HERO_FOLLOW_POINT_COUNT = 56;
const HERO_CASCADE_FOLLOW_POINT_COUNT = 64;
const HERO_ECHO_FOLLOW_POINT_COUNT = 56;
const HERO_POINTER_HISTORY_LIMIT = 768;
const HERO_FOLLOW_OVERSCAN = 0.15;
const HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX = 0.35;
const HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS = 1 / 180;
const HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS = 1 / 90;
const HERO_FOLLOW_DUPLICATE_DISTANCE_PX = 0.45;
const HERO_FOLLOW_SPLINE_ALPHA = 0.5;
const HERO_FOLLOW_HISTORY_MARGIN_SECONDS = 0.3;
const HERO_PALETTE_TEXTURE_WIDTH = 512;
const HERO_GLOW_TEXTURE_WIDTH = 1024;
const HERO_GLOW_PROFILE_MAX_DISTANCE = 1.75;
const HERO_MASK_TEXTURE_HEIGHT = 192;
const HERO_PATH_SEED_SCALE = 0.5;
const HERO_PATH_PYRAMID_LEVELS = 6;
const HERO_PATH_BROAD_BLUR_PASSES = 3;
const HERO_PATH_DOWNSAMPLE_OFFSET = 2;
const HERO_PATH_BROAD_BLUR_OFFSET = 1.5;
const HERO_PATH_SEED_HALF_WIDTH_PX = 1.75;
const HERO_PATH_SEED_WEIGHT = 0.18;
const HERO_PATH_CORE_HALF_WIDTH_CSS_PX = 9;
const HERO_PATH_ENDPOINT_FEATHER_CSS_PX = 12;
const HERO_PATH_VERTEX_STRIDE = 7;
const HERO_PATH_VERTEX_CAPACITY_FACTOR = 2;
const HERO_PATH_REVERSAL_SPLIT_DOT = -0.92;
const HERO_MAX_PATH_SAMPLES = 32768;
const HERO_PATH_FLATNESS_PX = 0.15;
const HERO_PATH_MAX_CHORD_PX = 5.5;
const HERO_PATH_MAX_SUBDIVISION_DEPTH = 18;
const HERO_MAX_DPR = 1.5;
const TAU = Math.PI * 2;

export type HeroWaveMotionMode = "travel" | "propagate" | "anchored";
export type HeroWavePathMode = "sine" | "organic" | "custom" | "follow";
export type HeroWaveFollowMode = "hybrid" | "cascade" | "echo";

export interface HeroTrajectoryPoint {
  id: string;
  /** Normalized horizontal position from 0 (left) to 1 (right). */
  x: number;
  /** Relative vertical displacement from `waveY`. */
  y: number;
  /** Relative speed on the segment leaving this point. */
  speed: number;
}

export function getHeroTrajectoryVerticalScale(
  curveScale: number,
  curveStrength: number,
) {
  return Math.max(0.38 * curveScale * curveStrength, 0.02);
}

export const HERO_DEFAULT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "trajectory-0", x: 0.04, y: 0.52, speed: 1 },
  { id: "trajectory-1", x: 0.18, y: 0.9, speed: 1 },
  { id: "trajectory-2", x: 0.36, y: 0.28, speed: 1 },
  { id: "trajectory-3", x: 0.52, y: -0.72, speed: 1 },
  { id: "trajectory-4", x: 0.64, y: -0.88, speed: 1 },
  { id: "trajectory-5", x: 0.76, y: -0.18, speed: 1 },
  { id: "trajectory-6", x: 0.86, y: 0.74, speed: 1 },
  { id: "trajectory-7", x: 0.96, y: 0.92, speed: 1 },
];

function seededTrajectoryValue(seed: number, index: number) {
  const value = Math.sin((seed + index * 137.17) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function createHeroOrganicTrajectory(
  seed: number,
  pointCount = 12,
): HeroTrajectoryPoint[] {
  const count = Math.max(MIN_HERO_TRAJECTORY_POINTS, Math.trunc(pointCount));
  const horizontalPhase = seededTrajectoryValue(seed, 31) * Math.PI;
  const verticalPhase = seededTrajectoryValue(seed, 47) * Math.PI;
  const turns = 0.9 + Math.abs(seededTrajectoryValue(seed, 53)) * 1.3;
  const horizontalAmplitude =
    0.08 + Math.abs(seededTrajectoryValue(seed, 61)) * 0.12;

  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const primary = Math.sin(progress * Math.PI * 2 * turns + verticalPhase);
    const secondary = Math.sin(
      progress * Math.PI * (3.2 + turns) - verticalPhase * 0.7,
    );
    const x =
      0.04 +
      progress * 0.92 +
      Math.sin(progress * Math.PI * 2 * turns + horizontalPhase) *
        horizontalAmplitude;
    return {
      id: `organic-${seed}-${index}`,
      x: Math.min(0.98, Math.max(0.02, x)),
      y: Math.min(0.96, Math.max(-0.96, primary * 0.72 + secondary * 0.2)),
      speed: 0.8 + Math.abs(seededTrajectoryValue(seed, index + 73)) * 0.7,
    };
  });
}

function normalizeTrajectoryPoints(
  points: readonly HeroTrajectoryPoint[],
  verticalLimit = HERO_TRAJECTORY_VERTICAL_LIMIT,
): HeroTrajectoryPoint[] {
  const count = Math.max(MIN_HERO_TRAJECTORY_POINTS, points.length);
  return Array.from({ length: count }, (_, index) => {
    const point = points[index] ?? HERO_DEFAULT_TRAJECTORY[index];
    const fallbackX = index / Math.max(count - 1, 1);
    return {
      id: point?.id ?? `trajectory-${index}`,
      x: clamp(finite(point?.x, fallbackX), 0, 1),
      y: clamp(finite(point?.y, 0), -verticalLimit, verticalLimit),
      speed: clamp(finite(point?.speed, 1), 0.2, 4),
    };
  });
}

function catmullRomValue(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export interface HeroWaveBackgroundProps {
  className?: string;
  /** Travel moves the envelope, propagate deforms the path in place, anchored pins both. */
  motionMode?: HeroWaveMotionMode;
  /** Analytic sine, seeded organic spline, or editable custom spline. */
  pathMode?: HeroWavePathMode;
  /** Geometry model used while following the pointer. */
  followMode?: HeroWaveFollowMode;
  /** Temporal viscosity: 0 samples history uniformly, 1 concentrates more detail near the head. */
  followDrift?: number;
  /** Trail memory. Higher values keep older pointer positions visible longer. */
  followLag?: number;
  /** Seed used by the organic spline generator. */
  trajectorySeed?: number;
  /** Arbitrary-length set of 2D control points used by the custom spline. */
  trajectoryPoints?: readonly HeroTrajectoryPoint[];
  /** Connect the last custom point back to the first. */
  trajectoryClosed?: boolean;
  /** Keep the moving head/tail taper on a closed path. */
  closedLoopTaper?: boolean;
  /** Vertical resting position of the band, 0 = top, 1 = bottom. */
  waveY?: number;
  /** Blend between a flat band and the snake curve. */
  curveStrength?: number;
  /** Vertical scale of the snake curve. */
  curveScale?: number;
  /** Number of broad bends along the filament. */
  curveFrequency?: number;
  /** Horizontal forward speed in viewport widths per second. */
  curveTravel?: number;
  /** Fraction of travel inherited by the world-space curve in travel mode. */
  pathDrift?: number;
  /** Slow global shape morphing while the filament advances. */
  curveMotion?: number;
  /** Total filament length in viewport widths. */
  segmentLength?: number;
  /** Portion of the filament used to taper the trailing edge. */
  tailTaper?: number;
  /** Portion of the filament used to taper the leading edge. */
  headTaper?: number;
  /** Motion speed multiplier. */
  speed?: number;
  /** Band glow: exponential spread (higher = brighter, wider). */
  glow?: number;
  /** Spread multiplier above the ridge. */
  upperGlowSpread?: number;
  /** Spread multiplier below the ridge. */
  lowerGlowSpread?: number;
  /** Vertical glow bias: -1 favors below, 0 is symmetric, 1 favors above. */
  glowAsymmetry?: number;
  /** Overall wave brightness. */
  intensity?: number;
  /** Palette propagation speed along the filament; 0 keeps colors anchored. */
  colorSpeed?: number;
  /** Ordered color stops distributed uniformly over the whole filament. */
  colors?: readonly HeroWaveColorStop[];
  /** Static hue rotation applied to the wave, in degrees. */
  hue?: number;
  /** Hue drift in degrees per second (slow global color cycle). */
  hueDrift?: number;
  /** Dot grid spacing in CSS pixels. */
  dotSpacing?: number;
  /** Dot base opacity, 0-1. */
  dotOpacity?: number;
  /** Amount of random dot pulsing, 0-1. */
  twinkle?: number;
  /** How strongly dots reflect the wave color, 0-2. */
  reflect?: number;
  /** Soft edge width shared by all dot masks, 0-1. */
  maskFeather?: number;
  /** Union of editable masks applied to the single V1 dot grid. */
  dotMasks?: readonly HeroDotMask[];
  /** Canvas reveal duration after the first WebGL frame, in milliseconds. */
  fadeInDuration?: number;
  /** Resolved CSS timing function used by the reveal transition. */
  fadeInEasing?: string;
  /** Freeze the animation (lab use). */
  paused?: boolean;
  /** Called whenever a traveling filament finishes a complete pass. */
  onCycleComplete?: () => void;
  /** Called immediately after this renderer draws a frame. */
  onFrame?: (delta: number) => void;
}

export const HERO_WAVE_DEFAULTS = {
  motionMode: "travel" as HeroWaveMotionMode,
  pathMode: "organic" as HeroWavePathMode,
  followMode: "hybrid" as HeroWaveFollowMode,
  followDrift: 0.45,
  followLag: 0.45,
  trajectorySeed: 731,
  trajectoryPoints: HERO_DEFAULT_TRAJECTORY,
  trajectoryClosed: false,
  closedLoopTaper: true,
  waveY: 0.68,
  curveStrength: 1,
  curveScale: 0.62,
  curveFrequency: 1.4,
  curveTravel: 0.08,
  pathDrift: 0,
  curveMotion: 0.65,
  segmentLength: 0.78,
  tailTaper: 0.24,
  headTaper: 0.14,
  speed: 0.7,
  glow: 1,
  upperGlowSpread: 1,
  lowerGlowSpread: 1,
  glowAsymmetry: 1,
  intensity: 1,
  colorSpeed: 1,
  colors: [
    { id: "palette-blue", color: "#2438ff" },
    { id: "palette-cyan", color: "#1adff5" },
    { id: "palette-green", color: "#22f25f" },
  ],
  hue: 0,
  hueDrift: 0,
  dotSpacing: 26,
  dotOpacity: 0.45,
  twinkle: 0.6,
  reflect: 0.8,
  maskFeather: 0.55,
  dotMasks: [
    { id: "left", x: 0.26, y: 0.52, radius: 0.72 },
    { id: "right", x: 0.78, y: 0.5, radius: 0.74 },
  ],
  fadeInDuration: 900,
  fadeInEasing: "ease-out",
  paused: false,
} as const;

type Settings = Required<
  Omit<HeroWaveBackgroundProps, "className" | "onCycleComplete" | "onFrame">
>;

function hexToVec3(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) {
    return [1, 1, 1];
  }
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function buildHeroPaletteTextureData(
  sourceColors: readonly HeroWaveColorStop[],
) {
  const colors =
    sourceColors.length > 0 ? sourceColors : HERO_WAVE_DEFAULTS.colors;
  const parsed = colors.map((stop) => hexToVec3(stop.color));
  const data = new Uint8Array(HERO_PALETTE_TEXTURE_WIDTH * 4);
  const sectionWidth = HERO_PALETTE_TEXTURE_WIDTH / 2;

  const writeSample = (index: number, progress: number, cyclic: boolean) => {
    const scaled =
      progress * Math.max(cyclic ? parsed.length : parsed.length - 1, 0);
    const rawLeftIndex = Math.floor(scaled);
    const leftIndex = cyclic
      ? rawLeftIndex % parsed.length
      : Math.min(parsed.length - 1, rawLeftIndex);
    const rightIndex = cyclic
      ? (leftIndex + 1) % parsed.length
      : Math.min(parsed.length - 1, leftIndex + 1);
    const mixAmount = scaled - rawLeftIndex;
    const left = parsed[leftIndex] ?? [1, 1, 1];
    const right = parsed[rightIndex] ?? left;
    const offset = index * 4;
    data[offset] = Math.round(
      (left[0] + (right[0] - left[0]) * mixAmount) * 255,
    );
    data[offset + 1] = Math.round(
      (left[1] + (right[1] - left[1]) * mixAmount) * 255,
    );
    data[offset + 2] = Math.round(
      (left[2] + (right[2] - left[2]) * mixAmount) * 255,
    );
    data[offset + 3] = 255;
  };

  for (let index = 0; index < sectionWidth; index++) {
    const progress = index / Math.max(sectionWidth - 1, 1);
    writeSample(index, progress, false);
    writeSample(sectionWidth + index, progress, true);
  }

  return data;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function finiteClamped(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return clamp(finite(value, fallback), minimum, maximum);
}

function resolveSettings(input: HeroWaveBackgroundProps): Settings {
  const motionMode: HeroWaveMotionMode =
    input.motionMode === "propagate" || input.motionMode === "anchored"
      ? input.motionMode
      : "travel";
  const pathMode: HeroWavePathMode =
    input.pathMode === "sine" ||
    input.pathMode === "custom" ||
    input.pathMode === "follow"
      ? input.pathMode
      : "organic";
  const followMode: HeroWaveFollowMode =
    input.followMode === "cascade" || input.followMode === "echo"
      ? input.followMode
      : "hybrid";
  return {
    motionMode,
    pathMode,
    followMode,
    followDrift: finiteClamped(
      input.followDrift,
      HERO_WAVE_DEFAULTS.followDrift,
      0,
      1,
    ),
    followLag: finiteClamped(
      input.followLag,
      HERO_WAVE_DEFAULTS.followLag,
      0,
      1,
    ),
    trajectorySeed: Math.trunc(
      finite(input.trajectorySeed, HERO_WAVE_DEFAULTS.trajectorySeed),
    ),
    trajectoryPoints:
      input.trajectoryPoints && input.trajectoryPoints.length > 0
        ? input.trajectoryPoints
        : HERO_WAVE_DEFAULTS.trajectoryPoints,
    trajectoryClosed:
      input.trajectoryClosed ?? HERO_WAVE_DEFAULTS.trajectoryClosed,
    closedLoopTaper:
      input.closedLoopTaper ?? HERO_WAVE_DEFAULTS.closedLoopTaper,
    waveY: finiteClamped(input.waveY, HERO_WAVE_DEFAULTS.waveY, 0, 1),
    curveStrength: finiteClamped(
      input.curveStrength,
      HERO_WAVE_DEFAULTS.curveStrength,
      0,
      2,
    ),
    curveScale: finiteClamped(
      input.curveScale,
      HERO_WAVE_DEFAULTS.curveScale,
      0,
      4,
    ),
    curveFrequency: finiteClamped(
      input.curveFrequency,
      HERO_WAVE_DEFAULTS.curveFrequency,
      0.05,
      12,
    ),
    curveTravel: finiteClamped(
      input.curveTravel,
      HERO_WAVE_DEFAULTS.curveTravel,
      -4,
      4,
    ),
    pathDrift: finiteClamped(
      input.pathDrift,
      HERO_WAVE_DEFAULTS.pathDrift,
      0,
      1,
    ),
    curveMotion: finiteClamped(
      input.curveMotion,
      HERO_WAVE_DEFAULTS.curveMotion,
      0,
      2,
    ),
    segmentLength: finiteClamped(
      input.segmentLength,
      HERO_WAVE_DEFAULTS.segmentLength,
      0.05,
      4,
    ),
    tailTaper: finiteClamped(
      input.tailTaper,
      HERO_WAVE_DEFAULTS.tailTaper,
      0.001,
      1,
    ),
    headTaper: finiteClamped(
      input.headTaper,
      HERO_WAVE_DEFAULTS.headTaper,
      0.001,
      1,
    ),
    speed: finiteClamped(input.speed, HERO_WAVE_DEFAULTS.speed, -8, 8),
    glow: finiteClamped(input.glow, HERO_WAVE_DEFAULTS.glow, 0.1, 8),
    upperGlowSpread: finiteClamped(
      input.upperGlowSpread,
      HERO_WAVE_DEFAULTS.upperGlowSpread,
      0.05,
      8,
    ),
    lowerGlowSpread: finiteClamped(
      input.lowerGlowSpread,
      HERO_WAVE_DEFAULTS.lowerGlowSpread,
      0.05,
      8,
    ),
    glowAsymmetry: finiteClamped(
      input.glowAsymmetry,
      HERO_WAVE_DEFAULTS.glowAsymmetry,
      -1,
      1,
    ),
    intensity: finiteClamped(
      input.intensity,
      HERO_WAVE_DEFAULTS.intensity,
      0,
      8,
    ),
    colorSpeed: finiteClamped(
      input.colorSpeed,
      HERO_WAVE_DEFAULTS.colorSpeed,
      -8,
      8,
    ),
    colors:
      input.colors && input.colors.length > 0
        ? input.colors
        : HERO_WAVE_DEFAULTS.colors,
    hue: finite(input.hue, HERO_WAVE_DEFAULTS.hue),
    hueDrift: finiteClamped(
      input.hueDrift,
      HERO_WAVE_DEFAULTS.hueDrift,
      -720,
      720,
    ),
    dotSpacing: finiteClamped(
      input.dotSpacing,
      HERO_WAVE_DEFAULTS.dotSpacing,
      2,
      512,
    ),
    dotOpacity: finiteClamped(
      input.dotOpacity,
      HERO_WAVE_DEFAULTS.dotOpacity,
      0,
      1,
    ),
    twinkle: finiteClamped(input.twinkle, HERO_WAVE_DEFAULTS.twinkle, 0, 1),
    reflect: finiteClamped(input.reflect, HERO_WAVE_DEFAULTS.reflect, 0, 2),
    maskFeather: finiteClamped(
      input.maskFeather,
      HERO_WAVE_DEFAULTS.maskFeather,
      0.001,
      1,
    ),
    dotMasks: input.dotMasks ?? HERO_WAVE_DEFAULTS.dotMasks,
    fadeInDuration: finiteClamped(
      input.fadeInDuration,
      HERO_WAVE_DEFAULTS.fadeInDuration,
      0,
      10_000,
    ),
    fadeInEasing: input.fadeInEasing?.trim() || HERO_WAVE_DEFAULTS.fadeInEasing,
    paused: input.paused ?? HERO_WAVE_DEFAULTS.paused,
  };
}

function buildGlowProfileTextureData() {
  const profile0 = new Uint8Array(HERO_GLOW_TEXTURE_WIDTH * 4);
  const profile1 = new Uint8Array(HERO_GLOW_TEXTURE_WIDTH * 4);
  const encode = (value: number) =>
    Math.round(clamp(Math.sqrt(Math.max(value, 0)), 0, 1) * 255);

  for (let index = 0; index < HERO_GLOW_TEXTURE_WIDTH; index++) {
    const distance =
      (index / (HERO_GLOW_TEXTURE_WIDTH - 1)) * HERO_GLOW_PROFILE_MAX_DISTANCE;
    const atmosphere = Math.exp(-distance * 4.6);
    const broad = Math.exp(-distance * 6.2);
    const body = Math.exp(-distance * 11);
    const ridge = Math.exp(-distance * 20);
    const core = Math.exp(-distance * 92);
    const veil = Math.exp(-distance * 25);
    const reflection = broad * 0.36 + body * 0.54 + ridge * 0.34;
    const offset = index * 4;
    profile0[offset] = encode(atmosphere);
    profile0[offset + 1] = encode(broad);
    profile0[offset + 2] = encode(body);
    profile0[offset + 3] = encode(ridge);
    profile1[offset] = encode(core);
    profile1[offset + 1] = encode(veil);
    profile1[offset + 2] = encode(reflection);
    profile1[offset + 3] = 255;
  }

  return { profile0, profile1 };
}

function buildDotMaskTextureData(
  sourceMasks: readonly HeroDotMask[],
  feather: number,
  aspect: number,
) {
  const height = HERO_MASK_TEXTURE_HEIGHT;
  const width = clamp(Math.round(height * aspect), 64, 1024);
  const masks = sourceMasks.slice(0, MAX_HERO_DOT_MASKS).map((mask) => ({
    x: clamp(finite(mask.x, 0.5), 0, 1),
    y: clamp(finite(mask.y, 0.5), 0, 1),
    radius: clamp(finite(mask.radius, 0.5), 0.01, 2),
  }));
  const data = new Uint8Array(width * height);
  if (masks.length === 0) {
    return { data, width, height };
  }

  const safeFeather = clamp(feather, 0.001, 1);
  for (let y = 0; y < height; y++) {
    const uvY = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const uvX = (x + 0.5) / width;
      let signal = 0;
      for (const mask of masks) {
        const dx = (uvX - mask.x) * aspect;
        const dy = uvY - mask.y;
        const distance = Math.hypot(dx, dy);
        const inner = mask.radius * (1 - safeFeather);
        const normalized = clamp(
          (distance - inner) / Math.max(mask.radius - inner, 0.000001),
          0,
          1,
        );
        const smooth = normalized * normalized * (3 - 2 * normalized);
        signal = Math.max(signal, 1 - smooth);
      }
      data[y * width + x] = Math.round(signal * 255);
    }
  }
  return { data, width, height };
}

function hashMix(hash: number, value: number) {
  return Math.imul(hash ^ (value | 0), 16_777_619) >>> 0;
}

function hashFloat(hash: number, value: number, precision = 100_000) {
  return hashMix(hash, Math.round(finite(value, 0) * precision));
}

function hashString(hash: number, value: string) {
  let result = hash;
  for (let index = 0; index < value.length; index++) {
    result = hashMix(result, value.charCodeAt(index));
  }
  return result;
}

function hashColors(colors: readonly HeroWaveColorStop[]) {
  let hash = hashMix(2_166_136_261, colors.length);
  for (const stop of colors) {
    hash = hashString(hash, stop.color.trim().toLowerCase());
  }
  return hash;
}

function hashMasks(masks: readonly HeroDotMask[], feather: number) {
  let hash = hashFloat(2_166_136_261, feather, 10_000);
  const count = Math.min(masks.length, MAX_HERO_DOT_MASKS);
  hash = hashMix(hash, count);
  for (let index = 0; index < count; index++) {
    const mask = masks[index];
    if (!mask) continue;
    hash = hashFloat(hash, mask.x);
    hash = hashFloat(hash, mask.y);
    hash = hashFloat(hash, mask.radius);
  }
  return hash;
}

function hashTrajectory(points: readonly HeroTrajectoryPoint[]) {
  let hash = hashMix(2_166_136_261, points.length);
  for (const point of points) {
    hash = hashFloat(hash, point.x);
    hash = hashFloat(hash, point.y);
    hash = hashFloat(hash, point.speed, 10_000);
  }
  return hash;
}

interface CurveSample {
  x: number;
  y: number;
  speed: number;
  progress: number;
}

interface PointerTrailSample {
  x: number;
  top: number;
  time: number;
}

interface FollowAnchor {
  x: number;
  top: number;
}

interface FollowScreenPoint {
  x: number;
  y: number;
}

interface PathDrawRange {
  first: number;
  count: number;
}

function trajectoryPointAt(
  points: readonly HeroTrajectoryPoint[],
  index: number,
  closed: boolean,
) {
  const count = points.length;
  const pointIndex = closed
    ? ((index % count) + count) % count
    : Math.min(count - 1, Math.max(0, index));
  return points[pointIndex] ?? points[0] ?? HERO_DEFAULT_TRAJECTORY[0];
}

function evaluateTrajectorySegment(
  points: readonly HeroTrajectoryPoint[],
  segment: number,
  localT: number,
  closed: boolean,
  bandHeight: number,
  verticalScale: number,
): CurveSample {
  const p0 = trajectoryPointAt(points, segment - 1, closed);
  const p1 = trajectoryPointAt(points, segment, closed);
  const p2 = trajectoryPointAt(points, segment + 1, closed);
  const p3 = trajectoryPointAt(points, segment + 2, closed);
  return {
    x: clamp(catmullRomValue(p0.x, p1.x, p2.x, p3.x, localT), -0.25, 1.25),
    y:
      bandHeight +
      catmullRomValue(p0.y, p1.y, p2.y, p3.y, localT) * verticalScale,
    speed: Math.max(p1.speed + (p2.speed - p1.speed) * localT, 0.2),
    progress: 0,
  };
}

function pointToSegmentDistancePixels(
  point: CurveSample,
  start: CurveSample,
  end: CurveSample,
  width: number,
  height: number,
) {
  const ax = start.x * width;
  const ay = start.y * height;
  const bx = end.x * width;
  const by = end.y * height;
  const px = point.x * width;
  const py = point.y * height;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return Math.hypot(px - ax, py - ay);
  const projection = clamp(
    ((px - ax) * dx + (py - ay) * dy) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(px - (ax + dx * projection), py - (ay + dy * projection));
}

function appendAdaptiveSegment(
  points: readonly HeroTrajectoryPoint[],
  segment: number,
  t0: number,
  start: CurveSample,
  t1: number,
  end: CurveSample,
  closed: boolean,
  bandHeight: number,
  verticalScale: number,
  width: number,
  height: number,
  depth: number,
  output: CurveSample[],
) {
  if (output.length >= HERO_MAX_PATH_SAMPLES) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarterT = (t0 * 3 + t1) * 0.25;
  const threeQuarterT = (t0 + t1 * 3) * 0.25;
  const midpoint = evaluateTrajectorySegment(
    points,
    segment,
    midpointT,
    closed,
    bandHeight,
    verticalScale,
  );
  const quarter = evaluateTrajectorySegment(
    points,
    segment,
    quarterT,
    closed,
    bandHeight,
    verticalScale,
  );
  const threeQuarter = evaluateTrajectorySegment(
    points,
    segment,
    threeQuarterT,
    closed,
    bandHeight,
    verticalScale,
  );
  const flatness = Math.max(
    pointToSegmentDistancePixels(quarter, start, end, width, height),
    pointToSegmentDistancePixels(midpoint, start, end, width, height),
    pointToSegmentDistancePixels(threeQuarter, start, end, width, height),
  );
  const chord = Math.hypot(
    (end.x - start.x) * width,
    (end.y - start.y) * height,
  );
  const split =
    (flatness > HERO_PATH_FLATNESS_PX || chord > HERO_PATH_MAX_CHORD_PX) &&
    depth < HERO_PATH_MAX_SUBDIVISION_DEPTH &&
    output.length < HERO_MAX_PATH_SAMPLES - 1;

  if (split) {
    appendAdaptiveSegment(
      points,
      segment,
      t0,
      start,
      midpointT,
      midpoint,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      depth + 1,
      output,
    );
    appendAdaptiveSegment(
      points,
      segment,
      midpointT,
      midpoint,
      t1,
      end,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      depth + 1,
      output,
    );
  } else {
    output.push(end);
  }
}

function buildAdaptivePathSamples(
  sourcePoints: readonly HeroTrajectoryPoint[],
  closed: boolean,
  width: number,
  height: number,
  waveY: number,
  curveScale: number,
  curveStrength: number,
) {
  const points = normalizeTrajectoryPoints(sourcePoints);
  const segmentCount = closed ? points.length : points.length - 1;
  const bandHeight = 1 - waveY;
  const verticalScale = getHeroTrajectoryVerticalScale(
    curveScale,
    curveStrength,
  );
  const output: CurveSample[] = [];
  if (segmentCount <= 0) return output;

  output.push(
    evaluateTrajectorySegment(points, 0, 0, closed, bandHeight, verticalScale),
  );
  for (
    let segment = 0;
    segment < segmentCount && output.length < HERO_MAX_PATH_SAMPLES;
    segment++
  ) {
    const start = output[output.length - 1]!;
    const end = evaluateTrajectorySegment(
      points,
      segment,
      1,
      closed,
      bandHeight,
      verticalScale,
    );
    appendAdaptiveSegment(
      points,
      segment,
      0,
      start,
      1,
      end,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      0,
      output,
    );
  }

  const aspect = width / Math.max(height, 1);
  let elapsed = 0;
  output[0]!.progress = 0;
  for (let index = 1; index < output.length; index++) {
    const previous = output[index - 1]!;
    const current = output[index]!;
    const localSpeed = Math.max((previous.speed + current.speed) * 0.5, 0.2);
    elapsed +=
      Math.hypot((current.x - previous.x) * aspect, current.y - previous.y) /
      localSpeed;
    current.progress = elapsed;
  }
  const total = Math.max(elapsed, 0.000001);
  for (const sample of output) sample.progress /= total;
  if (closed && output.length > 1) output[output.length - 1]!.progress = 1;
  return output;
}

function followScreenControlPoint(
  points: readonly FollowScreenPoint[],
  index: number,
): FollowScreenPoint {
  const count = points.length;
  if (count === 0) return { x: 0, y: 0 };
  if (count === 1) return points[0]!;
  if (index < 0) {
    const first = points[0]!;
    const second = points[1]!;
    return {
      x: first.x * 2 - second.x,
      y: first.y * 2 - second.y,
    };
  }
  if (index >= count) {
    const last = points[count - 1]!;
    const previous = points[count - 2]!;
    return {
      x: last.x * 2 - previous.x,
      y: last.y * 2 - previous.y,
    };
  }
  return points[index]!;
}

function followParameterStep(from: FollowScreenPoint, to: FollowScreenPoint) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(distance ** HERO_FOLLOW_SPLINE_ALPHA, 0.001);
}

function interpolateFollowPoint(
  from: FollowScreenPoint,
  to: FollowScreenPoint,
  fromTime: number,
  toTime: number,
  time: number,
): FollowScreenPoint {
  const amount = (time - fromTime) / Math.max(toTime - fromTime, 0.000001);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

/**
 * Centripetal Catmull-Rom evaluated in physical screen space. Mirrored endpoint
 * controls force the first and last tangent to follow the recorded pointer
 * direction, preventing the tail from curling back because of spline overshoot.
 */
function evaluateFollowSegment(
  points: readonly FollowScreenPoint[],
  segment: number,
  localT: number,
  width: number,
  height: number,
): CurveSample {
  const p0 = followScreenControlPoint(points, segment - 1);
  const p1 = followScreenControlPoint(points, segment);
  const p2 = followScreenControlPoint(points, segment + 1);
  const p3 = followScreenControlPoint(points, segment + 2);

  const t0 = 0;
  const t1 = t0 + followParameterStep(p0, p1);
  const t2 = t1 + followParameterStep(p1, p2);
  const t3 = t2 + followParameterStep(p2, p3);
  const time = t1 + (t2 - t1) * clamp(localT, 0, 1);

  const a1 = interpolateFollowPoint(p0, p1, t0, t1, time);
  const a2 = interpolateFollowPoint(p1, p2, t1, t2, time);
  const a3 = interpolateFollowPoint(p2, p3, t2, t3, time);
  const b1 = interpolateFollowPoint(a1, a2, t0, t2, time);
  const b2 = interpolateFollowPoint(a2, a3, t1, t3, time);
  const point = interpolateFollowPoint(b1, b2, t1, t2, time);

  return {
    x: point.x / Math.max(width, 1),
    y: point.y / Math.max(height, 1),
    speed: 1,
    progress: 0,
  };
}

function appendAdaptiveFollowSegment(
  points: readonly FollowScreenPoint[],
  segment: number,
  t0: number,
  start: CurveSample,
  t1: number,
  end: CurveSample,
  width: number,
  height: number,
  depth: number,
  output: CurveSample[],
) {
  if (output.length >= HERO_MAX_PATH_SAMPLES) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarterT = (t0 * 3 + t1) * 0.25;
  const threeQuarterT = (t0 + t1 * 3) * 0.25;
  const quarter = evaluateFollowSegment(
    points,
    segment,
    quarterT,
    width,
    height,
  );
  const midpoint = evaluateFollowSegment(
    points,
    segment,
    midpointT,
    width,
    height,
  );
  const threeQuarter = evaluateFollowSegment(
    points,
    segment,
    threeQuarterT,
    width,
    height,
  );
  const flatness = Math.max(
    pointToSegmentDistancePixels(quarter, start, end, width, height),
    pointToSegmentDistancePixels(midpoint, start, end, width, height),
    pointToSegmentDistancePixels(threeQuarter, start, end, width, height),
  );
  const chord = Math.hypot(
    (end.x - start.x) * width,
    (end.y - start.y) * height,
  );
  const split =
    (flatness > HERO_PATH_FLATNESS_PX || chord > HERO_PATH_MAX_CHORD_PX) &&
    depth < HERO_PATH_MAX_SUBDIVISION_DEPTH &&
    output.length < HERO_MAX_PATH_SAMPLES - 1;

  if (split) {
    appendAdaptiveFollowSegment(
      points,
      segment,
      t0,
      start,
      midpointT,
      midpoint,
      width,
      height,
      depth + 1,
      output,
    );
    appendAdaptiveFollowSegment(
      points,
      segment,
      midpointT,
      midpoint,
      t1,
      end,
      width,
      height,
      depth + 1,
      output,
    );
  } else {
    output.push(end);
  }
}

function buildAdaptiveFollowPathSamples(
  anchors: readonly FollowAnchor[],
  width: number,
  height: number,
  output: CurveSample[],
) {
  output.length = 0;
  const points: FollowScreenPoint[] = [];

  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (!anchor) continue;
    const point = {
      x: anchor.x * width,
      y: (1 - anchor.top) * height,
    };
    const previous = points[points.length - 1];
    const isLast = index === anchors.length - 1;
    if (!previous) {
      points.push(point);
      continue;
    }
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= HERO_FOLLOW_DUPLICATE_DISTANCE_PX) {
      points.push(point);
    } else if (isLast) {
      // Always keep the head exactly under the current pointer.
      points[points.length - 1] = point;
    }
  }

  if (points.length === 0) return output;
  if (points.length === 1) {
    output.push({
      x: points[0]!.x / Math.max(width, 1),
      y: points[0]!.y / Math.max(height, 1),
      speed: 1,
      progress: 0,
    });
    return output;
  }

  const segmentCount = points.length - 1;
  output.push(evaluateFollowSegment(points, 0, 0, width, height));
  for (
    let segment = 0;
    segment < segmentCount && output.length < HERO_MAX_PATH_SAMPLES;
    segment++
  ) {
    const start = output[output.length - 1]!;
    const end = evaluateFollowSegment(points, segment, 1, width, height);
    appendAdaptiveFollowSegment(
      points,
      segment,
      0,
      start,
      1,
      end,
      width,
      height,
      0,
      output,
    );
  }

  let elapsed = 0;
  output[0]!.progress = 0;
  for (let index = 1; index < output.length; index++) {
    const previous = output[index - 1]!;
    const current = output[index]!;
    elapsed += Math.hypot(
      (current.x - previous.x) * width,
      (current.y - previous.y) * height,
    );
    current.progress = elapsed;
  }
  const total = Math.max(elapsed, 0.000001);
  for (const sample of output) sample.progress /= total;
  return output;
}

function buildPropagatedPathSamples(
  source: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  time: number,
  settings: Settings,
  target: CurveSample[],
) {
  const aspect = width / Math.max(height, 1);
  const uniqueCount =
    closed && source.length > 2 ? source.length - 1 : source.length;
  const waveCount = closed
    ? Math.max(1, Math.round(settings.curveFrequency * 2))
    : Math.max(settings.curveFrequency, 0.05);
  const secondaryWaveCount = closed ? waveCount + 1 : waveCount * 0.55 + 0.4;
  const phaseAdvance = time * settings.curveTravel * TAU * 1.6;
  const amplitude =
    0.055 *
    clamp(settings.curveMotion, 0, 1.5) *
    clamp(settings.curveScale * settings.curveStrength, 0, 1.5);

  target.length = source.length;
  for (let index = 0; index < source.length; index++) {
    const sample = source[index];
    if (!sample) continue;
    const canonicalIndex = closed && index === source.length - 1 ? 0 : index;
    const previousIndex = closed
      ? (canonicalIndex - 1 + uniqueCount) % uniqueCount
      : Math.max(0, canonicalIndex - 1);
    const nextIndex = closed
      ? (canonicalIndex + 1) % uniqueCount
      : Math.min(source.length - 1, canonicalIndex + 1);
    const previous = source[previousIndex] ?? sample;
    const next = source[nextIndex] ?? sample;
    const tangentX = (next.x - previous.x) * aspect;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.max(Math.hypot(tangentX, tangentY), 0.000001);
    const normalX = -tangentY / tangentLength / aspect;
    const normalY = tangentX / tangentLength;
    const progress = clamp(sample.progress, 0, 1);
    const endpointEnvelope = closed ? 1 : Math.sin(Math.PI * progress) ** 2;
    const primaryPhase = progress * TAU * waveCount - phaseAdvance;
    const secondaryPhase =
      progress * TAU * secondaryWaveCount + phaseAdvance * 0.63 + 1.1;
    const displacement =
      amplitude *
      endpointEnvelope *
      (Math.sin(primaryPhase) * 0.78 + Math.sin(secondaryPhase) * 0.22);
    const output = target[index] ?? { x: 0, y: 0, speed: 1, progress: 0 };
    output.x = sample.x + normalX * displacement;
    output.y = sample.y + normalY * displacement;
    output.speed = sample.speed;
    output.progress = sample.progress;
    target[index] = output;
  }
  return target;
}

function pathScreenDirection(
  samples: readonly CurveSample[],
  index: number,
  direction: -1 | 1,
  closed: boolean,
  width: number,
  height: number,
  rangeStart = 0,
  rangeEnd = samples.length - 1,
) {
  const lastIndex = samples.length - 1;
  const uniqueCount = closed && lastIndex > 1 ? lastIndex : samples.length;
  const canonicalIndex = closed && index === lastIndex ? 0 : index;
  const current = samples[canonicalIndex];
  if (!current || uniqueCount <= 1) return null;

  const minimumDistanceSquared = 0.25 ** 2;
  for (let step = 1; step < uniqueCount; step++) {
    let candidateIndex = canonicalIndex + direction * step;
    if (closed) {
      candidateIndex =
        ((candidateIndex % uniqueCount) + uniqueCount) % uniqueCount;
    } else if (candidateIndex < rangeStart || candidateIndex > rangeEnd) {
      break;
    }
    const candidate = samples[candidateIndex];
    if (!candidate) continue;
    const dx = (candidate.x - current.x) * width;
    const dy = (candidate.y - current.y) * height;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= minimumDistanceSquared) continue;
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    return direction < 0
      ? { x: -dx * inverseLength, y: -dy * inverseLength }
      : { x: dx * inverseLength, y: dy * inverseLength };
  }
  return null;
}

function buildPathStrokeVertexData(
  samples: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  endpointFeatherPx: number,
  target: Float32Array,
) {
  if (samples.length < 2) {
    return { floatCount: 0, vertexCount: 0, drawRanges: [] as PathDrawRange[] };
  }

  const cumulativeLength = new Float32Array(samples.length);
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    cumulativeLength[index] =
      cumulativeLength[index - 1]! +
      (previous && current
        ? Math.hypot(
            (current.x - previous.x) * width,
            (current.y - previous.y) * height,
          )
        : 0);
  }
  const totalScreenLength = cumulativeLength[samples.length - 1] ?? 0;

  const smoothEndpoint = (distance: number) => {
    const normalized = clamp(
      distance / Math.max(endpointFeatherPx, 0.001),
      0,
      1,
    );
    return normalized * normalized * (3 - 2 * normalized);
  };

  // A near-180 degree reversal is topologically ambiguous for one continuous
  // triangle strip. Split there and overlap one center sample instead of
  // letting the strip bridge across the hairpin and scramble the tail.
  const centerRanges: Array<{ start: number; end: number }> = [];
  if (closed) {
    centerRanges.push({ start: 0, end: samples.length - 1 });
  } else {
    let rangeStart = 0;
    for (let index = 1; index < samples.length - 1; index++) {
      const incoming = pathScreenDirection(
        samples,
        index,
        -1,
        false,
        width,
        height,
      );
      const outgoing = pathScreenDirection(
        samples,
        index,
        1,
        false,
        width,
        height,
      );
      if (!incoming || !outgoing) continue;
      const tangentDot = incoming.x * outgoing.x + incoming.y * outgoing.y;
      if (tangentDot < HERO_PATH_REVERSAL_SPLIT_DOT) {
        if (index - rangeStart >= 1) {
          centerRanges.push({ start: rangeStart, end: index });
        }
        rangeStart = index;
      }
    }
    if (samples.length - 1 - rangeStart >= 1) {
      centerRanges.push({ start: rangeStart, end: samples.length - 1 });
    }
  }

  let cursor = 0;
  let vertexCount = 0;
  const drawRanges: PathDrawRange[] = [];

  for (const range of centerRanges) {
    const firstVertex = vertexCount;
    for (let index = range.start; index <= range.end; index++) {
      const current = samples[index];
      if (!current) continue;
      let incoming = pathScreenDirection(
        samples,
        index,
        -1,
        closed,
        width,
        height,
        range.start,
        range.end,
      );
      let outgoing = pathScreenDirection(
        samples,
        index,
        1,
        closed,
        width,
        height,
        range.start,
        range.end,
      );
      if (!incoming && outgoing) incoming = outgoing;
      if (!outgoing && incoming) outgoing = incoming;
      incoming ??= { x: 1, y: 0 };
      outgoing ??= incoming;

      const incomingNormal = { x: -incoming.y, y: incoming.x };
      const outgoingNormal = { x: -outgoing.y, y: outgoing.x };
      const tangentDot = incoming.x * outgoing.x + incoming.y * outgoing.y;
      let miterX = incomingNormal.x + outgoingNormal.x;
      let miterY = incomingNormal.y + outgoingNormal.y;
      const miterLength = Math.hypot(miterX, miterY);
      if (miterLength <= 0.0001 || tangentDot < -0.85) {
        miterX = outgoingNormal.x;
        miterY = outgoingNormal.y;
      } else {
        miterX /= miterLength;
        miterY /= miterLength;
      }
      const denominator = Math.max(
        Math.abs(miterX * outgoingNormal.x + miterY * outgoingNormal.y),
        0.42,
      );
      const miterScale = Math.min(1 / denominator, 2.15);
      const offsetX = miterX * miterScale;
      const offsetY = miterY * miterScale;
      const traversed = cumulativeLength[index] ?? 0;
      const endpointWeight = closed
        ? 1
        : smoothEndpoint(traversed) *
          smoothEndpoint(totalScreenLength - traversed);

      if (cursor + HERO_PATH_VERTEX_STRIDE * 2 > target.length) break;
      for (const side of [-1, 1] as const) {
        target[cursor++] = current.x;
        target[cursor++] = current.y;
        target[cursor++] = offsetX;
        target[cursor++] = offsetY;
        target[cursor++] = current.progress;
        target[cursor++] = side;
        target[cursor++] = endpointWeight;
        vertexCount += 1;
      }
    }
    const count = vertexCount - firstVertex;
    if (count >= 4) drawRanges.push({ first: firstVertex, count });
  }

  return {
    floatCount: cursor,
    vertexCount,
    drawRanges,
  };
}

function buildHueMatrix(angle: number, target: Float32Array) {
  const axis = 1 / Math.sqrt(3);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const common = (1 - cosine) * axis * axis;
  target[0] = cosine + common;
  target[1] = common + axis * sine;
  target[2] = common - axis * sine;
  target[3] = common - axis * sine;
  target[4] = cosine + common;
  target[5] = common + axis * sine;
  target[6] = common + axis * sine;
  target[7] = common - axis * sine;
  target[8] = cosine + common;
}

const FULLSCREEN_VERTEX_SHADER = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const COMMON_SEGMENT_GLSL = `
uniform float uTime;
uniform float uCurveTravel;
uniform float uEnvelopeStationary;
uniform float uStationaryCenter;
uniform float uSegmentLength;
uniform float uTailTaper;
uniform float uHeadTaper;

float segmentCenter(float time) {
  float length = max(uSegmentLength, 0.05);
  float outsidePadding = 0.06;
  float firstCenter = -0.5 * length - outsidePadding;
  float cycleLength = 1.0 + length + 2.0 * outsidePadding;
  float centeredOffset = 0.5 - firstCenter;
  float travelingCenter = firstCenter + mod(
    time * uCurveTravel + centeredOffset,
    cycleLength
  );
  return mix(
    travelingCenter,
    uStationaryCenter,
    step(0.5, uEnvelopeStationary)
  );
}

float segmentPositionForValue(float value, float time) {
  float length = max(uSegmentLength, 0.05);
  return (value - (segmentCenter(time) - 0.5 * length)) / length;
}

float segmentEnvelope(float position) {
  float tail = smoothstep(0.0, max(uTailTaper, 0.001), position);
  float head = 1.0 - smoothstep(
    1.0 - max(uHeadTaper, 0.001),
    1.0,
    position
  );
  return tail * head;
}
`;

const COMMON_GLOW_GLSL = `
uniform sampler2D uPalette;
uniform sampler2D uGlowProfile0;
uniform sampler2D uGlowProfile1;
uniform mat3 uHueMatrix;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;
uniform float uPaletteOffset;

const float GLOW_PROFILE_MAX_DISTANCE = ${HERO_GLOW_PROFILE_MAX_DISTANCE.toFixed(8)};
const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 spatialPalette(float position) {
  float palettePosition = mix(
    0.5 * PALETTE_TEXEL,
    0.5 - 0.5 * PALETTE_TEXEL,
    clamp(position, 0.0, 1.0)
  );
  if (abs(uPaletteOffset) > 0.000001) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      fract(position - uPaletteOffset)
    );
  }
  return texture2D(
    uPalette,
    vec2(palettePosition, 0.5)
  ).rgb;
}

vec3 filamentContribution(
  float normalizedDistance,
  float sideDirection,
  float position,
  float segmentAlpha,
  out float reflectionEnergy,
  out vec3 reflectionColor
) {
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, normalizedDistance);
  float directionalSpread = mix(
    max(uLowerGlowSpread, 0.05),
    max(uUpperGlowSpread, 0.05),
    upperSide
  );
  float profileDistance = abs(normalizedDistance)
    / directionalSpread
    / max(uBandSpread, 0.10);
  vec3 waveColor = spatialPalette(position);
  vec3 paleColor = mix(waveColor, vec3(0.90, 1.0, 0.98), 0.18);
  reflectionColor = mix(waveColor, paleColor, 0.28);

  // Outside the visible profile (or outside the finite segment), preserve the
  // subtle palette tint of the dots but skip all glow texture fetches/math.
  if (
    segmentAlpha <= 0.000001 ||
    profileDistance >= GLOW_PROFILE_MAX_DISTANCE
  ) {
    reflectionEnergy = 0.0;
    return vec3(0.0);
  }

  float profileU = profileDistance / GLOW_PROFILE_MAX_DISTANCE;
  vec4 profile0 = texture2D(uGlowProfile0, vec2(profileU, 0.5));
  vec4 profile1 = texture2D(uGlowProfile1, vec2(profileU, 0.5));
  profile0 *= profile0;
  profile1 *= profile1;

  float atmosphere = profile0.r;
  float broad = profile0.g;
  float body = profile0.b;
  float ridge = profile0.a;
  float core = profile1.r;
  float veil = profile1.g;
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);
  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, normalizedDistance);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, normalizedDistance);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;
  vec3 wave = (
      waveColor * atmosphere * 0.06 * outerBloom
      + waveColor * broad * 0.24 * outerBloom
      + waveColor * body * 0.30 * bodyBloom
      + paleColor * ridge * 0.46
      + coreColor * core * 0.28
      + waveColor * veil * 0.04
    ) * uBrightness * longitudinal * segmentAlpha;
  wave = uHueMatrix * wave;

  float waveLuminance = dot(wave, LUMA);
  float saturationBase = 1.0 - core;
  float saturationBoost = 1.0 + 0.45 * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), wave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  reflectionEnergy = profile1.b * segmentAlpha;
  return saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
}
`;

const COMMON_DOTS_GLSL = `
uniform vec2 uRes;
uniform sampler2D uDotMask;
uniform float uSpacing;
uniform float uDotR;
uniform float uDotAlpha;
uniform float uTwinkle;
uniform float uReflect;
uniform float uNoisePhase;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec3 composeDots(
  vec2 fragmentCoordinate,
  vec2 uv,
  float reflectionEnergy,
  vec3 reflectionColor
) {
  vec2 grid = fragmentCoordinate / uSpacing;
  vec2 cellId = floor(grid);
  vec2 cellPosition = (fract(grid) - 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2)) + random1 * 6.2831
  );
  pulse *= pulse;
  float dotScale = 1.0 + 0.5 * uTwinkle * pulse;
  float dotAmplitude = mix(0.55, 0.35 + 0.65 * pulse, uTwinkle);
  float sigma = max(uDotR * dotScale, 0.0001);
  float dotSignal = exp(-radiusSquared / (2.0 * sigma * sigma))
    * dotAmplitude;
  float dotMask = texture2D(uDotMask, uv).r;
  float reflected = clamp(reflectionEnergy * uReflect, 0.0, 1.0);
  vec3 dotColor = mix(
    vec3(0.62, 0.66, 0.72),
    reflectionColor,
    0.10 + 0.85 * reflected
  );
  float dotLuminance = uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  return dotColor * dotSignal * dotLuminance;
}

vec3 baseBackground(vec2 uv) {
  return mix(vec3(0.008, 0.011, 0.016), vec3(0.016, 0.021, 0.030), uv.y);
}

float displayNoise(vec2 fragmentCoordinate) {
  return (hash21(fragmentCoordinate + uNoisePhase) - 0.5) / 255.0 * 2.0;
}
`;

const SINE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

${COMMON_SEGMENT_GLSL}
${COMMON_GLOW_GLSL}
${COMMON_DOTS_GLSL}

uniform float uBandHeight;
uniform float uCurveStrength;
uniform float uCurveScale;
uniform float uCurveFrequency;
uniform float uCurveMotion;
uniform float uGeometryAdvanceRatio;

const float TAU = 6.28318530718;

vec2 movingCurveAndSlope(float x, float time) {
  float frequency = max(uCurveFrequency, 0.05);
  float morphAmount = clamp(uCurveMotion, 0.0, 1.0);
  float advance = time * uCurveTravel * uGeometryAdvanceRatio;
  float pathX = x - advance * (0.12 + 0.10 * morphAmount);

  float bendArgument = TAU * (frequency * 0.42 * pathX + 0.27)
    + advance * 0.875;
  float bendSin = sin(bendArgument);
  float bendCos = cos(bendArgument);
  float phase = frequency * pathX - 0.03
    + bendSin * 0.065 * morphAmount;
  float phaseDerivative = frequency
    + bendCos * TAU * frequency * 0.42 * 0.065 * morphAmount;
  float phaseArgument = TAU * phase;
  float phaseSin = sin(phaseArgument);
  float phaseCos = cos(phaseArgument);

  float swellArgument = TAU * (frequency * 0.28 * pathX - 0.12)
    - advance * 1.125;
  float swellSin = sin(swellArgument);
  float swellCos = cos(swellArgument);
  float swell = 1.0 + 0.08 * morphAmount * swellSin;
  float swellDerivative = 0.08 * morphAmount * swellCos
    * TAU * frequency * 0.28;
  float sineShape = phaseSin * swell;
  float shapeDerivative = phaseCos * TAU * phaseDerivative * swell
    + phaseSin * swellDerivative;
  float verticalDrift = sin(advance * 1.125) * 0.025 * uCurveMotion;
  float scaledAmplitude = 0.38 * uCurveScale;
  float center = uBandHeight
    + uCurveStrength * (sineShape * scaledAmplitude + verticalDrift);
  float slope = uCurveStrength * shapeDerivative * scaledAmplitude;
  return vec2(center, slope);
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;
  float position = segmentPositionForValue(uv.x, uTime);
  float segmentAlpha = pow(segmentEnvelope(position), 0.55);
  float taperWidth = mix(0.025, 1.0, segmentAlpha);
  vec2 curve = movingCurveAndSlope(uv.x, uTime);
  float aspect = uRes.x / max(uRes.y, 1.0);
  float slopeInHeightSpace = curve.y / max(aspect, 0.0001);
  float signedDistance = (uv.y - curve.x)
    / sqrt(1.0 + slopeInHeightSpace * slopeInHeightSpace);
  float side = signedDistance >= 0.0 ? 1.0 : -1.0;

  float reflectionEnergy;
  vec3 reflectionColor;
  vec3 wave = filamentContribution(
    abs(signedDistance) / taperWidth,
    side,
    position,
    segmentAlpha,
    reflectionEnergy,
    reflectionColor
  );
  vec3 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  vec3 color = baseBackground(uv) + wave + dots;
  color += displayNoise(fragmentCoordinate);
  gl_FragColor = vec4(color, 1.0);
}
`;

const PATH_STROKE_VERTEX_SHADER = `
precision highp float;

attribute vec2 aCenter;
attribute vec2 aOffsetNormal;
attribute float aProgress;
attribute float aSide;
attribute float aEndpointWeight;

uniform vec2 uTargetResolution;
uniform float uStrokeHalfWidthPx;
uniform float uPathClosed;
uniform float uClosedLoopTaper;

${COMMON_SEGMENT_GLSL}

varying __PRECISION__ float vAcross;
varying __PRECISION__ float vWeight;
varying __PRECISION__ float vPosition;
varying __PRECISION__ vec2 vNormal;

float pathSegmentPosition(float progress, float time) {
  if (uPathClosed < 0.5) {
    return segmentPositionForValue(progress, time);
  }
  float length = min(max(uSegmentLength, 0.05), 0.98);
  float travelingCenter = fract(time * uCurveTravel + 0.5);
  float center = mix(
    travelingCenter,
    uStationaryCenter,
    step(0.5, uEnvelopeStationary)
  );
  float delta = mod(progress - center + 0.5, 1.0) - 0.5;
  return delta / length + 0.5;
}

void main() {
  float fullClosedLoop = step(0.5, uPathClosed)
    * (1.0 - step(0.5, uClosedLoopTaper));
  float position = mix(
    pathSegmentPosition(aProgress, uTime),
    aProgress,
    fullClosedLoop
  );
  float segmentAlpha = mix(
    pow(segmentEnvelope(position), 0.55),
    1.0,
    fullClosedLoop
  );
  float taperWidth = mix(0.04, 1.0, segmentAlpha);
  float halfWidth = max(0.35, uStrokeHalfWidthPx * taperWidth);
  vec2 offset = aOffsetNormal * aSide * halfWidth / uTargetResolution;
  gl_Position = vec4((aCenter + offset) * 2.0 - 1.0, 0.0, 1.0);

  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  vAcross = aSide;
  vWeight = segmentAlpha * longitudinal * aEndpointWeight;
  vPosition = position;
  vNormal = normalize(aOffsetNormal);
}
`;

const PATH_SEED_FRAGMENT_SHADER = `
precision __PRECISION__ float;

varying __PRECISION__ float vAcross;
varying __PRECISION__ float vWeight;
varying __PRECISION__ float vPosition;
varying __PRECISION__ vec2 vNormal;

uniform sampler2D uPalette;
uniform float uPaletteOffset;
uniform float uSeedMode;

const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const float SEED_WEIGHT = ${HERO_PATH_SEED_WEIGHT.toFixed(8)};

vec3 spatialPalette(float position) {
  float palettePosition = mix(
    0.5 * PALETTE_TEXEL,
    0.5 - 0.5 * PALETTE_TEXEL,
    clamp(position, 0.0, 1.0)
  );
  if (abs(uPaletteOffset) > 0.000001) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      fract(position - uPaletteOffset)
    );
  }
  return texture2D(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void main() {
  float edge = 1.0 - smoothstep(0.66, 1.0, abs(vAcross));
  float weight = max(vWeight, 0.0) * edge * SEED_WEIGHT;
  if (uSeedMode < 0.5) {
    vec3 color = spatialPalette(vPosition);
    gl_FragColor = vec4(color * weight, weight);
  } else {
    vec2 encodedNormal = normalize(vNormal) * 0.5 + 0.5;
    gl_FragColor = vec4(
      encodedNormal * weight,
      (vAcross * 0.5 + 0.5) * weight,
      weight
    );
  }
}
`;

const PATH_DOWNSAMPLE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

uniform sampler2D uSource;
uniform vec2 uSourceTexel;
uniform vec2 uTargetResolution;
uniform float uOffset;
uniform float uGain;

void main() {
  vec2 uv = gl_FragCoord.xy / uTargetResolution;
  vec2 delta = uSourceTexel * uOffset;
  vec4 sum = texture2D(uSource, uv) * 4.0;
  sum += texture2D(uSource, uv + vec2(delta.x, 0.0)) * 2.0;
  sum += texture2D(uSource, uv - vec2(delta.x, 0.0)) * 2.0;
  sum += texture2D(uSource, uv + vec2(0.0, delta.y)) * 2.0;
  sum += texture2D(uSource, uv - vec2(0.0, delta.y)) * 2.0;
  sum += texture2D(uSource, uv + delta);
  sum += texture2D(uSource, uv - delta);
  sum += texture2D(uSource, uv + vec2(delta.x, -delta.y));
  sum += texture2D(uSource, uv + vec2(-delta.x, delta.y));
  gl_FragColor = sum * (uGain / 16.0);
}
`;

const PATH_COMPOSITE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

uniform float uTime;
${COMMON_DOTS_GLSL}

uniform sampler2D uColor1;
uniform sampler2D uColor2;
uniform sampler2D uColor3;
uniform sampler2D uColor4;
uniform sampler2D uColor5;
uniform sampler2D uColorBroad;
uniform sampler2D uNormalField;
uniform vec2 uNormalFieldTexel;
uniform mat3 uHueMatrix;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec4 pyramidSample(
  float level,
  vec4 level0,
  vec4 level1,
  vec4 level2,
  vec4 level3,
  vec4 level4,
  vec4 level5
) {
  float clampedLevel = clamp(level, 0.0, 5.0);
  if (clampedLevel < 1.0) return mix(level0, level1, clampedLevel);
  if (clampedLevel < 2.0) {
    return mix(level1, level2, clampedLevel - 1.0);
  }
  if (clampedLevel < 3.0) {
    return mix(level2, level3, clampedLevel - 2.0);
  }
  if (clampedLevel < 4.0) {
    return mix(level3, level4, clampedLevel - 3.0);
  }
  return mix(level4, level5, clampedLevel - 4.0);
}

vec3 unpremultipliedColor(vec4 sampleValue, vec3 fallback) {
  float usable = smoothstep(0.0002, 0.003, sampleValue.a);
  vec3 decoded = clamp(
    sampleValue.rgb / max(sampleValue.a, 0.0001),
    0.0,
    1.0
  );
  return mix(fallback, decoded, usable);
}

float softEnergy(float value) {
  float positive = max(value, 0.0);
  return positive / (1.0 + 0.28 * positive);
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;

  vec4 level0 = texture2D(uColor1, uv) * 5.2167;
  vec4 level1 = texture2D(uColor2, uv) * 4.5945;
  vec4 level2 = texture2D(uColor3, uv) * 4.2352;
  vec4 level3 = texture2D(uColor4, uv) * 4.0732;
  vec4 level4 = texture2D(uColor5, uv) * 5.3616;
  vec4 level5 = texture2D(uColorBroad, uv) * 11.2080;

  vec4 normalMoment = texture2D(uNormalField, uv);
  float sideDirection = 0.0;
  if (normalMoment.a > 0.0001) {
    vec2 decodedNormal = normalMoment.rg / normalMoment.a * 2.0 - 1.0;
    float normalConfidence = clamp(length(decodedNormal), 0.0, 1.0);
    vec2 localNormal = decodedNormal / max(length(decodedNormal), 0.0001);
    vec2 probeOffset = localNormal * uNormalFieldTexel * 0.85;
    float positiveEnergy = texture2D(
      uNormalField,
      clamp(uv + probeOffset, vec2(0.0), vec2(1.0))
    ).a;
    float negativeEnergy = texture2D(
      uNormalField,
      clamp(uv - probeOffset, vec2(0.0), vec2(1.0))
    ).a;
    float gradientEvidence = (negativeEnergy - positiveEnergy)
      / max(negativeEnergy + positiveEnergy, 0.0001);
    float momentEvidence = normalMoment.b / normalMoment.a * 2.0 - 1.0;
    float signedEvidence = mix(
      momentEvidence * 3.2,
      gradientEvidence * 2.4,
      smoothstep(0.04, 0.22, abs(gradientEvidence))
    );
    float fieldConfidence = smoothstep(0.0015, 0.045, normalMoment.a);
    sideDirection = clamp(signedEvidence, -1.0, 1.0)
      * normalConfidence * fieldConfidence;
  }

  float upperSide = 0.5 + 0.5 * sideDirection;
  float directionalSpread = mix(
    max(uLowerGlowSpread, 0.05),
    max(uUpperGlowSpread, 0.05),
    upperSide
  );
  float spread = clamp(
    max(uBandSpread, 0.10) * directionalSpread,
    0.25,
    4.0
  );
  float levelShift = log2(spread);

  vec4 ridgeSample = pyramidSample(
    1.25 + levelShift * 0.55,
    level0,
    level1,
    level2,
    level3,
    level4,
    level5
  );
  vec4 veilSample = pyramidSample(
    2.35 + levelShift * 0.75,
    level0,
    level1,
    level2,
    level3,
    level4,
    level5
  );
  vec4 bodySample = pyramidSample(
    3.15 + levelShift,
    level0,
    level1,
    level2,
    level3,
    level4,
    level5
  );
  vec4 broadSample = pyramidSample(
    4.15 + levelShift * 0.82,
    level0,
    level1,
    level2,
    level3,
    level4,
    level5
  );
  vec4 atmosphereSample = pyramidSample(
    4.92 + levelShift * 0.35,
    level0,
    level1,
    level2,
    level3,
    level4,
    level5
  );

  vec3 atmosphereColor = unpremultipliedColor(
    atmosphereSample,
    vec3(0.30, 0.82, 0.90)
  );
  vec3 broadColor = unpremultipliedColor(
    broadSample,
    atmosphereColor
  );
  vec3 bodyColor = unpremultipliedColor(bodySample, broadColor);
  vec3 ridgeColor = unpremultipliedColor(ridgeSample, bodyColor);
  vec3 veilColor = unpremultipliedColor(veilSample, bodyColor);

  float atmosphere = softEnergy(atmosphereSample.a);
  float broad = softEnergy(broadSample.a);
  float body = softEnergy(bodySample.a);
  float ridge = softEnergy(ridgeSample.a);
  float veil = softEnergy(veilSample.a);

  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerBloom = 0.72 + 0.44 * glowBias * sideDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * sideDirection;
  vec3 paleBody = mix(bodyColor, vec3(0.90, 1.0, 0.98), 0.15);
  vec3 paleRidge = mix(ridgeColor, vec3(0.92, 1.0, 0.99), 0.22);

  vec3 wave = (
      atmosphereColor * atmosphere * 0.055 * outerBloom
      + broadColor * broad * 0.225 * outerBloom
      + paleBody * body * 0.30 * bodyBloom
      + veilColor * veil * 0.05
      + paleRidge * ridge * 0.18
    ) * uBrightness;
  wave = uHueMatrix * wave;

  float waveLuminance = dot(wave, LUMA);
  float saturationBoost = 1.0 + 0.38 * (1.0 - ridge) * (1.0 - ridge);
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), wave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  wave = saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);

  float reflectionEnergy = clamp(
    broad * 0.36 + body * 0.54 + ridge * 0.34,
    0.0,
    1.0
  );
  vec3 reflectionColor = mix(broadColor, bodyColor, 0.62);
  vec3 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  vec3 color = baseBackground(uv) + wave + dots;
  color += displayNoise(fragmentCoordinate);
  gl_FragColor = vec4(color, 1.0);
}
`;

const PATH_CORE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

varying __PRECISION__ float vAcross;
varying __PRECISION__ float vWeight;
varying __PRECISION__ float vPosition;

uniform sampler2D uPalette;
uniform float uPaletteOffset;
uniform mat3 uHueMatrix;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;
uniform float uCoreWidthScale;

const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 spatialPalette(float position) {
  float palettePosition = mix(
    0.5 * PALETTE_TEXEL,
    0.5 - 0.5 * PALETTE_TEXEL,
    clamp(position, 0.0, 1.0)
  );
  if (abs(uPaletteOffset) > 0.000001) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      fract(position - uPaletteOffset)
    );
  }
  return texture2D(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void main() {
  float sideDirection = clamp(vAcross * 1.7, -1.0, 1.0);
  float upperSide = 0.5 + 0.5 * sideDirection;
  float directionalSpread = mix(
    max(uLowerGlowSpread, 0.05),
    max(uUpperGlowSpread, 0.05),
    upperSide
  );
  float relativeSpread = clamp(
    sqrt(max(uBandSpread * directionalSpread, 0.05))
      / max(uCoreWidthScale, 0.1),
    0.24,
    1.20
  );
  float profileDistance = abs(vAcross) / relativeSpread;
  float edge = 1.0 - smoothstep(0.78, 1.0, abs(vAcross));
  float ridge = exp(-profileDistance * 4.4);
  float veil = exp(-profileDistance * 8.0);
  float core = exp(-profileDistance * 17.0);

  vec3 waveColor = spatialPalette(vPosition);
  vec3 paleColor = mix(waveColor, vec3(0.90, 1.0, 0.98), 0.20);
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.06);
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float sideBloom = 0.90 + 0.30 * glowBias * sideDirection;
  vec3 wave = (
      waveColor * veil * 0.07
      + paleColor * ridge * 0.44 * sideBloom
      + coreColor * core * 0.31
    ) * uBrightness * vWeight * edge;
  wave = uHueMatrix * wave;

  float luminance = dot(wave, LUMA);
  float saturationBoost = 1.0 + 0.30 * (1.0 - core) * (1.0 - core);
  vec3 saturated = max(
    vec3(0.0),
    mix(vec3(luminance), wave, saturationBoost)
  );
  float saturatedLuminance = dot(saturated, LUMA);
  wave = saturated * luminance / max(saturatedLuminance, 0.0001);
  gl_FragColor = vec4(clamp(wave, 0.0, 1.0), 1.0);
}
`;

interface ProgramBundle {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface PathResources {
  seedProgram: ProgramBundle;
  downsampleProgram: ProgramBundle;
  compositeProgram: ProgramBundle;
  coreProgram: ProgramBundle;
  pathBuffer: WebGLBuffer;
  framebuffer: WebGLFramebuffer;
  colorTextures: WebGLTexture[];
  normalTextures: WebGLTexture[];
  broadTextures: [WebGLTexture, WebGLTexture];
  levelWidths: number[];
  levelHeights: number[];
  broadFinalTexture: WebGLTexture;
  staticSettingsRevision: number;
  staticSizeRevision: number;
  pathVertexCount: number;
  pathDrawRanges: PathDrawRange[];
}

const SINE_UNIFORMS = [
  "uRes",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPalette",
  "uGlowProfile0",
  "uGlowProfile1",
  "uHueMatrix",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uPaletteOffset",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uBandHeight",
  "uCurveStrength",
  "uCurveScale",
  "uCurveFrequency",
  "uCurveMotion",
  "uGeometryAdvanceRatio",
] as const;

const PATH_STROKE_UNIFORMS = [
  "uTargetResolution",
  "uStrokeHalfWidthPx",
  "uPathClosed",
  "uClosedLoopTaper",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPalette",
  "uPaletteOffset",
  "uSeedMode",
] as const;

const PATH_CORE_UNIFORMS = [
  "uTargetResolution",
  "uStrokeHalfWidthPx",
  "uPathClosed",
  "uClosedLoopTaper",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPalette",
  "uPaletteOffset",
  "uHueMatrix",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uCoreWidthScale",
] as const;

const PATH_DOWNSAMPLE_UNIFORMS = [
  "uSource",
  "uSourceTexel",
  "uTargetResolution",
  "uOffset",
  "uGain",
] as const;

const PATH_COMPOSITE_UNIFORMS = [
  "uRes",
  "uTime",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uColor1",
  "uColor2",
  "uColor3",
  "uColor4",
  "uColor5",
  "uColorBroad",
  "uNormalField",
  "uNormalFieldTexel",
  "uHueMatrix",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
] as const;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgramBundle(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributeNames: readonly string[],
  uniformNames: readonly string[],
): ProgramBundle {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error("Unable to allocate a WebGL program.");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  const attributes: Record<string, number> = {};
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of attributeNames) {
    attributes[name] = gl.getAttribLocation(program, name);
  }
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, attributes, uniforms };
}

function createTexture(
  gl: WebGLRenderingContext,
  unit: number,
  minFilter: number,
  magFilter: number,
) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to allocate a WebGL texture.");
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function uniform1f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1f(bundle.uniforms[name] ?? null, value);
}

function uniform1i(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  value: number,
) {
  gl.uniform1i(bundle.uniforms[name] ?? null, value);
}

function uniform2f(
  gl: WebGLRenderingContext,
  bundle: ProgramBundle,
  name: string,
  x: number,
  y: number,
) {
  gl.uniform2f(bundle.uniforms[name] ?? null, x, y);
}

function createFollowAnchors(count: number): FollowAnchor[] {
  return Array.from({ length: count }, () => ({ x: 0.5, top: 0.5 }));
}

function echoFollowLifetimeSeconds(settings: Settings) {
  return 0.28 + settings.followLag * 1.42;
}

export function HeroWaveBackground({
  className,
  onCycleComplete,
  onFrame,
  ...inputSettings
}: HeroWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCycleCompleteRef = useRef(onCycleComplete);
  onCycleCompleteRef.current = onCycleComplete;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const invalidateRef = useRef<() => void>(() => undefined);
  const settingsRevisionRef = useRef(0);
  const settingsRef = useRef<Settings>(resolveSettings(inputSettings));
  const [contextEpoch, setContextEpoch] = useState(0);
  const resolvedSettings = resolveSettings(inputSettings);
  settingsRef.current = resolvedSettings;
  settingsRevisionRef.current += 1;
  const fadeInDuration = resolvedSettings.fadeInDuration;

  useEffect(() => {
    invalidateRef.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    delete canvas.dataset.ready;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;
    const activateProgram = gl.useProgram.bind(gl);

    const precisionInfo = gl.getShaderPrecisionFormat(
      gl.FRAGMENT_SHADER,
      gl.HIGH_FLOAT,
    );
    const precision =
      precisionInfo && precisionInfo.precision > 0 ? "highp" : "mediump";
    const withPrecision = (source: string) =>
      source.split("__PRECISION__").join(precision);

    let sineProgram: ProgramBundle;
    try {
      sineProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(SINE_FRAGMENT_SHADER),
        ["aPos"],
        SINE_UNIFORMS,
      );
    } catch (error) {
      console.error("HeroWaveBackground sine shader:", error);
      return;
    }

    const fullscreenBuffer = gl.createBuffer();
    if (!fullscreenBuffer) {
      gl.deleteProgram(sineProgram.program);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    let paletteTexture: WebGLTexture;
    let glowTexture0: WebGLTexture;
    let glowTexture1: WebGLTexture;
    let maskTexture: WebGLTexture;
    try {
      paletteTexture = createTexture(gl, 0, gl.LINEAR, gl.LINEAR);
      glowTexture0 = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
      glowTexture1 = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
      maskTexture = createTexture(gl, 3, gl.LINEAR, gl.LINEAR);
    } catch (error) {
      console.error("HeroWaveBackground textures:", error);
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      return;
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const glowProfiles = buildGlowProfileTextureData();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      HERO_GLOW_TEXTURE_WIDTH,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      glowProfiles.profile0,
    );
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      HERO_GLOW_TEXTURE_WIDTH,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      glowProfiles.profile1,
    );

    let pathResources: PathResources | null | undefined;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let dpr = 1;
    let sizeRevision = 0;
    let sineStaticSettingsRevision = -1;
    let sineStaticSizeRevision = -1;
    let paletteHash = -1;
    let maskHash = -1;
    let maskSizeRevision = -1;
    let pathMeshKey = -1;
    let basePathKey = -1;
    let pathMeshIsDynamic = false;
    let basePathSamples: CurveSample[] = [];
    const propagatedPathSamples: CurveSample[] = [];
    const pathVertexData = new Float32Array(
      HERO_MAX_PATH_SAMPLES *
        HERO_PATH_VERTEX_CAPACITY_FACTOR *
        2 *
        HERO_PATH_VERTEX_STRIDE,
    );
    const hueMatrix = new Float32Array(9);

    const attachPathTarget = (
      resources: PathResources,
      texture: WebGLTexture,
      width: number,
      height: number,
    ) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      gl.viewport(0, 0, width, height);
    };

    const allocatePathTargets = (resources: PathResources) => {
      const levelWidths: number[] = [];
      const levelHeights: number[] = [];
      let width = Math.max(1, Math.round(canvasWidth * HERO_PATH_SEED_SCALE));
      let height = Math.max(1, Math.round(canvasHeight * HERO_PATH_SEED_SCALE));
      for (let level = 0; level < HERO_PATH_PYRAMID_LEVELS; level++) {
        levelWidths.push(width);
        levelHeights.push(height);
        width = Math.max(1, Math.ceil(width / 2));
        height = Math.max(1, Math.ceil(height / 2));
      }

      const unchanged =
        resources.levelWidths.length === levelWidths.length &&
        levelWidths.every(
          (value, index) =>
            value === resources.levelWidths[index] &&
            levelHeights[index] === resources.levelHeights[index],
        );
      if (unchanged) return;

      const allocateTexture = (
        texture: WebGLTexture,
        textureWidth: number,
        textureHeight: number,
      ) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          textureWidth,
          textureHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        attachPathTarget(resources, texture, textureWidth, textureHeight);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error(`Incomplete WebGL framebuffer: ${status}`);
        }
      };

      for (let level = 0; level < HERO_PATH_PYRAMID_LEVELS; level++) {
        allocateTexture(
          resources.colorTextures[level]!,
          levelWidths[level]!,
          levelHeights[level]!,
        );
        allocateTexture(
          resources.normalTextures[level]!,
          levelWidths[level]!,
          levelHeights[level]!,
        );
      }
      const broadWidth = levelWidths[HERO_PATH_PYRAMID_LEVELS - 1]!;
      const broadHeight = levelHeights[HERO_PATH_PYRAMID_LEVELS - 1]!;
      allocateTexture(resources.broadTextures[0], broadWidth, broadHeight);
      allocateTexture(resources.broadTextures[1], broadWidth, broadHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      resources.levelWidths = levelWidths;
      resources.levelHeights = levelHeights;
      resources.broadFinalTexture = resources.broadTextures[0];
      resources.staticSizeRevision = -1;
    };

    const destroyPathResources = (resources: PathResources | null) => {
      if (!resources) return;
      gl.deleteProgram(resources.seedProgram.program);
      gl.deleteProgram(resources.downsampleProgram.program);
      gl.deleteProgram(resources.compositeProgram.program);
      gl.deleteProgram(resources.coreProgram.program);
      gl.deleteBuffer(resources.pathBuffer);
      gl.deleteFramebuffer(resources.framebuffer);
      for (const texture of resources.colorTextures) {
        gl.deleteTexture(texture);
      }
      for (const texture of resources.normalTextures) {
        gl.deleteTexture(texture);
      }
      gl.deleteTexture(resources.broadTextures[0]);
      gl.deleteTexture(resources.broadTextures[1]);
    };

    const ensurePathResources = () => {
      if (pathResources !== undefined) return pathResources;
      let seedProgram: ProgramBundle | null = null;
      let downsampleProgram: ProgramBundle | null = null;
      let compositeProgram: ProgramBundle | null = null;
      let coreProgram: ProgramBundle | null = null;
      let pathBuffer: WebGLBuffer | null = null;
      let framebuffer: WebGLFramebuffer | null = null;
      const colorTextures: WebGLTexture[] = [];
      const normalTextures: WebGLTexture[] = [];
      const broadTextures: WebGLTexture[] = [];

      try {
        const maximumTextureUnits = gl.getParameter(
          gl.MAX_TEXTURE_IMAGE_UNITS,
        ) as number;
        if (maximumTextureUnits < 8) {
          throw new Error(
            `The adaptive path renderer requires 8 fragment texture units; only ${maximumTextureUnits} are available.`,
          );
        }

        seedProgram = createProgramBundle(
          gl,
          withPrecision(PATH_STROKE_VERTEX_SHADER),
          withPrecision(PATH_SEED_FRAGMENT_SHADER),
          ["aCenter", "aOffsetNormal", "aProgress", "aSide", "aEndpointWeight"],
          PATH_STROKE_UNIFORMS,
        );
        downsampleProgram = createProgramBundle(
          gl,
          FULLSCREEN_VERTEX_SHADER,
          withPrecision(PATH_DOWNSAMPLE_FRAGMENT_SHADER),
          ["aPos"],
          PATH_DOWNSAMPLE_UNIFORMS,
        );
        compositeProgram = createProgramBundle(
          gl,
          FULLSCREEN_VERTEX_SHADER,
          withPrecision(PATH_COMPOSITE_FRAGMENT_SHADER),
          ["aPos"],
          PATH_COMPOSITE_UNIFORMS,
        );
        coreProgram = createProgramBundle(
          gl,
          withPrecision(PATH_STROKE_VERTEX_SHADER),
          withPrecision(PATH_CORE_FRAGMENT_SHADER),
          ["aCenter", "aOffsetNormal", "aProgress", "aSide", "aEndpointWeight"],
          PATH_CORE_UNIFORMS,
        );

        pathBuffer = gl.createBuffer();
        framebuffer = gl.createFramebuffer();
        if (!pathBuffer || !framebuffer) {
          throw new Error("Unable to allocate adaptive path WebGL resources.");
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, pathBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          HERO_MAX_PATH_SAMPLES *
            HERO_PATH_VERTEX_CAPACITY_FACTOR *
            2 *
            HERO_PATH_VERTEX_STRIDE *
            Float32Array.BYTES_PER_ELEMENT,
          gl.DYNAMIC_DRAW,
        );

        for (let level = 0; level < HERO_PATH_PYRAMID_LEVELS; level++) {
          colorTextures.push(createTexture(gl, 0, gl.LINEAR, gl.LINEAR));
          normalTextures.push(createTexture(gl, 0, gl.LINEAR, gl.LINEAR));
        }
        broadTextures.push(createTexture(gl, 0, gl.LINEAR, gl.LINEAR));
        broadTextures.push(createTexture(gl, 0, gl.LINEAR, gl.LINEAR));

        const resources: PathResources = {
          seedProgram,
          downsampleProgram,
          compositeProgram,
          coreProgram,
          pathBuffer,
          framebuffer,
          colorTextures,
          normalTextures,
          broadTextures: [broadTextures[0]!, broadTextures[1]!],
          levelWidths: [],
          levelHeights: [],
          broadFinalTexture: broadTextures[0]!,
          staticSettingsRevision: -1,
          staticSizeRevision: -1,
          pathVertexCount: 0,
          pathDrawRanges: [],
        };
        allocatePathTargets(resources);
        pathResources = resources;
      } catch (error) {
        console.error("HeroWaveBackground adaptive 2D path renderer:", error);
        if (seedProgram) gl.deleteProgram(seedProgram.program);
        if (downsampleProgram) gl.deleteProgram(downsampleProgram.program);
        if (compositeProgram) gl.deleteProgram(compositeProgram.program);
        if (coreProgram) gl.deleteProgram(coreProgram.program);
        if (pathBuffer) gl.deleteBuffer(pathBuffer);
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
        for (const texture of colorTextures) gl.deleteTexture(texture);
        for (const texture of normalTextures) gl.deleteTexture(texture);
        for (const texture of broadTextures) gl.deleteTexture(texture);
        pathResources = null;
      }
      return pathResources;
    };

    const resizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, HERO_MAX_DPR);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (width === canvasWidth && height === canvasHeight) return false;
      canvasWidth = width;
      canvasHeight = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      sizeRevision += 1;
      pathMeshKey = -1;
      basePathKey = -1;
      pathMeshIsDynamic = false;
      if (pathResources) allocatePathTargets(pathResources);
      return true;
    };

    resizeCanvas();

    let raf = 0;
    let revealRaf = 0;
    let revealTimer = 0;
    let frameScheduled = false;
    let running = true;
    let lastTimestamp: number | null = null;
    let motionTime = 0;
    let colorTime = 0;
    let huePhase = 0;
    let cycleKey = "";
    let cycleIndex: number | null = null;

    const completedCycleIndex = (settings: Settings) => {
      if (
        settings.motionMode !== "travel" ||
        settings.pathMode === "follow" ||
        settings.curveTravel <= 0
      ) {
        return null;
      }
      const phase = motionTime * settings.curveTravel;
      if (settings.pathMode !== "sine" && settings.trajectoryClosed) {
        return Math.floor(phase + 0.5);
      }
      const length = Math.max(settings.segmentLength, 0.05);
      const outsidePadding = 0.06;
      const firstCenter = -0.5 * length - outsidePadding;
      const centeredOffset = 0.5 - firstCenter;
      const cycleLength = 1 + length + 2 * outsidePadding;
      return Math.floor((phase + centeredOffset) / cycleLength);
    };

    const notifyCompletedCycle = (settings: Settings) => {
      const nextCycleKey = `${settings.motionMode}:${settings.pathMode}:${settings.trajectoryClosed}:${settings.segmentLength}:${settings.curveTravel}`;
      const nextCycleIndex = completedCycleIndex(settings);
      if (nextCycleKey !== cycleKey) {
        cycleKey = nextCycleKey;
        cycleIndex = nextCycleIndex;
        return;
      }
      if (
        nextCycleIndex !== null &&
        cycleIndex !== null &&
        nextCycleIndex !== cycleIndex
      ) {
        cycleIndex = nextCycleIndex;
        onCycleCompleteRef.current?.();
        return;
      }
      cycleIndex = nextCycleIndex;
    };

    const requestFrame = () => {
      if (!running || frameScheduled || document.visibilityState === "hidden") {
        return;
      }
      frameScheduled = true;
      raf = requestAnimationFrame(loop);
    };
    invalidateRef.current = requestFrame;

    let canvasRect = canvas.getBoundingClientRect();
    let rectDirty = false;
    let resizePending = false;
    const resizeObserver = new ResizeObserver(() => {
      rectDirty = true;
      resizePending = true;
      requestFrame();
    });
    resizeObserver.observe(canvas);

    const markRectDirty = () => {
      rectDirty = true;
    };
    window.addEventListener("scroll", markRectDirty, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const followAnchors = createFollowAnchors(HERO_ECHO_FOLLOW_POINT_COUNT);
    const hybridAnchors = createFollowAnchors(HERO_FOLLOW_POINT_COUNT);
    const hybridExactAnchors = createFollowAnchors(HERO_FOLLOW_POINT_COUNT);
    const hybridRopeAnchors = createFollowAnchors(HERO_FOLLOW_POINT_COUNT);
    const hybridResampledRopeAnchors = createFollowAnchors(
      HERO_FOLLOW_POINT_COUNT,
    );
    const cascadeAnchors = createFollowAnchors(HERO_CASCADE_FOLLOW_POINT_COUNT);
    const followPathSamples: CurveSample[] = [];
    const pointerHistory: PointerTrailSample[] = [];
    const persistentPointerHistory: FollowAnchor[] = [];
    const persistentCumulative = new Float32Array(HERO_POINTER_HISTORY_LIMIT);
    const anchorCumulative = new Float32Array(
      Math.max(HERO_FOLLOW_POINT_COUNT, HERO_CASCADE_FOLLOW_POINT_COUNT),
    );
    let pointerX = 0.5;
    let pointerTop = 0.5;
    let pointerRevision = 0;
    let lastPersistentInputTime = Number.NEGATIVE_INFINITY;
    let hybridInitialized = false;
    let cascadeInitialized = false;

    const pointerEventTimeSeconds = (eventTime: number) => {
      const nowMilliseconds = performance.now();
      let candidate = eventTime;
      if (candidate > 1_000_000_000_000) {
        candidate -= performance.timeOrigin;
      }
      if (
        !Number.isFinite(candidate) ||
        Math.abs(candidate - nowMilliseconds) > 60_000
      ) {
        candidate = nowMilliseconds;
      }
      return candidate * 0.001;
    };

    const resetPointerHistory = (x: number, top: number, time: number) => {
      pointerHistory.length = 0;
      pointerHistory.push({ x, top, time });
      for (const anchor of followAnchors) {
        anchor.x = x;
        anchor.top = top;
      }
      pointerRevision += 1;
    };

    const appendPointerSample = (
      x: number,
      top: number,
      sampleTime: number,
      force = false,
    ) => {
      const latest = pointerHistory[pointerHistory.length - 1];
      if (!latest) {
        resetPointerHistory(x, top, sampleTime);
        return;
      }
      const time = Math.max(sampleTime, latest.time + 0.000001);
      const distanceCssPx = Math.hypot(
        (x - latest.x) * Math.max(canvasRect.width, 1),
        (top - latest.top) * Math.max(canvasRect.height, 1),
      );
      const elapsed = time - latest.time;
      if (
        !force &&
        distanceCssPx <= HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX &&
        elapsed <= HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS
      ) {
        latest.x = x;
        latest.top = top;
        latest.time = time;
      } else {
        pointerHistory.push({ x, top, time });
      }
      if (pointerHistory.length > HERO_POINTER_HISTORY_LIMIT) {
        pointerHistory.splice(
          0,
          pointerHistory.length - HERO_POINTER_HISTORY_LIMIT,
        );
      }
      pointerRevision += 1;
    };

    const appendPersistentPointerSample = (
      x: number,
      top: number,
      sampleTime: number,
    ) => {
      const latest =
        persistentPointerHistory[persistentPointerHistory.length - 1];
      const distanceCssPx = latest
        ? Math.hypot(
            (x - latest.x) * Math.max(canvasRect.width, 1),
            (top - latest.top) * Math.max(canvasRect.height, 1),
          )
        : Number.POSITIVE_INFINITY;
      if (latest && distanceCssPx <= HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX) {
        latest.x = x;
        latest.top = top;
      } else {
        persistentPointerHistory.push({ x, top });
      }

      let trailLength = 0;
      let keepFrom = persistentPointerHistory.length - 1;
      for (
        let index = persistentPointerHistory.length - 2;
        index >= 0;
        index--
      ) {
        const point = persistentPointerHistory[index];
        const next = persistentPointerHistory[index + 1];
        if (!point || !next) continue;
        trailLength += Math.hypot(next.x - point.x, next.top - point.top);
        keepFrom = index;
        if (trailLength >= 1.35) break;
      }
      if (keepFrom > 0) persistentPointerHistory.splice(0, keepFrom);
      if (persistentPointerHistory.length > HERO_POINTER_HISTORY_LIMIT) {
        persistentPointerHistory.splice(
          0,
          persistentPointerHistory.length - HERO_POINTER_HISTORY_LIMIT,
        );
      }
      lastPersistentInputTime = sampleTime;
      pointerRevision += 1;
    };

    const resampleAnchorPath = (
      source: readonly FollowAnchor[],
      target: FollowAnchor[],
      cumulative: Float32Array,
    ) => {
      const first = source[0];
      if (!first) {
        for (const anchor of target) {
          anchor.x = pointerX;
          anchor.top = pointerTop;
        }
        return 0;
      }
      cumulative[0] = 0;
      for (let index = 1; index < source.length; index++) {
        const point = source[index];
        const previous = source[index - 1];
        cumulative[index] =
          cumulative[index - 1]! +
          (point && previous
            ? Math.hypot(
                (point.x - previous.x) * canvasWidth,
                (point.top - previous.top) * canvasHeight,
              )
            : 0);
      }
      const totalLength = cumulative[source.length - 1] ?? 0;
      let sourceIndex = 1;
      for (let index = 0; index < target.length; index++) {
        const targetLength =
          totalLength * (index / Math.max(target.length - 1, 1));
        while (
          sourceIndex < source.length - 1 &&
          (cumulative[sourceIndex] ?? 0) < targetLength
        ) {
          sourceIndex += 1;
        }
        const beforeIndex = Math.max(0, sourceIndex - 1);
        const before = source[beforeIndex] ?? first;
        const after = source[sourceIndex] ?? before;
        const beforeLength = cumulative[beforeIndex] ?? 0;
        const afterLength = cumulative[sourceIndex] ?? beforeLength;
        const amount =
          afterLength > beforeLength
            ? (targetLength - beforeLength) / (afterLength - beforeLength)
            : 0;
        const anchor = target[index];
        if (!anchor) continue;
        anchor.x = before.x + (after.x - before.x) * amount;
        anchor.top = before.top + (after.top - before.top) * amount;
      }
      return totalLength;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (rectDirty) {
        canvasRect = canvas.getBoundingClientRect();
        rectDirty = false;
      }
      const settings = settingsRef.current;
      const coalescedEvents = event.getCoalescedEvents?.() ?? [];
      const samples = coalescedEvents.length > 0 ? coalescedEvents : [event];
      for (const sampleEvent of samples) {
        const x = clamp(
          (sampleEvent.clientX - canvasRect.left) /
            Math.max(canvasRect.width, 1),
          -HERO_FOLLOW_OVERSCAN,
          1 + HERO_FOLLOW_OVERSCAN,
        );
        const top = clamp(
          (sampleEvent.clientY - canvasRect.top) /
            Math.max(canvasRect.height, 1),
          -HERO_FOLLOW_OVERSCAN,
          1 + HERO_FOLLOW_OVERSCAN,
        );
        pointerX = x;
        pointerTop = top;
        if (settings.pathMode === "follow") {
          const sampleTime = pointerEventTimeSeconds(sampleEvent.timeStamp);
          if (settings.followMode === "echo") {
            appendPointerSample(x, top, sampleTime);
          } else if (settings.followMode === "hybrid") {
            appendPersistentPointerSample(x, top, sampleTime);
          } else {
            lastPersistentInputTime = sampleTime;
            pointerRevision += 1;
          }
        }
      }
      if (settings.pathMode === "follow") requestFrame();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const samplePointerHistory = (
      targetTime: number,
      now: number,
      startIndex: number,
    ) => {
      const first = pointerHistory[0] ?? {
        x: pointerX,
        top: pointerTop,
        time: now,
      };
      const last = pointerHistory[pointerHistory.length - 1] ?? first;
      if (targetTime <= first.time) {
        return { x: first.x, top: first.top, nextIndex: 1 };
      }
      if (targetTime >= last.time) {
        const amount = clamp(
          (targetTime - last.time) / Math.max(now - last.time, 0.000001),
          0,
          1,
        );
        return {
          x: last.x + (pointerX - last.x) * amount,
          top: last.top + (pointerTop - last.top) * amount,
          nextIndex: pointerHistory.length - 1,
        };
      }

      let historyIndex = Math.max(1, startIndex);
      while (
        historyIndex < pointerHistory.length - 1 &&
        pointerHistory[historyIndex]!.time < targetTime
      ) {
        historyIndex += 1;
      }
      const before = pointerHistory[Math.max(0, historyIndex - 1)] ?? first;
      const after = pointerHistory[historyIndex] ?? before;
      const amount = clamp(
        (targetTime - before.time) /
          Math.max(after.time - before.time, 0.000001),
        0,
        1,
      );
      return {
        x: before.x + (after.x - before.x) * amount,
        top: before.top + (after.top - before.top) * amount,
        nextIndex: historyIndex,
      };
    };

    const updateEchoFollowAnchors = (settings: Settings) => {
      const now = performance.now() * 0.001;
      if (pointerHistory.length === 0) {
        resetPointerHistory(pointerX, pointerTop, now);
      }

      const latest = pointerHistory[pointerHistory.length - 1];
      if (
        latest &&
        now - latest.time >= HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS
      ) {
        appendPointerSample(pointerX, pointerTop, now, true);
      }

      const lifetime = echoFollowLifetimeSeconds(settings);
      const cutoff = now - lifetime - HERO_FOLLOW_HISTORY_MARGIN_SECONDS;
      let removeCount = 0;
      while (
        removeCount + 1 < pointerHistory.length &&
        pointerHistory[removeCount + 1]!.time < cutoff
      ) {
        removeCount += 1;
      }
      if (removeCount > 0) pointerHistory.splice(0, removeCount);

      let historyIndex = 1;
      for (let index = 0; index < followAnchors.length; index++) {
        const headProgress = index / Math.max(followAnchors.length - 1, 1);
        const tailFraction = 1 - headProgress;
        const age = lifetime * tailFraction;
        const sampled = samplePointerHistory(now - age, now, historyIndex);
        historyIndex = sampled.nextIndex;
        const anchor = followAnchors[index]!;
        anchor.x = sampled.x;
        anchor.top = sampled.top;
      }

      const head = followAnchors[followAnchors.length - 1];
      if (head) {
        head.x = pointerX;
        head.top = pointerTop;
      }
      return followAnchors;
    };

    const updateHybridFollowAnchors = (
      settings: Settings,
      frameDelta: number,
    ) => {
      const exactLength = resampleAnchorPath(
        persistentPointerHistory,
        hybridExactAnchors,
        persistentCumulative,
      );
      if (!hybridInitialized) {
        for (let index = 0; index < hybridRopeAnchors.length; index++) {
          const source = hybridExactAnchors[index];
          const target = hybridRopeAnchors[index];
          if (!source || !target) continue;
          target.x = source.x;
          target.top = source.top;
        }
        hybridInitialized = true;
      }

      const head = hybridRopeAnchors[hybridRopeAnchors.length - 1];
      if (head) {
        head.x = pointerX;
        head.top = pointerTop;
      }
      const now = performance.now() * 0.001;
      if (now - lastPersistentInputTime < 0.08) {
        const delta = clamp(frameDelta || 1 / 60, 1 / 240, 0.05);
        const response = 1 - Math.exp(-18 * delta);
        const desiredSpacing = Math.max(
          exactLength / Math.max(hybridRopeAnchors.length - 1, 1),
          2,
        );
        for (let pass = 0; pass < 3; pass++) {
          for (let index = hybridRopeAnchors.length - 2; index >= 0; index--) {
            const point = hybridRopeAnchors[index];
            const leader = hybridRopeAnchors[index + 1];
            if (!point || !leader) continue;
            const deltaX = (leader.x - point.x) * canvasWidth;
            const deltaY = (leader.top - point.top) * canvasHeight;
            const distance = Math.max(Math.hypot(deltaX, deltaY), 0.0001);
            const correction =
              ((distance - desiredSpacing) / distance) * response;
            point.x += (leader.x - point.x) * correction;
            point.top += (leader.top - point.top) * correction;
          }
        }
      }

      resampleAnchorPath(
        hybridRopeAnchors,
        hybridResampledRopeAnchors,
        anchorCumulative,
      );
      for (let index = 0; index < hybridAnchors.length; index++) {
        const anchor = hybridAnchors[index];
        const exact = hybridExactAnchors[index];
        const rope = hybridResampledRopeAnchors[index];
        if (!anchor || !exact || !rope) continue;
        anchor.x = exact.x + (rope.x - exact.x) * settings.followDrift;
        anchor.top = exact.top + (rope.top - exact.top) * settings.followDrift;
      }
      const hybridHead = hybridAnchors[hybridAnchors.length - 1];
      if (hybridHead) {
        hybridHead.x = pointerX;
        hybridHead.top = pointerTop;
      }
      return hybridAnchors;
    };

    const updateCascadeFollowAnchors = (
      settings: Settings,
      frameDelta: number,
    ) => {
      if (!cascadeInitialized) {
        for (const anchor of cascadeAnchors) {
          anchor.x = pointerX;
          anchor.top = pointerTop;
        }
        cascadeInitialized = true;
      }
      const head = cascadeAnchors[cascadeAnchors.length - 1];
      if (head) {
        head.x = pointerX;
        head.top = pointerTop;
      }
      const now = performance.now() * 0.001;
      if (now - lastPersistentInputTime < 0.08) {
        const delta = clamp(frameDelta || 1 / 60, 1 / 240, 0.05);
        const responseRate = 90 - settings.followLag * 60;
        const response = 1 - Math.exp(-responseRate * delta);
        for (let index = cascadeAnchors.length - 2; index >= 0; index--) {
          const anchor = cascadeAnchors[index];
          const leader = cascadeAnchors[index + 1];
          if (!anchor || !leader) continue;
          anchor.x += (leader.x - anchor.x) * response;
          anchor.top += (leader.top - anchor.top) * response;
        }
      }
      return cascadeAnchors;
    };

    const updatePaletteTexture = (settings: Settings) => {
      const nextHash = hashColors(settings.colors);
      if (nextHash === paletteHash) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        HERO_PALETTE_TEXTURE_WIDTH,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        buildHeroPaletteTextureData(settings.colors),
      );
      paletteHash = nextHash;
    };

    const updateMaskTexture = (settings: Settings) => {
      const nextHash = hashMasks(settings.dotMasks, settings.maskFeather);
      if (nextHash === maskHash && maskSizeRevision === sizeRevision) return;
      const mask = buildDotMaskTextureData(
        settings.dotMasks,
        settings.maskFeather,
        canvasWidth / Math.max(canvasHeight, 1),
      );
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        mask.width,
        mask.height,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        mask.data,
      );
      maskHash = nextHash;
      maskSizeRevision = sizeRevision;
    };

    const bindFullscreen = (bundle: ProgramBundle) => {
      const location = bundle.attributes.aPos ?? -1;
      gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      }
    };

    const bindPathGeometry = (
      bundle: ProgramBundle,
      resources: PathResources,
    ) => {
      const stride = HERO_PATH_VERTEX_STRIDE * Float32Array.BYTES_PER_ELEMENT;
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.pathBuffer);
      const center = bundle.attributes.aCenter ?? -1;
      const offsetNormal = bundle.attributes.aOffsetNormal ?? -1;
      const progress = bundle.attributes.aProgress ?? -1;
      const side = bundle.attributes.aSide ?? -1;
      const endpointWeight = bundle.attributes.aEndpointWeight ?? -1;
      if (center >= 0) {
        gl.enableVertexAttribArray(center);
        gl.vertexAttribPointer(center, 2, gl.FLOAT, false, stride, 0);
      }
      if (offsetNormal >= 0) {
        gl.enableVertexAttribArray(offsetNormal);
        gl.vertexAttribPointer(
          offsetNormal,
          2,
          gl.FLOAT,
          false,
          stride,
          2 * Float32Array.BYTES_PER_ELEMENT,
        );
      }
      if (progress >= 0) {
        gl.enableVertexAttribArray(progress);
        gl.vertexAttribPointer(
          progress,
          1,
          gl.FLOAT,
          false,
          stride,
          4 * Float32Array.BYTES_PER_ELEMENT,
        );
      }
      if (side >= 0) {
        gl.enableVertexAttribArray(side);
        gl.vertexAttribPointer(
          side,
          1,
          gl.FLOAT,
          false,
          stride,
          5 * Float32Array.BYTES_PER_ELEMENT,
        );
      }
      if (endpointWeight >= 0) {
        gl.enableVertexAttribArray(endpointWeight);
        gl.vertexAttribPointer(
          endpointWeight,
          1,
          gl.FLOAT,
          false,
          stride,
          6 * Float32Array.BYTES_PER_ELEMENT,
        );
      }
    };

    const drawBoundPathGeometry = (resources: PathResources) => {
      const ranges = resources.pathDrawRanges;
      if (ranges.length === 0) {
        if (resources.pathVertexCount >= 4) {
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, resources.pathVertexCount);
        }
        return;
      }
      for (const range of ranges) {
        if (range.count >= 4) {
          gl.drawArrays(gl.TRIANGLE_STRIP, range.first, range.count);
        }
      }
    };

    const bindSineTextures = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glowTexture0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, glowTexture1);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    };

    const bindPaletteTexture = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
    };

    const bindPathCompositeTextures = (resources: PathResources) => {
      const colorTextures = [
        resources.colorTextures[1]!,
        resources.colorTextures[2]!,
        resources.colorTextures[3]!,
        resources.colorTextures[4]!,
        resources.colorTextures[5]!,
        resources.broadFinalTexture,
      ];
      for (let unit = 0; unit < colorTextures.length; unit++) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, colorTextures[unit]!);
      }
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(
        gl.TEXTURE_2D,
        resources.normalTextures[HERO_PATH_PYRAMID_LEVELS - 1]!,
      );
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    };

    const applySineStaticUniforms = (settings: Settings) => {
      activateProgram(sineProgram.program);
      uniform2f(gl, sineProgram, "uRes", canvasWidth, canvasHeight);
      uniform1i(gl, sineProgram, "uPalette", 0);
      uniform1i(gl, sineProgram, "uGlowProfile0", 1);
      uniform1i(gl, sineProgram, "uGlowProfile1", 2);
      uniform1i(gl, sineProgram, "uDotMask", 3);
      uniform1f(gl, sineProgram, "uBrightness", settings.intensity);
      uniform1f(gl, sineProgram, "uBandHeight", 1 - settings.waveY);
      uniform1f(gl, sineProgram, "uCurveStrength", settings.curveStrength);
      uniform1f(gl, sineProgram, "uCurveScale", settings.curveScale);
      uniform1f(gl, sineProgram, "uCurveFrequency", settings.curveFrequency);
      uniform1f(gl, sineProgram, "uCurveTravel", settings.curveTravel);
      uniform1f(gl, sineProgram, "uCurveMotion", settings.curveMotion);
      uniform1f(
        gl,
        sineProgram,
        "uEnvelopeStationary",
        settings.motionMode === "travel" ? 0 : 1,
      );
      uniform1f(gl, sineProgram, "uStationaryCenter", 0.5);
      uniform1f(
        gl,
        sineProgram,
        "uGeometryAdvanceRatio",
        settings.motionMode === "propagate"
          ? 1
          : settings.motionMode === "travel"
            ? settings.pathDrift
            : 0,
      );
      uniform1f(gl, sineProgram, "uSegmentLength", settings.segmentLength);
      uniform1f(gl, sineProgram, "uTailTaper", settings.tailTaper);
      uniform1f(gl, sineProgram, "uHeadTaper", settings.headTaper);
      uniform1f(gl, sineProgram, "uBandSpread", settings.glow);
      uniform1f(gl, sineProgram, "uUpperGlowSpread", settings.upperGlowSpread);
      uniform1f(gl, sineProgram, "uLowerGlowSpread", settings.lowerGlowSpread);
      uniform1f(gl, sineProgram, "uGlowAsymmetry", settings.glowAsymmetry);
      uniform1f(gl, sineProgram, "uSpacing", settings.dotSpacing * dpr);
      uniform1f(gl, sineProgram, "uDotR", 1.1 * dpr);
      uniform1f(gl, sineProgram, "uDotAlpha", settings.dotOpacity);
      uniform1f(gl, sineProgram, "uTwinkle", settings.twinkle);
      uniform1f(gl, sineProgram, "uReflect", settings.reflect);
      sineStaticSettingsRevision = settingsRevisionRef.current;
      sineStaticSizeRevision = sizeRevision;
    };

    const applyPathSegmentUniforms = (
      bundle: ProgramBundle,
      settings: Settings,
    ) => {
      const pathClosed =
        settings.pathMode !== "follow" && settings.trajectoryClosed;
      uniform1f(gl, bundle, "uCurveTravel", settings.curveTravel);
      uniform1f(
        gl,
        bundle,
        "uEnvelopeStationary",
        settings.pathMode === "follow" || settings.motionMode !== "travel"
          ? 1
          : 0,
      );
      uniform1f(
        gl,
        bundle,
        "uStationaryCenter",
        settings.pathMode === "follow" ? 1 - settings.segmentLength * 0.5 : 0.5,
      );
      uniform1f(gl, bundle, "uSegmentLength", settings.segmentLength);
      uniform1f(gl, bundle, "uTailTaper", settings.tailTaper);
      uniform1f(gl, bundle, "uHeadTaper", settings.headTaper);
      uniform1f(gl, bundle, "uPathClosed", pathClosed ? 1 : 0);
      uniform1f(
        gl,
        bundle,
        "uClosedLoopTaper",
        pathClosed && settings.closedLoopTaper ? 1 : 0,
      );
    };

    const applyPathStaticUniforms = (
      resources: PathResources,
      settings: Settings,
    ) => {
      const level0Width = resources.levelWidths[0]!;
      const level0Height = resources.levelHeights[0]!;
      const maximumDirectionalSpread = Math.max(
        settings.upperGlowSpread,
        settings.lowerGlowSpread,
      );
      const coreWidthScale = clamp(
        Math.sqrt(Math.max(settings.glow * maximumDirectionalSpread, 0.05)),
        0.7,
        2.5,
      );

      activateProgram(resources.seedProgram.program);
      uniform2f(
        gl,
        resources.seedProgram,
        "uTargetResolution",
        level0Width,
        level0Height,
      );
      uniform1f(
        gl,
        resources.seedProgram,
        "uStrokeHalfWidthPx",
        HERO_PATH_SEED_HALF_WIDTH_PX,
      );
      uniform1i(gl, resources.seedProgram, "uPalette", 0);
      applyPathSegmentUniforms(resources.seedProgram, settings);

      activateProgram(resources.coreProgram.program);
      uniform2f(
        gl,
        resources.coreProgram,
        "uTargetResolution",
        canvasWidth,
        canvasHeight,
      );
      uniform1f(
        gl,
        resources.coreProgram,
        "uStrokeHalfWidthPx",
        HERO_PATH_CORE_HALF_WIDTH_CSS_PX * dpr * coreWidthScale,
      );
      uniform1i(gl, resources.coreProgram, "uPalette", 0);
      uniform1f(gl, resources.coreProgram, "uBrightness", settings.intensity);
      uniform1f(gl, resources.coreProgram, "uBandSpread", settings.glow);
      uniform1f(
        gl,
        resources.coreProgram,
        "uUpperGlowSpread",
        settings.upperGlowSpread,
      );
      uniform1f(
        gl,
        resources.coreProgram,
        "uLowerGlowSpread",
        settings.lowerGlowSpread,
      );
      uniform1f(
        gl,
        resources.coreProgram,
        "uGlowAsymmetry",
        settings.glowAsymmetry,
      );
      uniform1f(gl, resources.coreProgram, "uCoreWidthScale", coreWidthScale);
      applyPathSegmentUniforms(resources.coreProgram, settings);

      activateProgram(resources.downsampleProgram.program);
      uniform1i(gl, resources.downsampleProgram, "uSource", 0);

      activateProgram(resources.compositeProgram.program);
      uniform2f(
        gl,
        resources.compositeProgram,
        "uRes",
        canvasWidth,
        canvasHeight,
      );
      uniform1i(gl, resources.compositeProgram, "uColor1", 0);
      uniform1i(gl, resources.compositeProgram, "uColor2", 1);
      uniform1i(gl, resources.compositeProgram, "uColor3", 2);
      uniform1i(gl, resources.compositeProgram, "uColor4", 3);
      uniform1i(gl, resources.compositeProgram, "uColor5", 4);
      uniform1i(gl, resources.compositeProgram, "uColorBroad", 5);
      uniform1i(gl, resources.compositeProgram, "uNormalField", 6);
      uniform1i(gl, resources.compositeProgram, "uDotMask", 7);
      uniform2f(
        gl,
        resources.compositeProgram,
        "uNormalFieldTexel",
        1 /
          Math.max(resources.levelWidths[HERO_PATH_PYRAMID_LEVELS - 1] ?? 1, 1),
        1 /
          Math.max(
            resources.levelHeights[HERO_PATH_PYRAMID_LEVELS - 1] ?? 1,
            1,
          ),
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uBrightness",
        settings.intensity,
      );
      uniform1f(gl, resources.compositeProgram, "uBandSpread", settings.glow);
      uniform1f(
        gl,
        resources.compositeProgram,
        "uUpperGlowSpread",
        settings.upperGlowSpread,
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uLowerGlowSpread",
        settings.lowerGlowSpread,
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uGlowAsymmetry",
        settings.glowAsymmetry,
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uSpacing",
        settings.dotSpacing * dpr,
      );
      uniform1f(gl, resources.compositeProgram, "uDotR", 1.1 * dpr);
      uniform1f(
        gl,
        resources.compositeProgram,
        "uDotAlpha",
        settings.dotOpacity,
      );
      uniform1f(gl, resources.compositeProgram, "uTwinkle", settings.twinkle);
      uniform1f(gl, resources.compositeProgram, "uReflect", settings.reflect);

      resources.staticSettingsRevision = settingsRevisionRef.current;
      resources.staticSizeRevision = sizeRevision;
    };

    let cachedTrajectorySourceKey = -1;
    let cachedTrajectory = normalizeTrajectoryPoints(
      settingsRef.current.trajectoryPoints,
    );

    const staticTrajectory = (settings: Settings) => {
      let sourceKey = hashMix(
        settings.pathMode === "organic" ? 0x0a11ce : 0xc0570f,
        settings.trajectoryPoints.length,
      );
      if (settings.pathMode === "organic") {
        sourceKey = hashMix(sourceKey, settings.trajectorySeed);
      } else {
        sourceKey = hashMix(
          sourceKey,
          hashTrajectory(settings.trajectoryPoints),
        );
      }
      if (sourceKey !== cachedTrajectorySourceKey) {
        cachedTrajectory =
          settings.pathMode === "organic"
            ? createHeroOrganicTrajectory(
                settings.trajectorySeed,
                settings.trajectoryPoints.length,
              )
            : normalizeTrajectoryPoints(settings.trajectoryPoints);
        cachedTrajectorySourceKey = sourceKey;
      }
      return cachedTrajectory;
    };

    const geometryKey = (
      settings: Settings,
      trajectory: readonly HeroTrajectoryPoint[],
      closed: boolean,
    ) => {
      let hash = hashTrajectory(trajectory);
      hash = hashMix(hash, closed ? 1 : 0);
      hash = hashMix(hash, canvasWidth);
      hash = hashMix(hash, canvasHeight);
      hash = hashFloat(hash, settings.waveY);
      hash = hashFloat(hash, settings.curveScale);
      hash = hashFloat(hash, settings.curveStrength);
      return hash;
    };

    const updatePathMesh = (
      resources: PathResources,
      settings: Settings,
      frameDelta: number,
    ) => {
      const closed =
        settings.pathMode === "follow" ? false : settings.trajectoryClosed;
      let nextKey = pointerRevision;
      let forceRebuild = false;
      let propagationEnabled = false;
      let samples: readonly CurveSample[];

      if (settings.pathMode === "follow") {
        const anchors =
          settings.followMode === "echo"
            ? updateEchoFollowAnchors(settings)
            : settings.followMode === "cascade"
              ? updateCascadeFollowAnchors(settings, frameDelta)
              : updateHybridFollowAnchors(settings, frameDelta);
        samples = buildAdaptiveFollowPathSamples(
          anchors,
          canvasWidth,
          canvasHeight,
          followPathSamples,
        );
        // The history window continues to advance after the cursor stops, so
        // follow geometry is intentionally rebuilt on every active frame.
        forceRebuild = true;
      } else {
        const trajectory = staticTrajectory(settings);
        nextKey = geometryKey(settings, trajectory, closed);
        propagationEnabled =
          settings.motionMode === "propagate" && settings.curveMotion > 0;
        if (
          !propagationEnabled &&
          !pathMeshIsDynamic &&
          nextKey === pathMeshKey
        ) {
          return;
        }
        if (nextKey !== basePathKey) {
          basePathSamples = buildAdaptivePathSamples(
            trajectory,
            closed,
            canvasWidth,
            canvasHeight,
            settings.waveY,
            settings.curveScale,
            settings.curveStrength,
          );
          basePathKey = nextKey;
        }
        samples = propagationEnabled
          ? buildPropagatedPathSamples(
              basePathSamples,
              closed,
              canvasWidth,
              canvasHeight,
              motionTime,
              settings,
              propagatedPathSamples,
            )
          : basePathSamples;
      }

      const mesh = buildPathStrokeVertexData(
        samples,
        closed,
        canvasWidth,
        canvasHeight,
        HERO_PATH_ENDPOINT_FEATHER_CSS_PX * dpr,
        pathVertexData,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.pathBuffer);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        pathVertexData.subarray(0, mesh.floatCount),
      );
      resources.pathVertexCount = mesh.vertexCount;
      resources.pathDrawRanges = mesh.drawRanges;
      pathMeshKey = nextKey;
      pathMeshIsDynamic = forceRebuild || propagationEnabled;
    };

    const paletteOffsetFor = (settings: Settings) =>
      colorTime * settings.colorSpeed * 0.12;

    const updateHueMatrix = (settings: Settings) => {
      buildHueMatrix((settings.hue * Math.PI) / 180 + huePhase, hueMatrix);
    };

    const applySineDynamicUniforms = (settings: Settings) => {
      uniform1f(gl, sineProgram, "uTime", motionTime);
      uniform1f(gl, sineProgram, "uPaletteOffset", paletteOffsetFor(settings));
      updateHueMatrix(settings);
      gl.uniformMatrix3fv(
        sineProgram.uniforms.uHueMatrix ?? null,
        false,
        hueMatrix,
      );
    };

    const applyPathSeedDynamicUniforms = (
      resources: PathResources,
      settings: Settings,
    ) => {
      uniform1f(gl, resources.seedProgram, "uTime", motionTime);
      uniform1f(
        gl,
        resources.seedProgram,
        "uPaletteOffset",
        paletteOffsetFor(settings),
      );
    };

    const applyPathCoreDynamicUniforms = (
      resources: PathResources,
      settings: Settings,
    ) => {
      uniform1f(gl, resources.coreProgram, "uTime", motionTime);
      uniform1f(
        gl,
        resources.coreProgram,
        "uPaletteOffset",
        paletteOffsetFor(settings),
      );
      updateHueMatrix(settings);
      gl.uniformMatrix3fv(
        resources.coreProgram.uniforms.uHueMatrix ?? null,
        false,
        hueMatrix,
      );
    };

    const drawSine = (settings: Settings) => {
      if (
        sineStaticSettingsRevision !== settingsRevisionRef.current ||
        sineStaticSizeRevision !== sizeRevision
      ) {
        updatePaletteTexture(settings);
        updateMaskTexture(settings);
        applySineStaticUniforms(settings);
      }
      bindSineTextures();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      activateProgram(sineProgram.program);
      bindFullscreen(sineProgram);
      applySineDynamicUniforms(settings);
      uniform1f(gl, sineProgram, "uNoisePhase", (motionTime % 1) * 61.7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const renderPathSeed = (
      resources: PathResources,
      settings: Settings,
      target: WebGLTexture,
      seedMode: number,
    ) => {
      const width = resources.levelWidths[0]!;
      const height = resources.levelHeights[0]!;
      attachPathTarget(resources, target, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE);
      bindPaletteTexture();
      activateProgram(resources.seedProgram.program);
      bindPathGeometry(resources.seedProgram, resources);
      applyPathSeedDynamicUniforms(resources, settings);
      uniform1f(gl, resources.seedProgram, "uSeedMode", seedMode);
      drawBoundPathGeometry(resources);
      gl.disable(gl.BLEND);
    };

    const downsamplePathTexture = (
      resources: PathResources,
      source: WebGLTexture,
      sourceWidth: number,
      sourceHeight: number,
      target: WebGLTexture,
      targetWidth: number,
      targetHeight: number,
      offset: number,
      gain: number,
    ) => {
      attachPathTarget(resources, target, targetWidth, targetHeight);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      activateProgram(resources.downsampleProgram.program);
      bindFullscreen(resources.downsampleProgram);
      uniform2f(
        gl,
        resources.downsampleProgram,
        "uSourceTexel",
        1 / Math.max(sourceWidth, 1),
        1 / Math.max(sourceHeight, 1),
      );
      uniform2f(
        gl,
        resources.downsampleProgram,
        "uTargetResolution",
        targetWidth,
        targetHeight,
      );
      uniform1f(gl, resources.downsampleProgram, "uOffset", offset);
      uniform1f(gl, resources.downsampleProgram, "uGain", gain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const buildPathPyramid = (
      resources: PathResources,
      textures: readonly WebGLTexture[],
    ) => {
      for (let level = 1; level < HERO_PATH_PYRAMID_LEVELS; level++) {
        downsamplePathTexture(
          resources,
          textures[level - 1]!,
          resources.levelWidths[level - 1]!,
          resources.levelHeights[level - 1]!,
          textures[level]!,
          resources.levelWidths[level]!,
          resources.levelHeights[level]!,
          HERO_PATH_DOWNSAMPLE_OFFSET,
          2,
        );
      }
    };

    const buildBroadPathGlow = (resources: PathResources) => {
      const lastLevel = HERO_PATH_PYRAMID_LEVELS - 1;
      const width = resources.levelWidths[lastLevel]!;
      const height = resources.levelHeights[lastLevel]!;
      let source = resources.colorTextures[lastLevel]!;
      let sourceIsFirstBroadTexture = false;

      for (let pass = 0; pass < HERO_PATH_BROAD_BLUR_PASSES; pass++) {
        const target = sourceIsFirstBroadTexture
          ? resources.broadTextures[1]
          : resources.broadTextures[0];
        downsamplePathTexture(
          resources,
          source,
          width,
          height,
          target,
          width,
          height,
          HERO_PATH_BROAD_BLUR_OFFSET,
          1,
        );
        source = target;
        sourceIsFirstBroadTexture = !sourceIsFirstBroadTexture;
      }
      resources.broadFinalTexture = source;
    };

    const compositePath = (resources: PathResources, settings: Settings) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      bindPathCompositeTextures(resources);
      activateProgram(resources.compositeProgram.program);
      bindFullscreen(resources.compositeProgram);
      uniform1f(gl, resources.compositeProgram, "uTime", motionTime);
      uniform1f(
        gl,
        resources.compositeProgram,
        "uNoisePhase",
        (motionTime % 1) * 61.7,
      );
      updateHueMatrix(settings);
      gl.uniformMatrix3fv(
        resources.compositeProgram.uniforms.uHueMatrix ?? null,
        false,
        hueMatrix,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const overlayPathCore = (resources: PathResources, settings: Settings) => {
      if (resources.pathVertexCount < 4) return;
      bindPaletteTexture();
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
      activateProgram(resources.coreProgram.program);
      bindPathGeometry(resources.coreProgram, resources);
      applyPathCoreDynamicUniforms(resources, settings);
      drawBoundPathGeometry(resources);
      gl.disable(gl.BLEND);
    };

    const drawPath = (settings: Settings, frameDelta: number) => {
      const resources = ensurePathResources();
      if (!resources) {
        drawSine(settings);
        return;
      }
      allocatePathTargets(resources);
      if (
        resources.staticSettingsRevision !== settingsRevisionRef.current ||
        resources.staticSizeRevision !== sizeRevision
      ) {
        updatePaletteTexture(settings);
        updateMaskTexture(settings);
        applyPathStaticUniforms(resources, settings);
      }
      updatePathMesh(resources, settings, frameDelta);

      renderPathSeed(resources, settings, resources.colorTextures[0]!, 0);
      renderPathSeed(resources, settings, resources.normalTextures[0]!, 1);
      buildPathPyramid(resources, resources.colorTextures);
      buildPathPyramid(resources, resources.normalTextures);
      buildBroadPathGlow(resources);
      compositePath(resources, settings);
      overlayPathCore(resources, settings);
    };

    const draw = (frameDelta: number) => {
      if (resizePending) {
        resizePending = false;
        resizeCanvas();
      }
      const settings = settingsRef.current;
      if (settings.pathMode === "sine") {
        drawSine(settings);
      } else {
        drawPath(settings, frameDelta);
      }
      onFrameRef.current?.(frameDelta);
    };

    function loop(timestamp: number) {
      frameScheduled = false;
      if (!running) return;
      const settings = settingsRef.current;
      let frameDelta = 0;
      if (lastTimestamp !== null) {
        frameDelta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      }
      lastTimestamp = timestamp;
      if (!settings.paused) {
        motionTime = (motionTime + frameDelta * settings.speed) % 4096;
        colorTime = (colorTime + frameDelta) % 8192;
        huePhase =
          (huePhase + (frameDelta * settings.hueDrift * Math.PI) / 180) % TAU;
      }
      notifyCompletedCycle(settings);
      draw(frameDelta);
      if (!settings.paused) requestFrame();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastTimestamp = null;
        requestFrame();
      } else if (frameScheduled) {
        cancelAnimationFrame(raf);
        frameScheduled = false;
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      running = false;
      if (frameScheduled) cancelAnimationFrame(raf);
      frameScheduled = false;
    };

    const onContextRestored = () => {
      setContextEpoch((value) => value + 1);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    draw(1 / 60);
    const reveal = () => {
      canvas.dataset.ready = "true";
    };
    revealRaf = requestAnimationFrame(() => {
      revealRaf = requestAnimationFrame(reveal);
    });
    revealTimer = window.setTimeout(reveal, 100);
    requestFrame();

    (
      canvas as HTMLCanvasElement & {
        __waveDebug?: { time: () => number; step: (seconds: number) => void };
      }
    ).__waveDebug = {
      time: () => motionTime,
      step: (seconds: number) => {
        const safeSeconds = finite(seconds, 0);
        motionTime = (motionTime + safeSeconds) % 4096;
        colorTime = (colorTime + safeSeconds) % 8192;
        notifyCompletedCycle(settingsRef.current);
        draw(Math.min(Math.abs(safeSeconds), 0.1));
      },
    };

    return () => {
      running = false;
      invalidateRef.current = () => undefined;
      if (frameScheduled) cancelAnimationFrame(raf);
      cancelAnimationFrame(revealRaf);
      window.clearTimeout(revealTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", markRectDirty, true);
      window.removeEventListener("resize", markRectDirty);
      resizeObserver.disconnect();
      delete (
        canvas as HTMLCanvasElement & {
          __waveDebug?: { time: () => number; step: (seconds: number) => void };
        }
      ).__waveDebug;
      destroyPathResources(pathResources ?? null);
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      gl.deleteTexture(paletteTexture);
      gl.deleteTexture(glowTexture0);
      gl.deleteTexture(glowTexture1);
      gl.deleteTexture(maskTexture);
    };
  }, [contextEpoch]);

  const previousFadeDuration = useRef(fadeInDuration);
  useEffect(() => {
    if (previousFadeDuration.current === fadeInDuration) return;
    previousFadeDuration.current = fadeInDuration;
    const canvas = canvasRef.current;
    if (!canvas) return;
    delete canvas.dataset.ready;
    let revealRaf = 0;
    const revealTimer = window.setTimeout(() => {
      canvas.dataset.ready = "true";
    }, 100);
    revealRaf = requestAnimationFrame(() => {
      revealRaf = requestAnimationFrame(() => {
        canvas.dataset.ready = "true";
        canvas.style.opacity = "1";
      });
    });
    return () => {
      cancelAnimationFrame(revealRaf);
      window.clearTimeout(revealTimer);
    };
  }, [fadeInDuration]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0,
        transitionProperty: "opacity",
        willChange: "opacity",
        transitionDuration: `${fadeInDuration}ms`,
        transitionTimingFunction: resolvedSettings.fadeInEasing,
      }}
      className={className}
    />
  );
}
