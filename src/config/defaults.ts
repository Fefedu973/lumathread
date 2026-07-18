import {
  HERO_DEFAULT_PROPAGATION_DEFORMERS,
  HERO_TRAJECTORY_VERTICAL_LIMIT,
  MIN_HERO_TRAJECTORY_POINTS,
  type HeroTrajectoryPoint,
  type HeroWaveBackgroundProps,
  type HeroWaveDotMode,
  type HeroWaveFadeEasingPreset,
  type HeroWaveFollowMode,
  type HeroWaveMaterialPreset,
  type HeroWaveMotionMode,
  type HeroWavePathInterpolation,
  type HeroWavePathMode,
  type HeroWaveTheme,
} from "../types";

import { HERO_DEFAULT_TRAJECTORY } from "../trajectory";
import { clamp, finite } from "../math";
import type { ResolvedFilamentPointerConfig } from "../interaction/filament-disturbance";

import type {
  ResolvedBackgroundImage,
  ResolvedDotInteraction,
  ResolvedGlassText,
  ResolvedMusicVisualizer,
  ResolvedTerrainDots,
} from "./models";

export const HERO_FOLLOW_POINT_COUNT = 56;
export const HERO_CASCADE_FOLLOW_POINT_COUNT = 64;
export const HERO_ECHO_FOLLOW_POINT_COUNT = 56;
export const HERO_POINTER_HISTORY_LIMIT = 768;
export const HERO_FOLLOW_OVERSCAN = 0.15;
export const HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX = 0.35;
export const HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS = 1 / 180;
export const HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS = 1 / 90;
export const HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS = 0.08;
export const HERO_FOLLOW_DUPLICATE_DISTANCE_PX = 0.45;
export const HERO_FOLLOW_SPLINE_ALPHA = 0.5;
export const HERO_FOLLOW_HISTORY_MARGIN_SECONDS = 0.3;
export const HERO_PROFILE_TEXTURE_WIDTH = 256;
export const HERO_PROFILE_TEXTURE_HEIGHT = 2;
export const HERO_GLOW_TEXTURE_WIDTH = 1024;
export const HERO_MASK_TEXTURE_HEIGHT = 192;
export const HERO_PATH_ENDPOINT_FEATHER_CSS_PX = 12;
export const HERO_PATH_SEGMENT_STRIDE = 8;
export const HERO_PATH_QUAD_VERTEX_COUNT = 6;
export const HERO_PATH_PASS_FAR = 0;
export const HERO_PATH_PASS_MID = 1;
export const HERO_PATH_PASS_CORE = 2;
export const HERO_PATH_PASS_COUNT = 3;
export const HERO_PATH_FAR_PROFILE_RADIUS = 1.75;
export const HERO_PATH_MID_PROFILE_RADIUS = 0.45;
export const HERO_PATH_CORE_PROFILE_RADIUS = 0.08;
export const HERO_PATH_K0_LUT_WIDTH = 4096;
export const HERO_MAX_PATH_SAMPLES = 32768;
export const HERO_PATH_MAX_SUBDIVISION_DEPTH = 20;
export const HERO_MAX_DPR = 2;
export const HERO_MAX_FILAMENTS_WARNING = 16;
export const HERO_GLASS_SDF_RANGE_CSS_PX = 128;
export const TAU = Math.PI * 2;

export function normalizeTrajectoryPoints(
  points: readonly HeroTrajectoryPoint[],
  verticalLimit = HERO_TRAJECTORY_VERTICAL_LIMIT,
): HeroTrajectoryPoint[] {
  const count = Math.max(MIN_HERO_TRAJECTORY_POINTS, points.length);
  return Array.from({ length: count }, (_, index) => {
    const point = points[index] ?? HERO_DEFAULT_TRAJECTORY[index];
    const fallbackX = index / Math.max(count - 1, 1);
    return {
      id: point?.id ?? `trajectory-${index}`,
      x: clamp(finite(point?.x, fallbackX), -4, 4),
      y: clamp(finite(point?.y, 0), -verticalLimit, verticalLimit),
      speed: clamp(finite(point?.speed, 1), 0.05, 16),
      ...(Number.isFinite(point?.inX) ? { inX: point!.inX as number } : {}),
      ...(Number.isFinite(point?.inY) ? { inY: point!.inY as number } : {}),
      ...(Number.isFinite(point?.outX) ? { outX: point!.outX as number } : {}),
      ...(Number.isFinite(point?.outY) ? { outY: point!.outY as number } : {}),
    };
  });
}

export function catmullRomValue(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
  tension = 0,
) {
  const tangentScale = 1 - clamp(tension, -1, 1);
  const m1 = ((p2 - p0) * tangentScale) / 2;
  const m2 = ((p3 - p1) * tangentScale) / 2;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p1 +
    (t3 - 2 * t2 + t) * m1 +
    (-2 * t3 + 3 * t2) * p2 +
    (t3 - t2) * m2
  );
}

export type HeroWaveBackgroundCoreProps = HeroWaveBackgroundProps;

export const INTERNAL_DEFAULTS = {
  theme: "dark" as HeroWaveTheme,
  motionMode: "travel" as HeroWaveMotionMode,
  pathMode: "organic" as HeroWavePathMode,
  followMode: "hybrid" as HeroWaveFollowMode,
  followViscosity: 0.45,
  trajectorySeed: 731,
  trajectoryPoints: HERO_DEFAULT_TRAJECTORY,
  trajectoryClosed: false,
  closedLoopTaper: true,
  trajectoryInterpolation: "catmull-rom" as HeroWavePathInterpolation,
  trajectoryTension: 0,
  svgPath: "",
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
    { id: "palette-blue", color: "#2438ff", offset: 0 },
    { id: "palette-cyan", color: "#1adff5", offset: 0.5 },
    { id: "palette-green", color: "#22f25f", offset: 1 },
  ],
  hue: 0,
  hueDrift: 0,
  materialPreset: "soft-aurora" as HeroWaveMaterialPreset,
  dotSpacing: 26,
  dotOpacity: 0.45,
  twinkle: 0.6,
  reflect: 0.8,
  maskFeather: 0.55,
  dotMode: "flat" as HeroWaveDotMode,
  terrainDots: {
    columns: 112,
    rows: 72,
    width: 7.2,
    depth: 6.2,
    amplitude: 0.42,
    pointSize: 2.1,
    speed: 0.28,
    viewAngle: 52,
    cameraDistance: 3.2,
    frequency: 1.5,
    opacity: 0.52,
    edgeFade: 0.12,
    fit: "fixed",
    contentFade: 0.48,
    colorLow: "#2438ff",
    colorHigh: "#22f25f",
  } satisfies ResolvedTerrainDots,
  dotInteraction: {
    enabled: false,
    radius: 140,
    softness: 0.55,
    brightness: 1.1,
    color: "#1adff5",
    colorStrength: 0.65,
    magnification: 1.55,
    terrainDisplacement: 0.55,
  } satisfies ResolvedDotInteraction,
  filamentInteraction: {
    enabled: false,
    target: "canvas",
    pointerTypes: ["mouse", "pen", "touch"],
    radius: 80,
    strength: 0.045,
    propagationSpeed: 0.72,
    frequency: 2.8,
    damping: 2.2,
    spatialDecay: 0.8,
    duration: 2.4,
    cooldown: 0.07,
    maxImpulses: 8,
    direction: "push",
  } satisfies ResolvedFilamentPointerConfig,
  glassText: {
    enabled: false,
    shape: "text",
    text: "",
    svgPath: "",
    svgViewBox: [0, 0, 100, 100],
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontWeight: 750,
    fontSize: 96,
    lineHeight: 0.94,
    letterSpacing: -2,
    textWrap: "auto",
    centerX: 0.5,
    centerY: 0.5,
    maxWidth: 0.82,
    maxHeight: 0.42,
    refraction: 18,
    edgeWrap: 0,
    surfaceModel: "simple",
    bevelMode: "biconvex",
    surfaceDepth: 40,
    ior: 1.5,
    magnificationX: 0,
    magnificationY: 0,
    displacementX: 0,
    displacementY: 0,
    diffusion: 0,
    blur: 0.2,
    distortion: 0.04,
    chromaticAberration: 2.4,
    frost: 0.08,
    roughness: 0.18,
    bevel: 1,
    ribStrength: 0,
    ribWidth: 18,
    ribAngle: -18,
    liquidStrength: 0,
    liquidScale: 3.2,
    liquidSpeed: 0.22,
    edgeStrength: 0.72,
    specular: 0.68,
    fresnel: 0.5,
    twinkle: 0,
    twinkleDensity: 0.28,
    twinkleSpeed: 0.8,
    twinkleSize: 28,
    tint: "#dffcff",
    tintStrength: 0.08,
    saturation: 0,
    brightness: 0,
    opacity: 0.92,
    introDelay: 0,
    introDuration: 0,
    introBlur: 0,
    introOffsetY: 0,
    introEasing: [0, 0, 1, 1] as const,
  } satisfies ResolvedGlassText,
  backgroundImage: {
    src: "",
    fit: "cover",
    opacity: 1,
  } satisfies ResolvedBackgroundImage,
  musicVisualizer: {
    enabled: false,
    source: "element",
    elementId: "",
    fftSize: 1024,
    smoothing: 0.78,
    sensitivity: 1,
    band: "energy",
    deformation: 0,
    deformationFrequency: 3,
    width: 0,
    intensity: 0,
    glow: 0,
    hue: 0,
    reflection: 0,
  } satisfies ResolvedMusicVisualizer,
  dotMasks: [
    { id: "left", x: 0.26, y: 0.52, radius: 0.72 },
    { id: "right", x: 0.78, y: 0.5, radius: 0.74 },
  ],
  fadeInDuration: 900,
  fadeInEasing: "ease-out" as HeroWaveFadeEasingPreset,
  paused: false,
  initialTime: 0,
  playbackRate: 1,
  respectReducedMotion: true,
  pauseWhenOffscreen: true,
} as const;

export const HERO_WAVE_DEFAULT_CONFIG: Readonly<HeroWaveBackgroundProps> = {
  theme: "dark",
  path: {
    mode: "organic",
    points: HERO_DEFAULT_TRAJECTORY,
    closed: false,
    closedLoopTaper: true,
    interpolation: "catmull-rom",
    tension: 0,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5,
    },
    organic: {
      pointCount: 12,
      turns: 1.55,
      amplitude: 0.92,
      roughness: 0.28,
      horizontalJitter: 0.14,
      speedVariation: 0.7,
      symmetry: 0,
      seed: 731,
    },
  },
  shape: { waveY: 0.68, strength: 1, scale: 0.62, frequency: 1.4 },
  motion: {
    mode: "travel",
    curveTravel: 0.08,
    pathDrift: 0,
    curveMotion: 0.65,
    segmentLength: 0.78,
    tailTaper: 0.24,
    headTaper: 0.14,
    speed: 0.7,
  },
  propagation: {
    enabled: false,
    deformers: HERO_DEFAULT_PROPAGATION_DEFORMERS,
    domain: "arcLength",
    phaseOffset: 0,
    phaseSpeed: 1,
    combine: "add",
    stage: "after-follow",
    recomputeArcLength: false,
  },
  profiles: {
    width: 1,
    opacity: 1,
    intensity: 1,
    glow: 1,
    upperGlowSpread: 1,
    lowerGlowSpread: 1,
    reflection: 1,
    colorPosition: 0,
  },
  material: {
    preset: "soft-aurora",
    intensity: 1,
    glow: 1,
    upperGlowSpread: 1,
    lowerGlowSpread: 1,
    glowAsymmetry: 1,
  },
  palette: {
    stops: INTERNAL_DEFAULTS.colors,
    interpolation: "srgb",
    wrap: "clamp",
    reverse: false,
    speed: 1,
    hue: 0,
    hueDrift: 0,
  },
  interaction: {
    follow: {
      mode: "hybrid",
      headResponse: 1,
      viscosity: 0.45,
      memorySeconds: 0.92,
      stationaryBehavior: "collapse",
      stationaryCollapseDuration: 1.2,
      lengthCssPx: 1800,
      leaveBehavior: "collapse",
      fadeDuration: 0.35,
      idleDelay: 0.35,
      idleRadiusX: 90,
      idleRadiusY: 65,
      idleSpeed: 0.55,
      pointerTypes: ["mouse", "pen", "touch"],
    },
  },
  dots: {
    enabled: true,
    mode: "flat",
    spacing: 26,
    opacity: 0.45,
    twinkle: 0.6,
    reflect: 0.8,
    maskFeather: 0.55,
    masks: INTERNAL_DEFAULTS.dotMasks,
    interaction: INTERNAL_DEFAULTS.dotInteraction,
  },
  glassText: { enabled: false },
  quality: "auto",
  fadeInDuration: 900,
  fadeInEasing: "ease-out",
  paused: false,
  initialTime: 0,
  playbackRate: 1,
  respectReducedMotion: true,
  pauseWhenOffscreen: true,
};
