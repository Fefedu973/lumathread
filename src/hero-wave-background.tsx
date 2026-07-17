"use client";

/**
 * Hero background inspired by react-bits SoftAurora.
 *
 * The analytic sine path stays a single-pass WebGL renderer. Free 2D paths use
 * a true multi-contribution line-integral renderer: every adaptive path span
 * emits independently into floating-point accumulation targets, so crossings
 * preserve all branches instead of selecting or averaging a fixed number of
 * nearest candidates.
 */
import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from "react";

export interface HeroDotMask {
  id: string;
  /** Horizontal center, 0 = left and 1 = right. */
  x: number;
  /** Vertical center, 0 = bottom and 1 = top. */
  y: number;
  /** Radius relative to viewport height. */
  radius: number;
  /** Optional feather override for this mask. Falls back to dots.maskFeather. */
  feather?: number;
}

export type HeroWaveColorStopEasing = "linear" | "smooth" | "hold";
export interface HeroWaveColorStop {
  id: string;
  color: string;
  /** Optional normalized position. Missing positions are distributed evenly. */
  offset?: number;
  /** Interpolation from this stop to the following stop. */
  easing?: HeroWaveColorStopEasing;
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
const HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS = 0.08;
const HERO_FOLLOW_DUPLICATE_DISTANCE_PX = 0.45;
const HERO_FOLLOW_SPLINE_ALPHA = 0.5;
const HERO_FOLLOW_HISTORY_MARGIN_SECONDS = 0.3;
const HERO_PALETTE_TEXTURE_WIDTH = 512;
const HERO_PROFILE_TEXTURE_WIDTH = 256;
const HERO_PROFILE_TEXTURE_HEIGHT = 2;
const HERO_GLOW_TEXTURE_WIDTH = 1024;
const HERO_GLOW_PROFILE_MAX_DISTANCE = 1.75;
const HERO_MASK_TEXTURE_HEIGHT = 192;
const HERO_PATH_ENDPOINT_FEATHER_CSS_PX = 12;
const HERO_PATH_SEGMENT_STRIDE = 8;
const HERO_PATH_QUAD_VERTEX_COUNT = 6;
const HERO_PATH_PASS_FAR = 0;
const HERO_PATH_PASS_MID = 1;
const HERO_PATH_PASS_CORE = 2;
const HERO_PATH_PASS_COUNT = 3;
const HERO_PATH_FAR_PROFILE_RADIUS = 1.75;
const HERO_PATH_MID_PROFILE_RADIUS = 0.45;
const HERO_PATH_CORE_PROFILE_RADIUS = 0.08;
const HERO_PATH_K0_LUT_WIDTH = 4096;
const HERO_PATH_K0_MAX_ARGUMENT = 24;
const HERO_PATH_K0_MIN_ARGUMENT = 0.0001;
const HERO_MAX_PATH_SAMPLES = 32768;
const HERO_PATH_MAX_SUBDIVISION_DEPTH = 20;
const HERO_MAX_DPR = 2;
const HERO_MAX_FILAMENTS_WARNING = 16;
const TAU = Math.PI * 2;

export type HeroWaveMotionMode = "travel" | "propagate" | "anchored";
export type HeroWavePathMode = "sine" | "organic" | "custom" | "svg" | "follow";
export type HeroWaveFollowMode = "hybrid" | "cascade" | "echo";
export type HeroWaveFollowStationaryBehavior = "freeze" | "collapse";
export type HeroWavePathRenderer = "auto" | "hdr" | "legacy";
export type HeroWaveTheme = "dark" | "light";
export type HeroWaveFadeEasingPreset =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out";
export type HeroWaveFadeEasing =
  | HeroWaveFadeEasingPreset
  | readonly [number, number, number, number];
export type HeroWavePathInterpolation =
  | "linear"
  | "catmull-rom"
  | "centripetal-catmull-rom"
  | "bezier";
export type HeroWaveProfileWrap = "clamp" | "repeat" | "mirror";
export type HeroWaveProfileInterpolation = "linear" | "smooth" | "cubic";
export type HeroWavePaletteInterpolation = "srgb" | "linear-rgb" | "oklab";
export type HeroWavePaletteWrap = "clamp" | "repeat" | "mirror";
export type HeroWaveMaterialPreset = "soft-aurora" | "mist" | "neon" | "plasma";
export type HeroWaveQualityPreset =
  | "auto"
  | "ultra"
  | "high"
  | "balanced"
  | "low";
export type HeroWaveFollowLeaveBehavior =
  | "freeze"
  | "collapse"
  | "idle"
  | "fade";
export type HeroWavePointerType = "mouse" | "pen" | "touch";
export type HeroWaveDeformationDomain = "arcLength" | "travelTime";
export type HeroWaveDeformationCombine = "add" | "max" | "multiply";
export type HeroWaveDeformationStage = "before-follow" | "after-follow";
export type HeroWaveDeformationDirection =
  | "normal"
  | "tangent"
  | "both"
  | "x"
  | "y";

export interface HeroTrajectoryPoint {
  id: string;
  x: number;
  /** Relative vertical displacement from waveY. */
  y: number;
  speed: number;
  /** Optional relative incoming Bézier handle. */
  inX?: number;
  inY?: number;
  /** Optional relative outgoing Bézier handle. */
  outX?: number;
  outY?: number;
}

export interface HeroWaveCurveKey {
  position: number;
  value: number;
  inTangent?: number;
  outTangent?: number;
}
export interface HeroWaveCurveProfile {
  type: "curve";
  keys: readonly HeroWaveCurveKey[];
  interpolation?: HeroWaveProfileInterpolation;
  wrap?: HeroWaveProfileWrap;
}
export interface HeroWaveSampledProfile {
  type: "sampled";
  values: readonly number[] | Float32Array;
  interpolation?: HeroWaveProfileInterpolation;
  wrap?: HeroWaveProfileWrap;
}
export type HeroWaveScalarProfile =
  | number
  | "flat"
  | "sin2"
  | "smoothstep"
  | "bell"
  | "head"
  | "tail"
  | HeroWaveCurveProfile
  | HeroWaveSampledProfile;

export interface HeroWaveHarmonic {
  amplitude: number;
  frequency: number;
  phase?: number;
  phaseSpeed?: number;
}
interface HeroWaveDeformerBase {
  id?: string;
  enabled?: boolean;
  /** Displacement in viewport-height units. */
  amplitude?: number;
  envelope?: HeroWaveScalarProfile;
  direction?: HeroWaveDeformationDirection;
  tangentAmount?: number;
}
export interface HeroWaveHarmonicDeformer extends HeroWaveDeformerBase {
  type: "harmonics";
  waves: readonly HeroWaveHarmonic[];
}
export interface HeroWaveSampledDeformer extends HeroWaveDeformerBase {
  type: "sampled";
  values: readonly number[] | Float32Array;
  frequency?: number;
  phase?: number;
  phaseSpeed?: number;
  interpolation?: HeroWaveProfileInterpolation;
  wrap?: HeroWaveProfileWrap;
}
export interface HeroWaveNoiseDeformer extends HeroWaveDeformerBase {
  type: "noise";
  seed?: number;
  frequency: number;
  phaseSpeed?: number;
  octaves?: number;
  lacunarity?: number;
  persistence?: number;
}
export interface HeroWavePulseDeformer extends HeroWaveDeformerBase {
  type: "pulse";
  width: number;
  phase?: number;
  phaseSpeed?: number;
  count?: number;
  shape?: "gaussian" | "smooth" | "triangle";
}
export interface HeroWaveDeformationContext {
  index: number;
  count: number;
  time: number;
  progress: number;
  arcProgress: number;
  point: Readonly<{ x: number; y: number }>;
  tangent: Readonly<{ x: number; y: number }>;
  normal: Readonly<{ x: number; y: number }>;
}
export interface HeroWaveDeformationOutput {
  normal: number;
  tangent: number;
  x: number;
  y: number;
}
export type HeroWaveCustomDeformerCallback = (
  context: Readonly<HeroWaveDeformationContext>,
  output: HeroWaveDeformationOutput,
) => void;
export interface HeroWaveCustomDeformer extends HeroWaveDeformerBase {
  type: "custom";
  callback: HeroWaveCustomDeformerCallback;
  /** Increment when captured callback data changes without callback identity changing. */
  version?: number;
}
export type HeroWaveDeformer =
  | HeroWaveHarmonicDeformer
  | HeroWaveSampledDeformer
  | HeroWaveNoiseDeformer
  | HeroWavePulseDeformer
  | HeroWaveCustomDeformer;
/**
 * Default travelling deformation. It is independent from path-shape controls:
 * amplitude, frequency and phase velocity live entirely in the propagation stack.
 */
export const HERO_DEFAULT_PROPAGATION_DEFORMERS = [
  {
    id: "primary-harmonics",
    type: "harmonics",
    amplitude: 0.055,
    envelope: "sin2",
    direction: "normal",
    waves: [
      { amplitude: 0.78, frequency: 1.4, phaseSpeed: -1 },
      {
        amplitude: 0.22,
        frequency: 1.17,
        phase: 1.1 / TAU,
        phaseSpeed: 0.63,
      },
    ],
  },
] as const satisfies readonly HeroWaveDeformer[];

export interface HeroWavePropagationOptions {
  enabled?: boolean;
  deformers?: readonly HeroWaveDeformer[];
  domain?: HeroWaveDeformationDomain;
  phaseOffset?: number;
  phaseSpeed?: number;
  combine?: HeroWaveDeformationCombine;
  stage?: HeroWaveDeformationStage;
  recomputeArcLength?: boolean;
}

export interface HeroWaveLongitudinalProfiles {
  width?: HeroWaveScalarProfile;
  opacity?: HeroWaveScalarProfile;
  intensity?: HeroWaveScalarProfile;
  glow?: HeroWaveScalarProfile;
  /** Multiplies the upper-side glow spread along the filament. */
  upperGlowSpread?: HeroWaveScalarProfile;
  /** Multiplies the lower-side glow spread along the filament. */
  lowerGlowSpread?: HeroWaveScalarProfile;
  reflection?: HeroWaveScalarProfile;
  /** Offset added to the regular palette coordinate. */
  colorPosition?: HeroWaveScalarProfile;
}

export interface HeroWavePathTransform {
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
}
export interface HeroWaveOrganicOptions {
  pointCount?: number;
  turns?: number;
  amplitude?: number;
  roughness?: number;
  horizontalJitter?: number;
  speedVariation?: number;
  symmetry?: number;
  seed?: number;
}
export interface HeroWaveShapeConfig {
  waveY?: number;
  strength?: number;
  scale?: number;
  frequency?: number;
}
export interface HeroWaveSvgViewBoxObject {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export type HeroWaveSvgViewBox =
  | readonly [number, number, number, number]
  | HeroWaveSvgViewBoxObject;

export interface HeroWavePathConfig {
  mode?: HeroWavePathMode;
  points?: readonly HeroTrajectoryPoint[];
  closed?: boolean;
  closedLoopTaper?: boolean;
  interpolation?: HeroWavePathInterpolation;
  tension?: number;
  /** One continuous SVG subpath. Use multiple filaments for multiple subpaths. */
  svgPath?: string;
  svgViewBox?: HeroWaveSvgViewBox;
  transform?: HeroWavePathTransform;
  organic?: HeroWaveOrganicOptions;
}
export interface HeroWaveMotionConfig {
  mode?: HeroWaveMotionMode;
  curveTravel?: number;
  pathDrift?: number;
  curveMotion?: number;
  segmentLength?: number;
  tailTaper?: number;
  headTaper?: number;
  speed?: number;
}
export interface HeroWavePaletteConfig {
  stops?: readonly HeroWaveColorStop[];
  interpolation?: HeroWavePaletteInterpolation;
  wrap?: HeroWavePaletteWrap;
  reverse?: boolean;
  speed?: number;
  hue?: number;
  hueDrift?: number;
}
export interface HeroWaveMaterialConfig {
  preset?: HeroWaveMaterialPreset;
  atmosphere?: number;
  broad?: number;
  body?: number;
  ridge?: number;
  core?: number;
  veil?: number;
  exposure?: number;
  saturation?: number;
  intensity?: number;
  glow?: number;
  upperGlowSpread?: number;
  lowerGlowSpread?: number;
  glowAsymmetry?: number;
}
export type HeroWaveMaterialInput =
  | HeroWaveMaterialPreset
  | HeroWaveMaterialConfig;

export interface HeroWaveVelocityInfluence {
  intensity?: number;
  width?: number;
  glow?: number;
  hue?: number;
  reflection?: number;
  response?: number;
  maxVelocityCssPx?: number;
}
export interface HeroWaveFollowPosition {
  x: number;
  y: number;
  space?: "normalized" | "client";
  active?: boolean;
}
export type HeroWaveFollowTarget =
  | "window"
  | "canvas"
  | HTMLElement
  | { readonly current: HTMLElement | null }
  | null;
export type HeroWaveFollowActivation = "path-mode" | "canvas" | "viewport";
export interface HeroWaveFollowOptions {
  mode?: HeroWaveFollowMode;
  target?: HeroWaveFollowTarget;
  /** Temporarily overrides the configured path with follow while inside this area. */
  activation?: HeroWaveFollowActivation;
  /** Seconds used to morph between a conditional fallback path and follow. */
  transitionDuration?: number;
  headResponse?: number;
  /** Hybrid-only blend between the recorded gesture and the inertial rope. */
  viscosity?: number;
  /** Echo lifetime; cascade maps 0.28-1.70 seconds to its 0-1 lag range. */
  memorySeconds?: number;
  /** Echo behavior while the pointer remains inside the target but stops. */
  stationaryBehavior?: HeroWaveFollowStationaryBehavior;
  /** Seconds used by echo to pull its tail along the recorded path. */
  stationaryCollapseDuration?: number;
  /** Maximum persistent spatial history used by hybrid mode. */
  lengthCssPx?: number;
  leaveBehavior?: HeroWaveFollowLeaveBehavior;
  /** Fade duration used by leaveBehavior="fade". */
  fadeDuration?: number;
  idleDelay?: number;
  idleRadiusX?: number;
  idleRadiusY?: number;
  /** Convenience speed used for both idle axes. */
  idleSpeed?: number;
  idleSpeedX?: number;
  idleSpeedY?: number;
  pointerTypes?: readonly HeroWavePointerType[];
  velocityInfluence?: HeroWaveVelocityInfluence;
  position?: HeroWaveFollowPosition;
}
export interface HeroWaveInteractionConfig {
  follow?: HeroWaveFollowOptions;
}
export type HeroWaveDotMode = "flat" | "terrain";
export interface HeroWaveTerrainDotsConfig {
  columns?: number;
  rows?: number;
  width?: number;
  depth?: number;
  amplitude?: number;
  pointSize?: number;
  speed?: number;
  viewAngle?: number;
  cameraDistance?: number;
  frequency?: number;
  opacity?: number;
  edgeFade?: number;
  fit?: "fixed" | "cover";
  /** Clears space around the hero content without introducing another layer. */
  contentFade?: number;
  colorLow?: string;
  colorHigh?: string;
}
export interface HeroWaveDotInteractionConfig {
  enabled?: boolean;
  /** Circular influence radius in CSS pixels. */
  radius?: number;
  /** Fraction of the radius used to feather the interaction edge. */
  softness?: number;
  /** Local dot-energy multiplier. Zero keeps the original brightness. */
  brightness?: number;
  /** Optional color pulled into dots under the pointer. */
  color?: string;
  colorStrength?: number;
  /** Circular lens scale for the flat grid. One is neutral. */
  magnification?: number;
  /** Signed height impulse for terrain dots. */
  terrainDisplacement?: number;
}
export interface HeroWaveDotsConfig {
  enabled?: boolean;
  mode?: HeroWaveDotMode;
  spacing?: number;
  opacity?: number;
  twinkle?: number;
  reflect?: number;
  maskFeather?: number;
  masks?: readonly HeroDotMask[];
  terrain?: HeroWaveTerrainDotsConfig;
  interaction?: HeroWaveDotInteractionConfig;
}
export interface HeroWaveGlassTextConfig {
  enabled?: boolean;
  shape?: "text" | "svg";
  text?: string;
  svgPath?: string;
  svgViewBox?: HeroWaveSvgViewBox;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  /** Center of the glass mask in normalized canvas coordinates. */
  center?: { x?: number; y?: number };
  /** Maximum text width as a fraction of the canvas width. */
  maxWidth?: number;
  /** Maximum text height as a fraction of the canvas height. */
  maxHeight?: number;
  refraction?: number;
  /** Pulls background colors around the glass boundary, in CSS pixels. */
  edgeWrap?: number;
  surfaceModel?: "simple" | "volumetric";
  bevelMode?: "biconvex" | "dome";
  surfaceDepth?: number;
  ior?: number;
  /** Uniform lens strength. Zero disables magnification. */
  magnification?: number;
  /** Overrides uniform magnification on the horizontal axis. */
  magnificationX?: number;
  /** Overrides uniform magnification on the vertical axis. */
  magnificationY?: number;
  /** Optical sample offset in CSS pixels. Positive Y moves downward. */
  displacement?: { x?: number; y?: number };
  /** Broad internal light transport across the letter. */
  diffusion?: number;
  blur?: number;
  distortion?: number;
  chromaticAberration?: number;
  frost?: number;
  roughness?: number;
  bevel?: number;
  ribStrength?: number;
  ribWidth?: number;
  ribAngle?: number;
  liquidStrength?: number;
  liquidScale?: number;
  liquidSpeed?: number;
  edgeStrength?: number;
  specular?: number;
  fresnel?: number;
  /** Animated star-like reflections inside the glass mask. Zero disables them. */
  twinkle?: number;
  /** Fraction of sparkle cells that light up during a pulse. */
  twinkleDensity?: number;
  /** Pulse cycles per second. */
  twinkleSpeed?: number;
  /** Average spacing between sparkle cells in CSS pixels. */
  twinkleSize?: number;
  tint?: string;
  tintStrength?: number;
  saturation?: number;
  brightness?: number;
  opacity?: number;
  /** Intro applied by the WebGL glass pass when the mask becomes active. */
  intro?: {
    /** Delay before the reveal starts, in milliseconds. */
    delay?: number;
    /** Fade and focus duration, in milliseconds. Zero reveals immediately. */
    duration?: number;
    /** Initial signed-distance blur radius, in CSS pixels. */
    blur?: number;
    /** Initial vertical offset, in CSS pixels. */
    offsetY?: number;
    /** Uses the same easing contract as the canvas fade-in. */
    easing?: HeroWaveFadeEasing;
  };
}
export interface HeroWaveBackgroundImageConfig {
  src?: string;
  fit?: "cover" | "contain" | "stretch";
  opacity?: number;
}
export type HeroWaveMusicVisualizerSource = "element" | "microphone";
export type HeroWaveMusicVisualizerBand = "energy" | "bass" | "mid" | "treble";
export interface HeroWaveMusicVisualizerConfig {
  enabled?: boolean;
  /** Analyse an existing HTMLMediaElement by id, or request a microphone stream. */
  source?: HeroWaveMusicVisualizerSource;
  elementId?: string;
  fftSize?: 256 | 512 | 1024 | 2048;
  smoothing?: number;
  sensitivity?: number;
  band?: HeroWaveMusicVisualizerBand;
  /** Normal displacement relative to the canvas height. */
  deformation?: number;
  deformationFrequency?: number;
  width?: number;
  intensity?: number;
  glow?: number;
  hue?: number;
  reflection?: number;
}
export interface HeroWaveQualityConfig {
  preset?: HeroWaveQualityPreset;
  maxDpr?: number;
  /** 0 disables frame throttling. */
  maxFps?: number;
  flatnessPx?: number;
  maxChordPx?: number;
  maxSamples?: number;
  maxSubdivisionDepth?: number;
  farScale?: number;
  midScale?: number;
  coreScale?: number;
  farMaxDimension?: number;
  midMaxDimension?: number;
  coreMaxDimension?: number;
  farMaxChordPx?: number;
  midMaxChordPx?: number;
  coreMaxChordPx?: number;
  farFlatnessPx?: number;
  midFlatnessPx?: number;
  coreFlatnessPx?: number;
  quadrature?: 2 | 4;
}
export interface HeroWaveRendererStatus {
  renderer: "sine" | "hdr" | "legacy" | "unavailable";
  supported: boolean;
  /** True when the renderer intentionally approximates unsupported features. */
  approximate?: boolean;
  reason?: string;
  webglVersion?: 1 | 2;
}
export interface HeroWaveCycleEvent {
  index: number;
  direction: 1 | -1;
  time: number;
  filamentId: string;
}
export interface HeroWaveBackgroundHandle {
  play(): void;
  pause(): void;
  seek(time: number): void;
  step(seconds: number): void;
  getTime(): number;
  invalidate(): void;
}

/** Imperative handle shared by a single wave and a multi-filament scene. */
export type HeroWaveSceneHandle = HeroWaveBackgroundHandle;
export interface HeroWaveFilamentConfig {
  id: string;
  enabled?: boolean;
  /** Per-filament offset on the shared scene timeline, in seconds. */
  timeOffset?: number;
  /** Per-filament multiplier on the shared scene timeline. */
  playbackRate?: number;
  path?: HeroWavePathConfig;
  shape?: HeroWaveShapeConfig;
  motion?: HeroWaveMotionConfig;
  propagation?: HeroWavePropagationOptions;
  profiles?: HeroWaveLongitudinalProfiles;
  material?: HeroWaveMaterialInput;
  palette?: HeroWavePaletteConfig;
  interaction?: HeroWaveInteractionConfig;
  quality?: HeroWaveQualityPreset | HeroWaveQualityConfig;
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
  options: HeroWaveOrganicOptions = {},
): HeroTrajectoryPoint[] {
  const resolvedSeed = Math.trunc(finite(options.seed, seed));
  const count = Math.max(
    MIN_HERO_TRAJECTORY_POINTS,
    Math.trunc(finite(options.pointCount, pointCount)),
  );
  const horizontalPhase = seededTrajectoryValue(resolvedSeed, 31) * Math.PI;
  const verticalPhase = seededTrajectoryValue(resolvedSeed, 47) * Math.PI;
  const turns = finite(
    options.turns,
    0.9 + Math.abs(seededTrajectoryValue(resolvedSeed, 53)) * 1.3,
  );
  const amplitude = finiteClamped(options.amplitude, 0.92, 0, 4);
  const roughness = finiteClamped(options.roughness, 0.28, 0, 1);
  const horizontalJitter = finiteClamped(
    options.horizontalJitter,
    0.08 + Math.abs(seededTrajectoryValue(resolvedSeed, 61)) * 0.12,
    0,
    0.45,
  );
  const speedVariation = finiteClamped(options.speedVariation, 0.7, 0, 3);
  const symmetry = finiteClamped(options.symmetry, 0, 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(count - 1, 1);
    const primary = Math.sin(progress * TAU * turns + verticalPhase);
    const secondary = Math.sin(
      progress * Math.PI * (3.2 + turns) - verticalPhase * 0.7,
    );
    const tertiary = seededTrajectoryValue(resolvedSeed, index + 191);
    const mirroredProgress = 1 - progress;
    const symmetricPrimary = Math.sin(
      mirroredProgress * TAU * turns + verticalPhase,
    );
    const shape =
      (primary * (1 - roughness * 0.35) +
        secondary * roughness * 0.55 +
        tertiary * roughness * 0.18) *
        (1 - symmetry) +
      (primary + symmetricPrimary) * 0.5 * symmetry;
    const x =
      0.04 +
      progress * 0.92 +
      Math.sin(progress * TAU * turns + horizontalPhase) * horizontalJitter;
    return {
      id: `organic-${resolvedSeed}-${index}`,
      x: clamp(x, -0.25, 1.25),
      y: clamp(shape * amplitude, -4, 4),
      speed: clamp(
        1 +
          seededTrajectoryValue(resolvedSeed, index + 73) *
            speedVariation *
            0.5,
        0.05,
        16,
      ),
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

function catmullRomValue(
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

export interface HeroWaveBackgroundProps {
  className?: string;
  style?: CSSProperties;
  /** Visual composition. Light uses a white canvas and luminous tinted blending. */
  theme?: HeroWaveTheme;
  /** Auto uses HDR when available and falls back to legacy for unsupported exact paths. */
  pathRenderer?: HeroWavePathRenderer;
  path?: HeroWavePathConfig;
  shape?: HeroWaveShapeConfig;
  motion?: HeroWaveMotionConfig;
  propagation?: HeroWavePropagationOptions;
  profiles?: HeroWaveLongitudinalProfiles;
  material?: HeroWaveMaterialInput;
  palette?: HeroWavePaletteConfig;
  interaction?: HeroWaveInteractionConfig;
  dots?: HeroWaveDotsConfig;
  glassText?: HeroWaveGlassTextConfig;
  backgroundImage?: HeroWaveBackgroundImageConfig;
  musicVisualizer?: HeroWaveMusicVisualizerConfig;
  quality?: HeroWaveQualityPreset | HeroWaveQualityConfig;
  /** When present, the root path/material configuration is inherited by each filament. */
  filaments?: readonly HeroWaveFilamentConfig[];
  fadeInDuration?: number;
  /** CSS easing preset or cubic-bezier control points for the initial reveal. */
  fadeInEasing?: HeroWaveFadeEasing;
  paused?: boolean;
  /** Controlled animation time in seconds. */
  time?: number;
  initialTime?: number;
  playbackRate?: number;
  respectReducedMotion?: boolean;
  pauseWhenOffscreen?: boolean;
  onCycle?: (event: HeroWaveCycleEvent) => void;
  onReady?: () => void;
  onRendererStatus?: (status: HeroWaveRendererStatus) => void;
  onRendererError?: (error: Error) => void;
  /** Called after an actual renderer draw, including throttled HDR frames. */
  onFrame?: (time: number, delta: number) => void;
}

export interface HeroWaveSceneProps extends HeroWaveBackgroundProps {
  filaments: readonly HeroWaveFilamentConfig[];
}

type HeroWaveBackgroundCoreProps = Omit<
  HeroWaveBackgroundProps,
  "pathRenderer"
>;

/** Internal adapter contract for the pre-existing WebGL1 renderer. */
interface LegacyHeroWaveProps {
  className?: string;
  motionMode?: HeroWaveMotionMode;
  pathMode?: Exclude<HeroWavePathMode, "svg">;
  followMode?: HeroWaveFollowMode;
  followDrift?: number;
  followLag?: number;
  trajectorySeed?: number;
  trajectoryPoints?: readonly HeroTrajectoryPoint[];
  trajectoryClosed?: boolean;
  closedLoopTaper?: boolean;
  waveY?: number;
  curveStrength?: number;
  curveScale?: number;
  curveFrequency?: number;
  curveTravel?: number;
  pathDrift?: number;
  curveMotion?: number;
  segmentLength?: number;
  tailTaper?: number;
  headTaper?: number;
  speed?: number;
  glow?: number;
  upperGlowSpread?: number;
  lowerGlowSpread?: number;
  glowAsymmetry?: number;
  intensity?: number;
  colorSpeed?: number;
  colors?: readonly HeroWaveColorStop[];
  hue?: number;
  hueDrift?: number;
  dotSpacing?: number;
  dotOpacity?: number;
  twinkle?: number;
  reflect?: number;
  maskFeather?: number;
  dotMasks?: readonly HeroDotMask[];
  materialPreset?: HeroWaveMaterialPreset;
  followPosition?: HeroWaveFollowPosition;
  fadeInDuration?: number;
  fadeInEasing?: string;
  paused?: boolean;
  onCycleComplete?: () => void;
  onFrame?: (delta: number) => void;
}

const LegacyHeroWaveBackground = lazy(async () => {
  const module = await import("./hero-wave-background-legacy");
  return {
    default: module.HeroWaveBackground as ComponentType<LegacyHeroWaveProps>,
  };
});

const INTERNAL_DEFAULTS = {
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
  pathRenderer: "auto",
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

interface ResolvedQuality {
  preset: HeroWaveQualityPreset;
  maxDpr: number;
  maxFps: number;
  flatnessPx: number;
  maxChordPx: number;
  maxSamples: number;
  maxSubdivisionDepth: number;
  farScale: number;
  midScale: number;
  coreScale: number;
  farMaxDimension: number;
  midMaxDimension: number;
  coreMaxDimension: number;
  farMaxChordPx: number;
  midMaxChordPx: number;
  coreMaxChordPx: number;
  farFlatnessPx: number;
  midFlatnessPx: number;
  coreFlatnessPx: number;
  quadrature: 2 | 4;
}
interface ResolvedMaterial {
  preset: HeroWaveMaterialPreset;
  atmosphere: number;
  broad: number;
  body: number;
  ridge: number;
  core: number;
  veil: number;
  exposure: number;
  saturation: number;
}
interface ResolvedFollow {
  mode: HeroWaveFollowMode;
  target: HeroWaveFollowTarget;
  activation: HeroWaveFollowActivation;
  transitionDuration: number;
  headResponse: number;
  viscosity: number;
  memorySeconds: number;
  stationaryBehavior: HeroWaveFollowStationaryBehavior;
  stationaryCollapseDuration: number;
  lengthCssPx: number;
  leaveBehavior: HeroWaveFollowLeaveBehavior;
  fadeDuration: number;
  idleDelay: number;
  idleRadiusX: number;
  idleRadiusY: number;
  idleSpeedX: number;
  idleSpeedY: number;
  pointerTypes: readonly HeroWavePointerType[];
  velocityInfluence: Required<HeroWaveVelocityInfluence>;
  position: HeroWaveFollowPosition | undefined;
}
interface ResolvedProfileBounds {
  maximumWidth: number;
  maximumGlow: number;
  maximumUpperGlowSpread: number;
  maximumLowerGlowSpread: number;
}
interface ResolvedTerrainDots {
  columns: number;
  rows: number;
  width: number;
  depth: number;
  amplitude: number;
  pointSize: number;
  speed: number;
  viewAngle: number;
  cameraDistance: number;
  frequency: number;
  opacity: number;
  edgeFade: number;
  fit: "fixed" | "cover";
  contentFade: number;
  colorLow: string;
  colorHigh: string;
}
interface ResolvedDotInteraction {
  enabled: boolean;
  radius: number;
  softness: number;
  brightness: number;
  color: string;
  colorStrength: number;
  magnification: number;
  terrainDisplacement: number;
}
interface ResolvedGlassText {
  enabled: boolean;
  shape: "text" | "svg";
  text: string;
  svgPath: string;
  svgViewBox: readonly [number, number, number, number];
  fontFamily: string;
  fontWeight: number | string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  centerX: number;
  centerY: number;
  maxWidth: number;
  maxHeight: number;
  refraction: number;
  edgeWrap: number;
  surfaceModel: "simple" | "volumetric";
  bevelMode: "biconvex" | "dome";
  surfaceDepth: number;
  ior: number;
  magnificationX: number;
  magnificationY: number;
  displacementX: number;
  displacementY: number;
  diffusion: number;
  blur: number;
  distortion: number;
  chromaticAberration: number;
  frost: number;
  roughness: number;
  bevel: number;
  ribStrength: number;
  ribWidth: number;
  ribAngle: number;
  liquidStrength: number;
  liquidScale: number;
  liquidSpeed: number;
  edgeStrength: number;
  specular: number;
  fresnel: number;
  twinkle: number;
  twinkleDensity: number;
  twinkleSpeed: number;
  twinkleSize: number;
  tint: string;
  tintStrength: number;
  saturation: number;
  brightness: number;
  opacity: number;
  introDelay: number;
  introDuration: number;
  introBlur: number;
  introOffsetY: number;
  introEasing: readonly [number, number, number, number];
}
interface ResolvedBackgroundImage {
  src: string;
  fit: "cover" | "contain" | "stretch";
  opacity: number;
}
interface ResolvedMusicVisualizer {
  enabled: boolean;
  source: HeroWaveMusicVisualizerSource;
  elementId: string;
  fftSize: 256 | 512 | 1024 | 2048;
  smoothing: number;
  sensitivity: number;
  band: HeroWaveMusicVisualizerBand;
  deformation: number;
  deformationFrequency: number;
  width: number;
  intensity: number;
  glow: number;
  hue: number;
  reflection: number;
}
interface Settings {
  id: string;
  theme: HeroWaveTheme;
  enabled: boolean;
  timeOffset: number;
  filamentPlaybackRate: number;
  motionMode: HeroWaveMotionMode;
  pathMode: HeroWavePathMode;
  trajectorySeed: number;
  trajectoryPoints: readonly HeroTrajectoryPoint[];
  trajectoryClosed: boolean;
  closedLoopTaper: boolean;
  trajectoryInterpolation: HeroWavePathInterpolation;
  trajectoryTension: number;
  svgPath: string;
  svgViewBox: readonly [number, number, number, number] | undefined;
  pathTransform: Required<HeroWavePathTransform>;
  organic: Required<HeroWaveOrganicOptions>;
  waveY: number;
  curveStrength: number;
  curveScale: number;
  curveFrequency: number;
  curveTravel: number;
  pathDrift: number;
  curveMotion: number;
  segmentLength: number;
  tailTaper: number;
  headTaper: number;
  speed: number;
  glow: number;
  upperGlowSpread: number;
  lowerGlowSpread: number;
  glowAsymmetry: number;
  intensity: number;
  colorSpeed: number;
  colors: readonly HeroWaveColorStop[];
  paletteInterpolation: HeroWavePaletteInterpolation;
  paletteWrap: HeroWavePaletteWrap;
  paletteReverse: boolean;
  hue: number;
  hueDrift: number;
  propagation: Required<Omit<HeroWavePropagationOptions, "deformers">> & {
    deformers: readonly HeroWaveDeformer[];
  };
  profiles: Required<HeroWaveLongitudinalProfiles>;
  profileBounds: ResolvedProfileBounds;
  material: ResolvedMaterial;
  follow: ResolvedFollow;
  quality: ResolvedQuality;
  dotsEnabled: boolean;
  dotMode: HeroWaveDotMode;
  dotSpacing: number;
  dotOpacity: number;
  twinkle: number;
  reflect: number;
  maskFeather: number;
  dotMasks: readonly HeroDotMask[];
  terrainDots: ResolvedTerrainDots;
  dotInteraction: ResolvedDotInteraction;
  glassText: ResolvedGlassText;
  backgroundImage: ResolvedBackgroundImage;
  musicVisualizer: ResolvedMusicVisualizer;
  fadeInDuration: number;
  fadeInEasing: string;
  paused: boolean;
  controlledTime: number | undefined;
  initialTime: number;
  playbackRate: number;
  respectReducedMotion: boolean;
  pauseWhenOffscreen: boolean;
  filaments: readonly Settings[];
  requiresPathPipeline: boolean;
}

const MATERIAL_PRESETS: Record<HeroWaveMaterialPreset, ResolvedMaterial> = {
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

const QUALITY_PRESETS: Record<
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

function resolveFadeInEasing(
  input: HeroWaveFadeEasing | undefined,
  fallback: string,
) {
  if (input && typeof input !== "string") {
    const x1 = finiteClamped(input[0], 0, 0, 1);
    const y1 = finiteClamped(input[1], 0, -4, 4);
    const x2 = finiteClamped(input[2], 1, 0, 1);
    const y2 = finiteClamped(input[3], 1, -4, 4);
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  }
  return typeof input === "string" ? input : fallback;
}

const FADE_EASING_POINTS: Record<
  HeroWaveFadeEasingPreset,
  readonly [number, number, number, number]
> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

function resolveFadeEasingPoints(
  input: HeroWaveFadeEasing | undefined,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  if (typeof input === "string") return FADE_EASING_POINTS[input];
  if (!input) return fallback;
  return [
    finiteClamped(input[0], fallback[0], 0, 1),
    finiteClamped(input[1], fallback[1], -4, 4),
    finiteClamped(input[2], fallback[2], 0, 1),
    finiteClamped(input[3], fallback[3], -4, 4),
  ];
}

function cubicBezierCoordinate(first: number, second: number, amount: number) {
  const inverse = 1 - amount;
  return (
    3 * inverse * inverse * amount * first +
    3 * inverse * amount * amount * second +
    amount * amount * amount
  );
}

function evaluateFadeEasing(
  progress: number,
  easing: readonly [number, number, number, number],
) {
  const target = clamp(progress, 0, 1);
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 12; iteration++) {
    const amount = (lower + upper) * 0.5;
    if (cubicBezierCoordinate(easing[0], easing[2], amount) < target) {
      lower = amount;
    } else {
      upper = amount;
    }
  }
  return cubicBezierCoordinate(easing[1], easing[3], (lower + upper) * 0.5);
}

function srgbChannelToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number) {
  const clamped = Math.max(value, 0);
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function linearRgbToOklab(
  color: readonly [number, number, number],
): [number, number, number] {
  const l =
    0.4122214708 * color[0] + 0.5363325363 * color[1] + 0.0514459929 * color[2];
  const m =
    0.2119034982 * color[0] + 0.6806995451 * color[1] + 0.1073969566 * color[2];
  const valueS =
    0.0883024619 * color[0] + 0.2817188376 * color[1] + 0.6299787005 * color[2];
  const lRoot = Math.cbrt(Math.max(l, 0));
  const mRoot = Math.cbrt(Math.max(m, 0));
  const sRoot = Math.cbrt(Math.max(valueS, 0));
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function oklabToLinearRgb(
  color: readonly [number, number, number],
): [number, number, number] {
  const lRoot = color[0] + 0.3963377774 * color[1] + 0.2158037573 * color[2];
  const mRoot = color[0] - 0.1055613458 * color[1] - 0.0638541728 * color[2];
  const sRoot = color[0] - 0.0894841775 * color[1] - 1.291485548 * color[2];
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const valueS = sRoot ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * valueS,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * valueS,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * valueS,
  ];
}

function applyStopEasing(amount: number, easing: HeroWaveColorStopEasing) {
  if (easing === "hold") return 0;
  if (easing === "smooth") return amount * amount * (3 - 2 * amount);
  return amount;
}

interface NormalizedColorStop {
  offset: number;
  easing: HeroWaveColorStopEasing;
  srgb: [number, number, number];
}

function normalizeColorStops(
  source: readonly HeroWaveColorStop[],
  reverse: boolean,
) {
  const colors = source.length > 0 ? source : INTERNAL_DEFAULTS.colors;
  const offsets: Array<number | undefined> = colors.map((stop) =>
    Number.isFinite(stop.offset)
      ? clamp(stop.offset as number, 0, 1)
      : undefined,
  );
  if (!offsets.some((offset) => offset !== undefined)) {
    for (let index = 0; index < offsets.length; index++) {
      offsets[index] = index / Math.max(offsets.length - 1, 1);
    }
  } else {
    if (offsets[0] === undefined) offsets[0] = 0;
    if (offsets[offsets.length - 1] === undefined)
      offsets[offsets.length - 1] = 1;
    let left = 0;
    while (left < offsets.length - 1) {
      let right = left + 1;
      while (right < offsets.length && offsets[right] === undefined) right += 1;
      const from = offsets[left] ?? 0;
      const to = Math.max(offsets[right] ?? from, from);
      const span = right - left;
      for (let index = 1; index < span; index++)
        offsets[left + index] = from + ((to - from) * index) / span;
      offsets[right] = to;
      left = right;
    }
  }
  const normalized: NormalizedColorStop[] = colors
    .map((stop, index) => ({
      offset: offsets[index] ?? index / Math.max(colors.length - 1, 1),
      easing: (stop as HeroWaveColorStop).easing ?? "linear",
      srgb: hexToVec3(stop.color),
    }))
    .sort((left, right) => left.offset - right.offset);
  if (normalized.length === 1) {
    normalized.push({ ...normalized[0]!, offset: 1 });
    normalized[0]!.offset = 0;
  }
  if (!reverse) return normalized;
  return normalized
    .map((stop) => ({ ...stop, offset: 1 - stop.offset }))
    .reverse();
}

function interpolatePaletteColor(
  left: NormalizedColorStop,
  right: NormalizedColorStop,
  amount: number,
  interpolation: HeroWavePaletteInterpolation,
): [number, number, number] {
  const eased = applyStopEasing(clamp(amount, 0, 1), left.easing);
  if (interpolation === "srgb") {
    return [0, 1, 2].map(
      (index) =>
        left.srgb[index]! + (right.srgb[index]! - left.srgb[index]!) * eased,
    ) as [number, number, number];
  }
  const leftLinear = left.srgb.map(srgbChannelToLinear) as [
    number,
    number,
    number,
  ];
  const rightLinear = right.srgb.map(srgbChannelToLinear) as [
    number,
    number,
    number,
  ];
  let mixed: [number, number, number];
  if (interpolation === "oklab") {
    const a = linearRgbToOklab(leftLinear);
    const b = linearRgbToOklab(rightLinear);
    mixed = oklabToLinearRgb([
      a[0] + (b[0] - a[0]) * eased,
      a[1] + (b[1] - a[1]) * eased,
      a[2] + (b[2] - a[2]) * eased,
    ]);
  } else {
    mixed = [0, 1, 2].map(
      (index) =>
        leftLinear[index]! + (rightLinear[index]! - leftLinear[index]!) * eased,
    ) as [number, number, number];
  }
  return mixed.map((value) => clamp(linearChannelToSrgb(value), 0, 1)) as [
    number,
    number,
    number,
  ];
}

function paletteColorAt(
  stops: readonly NormalizedColorStop[],
  progress: number,
  interpolation: HeroWavePaletteInterpolation,
  cyclic: boolean,
) {
  const position = cyclic ? ((progress % 1) + 1) % 1 : clamp(progress, 0, 1);
  if (
    cyclic &&
    (position < stops[0]!.offset || position >= stops[stops.length - 1]!.offset)
  ) {
    const left = stops[stops.length - 1]!;
    const right = stops[0]!;
    const span = 1 - left.offset + right.offset;
    const adjusted = position < right.offset ? position + 1 : position;
    return interpolatePaletteColor(
      left,
      right,
      span > 0 ? (adjusted - left.offset) / span : 0,
      interpolation,
    );
  }
  let rightIndex = 1;
  while (rightIndex < stops.length && position > stops[rightIndex]!.offset)
    rightIndex += 1;
  const right = stops[Math.min(stops.length - 1, rightIndex)]!;
  const left = stops[Math.max(0, rightIndex - 1)] ?? right;
  return interpolatePaletteColor(
    left,
    right,
    (position - left.offset) / Math.max(right.offset - left.offset, 0.000001),
    interpolation,
  );
}

function buildHeroPaletteTextureData(
  source: readonly HeroWaveColorStop[],
  interpolation: HeroWavePaletteInterpolation = "srgb",
  reverse = false,
) {
  const stops = normalizeColorStops(source, reverse);
  const data = new Uint8Array(HERO_PALETTE_TEXTURE_WIDTH * 4);
  const half = HERO_PALETTE_TEXTURE_WIDTH / 2;
  const write = (index: number, progress: number, cyclic: boolean) => {
    const color = paletteColorAt(stops, progress, interpolation, cyclic);
    const offset = index * 4;
    data[offset] = Math.round(color[0] * 255);
    data[offset + 1] = Math.round(color[1] * 255);
    data[offset + 2] = Math.round(color[2] * 255);
    data[offset + 3] = 255;
  };
  for (let index = 0; index < half; index++) {
    const progress = index / Math.max(half - 1, 1);
    write(index, progress, false);
    write(half + index, progress, true);
  }
  return data;
}

function wrapProfilePosition(value: number, wrap: HeroWaveProfileWrap) {
  if (wrap === "repeat") return ((value % 1) + 1) % 1;
  if (wrap === "mirror") {
    const wrapped = ((value % 2) + 2) % 2;
    return wrapped <= 1 ? wrapped : 2 - wrapped;
  }
  return clamp(value, 0, 1);
}
function smoothProfileAmount(amount: number) {
  const clamped = clamp(amount, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
function sampleProfileArray(
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

interface PreparedCurveKey {
  position: number;
  value: number;
  inTangent: number;
  outTangent: number;
}

const preparedCurveProfiles = new WeakMap<
  HeroWaveCurveProfile,
  readonly PreparedCurveKey[]
>();

function preparedCurveKeys(profile: HeroWaveCurveProfile) {
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

function evaluateCurveProfile(profile: HeroWaveCurveProfile, progress: number) {
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

function evaluateScalarProfile(
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
function buildLongitudinalProfileTextureData(
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

function resolveAutoQualityPreset(): Exclude<HeroWaveQualityPreset, "auto"> {
  if (typeof navigator === "undefined") return "high";
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  if ((memory !== undefined && memory <= 4) || cores <= 4) return "balanced";
  if (memory !== undefined && memory >= 8 && cores >= 8) return "high";
  return "balanced";
}
function resolveQuality(
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
function resolveMaterial(
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

function resolveProfileBounds(
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

function normalizeSvgViewBox(
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

interface StructuredWaveConfig {
  theme?: HeroWaveTheme | undefined;
  path?: HeroWavePathConfig | undefined;
  shape?: HeroWaveShapeConfig | undefined;
  motion?: HeroWaveMotionConfig | undefined;
  propagation?: HeroWavePropagationOptions | undefined;
  profiles?: HeroWaveLongitudinalProfiles | undefined;
  material?: HeroWaveMaterialInput | undefined;
  palette?: HeroWavePaletteConfig | undefined;
  interaction?: HeroWaveInteractionConfig | undefined;
  dots?: HeroWaveDotsConfig | undefined;
  glassText?: HeroWaveGlassTextConfig | undefined;
  backgroundImage?: HeroWaveBackgroundImageConfig | undefined;
  musicVisualizer?: HeroWaveMusicVisualizerConfig | undefined;
  quality?: HeroWaveQualityPreset | HeroWaveQualityConfig | undefined;
  fadeInDuration?: number | undefined;
  fadeInEasing?: HeroWaveFadeEasing | undefined;
  paused?: boolean | undefined;
  time?: number | undefined;
  initialTime?: number | undefined;
  playbackRate?: number | undefined;
  respectReducedMotion?: boolean | undefined;
  pauseWhenOffscreen?: boolean | undefined;
}

interface ResolveSettingsOverrides {
  enabled?: boolean | undefined;
  timeOffset?: number | undefined;
  filamentPlaybackRate?: number | undefined;
}

function resolveOneSettings(
  input: StructuredWaveConfig,
  id: string,
  inherited?: Settings,
  overrides: ResolveSettingsOverrides = {},
): Settings {
  const path = input.path;
  const shape = input.shape;
  const motion = input.motion;
  const palette = input.palette;
  const materialInput = input.material;
  const materialConfig =
    typeof materialInput === "string"
      ? ({ preset: materialInput } satisfies HeroWaveMaterialConfig)
      : materialInput;
  const dots = input.dots;
  const terrainInput = dots?.terrain;
  const dotInteractionInput = dots?.interaction;
  const glassInput = input.glassText;
  const backgroundImageInput = input.backgroundImage;
  const musicVisualizerInput = input.musicVisualizer;
  const followInput = input.interaction?.follow;

  const motionMode =
    motion?.mode ?? inherited?.motionMode ?? INTERNAL_DEFAULTS.motionMode;
  const svgPathValue = path?.svgPath ?? inherited?.svgPath ?? "";
  const pathMode: HeroWavePathMode =
    path?.mode ??
    (path?.svgPath ? "svg" : undefined) ??
    inherited?.pathMode ??
    INTERNAL_DEFAULTS.pathMode;
  const curveFrequency = finiteClamped(
    shape?.frequency,
    inherited?.curveFrequency ?? INTERNAL_DEFAULTS.curveFrequency,
    0.01,
    64,
  );
  const curveTravel = finiteClamped(
    motion?.curveTravel,
    inherited?.curveTravel ?? INTERNAL_DEFAULTS.curveTravel,
    -16,
    16,
  );
  const curveMotion = finiteClamped(
    motion?.curveMotion,
    inherited?.curveMotion ?? INTERNAL_DEFAULTS.curveMotion,
    0,
    8,
  );
  const curveScale = finiteClamped(
    shape?.scale,
    inherited?.curveScale ?? INTERNAL_DEFAULTS.curveScale,
    0,
    8,
  );
  const curveStrength = finiteClamped(
    shape?.strength,
    inherited?.curveStrength ?? INTERNAL_DEFAULTS.curveStrength,
    0,
    4,
  );

  const explicitPropagation = input.propagation;
  const inheritedPropagation = inherited?.propagation;
  const propagationEnabled =
    explicitPropagation?.enabled ??
    (explicitPropagation !== undefined
      ? true
      : motion?.mode === "propagate"
        ? true
        : (inheritedPropagation?.enabled ?? motionMode === "propagate"));
  const propagation = {
    enabled: propagationEnabled,
    deformers:
      explicitPropagation?.deformers ??
      inheritedPropagation?.deformers ??
      HERO_DEFAULT_PROPAGATION_DEFORMERS,
    domain:
      explicitPropagation?.domain ??
      inheritedPropagation?.domain ??
      "arcLength",
    phaseOffset: finite(
      explicitPropagation?.phaseOffset,
      inheritedPropagation?.phaseOffset ?? 0,
    ),
    phaseSpeed: finite(
      explicitPropagation?.phaseSpeed,
      inheritedPropagation?.phaseSpeed ?? 1,
    ),
    combine:
      explicitPropagation?.combine ?? inheritedPropagation?.combine ?? "add",
    stage:
      explicitPropagation?.stage ??
      inheritedPropagation?.stage ??
      "after-follow",
    recomputeArcLength:
      explicitPropagation?.recomputeArcLength ??
      inheritedPropagation?.recomputeArcLength ??
      false,
  } as Settings["propagation"];

  const profiles: Required<HeroWaveLongitudinalProfiles> = {
    width: input.profiles?.width ?? inherited?.profiles.width ?? 1,
    opacity: input.profiles?.opacity ?? inherited?.profiles.opacity ?? 1,
    intensity: input.profiles?.intensity ?? inherited?.profiles.intensity ?? 1,
    glow: input.profiles?.glow ?? inherited?.profiles.glow ?? 1,
    upperGlowSpread:
      input.profiles?.upperGlowSpread ??
      inherited?.profiles.upperGlowSpread ??
      1,
    lowerGlowSpread:
      input.profiles?.lowerGlowSpread ??
      inherited?.profiles.lowerGlowSpread ??
      1,
    reflection:
      input.profiles?.reflection ?? inherited?.profiles.reflection ?? 1,
    colorPosition:
      input.profiles?.colorPosition ?? inherited?.profiles.colorPosition ?? 0,
  };

  const organicInput = path?.organic;
  const organic: Required<HeroWaveOrganicOptions> = {
    pointCount: Math.trunc(
      finiteClamped(
        organicInput?.pointCount,
        inherited?.organic.pointCount ?? 12,
        MIN_HERO_TRAJECTORY_POINTS,
        256,
      ),
    ),
    turns: finiteClamped(
      organicInput?.turns,
      inherited?.organic.turns ?? 1.55,
      0.1,
      12,
    ),
    amplitude: finiteClamped(
      organicInput?.amplitude,
      inherited?.organic.amplitude ?? 0.92,
      0,
      4,
    ),
    roughness: finiteClamped(
      organicInput?.roughness,
      inherited?.organic.roughness ?? 0.28,
      0,
      1,
    ),
    horizontalJitter: finiteClamped(
      organicInput?.horizontalJitter,
      inherited?.organic.horizontalJitter ?? 0.14,
      0,
      0.45,
    ),
    speedVariation: finiteClamped(
      organicInput?.speedVariation,
      inherited?.organic.speedVariation ?? 0.7,
      0,
      3,
    ),
    symmetry: finiteClamped(
      organicInput?.symmetry,
      inherited?.organic.symmetry ?? 0,
      0,
      1,
    ),
    seed: Math.trunc(
      finite(
        organicInput?.seed,
        inherited?.organic.seed ?? INTERNAL_DEFAULTS.trajectorySeed,
      ),
    ),
  };

  const transformInput = path?.transform;
  const pathTransform: Required<HeroWavePathTransform> = {
    x: finite(transformInput?.x, inherited?.pathTransform.x ?? 0),
    y: finite(transformInput?.y, inherited?.pathTransform.y ?? 0),
    scaleX: finite(
      transformInput?.scaleX,
      inherited?.pathTransform.scaleX ?? 1,
    ),
    scaleY: finite(
      transformInput?.scaleY,
      inherited?.pathTransform.scaleY ?? 1,
    ),
    rotation: finite(
      transformInput?.rotation,
      inherited?.pathTransform.rotation ?? 0,
    ),
    anchorX: finite(
      transformInput?.anchorX,
      inherited?.pathTransform.anchorX ?? 0.5,
    ),
    anchorY: finite(
      transformInput?.anchorY,
      inherited?.pathTransform.anchorY ?? 0.5,
    ),
  };

  const viscosity = finiteClamped(
    followInput?.viscosity,
    inherited?.follow.viscosity ?? INTERNAL_DEFAULTS.followViscosity,
    0,
    1,
  );
  const velocityInput = followInput?.velocityInfluence;
  const follow: ResolvedFollow = {
    mode:
      followInput?.mode ??
      inherited?.follow.mode ??
      INTERNAL_DEFAULTS.followMode,
    target: followInput?.target ?? inherited?.follow.target ?? "window",
    activation:
      followInput?.activation ?? inherited?.follow.activation ?? "path-mode",
    transitionDuration: finiteClamped(
      followInput?.transitionDuration,
      inherited?.follow.transitionDuration ?? 0,
      0,
      5,
    ),
    headResponse: finiteClamped(
      followInput?.headResponse,
      inherited?.follow.headResponse ?? 1,
      0.01,
      1,
    ),
    viscosity,
    memorySeconds: finiteClamped(
      followInput?.memorySeconds,
      inherited?.follow.memorySeconds ?? 0.92,
      0.05,
      12,
    ),
    stationaryBehavior:
      followInput?.stationaryBehavior ??
      inherited?.follow.stationaryBehavior ??
      "collapse",
    stationaryCollapseDuration: finiteClamped(
      followInput?.stationaryCollapseDuration,
      inherited?.follow.stationaryCollapseDuration ?? 1.2,
      0.1,
      30,
    ),
    lengthCssPx: finiteClamped(
      followInput?.lengthCssPx,
      inherited?.follow.lengthCssPx ?? 1800,
      16,
      20_000,
    ),
    leaveBehavior:
      followInput?.leaveBehavior ??
      inherited?.follow.leaveBehavior ??
      "collapse",
    fadeDuration: finiteClamped(
      followInput?.fadeDuration,
      inherited?.follow.fadeDuration ?? 0.35,
      0.01,
      30,
    ),
    idleDelay: finiteClamped(
      followInput?.idleDelay,
      inherited?.follow.idleDelay ?? 0.35,
      0,
      30,
    ),
    idleRadiusX: finiteClamped(
      followInput?.idleRadiusX,
      inherited?.follow.idleRadiusX ?? 90,
      0,
      2000,
    ),
    idleRadiusY: finiteClamped(
      followInput?.idleRadiusY,
      inherited?.follow.idleRadiusY ?? 65,
      0,
      2000,
    ),
    idleSpeedX: finiteClamped(
      followInput?.idleSpeedX ?? followInput?.idleSpeed,
      inherited?.follow.idleSpeedX ?? 0.55,
      -10,
      10,
    ),
    idleSpeedY: finiteClamped(
      followInput?.idleSpeedY ?? followInput?.idleSpeed,
      inherited?.follow.idleSpeedY ?? 0.4565,
      -10,
      10,
    ),
    pointerTypes:
      followInput?.pointerTypes ??
      inherited?.follow.pointerTypes ??
      (["mouse", "pen", "touch"] as const),
    velocityInfluence: {
      intensity: finiteClamped(
        velocityInput?.intensity,
        inherited?.follow.velocityInfluence.intensity ?? 0.08,
        -2,
        2,
      ),
      width: finiteClamped(
        velocityInput?.width,
        inherited?.follow.velocityInfluence.width ?? 0.05,
        -2,
        2,
      ),
      glow: finiteClamped(
        velocityInput?.glow,
        inherited?.follow.velocityInfluence.glow ?? 0.08,
        -2,
        2,
      ),
      hue: finiteClamped(
        velocityInput?.hue,
        inherited?.follow.velocityInfluence.hue ?? 8,
        -360,
        360,
      ),
      reflection: finiteClamped(
        velocityInput?.reflection,
        inherited?.follow.velocityInfluence.reflection ?? 0.08,
        -2,
        2,
      ),
      response: finiteClamped(
        velocityInput?.response,
        inherited?.follow.velocityInfluence.response ?? 12,
        0.1,
        120,
      ),
      maxVelocityCssPx: finiteClamped(
        velocityInput?.maxVelocityCssPx,
        inherited?.follow.velocityInfluence.maxVelocityCssPx ?? 1400,
        10,
        20_000,
      ),
    },
    position: followInput?.position ?? inherited?.follow.position,
  };

  const quality =
    input.quality !== undefined
      ? resolveQuality(input.quality)
      : (inherited?.quality ?? resolveQuality(undefined));
  const colors =
    palette?.stops ?? inherited?.colors ?? INTERNAL_DEFAULTS.colors;
  const trajectoryPoints =
    path?.points ??
    inherited?.trajectoryPoints ??
    INTERNAL_DEFAULTS.trajectoryPoints;
  const trajectoryClosed =
    path?.closed ??
    (path?.svgPath ? /[zZ]\s*$/.test(path.svgPath.trim()) : undefined) ??
    inherited?.trajectoryClosed ??
    INTERNAL_DEFAULTS.trajectoryClosed;
  const material = resolveMaterial(materialInput, inherited?.material);
  const inheritedTerrain =
    inherited?.terrainDots ?? INTERNAL_DEFAULTS.terrainDots;
  const terrainDots: ResolvedTerrainDots = {
    columns: Math.round(
      finiteClamped(terrainInput?.columns, inheritedTerrain.columns, 8, 320),
    ),
    rows: Math.round(
      finiteClamped(terrainInput?.rows, inheritedTerrain.rows, 8, 240),
    ),
    width: finiteClamped(terrainInput?.width, inheritedTerrain.width, 1, 24),
    depth: finiteClamped(terrainInput?.depth, inheritedTerrain.depth, 1, 24),
    amplitude: finiteClamped(
      terrainInput?.amplitude,
      inheritedTerrain.amplitude,
      0,
      4,
    ),
    pointSize: finiteClamped(
      terrainInput?.pointSize,
      inheritedTerrain.pointSize,
      0.25,
      16,
    ),
    speed: finiteClamped(terrainInput?.speed, inheritedTerrain.speed, -8, 8),
    viewAngle: finiteClamped(
      terrainInput?.viewAngle,
      inheritedTerrain.viewAngle,
      12,
      82,
    ),
    cameraDistance: finiteClamped(
      terrainInput?.cameraDistance,
      inheritedTerrain.cameraDistance,
      1,
      16,
    ),
    frequency: finiteClamped(
      terrainInput?.frequency,
      inheritedTerrain.frequency,
      0.05,
      16,
    ),
    opacity: finiteClamped(
      terrainInput?.opacity,
      inheritedTerrain.opacity,
      0,
      1,
    ),
    edgeFade: finiteClamped(
      terrainInput?.edgeFade,
      inheritedTerrain.edgeFade,
      0,
      0.5,
    ),
    fit: terrainInput?.fit ?? inheritedTerrain.fit,
    contentFade: finiteClamped(
      terrainInput?.contentFade,
      inheritedTerrain.contentFade,
      0,
      1,
    ),
    colorLow: terrainInput?.colorLow ?? inheritedTerrain.colorLow,
    colorHigh: terrainInput?.colorHigh ?? inheritedTerrain.colorHigh,
  };
  const inheritedDotInteraction =
    inherited?.dotInteraction ?? INTERNAL_DEFAULTS.dotInteraction;
  const dotInteraction: ResolvedDotInteraction = {
    enabled:
      dotInteractionInput?.enabled ?? inheritedDotInteraction.enabled ?? false,
    radius: finiteClamped(
      dotInteractionInput?.radius,
      inheritedDotInteraction.radius,
      8,
      1200,
    ),
    softness: finiteClamped(
      dotInteractionInput?.softness,
      inheritedDotInteraction.softness,
      0.01,
      1,
    ),
    brightness: finiteClamped(
      dotInteractionInput?.brightness,
      inheritedDotInteraction.brightness,
      -1,
      8,
    ),
    color: dotInteractionInput?.color ?? inheritedDotInteraction.color,
    colorStrength: finiteClamped(
      dotInteractionInput?.colorStrength,
      inheritedDotInteraction.colorStrength,
      0,
      1,
    ),
    magnification: finiteClamped(
      dotInteractionInput?.magnification,
      inheritedDotInteraction.magnification,
      0.25,
      5,
    ),
    terrainDisplacement: finiteClamped(
      dotInteractionInput?.terrainDisplacement,
      inheritedDotInteraction.terrainDisplacement,
      -4,
      4,
    ),
  };
  const inheritedGlass = inherited?.glassText ?? INTERNAL_DEFAULTS.glassText;
  const uniformMagnification = glassInput?.magnification;
  const glassText: ResolvedGlassText = {
    enabled: glassInput?.enabled ?? inheritedGlass.enabled,
    shape: glassInput?.shape ?? inheritedGlass.shape,
    text: glassInput?.text ?? inheritedGlass.text,
    svgPath: glassInput?.svgPath ?? inheritedGlass.svgPath,
    svgViewBox:
      normalizeSvgViewBox(glassInput?.svgViewBox) ?? inheritedGlass.svgViewBox,
    fontFamily: glassInput?.fontFamily ?? inheritedGlass.fontFamily,
    fontWeight: glassInput?.fontWeight ?? inheritedGlass.fontWeight,
    fontSize: finiteClamped(
      glassInput?.fontSize,
      inheritedGlass.fontSize,
      8,
      512,
    ),
    lineHeight: finiteClamped(
      glassInput?.lineHeight,
      inheritedGlass.lineHeight,
      0.5,
      3,
    ),
    letterSpacing: finiteClamped(
      glassInput?.letterSpacing,
      inheritedGlass.letterSpacing,
      -32,
      64,
    ),
    centerX: finiteClamped(glassInput?.center?.x, inheritedGlass.centerX, 0, 1),
    centerY: finiteClamped(glassInput?.center?.y, inheritedGlass.centerY, 0, 1),
    maxWidth: finiteClamped(
      glassInput?.maxWidth,
      inheritedGlass.maxWidth,
      0.05,
      1,
    ),
    maxHeight: finiteClamped(
      glassInput?.maxHeight,
      inheritedGlass.maxHeight,
      0.05,
      1,
    ),
    refraction: finiteClamped(
      glassInput?.refraction,
      inheritedGlass.refraction,
      0,
      128,
    ),
    edgeWrap: finiteClamped(
      glassInput?.edgeWrap,
      inheritedGlass.edgeWrap,
      0,
      256,
    ),
    surfaceModel: glassInput?.surfaceModel ?? inheritedGlass.surfaceModel,
    bevelMode: glassInput?.bevelMode ?? inheritedGlass.bevelMode,
    surfaceDepth: finiteClamped(
      glassInput?.surfaceDepth,
      inheritedGlass.surfaceDepth,
      1,
      256,
    ),
    ior: finiteClamped(glassInput?.ior, inheritedGlass.ior, 1.01, 2.5),
    magnificationX: finiteClamped(
      glassInput?.magnificationX ?? uniformMagnification,
      inheritedGlass.magnificationX,
      0,
      3,
    ),
    magnificationY: finiteClamped(
      glassInput?.magnificationY ?? uniformMagnification,
      inheritedGlass.magnificationY,
      0,
      3,
    ),
    displacementX: finiteClamped(
      glassInput?.displacement?.x,
      inheritedGlass.displacementX,
      -512,
      512,
    ),
    displacementY: finiteClamped(
      glassInput?.displacement?.y,
      inheritedGlass.displacementY,
      -512,
      512,
    ),
    diffusion: finiteClamped(
      glassInput?.diffusion,
      inheritedGlass.diffusion,
      0,
      1,
    ),
    blur: finiteClamped(glassInput?.blur, inheritedGlass.blur, 0, 1),
    distortion: finiteClamped(
      glassInput?.distortion,
      inheritedGlass.distortion,
      0,
      1,
    ),
    chromaticAberration: finiteClamped(
      glassInput?.chromaticAberration,
      inheritedGlass.chromaticAberration,
      0,
      32,
    ),
    frost: finiteClamped(glassInput?.frost, inheritedGlass.frost, 0, 1),
    roughness: finiteClamped(
      glassInput?.roughness,
      inheritedGlass.roughness,
      0,
      1,
    ),
    bevel: finiteClamped(glassInput?.bevel, inheritedGlass.bevel, 0, 4),
    ribStrength: finiteClamped(
      glassInput?.ribStrength,
      inheritedGlass.ribStrength,
      0,
      2,
    ),
    ribWidth: finiteClamped(
      glassInput?.ribWidth,
      inheritedGlass.ribWidth,
      1,
      256,
    ),
    ribAngle: finite(glassInput?.ribAngle, inheritedGlass.ribAngle),
    liquidStrength: finiteClamped(
      glassInput?.liquidStrength,
      inheritedGlass.liquidStrength,
      0,
      2,
    ),
    liquidScale: finiteClamped(
      glassInput?.liquidScale,
      inheritedGlass.liquidScale,
      0.05,
      32,
    ),
    liquidSpeed: finiteClamped(
      glassInput?.liquidSpeed,
      inheritedGlass.liquidSpeed,
      -8,
      8,
    ),
    edgeStrength: finiteClamped(
      glassInput?.edgeStrength,
      inheritedGlass.edgeStrength,
      0,
      4,
    ),
    specular: finiteClamped(
      glassInput?.specular,
      inheritedGlass.specular,
      0,
      4,
    ),
    fresnel: finiteClamped(glassInput?.fresnel, inheritedGlass.fresnel, 0, 4),
    twinkle: finiteClamped(glassInput?.twinkle, inheritedGlass.twinkle, 0, 4),
    twinkleDensity: finiteClamped(
      glassInput?.twinkleDensity,
      inheritedGlass.twinkleDensity,
      0,
      1,
    ),
    twinkleSpeed: finiteClamped(
      glassInput?.twinkleSpeed,
      inheritedGlass.twinkleSpeed,
      0,
      8,
    ),
    twinkleSize: finiteClamped(
      glassInput?.twinkleSize,
      inheritedGlass.twinkleSize,
      4,
      160,
    ),
    tint: glassInput?.tint ?? inheritedGlass.tint,
    tintStrength: finiteClamped(
      glassInput?.tintStrength,
      inheritedGlass.tintStrength,
      0,
      1,
    ),
    saturation: finiteClamped(
      glassInput?.saturation,
      inheritedGlass.saturation,
      -1,
      2,
    ),
    brightness: finiteClamped(
      glassInput?.brightness,
      inheritedGlass.brightness,
      -0.75,
      1,
    ),
    opacity: finiteClamped(glassInput?.opacity, inheritedGlass.opacity, 0, 1),
    introDelay: finiteClamped(
      glassInput?.intro?.delay,
      inheritedGlass.introDelay,
      0,
      10000,
    ),
    introDuration: finiteClamped(
      glassInput?.intro?.duration,
      inheritedGlass.introDuration,
      0,
      10000,
    ),
    introBlur: finiteClamped(
      glassInput?.intro?.blur,
      inheritedGlass.introBlur,
      0,
      HERO_GLASS_SDF_RANGE_CSS_PX,
    ),
    introOffsetY: finiteClamped(
      glassInput?.intro?.offsetY,
      inheritedGlass.introOffsetY,
      -128,
      128,
    ),
    introEasing: resolveFadeEasingPoints(
      glassInput?.intro?.easing,
      inheritedGlass.introEasing,
    ),
  };
  const inheritedBackgroundImage =
    inherited?.backgroundImage ?? INTERNAL_DEFAULTS.backgroundImage;
  const backgroundImage: ResolvedBackgroundImage = {
    src: backgroundImageInput?.src ?? inheritedBackgroundImage.src,
    fit: backgroundImageInput?.fit ?? inheritedBackgroundImage.fit,
    opacity: finiteClamped(
      backgroundImageInput?.opacity,
      inheritedBackgroundImage.opacity,
      0,
      1,
    ),
  };
  const inheritedMusicVisualizer =
    inherited?.musicVisualizer ?? INTERNAL_DEFAULTS.musicVisualizer;
  const requestedFftSize = finite(
    musicVisualizerInput?.fftSize,
    inheritedMusicVisualizer.fftSize,
  );
  const fftSize: ResolvedMusicVisualizer["fftSize"] =
    requestedFftSize <= 256
      ? 256
      : requestedFftSize <= 512
        ? 512
        : requestedFftSize <= 1024
          ? 1024
          : 2048;
  const musicVisualizer: ResolvedMusicVisualizer = {
    enabled: musicVisualizerInput?.enabled ?? inheritedMusicVisualizer.enabled,
    source: musicVisualizerInput?.source ?? inheritedMusicVisualizer.source,
    elementId:
      musicVisualizerInput?.elementId ?? inheritedMusicVisualizer.elementId,
    fftSize,
    smoothing: finiteClamped(
      musicVisualizerInput?.smoothing,
      inheritedMusicVisualizer.smoothing,
      0,
      0.99,
    ),
    sensitivity: finiteClamped(
      musicVisualizerInput?.sensitivity,
      inheritedMusicVisualizer.sensitivity,
      0,
      8,
    ),
    band: musicVisualizerInput?.band ?? inheritedMusicVisualizer.band,
    deformation: finiteClamped(
      musicVisualizerInput?.deformation,
      inheritedMusicVisualizer.deformation,
      0,
      0.5,
    ),
    deformationFrequency: finiteClamped(
      musicVisualizerInput?.deformationFrequency,
      inheritedMusicVisualizer.deformationFrequency,
      0.1,
      32,
    ),
    width: finiteClamped(
      musicVisualizerInput?.width,
      inheritedMusicVisualizer.width,
      -0.95,
      4,
    ),
    intensity: finiteClamped(
      musicVisualizerInput?.intensity,
      inheritedMusicVisualizer.intensity,
      -1,
      8,
    ),
    glow: finiteClamped(
      musicVisualizerInput?.glow,
      inheritedMusicVisualizer.glow,
      -0.95,
      8,
    ),
    hue: finiteClamped(
      musicVisualizerInput?.hue,
      inheritedMusicVisualizer.hue,
      -360,
      360,
    ),
    reflection: finiteClamped(
      musicVisualizerInput?.reflection,
      inheritedMusicVisualizer.reflection,
      -1,
      8,
    ),
  };

  const settings: Settings = {
    id,
    theme: input.theme ?? inherited?.theme ?? INTERNAL_DEFAULTS.theme,
    enabled: overrides.enabled ?? inherited?.enabled ?? true,
    timeOffset: finite(overrides.timeOffset, inherited?.timeOffset ?? 0),
    filamentPlaybackRate: finiteClamped(
      overrides.filamentPlaybackRate,
      inherited?.filamentPlaybackRate ?? 1,
      -16,
      16,
    ),
    motionMode,
    pathMode,
    trajectorySeed: organic.seed,
    trajectoryPoints,
    trajectoryClosed,
    closedLoopTaper:
      path?.closedLoopTaper ??
      inherited?.closedLoopTaper ??
      INTERNAL_DEFAULTS.closedLoopTaper,
    trajectoryInterpolation:
      path?.interpolation ??
      inherited?.trajectoryInterpolation ??
      INTERNAL_DEFAULTS.trajectoryInterpolation,
    trajectoryTension: finiteClamped(
      path?.tension,
      inherited?.trajectoryTension ?? INTERNAL_DEFAULTS.trajectoryTension,
      -1,
      1,
    ),
    svgPath: svgPathValue,
    svgViewBox:
      path?.svgViewBox !== undefined
        ? normalizeSvgViewBox(path.svgViewBox)
        : path?.svgPath !== undefined
          ? undefined
          : inherited?.svgViewBox,
    pathTransform,
    organic,
    waveY: finiteClamped(
      shape?.waveY,
      inherited?.waveY ?? INTERNAL_DEFAULTS.waveY,
      -4,
      4,
    ),
    curveStrength,
    curveScale,
    curveFrequency,
    curveTravel,
    pathDrift: finiteClamped(
      motion?.pathDrift,
      inherited?.pathDrift ?? INTERNAL_DEFAULTS.pathDrift,
      -4,
      4,
    ),
    curveMotion,
    segmentLength: finiteClamped(
      motion?.segmentLength,
      inherited?.segmentLength ?? INTERNAL_DEFAULTS.segmentLength,
      0.01,
      16,
    ),
    tailTaper: finiteClamped(
      motion?.tailTaper,
      inherited?.tailTaper ?? INTERNAL_DEFAULTS.tailTaper,
      0.001,
      1,
    ),
    headTaper: finiteClamped(
      motion?.headTaper,
      inherited?.headTaper ?? INTERNAL_DEFAULTS.headTaper,
      0.001,
      1,
    ),
    speed: finiteClamped(
      motion?.speed,
      inherited?.speed ?? INTERNAL_DEFAULTS.speed,
      -16,
      16,
    ),
    glow: finiteClamped(
      materialConfig?.glow,
      inherited?.glow ?? INTERNAL_DEFAULTS.glow,
      0.02,
      16,
    ),
    upperGlowSpread: finiteClamped(
      materialConfig?.upperGlowSpread,
      inherited?.upperGlowSpread ?? INTERNAL_DEFAULTS.upperGlowSpread,
      0.02,
      16,
    ),
    lowerGlowSpread: finiteClamped(
      materialConfig?.lowerGlowSpread,
      inherited?.lowerGlowSpread ?? INTERNAL_DEFAULTS.lowerGlowSpread,
      0.02,
      16,
    ),
    glowAsymmetry: finiteClamped(
      materialConfig?.glowAsymmetry,
      inherited?.glowAsymmetry ?? INTERNAL_DEFAULTS.glowAsymmetry,
      -1,
      1,
    ),
    intensity: finiteClamped(
      materialConfig?.intensity,
      inherited?.intensity ?? INTERNAL_DEFAULTS.intensity,
      0,
      16,
    ),
    colorSpeed: finiteClamped(
      palette?.speed,
      inherited?.colorSpeed ?? INTERNAL_DEFAULTS.colorSpeed,
      -16,
      16,
    ),
    colors,
    paletteInterpolation:
      palette?.interpolation ?? inherited?.paletteInterpolation ?? "srgb",
    paletteWrap: palette?.wrap ?? inherited?.paletteWrap ?? "clamp",
    paletteReverse: palette?.reverse ?? inherited?.paletteReverse ?? false,
    hue: finite(palette?.hue, inherited?.hue ?? INTERNAL_DEFAULTS.hue),
    hueDrift: finiteClamped(
      palette?.hueDrift,
      inherited?.hueDrift ?? INTERNAL_DEFAULTS.hueDrift,
      -1440,
      1440,
    ),
    propagation,
    profiles,
    profileBounds: resolveProfileBounds(profiles),
    material,
    follow,
    quality,
    dotsEnabled: dots?.enabled ?? inherited?.dotsEnabled ?? true,
    dotMode: dots?.mode ?? inherited?.dotMode ?? INTERNAL_DEFAULTS.dotMode,
    dotSpacing: finiteClamped(
      dots?.spacing,
      inherited?.dotSpacing ?? INTERNAL_DEFAULTS.dotSpacing,
      2,
      1024,
    ),
    dotOpacity: finiteClamped(
      dots?.opacity,
      inherited?.dotOpacity ?? INTERNAL_DEFAULTS.dotOpacity,
      0,
      1,
    ),
    twinkle: finiteClamped(
      dots?.twinkle,
      inherited?.twinkle ?? INTERNAL_DEFAULTS.twinkle,
      0,
      1,
    ),
    reflect: finiteClamped(
      dots?.reflect,
      inherited?.reflect ?? INTERNAL_DEFAULTS.reflect,
      0,
      4,
    ),
    maskFeather: finiteClamped(
      dots?.maskFeather,
      inherited?.maskFeather ?? INTERNAL_DEFAULTS.maskFeather,
      0.001,
      1,
    ),
    dotMasks: dots?.masks ?? inherited?.dotMasks ?? INTERNAL_DEFAULTS.dotMasks,
    terrainDots,
    dotInteraction,
    glassText,
    backgroundImage,
    musicVisualizer,
    fadeInDuration: finiteClamped(
      input.fadeInDuration,
      inherited?.fadeInDuration ?? INTERNAL_DEFAULTS.fadeInDuration,
      0,
      10_000,
    ),
    fadeInEasing: resolveFadeInEasing(
      input.fadeInEasing,
      inherited?.fadeInEasing ?? INTERNAL_DEFAULTS.fadeInEasing,
    ),
    paused: input.paused ?? inherited?.paused ?? INTERNAL_DEFAULTS.paused,
    controlledTime: Number.isFinite(input.time)
      ? input.time
      : inherited?.controlledTime,
    initialTime: finite(
      input.initialTime,
      inherited?.initialTime ?? INTERNAL_DEFAULTS.initialTime,
    ),
    playbackRate: finiteClamped(
      input.playbackRate,
      inherited?.playbackRate ?? INTERNAL_DEFAULTS.playbackRate,
      -16,
      16,
    ),
    respectReducedMotion:
      input.respectReducedMotion ??
      inherited?.respectReducedMotion ??
      INTERNAL_DEFAULTS.respectReducedMotion,
    pauseWhenOffscreen:
      input.pauseWhenOffscreen ??
      inherited?.pauseWhenOffscreen ??
      INTERNAL_DEFAULTS.pauseWhenOffscreen,
    filaments: [],
    requiresPathPipeline: false,
  };

  const transformIsIdentity =
    Math.abs(settings.pathTransform.x) <= 0.000001 &&
    Math.abs(settings.pathTransform.y) <= 0.000001 &&
    Math.abs(settings.pathTransform.scaleX - 1) <= 0.000001 &&
    Math.abs(settings.pathTransform.scaleY - 1) <= 0.000001 &&
    Math.abs(settings.pathTransform.rotation) <= 0.000001 &&
    Math.abs(settings.pathTransform.anchorX - 0.5) <= 0.000001 &&
    Math.abs(settings.pathTransform.anchorY - 0.5) <= 0.000001;
  settings.requiresPathPipeline =
    settings.pathMode !== "sine" ||
    settings.follow.activation !== "path-mode" ||
    (settings.musicVisualizer.enabled &&
      settings.musicVisualizer.deformation > 0.000001) ||
    (settings.propagation.enabled &&
      settings.propagation.deformers.some(
        (deformer) => deformer.enabled !== false,
      )) ||
    Boolean(settings.svgPath) ||
    !transformIsIdentity;
  return settings;
}

function resolveFilamentSettings(
  root: Settings,
  filament: HeroWaveFilamentConfig,
): Settings {
  return resolveOneSettings(
    {
      path: filament.path,
      shape: filament.shape,
      motion: filament.motion,
      propagation: filament.propagation,
      profiles: filament.profiles,
      material: filament.material,
      palette: filament.palette,
      interaction: filament.interaction,
      quality: filament.quality,
    },
    filament.id,
    root,
    {
      enabled: filament.enabled,
      timeOffset: filament.timeOffset,
      filamentPlaybackRate: filament.playbackRate,
    },
  );
}

const warnedDuplicateFilamentIds = new Set<string>();
const warnedLargeFilamentScenes = new Set<number>();

function resolveSettings(input: HeroWaveBackgroundCoreProps): Settings {
  const root = resolveOneSettings(input, "primary", undefined, {
    enabled: true,
    timeOffset: 0,
    filamentPlaybackRate: 1,
  });
  const usedIds = new Set<string>();
  const filaments = input.filaments?.map((filament, index) => {
    let id = filament.id.trim() || `filament-${index + 1}`;
    if (usedIds.has(id)) {
      const base = id;
      let suffix = 2;
      while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
      id = `${base}-${suffix}`;
      const warningKey = `${base}->${id}`;
      if (!warnedDuplicateFilamentIds.has(warningKey)) {
        warnedDuplicateFilamentIds.add(warningKey);
        console.warn(
          `HeroWaveBackground: duplicate filament id "${base}" was renamed to "${id}".`,
        );
      }
    }
    usedIds.add(id);
    return resolveFilamentSettings(root, { ...filament, id });
  });
  root.filaments = filaments && filaments.length > 0 ? filaments : [];
  if (
    root.filaments.length > HERO_MAX_FILAMENTS_WARNING &&
    !warnedLargeFilamentScenes.has(root.filaments.length)
  ) {
    warnedLargeFilamentScenes.add(root.filaments.length);
    console.warn(
      `HeroWaveBackground: ${root.filaments.length} filaments can be expensive; consider a lower quality preset.`,
    );
  }
  root.requiresPathPipeline =
    root.requiresPathPipeline || root.filaments.length > 0;
  return root;
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

function modifiedBesselI0(value: number) {
  const x = Math.abs(value);
  if (x < 3.75) {
    const y = (x / 3.75) ** 2;
    return (
      1 +
      y *
        (3.5156229 +
          y *
            (3.0899424 +
              y *
                (1.2067492 +
                  y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))))
    );
  }
  const y = 3.75 / x;
  return (
    (Math.exp(x) / Math.sqrt(x)) *
    (0.39894228 +
      y *
        (0.01328592 +
          y *
            (0.00225319 +
              y *
                (-0.00157565 +
                  y *
                    (0.00916281 +
                      y *
                        (-0.02057706 +
                          y *
                            (0.02635537 +
                              y * (-0.01647633 + y * 0.00392377))))))))
  );
}

function modifiedBesselK0(value: number) {
  const x = Math.max(value, HERO_PATH_K0_MIN_ARGUMENT);
  if (x <= 2) {
    const y = (x * x) / 4;
    return (
      -Math.log(x / 2) * modifiedBesselI0(x) +
      (-0.57721566 +
        y *
          (0.4227842 +
            y *
              (0.23069756 +
                y *
                  (0.0348859 +
                    y * (0.00262698 + y * (0.0001075 + y * 0.0000074))))))
    );
  }
  const y = 2 / x;
  return (
    (Math.exp(-x) / Math.sqrt(x)) *
    (1.25331414 +
      y *
        (-0.07832358 +
          y *
            (0.02189568 +
              y *
                (-0.01062446 +
                  y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))))
  );
}

/**
 * K0 is sampled with a quadratic coordinate, concentrating texels around its
 * logarithmic singularity while retaining a long, smooth tail.
 */
function buildPathK0TextureData() {
  const data = new Float32Array(HERO_PATH_K0_LUT_WIDTH);
  for (let index = 0; index < HERO_PATH_K0_LUT_WIDTH; index++) {
    const normalized = index / Math.max(HERO_PATH_K0_LUT_WIDTH - 1, 1);
    const argument = Math.max(
      HERO_PATH_K0_MIN_ARGUMENT,
      HERO_PATH_K0_MAX_ARGUMENT * normalized * normalized,
    );
    data[index] = modifiedBesselK0(argument);
  }
  return data;
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
    feather: clamp(finite(mask.feather, feather), 0.001, 1),
  }));
  const data = new Uint8Array(width * height);
  if (masks.length === 0) {
    return { data, width, height };
  }

  for (let y = 0; y < height; y++) {
    const uvY = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const uvX = (x + 0.5) / width;
      let signal = 0;
      for (const mask of masks) {
        const dx = (uvX - mask.x) * aspect;
        const dy = uvY - mask.y;
        const distance = Math.hypot(dx, dy);
        const inner = mask.radius * (1 - mask.feather);
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

function hashColors(
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
    hash = hashFloat(hash, clamp(finite(mask.feather, feather), 0.001, 1));
  }
  return hash;
}

function hashTrajectory(points: readonly HeroTrajectoryPoint[]) {
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

function hashUnknown(value: unknown, seed = 2_166_136_261): number {
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

function hashProfiles(profiles: Required<HeroWaveLongitudinalProfiles>) {
  return hashUnknown(profiles);
}

interface CurveSample {
  x: number;
  y: number;
  speed: number;
  /** Progress weighted by trajectory speed. */
  progress: number;
  /** Pure screen-space arc-length progress. */
  arcProgress: number;
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

function trajectoryPointAt(
  points: readonly HeroTrajectoryPoint[],
  index: number,
  closed: boolean,
): HeroTrajectoryPoint {
  const count = points.length;
  const pointIndex = closed
    ? ((index % count) + count) % count
    : Math.min(count - 1, Math.max(0, index));
  return points[pointIndex] ?? points[0] ?? HERO_DEFAULT_TRAJECTORY[0]!;
}

function applyPathTransformToPoint(
  x: number,
  y: number,
  transform: Required<HeroWavePathTransform>,
  width: number,
  height: number,
) {
  const aspect = width / Math.max(height, 1);
  const anchorX = transform.anchorX * aspect;
  const anchorY = transform.anchorY;
  const localX = (x * aspect - anchorX) * transform.scaleX;
  const localY = (y - anchorY) * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: (anchorX + localX * cosine - localY * sine) / aspect + transform.x,
    y: anchorY + localX * sine + localY * cosine + transform.y,
  };
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
function centripetalPoint(
  p0: FollowScreenPoint,
  p1: FollowScreenPoint,
  p2: FollowScreenPoint,
  p3: FollowScreenPoint,
  localT: number,
) {
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
  return interpolateFollowPoint(b1, b2, t1, t2, time);
}

function cubicBezierValue(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
) {
  const inverse = 1 - t;
  return (
    inverse ** 3 * a +
    3 * inverse * inverse * t * b +
    3 * inverse * t * t * c +
    t ** 3 * d
  );
}

function evaluateTrajectorySegment(
  points: readonly HeroTrajectoryPoint[],
  segment: number,
  localT: number,
  closed: boolean,
  bandHeight: number,
  verticalScale: number,
  width: number,
  height: number,
  settings: Settings,
): CurveSample {
  const p0 = trajectoryPointAt(points, segment - 1, closed);
  const p1 = trajectoryPointAt(points, segment, closed);
  const p2 = trajectoryPointAt(points, segment + 1, closed);
  const p3 = trajectoryPointAt(points, segment + 2, closed);
  const pointY = (point: HeroTrajectoryPoint) =>
    bandHeight + point.y * verticalScale;
  let x = 0;
  let y = 0;
  if (settings.trajectoryInterpolation === "linear") {
    x = p1.x + (p2.x - p1.x) * localT;
    y = pointY(p1) + (pointY(p2) - pointY(p1)) * localT;
  } else if (settings.trajectoryInterpolation === "centripetal-catmull-rom") {
    const result = centripetalPoint(
      { x: p0.x * width, y: pointY(p0) * height },
      { x: p1.x * width, y: pointY(p1) * height },
      { x: p2.x * width, y: pointY(p2) * height },
      { x: p3.x * width, y: pointY(p3) * height },
      localT,
    );
    x = result.x / Math.max(width, 1);
    y = result.y / Math.max(height, 1);
  } else if (settings.trajectoryInterpolation === "bezier") {
    const tangentScale = (1 - settings.trajectoryTension) / 6;
    const outX = p1.x + finite(p1.outX, (p2.x - p0.x) * tangentScale);
    const outY =
      pointY(p1) + finite(p1.outY, (pointY(p2) - pointY(p0)) * tangentScale);
    const inX = p2.x + finite(p2.inX, -(p3.x - p1.x) * tangentScale);
    const inY =
      pointY(p2) + finite(p2.inY, -(pointY(p3) - pointY(p1)) * tangentScale);
    x = cubicBezierValue(p1.x, outX, inX, p2.x, localT);
    y = cubicBezierValue(pointY(p1), outY, inY, pointY(p2), localT);
  } else {
    x = catmullRomValue(
      p0.x,
      p1.x,
      p2.x,
      p3.x,
      localT,
      settings.trajectoryTension,
    );
    y = catmullRomValue(
      pointY(p0),
      pointY(p1),
      pointY(p2),
      pointY(p3),
      localT,
      settings.trajectoryTension,
    );
  }
  const transformed = applyPathTransformToPoint(
    x,
    y,
    settings.pathTransform,
    width,
    height,
  );
  return {
    x: clamp(transformed.x, -4, 5),
    y: clamp(transformed.y, -4, 5),
    speed: Math.max(p1.speed + (p2.speed - p1.speed) * localT, 0.05),
    progress: 0,
    arcProgress: 0,
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

function recomputePathProgress(
  samples: CurveSample[],
  width: number,
  height: number,
  closed: boolean,
  preserveSpeed = false,
) {
  if (samples.length === 0) return samples;
  let arcElapsed = 0;
  let travelElapsed = 0;
  samples[0]!.arcProgress = 0;
  samples[0]!.progress = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const distance = Math.hypot(
      (current.x - previous.x) * width,
      (current.y - previous.y) * height,
    );
    arcElapsed += distance;
    const localSpeed = preserveSpeed
      ? Math.max((previous.speed + current.speed) * 0.5, 0.05)
      : 1;
    travelElapsed += distance / localSpeed;
    current.arcProgress = arcElapsed;
    current.progress = travelElapsed;
  }
  const safeArc = Math.max(arcElapsed, 0.000001);
  const safeTravel = Math.max(travelElapsed, 0.000001);
  for (const sample of samples) {
    sample.arcProgress /= safeArc;
    sample.progress /= safeTravel;
  }
  if (closed && samples.length > 1) {
    samples[samples.length - 1]!.arcProgress = 1;
    samples[samples.length - 1]!.progress = 1;
  }
  return samples;
}

function writeCurveSampleAtArcProgress(
  samples: readonly CurveSample[],
  progress: number,
  output: CurveSample,
) {
  const first = samples[0];
  if (!first) {
    output.x = 0.5;
    output.y = 0.5;
    output.speed = 1;
    output.progress = progress;
    output.arcProgress = progress;
    return;
  }
  const last = samples[samples.length - 1] ?? first;
  if (progress <= first.arcProgress || samples.length === 1) {
    Object.assign(output, first);
    return;
  }
  if (progress >= last.arcProgress) {
    Object.assign(output, last);
    return;
  }

  let low = 1;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) * 0.5);
    if ((samples[middle]?.arcProgress ?? 1) < progress) low = middle + 1;
    else high = middle;
  }
  const after = samples[low] ?? last;
  const before = samples[Math.max(0, low - 1)] ?? first;
  const amount = clamp(
    (progress - before.arcProgress) /
      Math.max(after.arcProgress - before.arcProgress, 0.000001),
    0,
    1,
  );
  output.x = before.x + (after.x - before.x) * amount;
  output.y = before.y + (after.y - before.y) * amount;
  output.speed = before.speed + (after.speed - before.speed) * amount;
  output.progress =
    before.progress + (after.progress - before.progress) * amount;
  output.arcProgress = progress;
}

function blendCurveSamplePaths(
  from: readonly CurveSample[],
  to: readonly CurveSample[],
  amount: number,
  width: number,
  height: number,
  output: CurveSample[],
) {
  if (from.length === 0 || to.length === 0) {
    const source = to.length > 0 ? to : from;
    output.length = source.length;
    for (let index = 0; index < source.length; index++) {
      const sourceSample = source[index]!;
      const target = output[index] ?? {
        x: 0,
        y: 0,
        speed: 1,
        progress: 0,
        arcProgress: 0,
      };
      Object.assign(target, sourceSample);
      output[index] = target;
    }
    return output;
  }

  const count = clamp(Math.max(from.length, to.length), 2, 1024);
  const fromSample: CurveSample = {
    x: 0,
    y: 0,
    speed: 1,
    progress: 0,
    arcProgress: 0,
  };
  const toSample: CurveSample = { ...fromSample };
  output.length = count;
  for (let index = 0; index < count; index++) {
    const progress = index / Math.max(count - 1, 1);
    writeCurveSampleAtArcProgress(from, progress, fromSample);
    writeCurveSampleAtArcProgress(to, progress, toSample);
    const target = output[index] ?? { ...fromSample };
    target.x = fromSample.x + (toSample.x - fromSample.x) * amount;
    target.y = fromSample.y + (toSample.y - fromSample.y) * amount;
    target.speed =
      fromSample.speed + (toSample.speed - fromSample.speed) * amount;
    target.progress = progress;
    target.arcProgress = progress;
    output[index] = target;
  }
  return recomputePathProgress(output, width, height, false);
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
  settings: Settings,
) {
  if (output.length >= settings.quality.maxSamples) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarterT = (t0 * 3 + t1) * 0.25;
  const threeQuarterT = (t0 + t1 * 3) * 0.25;
  const evaluate = (time: number) =>
    evaluateTrajectorySegment(
      points,
      segment,
      time,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      settings,
    );
  const quarter = evaluate(quarterT);
  const midpoint = evaluate(midpointT);
  const threeQuarter = evaluate(threeQuarterT);
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
    (flatness > settings.quality.flatnessPx ||
      chord > settings.quality.maxChordPx) &&
    depth < settings.quality.maxSubdivisionDepth &&
    output.length < settings.quality.maxSamples - 1;
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
      settings,
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
      settings,
    );
  } else output.push(end);
}

function buildAdaptivePathSamples(
  sourcePoints: readonly HeroTrajectoryPoint[],
  closed: boolean,
  width: number,
  height: number,
  settings: Settings,
) {
  const points = normalizeTrajectoryPoints(sourcePoints);
  const segmentCount = closed ? points.length : points.length - 1;
  const bandHeight = 1 - settings.waveY;
  const verticalScale = getHeroTrajectoryVerticalScale(
    settings.curveScale,
    settings.curveStrength,
  );
  const output: CurveSample[] = [];
  if (segmentCount <= 0) return output;
  const evaluate = (segment: number, t: number) =>
    evaluateTrajectorySegment(
      points,
      segment,
      t,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      settings,
    );
  output.push(evaluate(0, 0));
  for (
    let segment = 0;
    segment < segmentCount && output.length < settings.quality.maxSamples;
    segment++
  ) {
    const start = output[output.length - 1]!;
    const end = evaluate(segment, 1);
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
      settings,
    );
  }
  return recomputePathProgress(output, width, height, closed, true);
}

function movingSineCurveAndSlope(x: number, time: number, settings: Settings) {
  const frequency = Math.max(settings.curveFrequency, 0.05);
  const morphAmount = clamp(settings.curveMotion, 0, 1);
  const geometryAdvanceRatio =
    settings.motionMode === "travel" ? settings.pathDrift : 0;
  const advance = time * settings.curveTravel * geometryAdvanceRatio;
  const pathX = x - advance * (0.12 + 0.1 * morphAmount);
  const bendArgument =
    TAU * (frequency * 0.42 * pathX + 0.27) + advance * 0.875;
  const bendSin = Math.sin(bendArgument);
  const bendCos = Math.cos(bendArgument);
  const phase = frequency * pathX - 0.03 + bendSin * 0.065 * morphAmount;
  const phaseDerivative =
    frequency + bendCos * TAU * frequency * 0.42 * 0.065 * morphAmount;
  const phaseArgument = TAU * phase;
  const phaseSin = Math.sin(phaseArgument);
  const phaseCos = Math.cos(phaseArgument);
  const swellArgument =
    TAU * (frequency * 0.28 * pathX - 0.12) - advance * 1.125;
  const swellSin = Math.sin(swellArgument);
  const swellCos = Math.cos(swellArgument);
  const swell = 1 + 0.08 * morphAmount * swellSin;
  const swellDerivative =
    0.08 * morphAmount * swellCos * TAU * frequency * 0.28;
  const sineShape = phaseSin * swell;
  const shapeDerivative =
    phaseCos * TAU * phaseDerivative * swell + phaseSin * swellDerivative;
  const verticalDrift =
    Math.sin(advance * 1.125) * 0.025 * settings.curveMotion;
  const scaledAmplitude = 0.38 * settings.curveScale;
  const center =
    1 -
    settings.waveY +
    settings.curveStrength * (sineShape * scaledAmplitude + verticalDrift);
  const slope = settings.curveStrength * shapeDerivative * scaledAmplitude;
  return { center, slope };
}

function buildAdaptiveSinePathSamples(
  settings: Settings,
  width: number,
  height: number,
  time: number,
) {
  const output: CurveSample[] = [];
  const startX = -0.2;
  const endX = 1.2;
  const evaluate = (x: number): CurveSample => {
    const curve = movingSineCurveAndSlope(x, time, settings);
    const transformed = applyPathTransformToPoint(
      x,
      curve.center,
      settings.pathTransform,
      width,
      height,
    );
    return {
      x: transformed.x,
      y: transformed.y,
      speed: 1,
      progress: 0,
      arcProgress: 0,
    };
  };
  const append = (
    x0: number,
    start: CurveSample,
    x1: number,
    end: CurveSample,
    depth: number,
  ) => {
    if (output.length >= settings.quality.maxSamples) return;
    const midpointX = (x0 + x1) * 0.5;
    const quarterX = x0 * 0.75 + x1 * 0.25;
    const threeQuarterX = x0 * 0.25 + x1 * 0.75;
    const midpoint = evaluate(midpointX);
    const flatness = Math.max(
      pointToSegmentDistancePixels(
        evaluate(quarterX),
        start,
        end,
        width,
        height,
      ),
      pointToSegmentDistancePixels(midpoint, start, end, width, height),
      pointToSegmentDistancePixels(
        evaluate(threeQuarterX),
        start,
        end,
        width,
        height,
      ),
    );
    const chord = Math.hypot(
      (end.x - start.x) * width,
      (end.y - start.y) * height,
    );
    if (
      (flatness > settings.quality.flatnessPx ||
        chord > settings.quality.maxChordPx) &&
      depth < settings.quality.maxSubdivisionDepth
    ) {
      append(x0, start, midpointX, midpoint, depth + 1);
      append(midpointX, midpoint, x1, end, depth + 1);
    } else output.push(end);
  };
  const first = evaluate(startX);
  output.push(first);
  append(startX, first, endX, evaluate(endX), 0);
  return recomputePathProgress(output, width, height, false, true);
}

function buildSvgPathSamples(
  settings: Settings,
  width: number,
  height: number,
) {
  if (!settings.svgPath || typeof document === "undefined") return null;
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const path = document.createElementNS(namespace, "path");
  svg.setAttribute("width", "1");
  svg.setAttribute("height", "1");
  svg.setAttribute(
    "style",
    "position:fixed;left:-10000px;top:-10000px;visibility:hidden;overflow:visible",
  );
  path.setAttribute("d", settings.svgPath);
  svg.appendChild(path);
  document.body.appendChild(svg);
  try {
    const totalLength = Math.max(path.getTotalLength(), 0.000001);
    const bounds = settings.svgViewBox
      ? {
          x: settings.svgViewBox[0],
          y: settings.svgViewBox[1],
          width: Math.max(settings.svgViewBox[2], 0.000001),
          height: Math.max(settings.svgViewBox[3], 0.000001),
        }
      : (() => {
          const box = path.getBBox();
          return {
            x: box.x,
            y: box.y,
            width: Math.max(box.width, 0.000001),
            height: Math.max(box.height, 0.000001),
          };
        })();
    const sampleAtLength = (length: number): CurveSample => {
      const point = path.getPointAtLength(clamp(length, 0, totalLength));
      const transformed = applyPathTransformToPoint(
        (point.x - bounds.x) / bounds.width,
        1 - (point.y - bounds.y) / bounds.height,
        settings.pathTransform,
        width,
        height,
      );
      const progress = clamp(length / totalLength, 0, 1);
      return {
        x: transformed.x,
        y: transformed.y,
        speed: 1,
        progress,
        arcProgress: progress,
      };
    };
    const samples: CurveSample[] = [sampleAtLength(0)];
    const append = (
      length0: number,
      start: CurveSample,
      length1: number,
      end: CurveSample,
      depth: number,
    ) => {
      if (samples.length >= settings.quality.maxSamples) return;
      const q1 = sampleAtLength(length0 * 0.75 + length1 * 0.25);
      const midLength = (length0 + length1) * 0.5;
      const mid = sampleAtLength(midLength);
      const q3 = sampleAtLength(length0 * 0.25 + length1 * 0.75);
      const flatness = Math.max(
        pointToSegmentDistancePixels(q1, start, end, width, height),
        pointToSegmentDistancePixels(mid, start, end, width, height),
        pointToSegmentDistancePixels(q3, start, end, width, height),
      );
      const chord = Math.hypot(
        (end.x - start.x) * width,
        (end.y - start.y) * height,
      );
      if (
        (flatness > settings.quality.flatnessPx ||
          chord > settings.quality.maxChordPx) &&
        depth < settings.quality.maxSubdivisionDepth &&
        samples.length < settings.quality.maxSamples - 1
      ) {
        append(length0, start, midLength, mid, depth + 1);
        append(midLength, mid, length1, end, depth + 1);
      } else samples.push(end);
    };
    append(0, samples[0]!, totalLength, sampleAtLength(totalLength), 0);
    if (settings.trajectoryClosed && samples.length > 1) {
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      if (
        Math.hypot((first.x - last.x) * width, (first.y - last.y) * height) >
        0.0001
      ) {
        samples.push({ ...first, progress: 1, arcProgress: 1 });
      }
    }
    return recomputePathProgress(
      samples,
      width,
      height,
      settings.trajectoryClosed,
    );
  } catch (error) {
    console.error("HeroWaveBackground SVG path:", error);
    return null;
  } finally {
    svg.remove();
  }
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
    return { x: first.x * 2 - second.x, y: first.y * 2 - second.y };
  }
  if (index >= count) {
    const last = points[count - 1]!;
    const previous = points[count - 2]!;
    return { x: last.x * 2 - previous.x, y: last.y * 2 - previous.y };
  }
  return points[index]!;
}
function evaluateFollowSegment(
  points: readonly FollowScreenPoint[],
  segment: number,
  localT: number,
  width: number,
  height: number,
): CurveSample {
  const point = centripetalPoint(
    followScreenControlPoint(points, segment - 1),
    followScreenControlPoint(points, segment),
    followScreenControlPoint(points, segment + 1),
    followScreenControlPoint(points, segment + 2),
    localT,
  );
  return {
    x: point.x / Math.max(width, 1),
    y: point.y / Math.max(height, 1),
    speed: 1,
    progress: 0,
    arcProgress: 0,
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
  settings: Settings,
) {
  if (output.length >= settings.quality.maxSamples) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarter = evaluateFollowSegment(
    points,
    segment,
    (t0 * 3 + t1) * 0.25,
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
    (t0 + t1 * 3) * 0.25,
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
  if (
    (flatness > settings.quality.flatnessPx ||
      chord > settings.quality.maxChordPx) &&
    depth < settings.quality.maxSubdivisionDepth &&
    output.length < settings.quality.maxSamples - 1
  ) {
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
      settings,
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
      settings,
    );
  } else output.push(end);
}
function buildAdaptiveFollowPathSamples(
  anchors: readonly FollowAnchor[],
  width: number,
  height: number,
  output: CurveSample[],
  settings: Settings,
) {
  output.length = 0;
  const points: FollowScreenPoint[] = [];
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (!anchor) continue;
    const point = { x: anchor.x * width, y: (1 - anchor.top) * height };
    const previous = points[points.length - 1];
    const isLast = index === anchors.length - 1;
    if (!previous) points.push(point);
    else {
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (distance >= HERO_FOLLOW_DUPLICATE_DISTANCE_PX) points.push(point);
      else if (isLast) points[points.length - 1] = point;
    }
  }
  if (points.length === 0) return output;
  if (points.length === 1) {
    output.push({
      x: points[0]!.x / Math.max(width, 1),
      y: points[0]!.y / Math.max(height, 1),
      speed: 1,
      progress: 0,
      arcProgress: 0,
    });
    return output;
  }
  output.push(evaluateFollowSegment(points, 0, 0, width, height));
  for (
    let segment = 0;
    segment < points.length - 1 && output.length < settings.quality.maxSamples;
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
      settings,
    );
  }
  return recomputePathProgress(output, width, height, false);
}

function noiseHash(seed: number, index: number) {
  const value =
    Math.sin((seed * 0.1031 + index * 17.127) * 12.9898) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}
function valueNoise1D(seed: number, value: number) {
  const left = Math.floor(value);
  const amount = smoothProfileAmount(value - left);
  return (
    noiseHash(seed, left) +
    (noiseHash(seed, left + 1) - noiseHash(seed, left)) * amount
  );
}
function fractalNoise1D(
  seed: number,
  value: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
) {
  let result = 0,
    amplitude = 1,
    frequency = 1,
    sum = 0;
  for (let octave = 0; octave < octaves; octave++) {
    result += valueNoise1D(seed + octave * 101, value * frequency) * amplitude;
    sum += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return result / Math.max(sum, 0.000001);
}
function sampledDeformerValue(
  deformer: HeroWaveSampledDeformer,
  domain: number,
  timePhase: number,
) {
  return sampleProfileArray(
    deformer.values,
    domain * finite(deformer.frequency, 1) +
      finite(deformer.phase, 0) +
      timePhase * finite(deformer.phaseSpeed, 1),
    deformer.interpolation ?? "cubic",
    deformer.wrap ?? "repeat",
  );
}
function pulseDeformerValue(
  deformer: HeroWavePulseDeformer,
  domain: number,
  timePhase: number,
) {
  const count = Math.max(finite(deformer.count, 1), 0.001);
  const center =
    finite(deformer.phase, 0) + timePhase * finite(deformer.phaseSpeed, 1);
  const wrapped = ((((domain * count - center) % 1) + 1.5) % 1) - 0.5;
  const normalized =
    Math.abs(wrapped) / Math.max(finite(deformer.width, 0.12), 0.0001);
  if (deformer.shape === "triangle") return Math.max(0, 1 - normalized);
  if (deformer.shape === "smooth")
    return 1 - smoothProfileAmount(clamp(normalized, 0, 1));
  return Math.exp(-0.5 * normalized * normalized);
}
const customDeformerErrorCallbacks =
  new WeakSet<HeroWaveCustomDeformerCallback>();

function reportCustomDeformerFailure(
  error: unknown,
  deformer: HeroWaveCustomDeformer,
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
) {
  if (customDeformerErrorCallbacks.has(deformer.callback)) return;
  customDeformerErrorCallbacks.add(deformer.callback);
  const resolvedError =
    error instanceof Error ? error : new Error(String(error));
  if (onError) onError(resolvedError, deformer);
  else console.error("HeroWaveBackground custom deformer:", resolvedError);
}

function evaluateDeformer(
  deformer: HeroWaveDeformer,
  context: HeroWaveDeformationContext,
  domain: number,
  timePhase: number,
  output: HeroWaveDeformationOutput,
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
) {
  output.normal = 0;
  output.tangent = 0;
  output.x = 0;
  output.y = 0;

  let value = 0;
  if (deformer.type === "harmonics") {
    for (const wave of deformer.waves) {
      value +=
        finite(wave.amplitude, 1) *
        Math.sin(
          TAU *
            (domain * finite(wave.frequency, 1) +
              finite(wave.phase, 0) +
              timePhase * finite(wave.phaseSpeed, 1)),
        );
    }
  } else if (deformer.type === "sampled") {
    value = sampledDeformerValue(deformer, domain, timePhase);
  } else if (deformer.type === "noise") {
    value = fractalNoise1D(
      Math.trunc(finite(deformer.seed, 0)),
      domain * Math.max(finite(deformer.frequency, 1), 0.0001) +
        timePhase * finite(deformer.phaseSpeed, 1),
      Math.trunc(clamp(finite(deformer.octaves, 3), 1, 8)),
      clamp(finite(deformer.lacunarity, 2), 1, 8),
      clamp(finite(deformer.persistence, 0.5), 0, 1),
    );
  } else if (deformer.type === "pulse") {
    value = pulseDeformerValue(deformer, domain, timePhase);
  } else {
    try {
      deformer.callback(context, output);
    } catch (error) {
      reportCustomDeformerFailure(error, deformer, onError);
      output.normal = 0;
      output.tangent = 0;
      output.x = 0;
      output.y = 0;
    }
    output.normal = finite(output.normal, 0);
    output.tangent = finite(output.tangent, 0);
    output.x = finite(output.x, 0);
    output.y = finite(output.y, 0);
  }

  const amplitude =
    finite(deformer.amplitude, 1) *
    evaluateScalarProfile(deformer.envelope, domain, 1);
  const direction =
    deformer.direction ?? (deformer.type === "custom" ? "both" : "normal");

  if (deformer.type === "custom") {
    const normalValue = output.normal;
    const tangentValue = output.tangent;
    const directX = output.x;
    const directY = output.y;
    output.normal =
      direction === "normal" || direction === "both"
        ? normalValue * amplitude
        : 0;
    output.tangent =
      direction === "tangent" || direction === "both"
        ? tangentValue * finite(deformer.tangentAmount, 1) * amplitude
        : 0;
    output.x = (directX + (direction === "x" ? normalValue : 0)) * amplitude;
    output.y = (directY + (direction === "y" ? normalValue : 0)) * amplitude;
    return;
  }

  const displacement = value * amplitude;
  if (direction === "normal" || direction === "both") {
    output.normal = displacement;
  }
  if (direction === "tangent" || direction === "both") {
    output.tangent =
      displacement *
      finite(deformer.tangentAmount, direction === "tangent" ? 1 : 0.35);
  }
  if (direction === "x") output.x = displacement;
  if (direction === "y") output.y = displacement;
}

function combineDeformationValue(
  current: number,
  value: number,
  combine: HeroWaveDeformationCombine,
  first: boolean,
) {
  if (first) return value;
  if (combine === "max")
    return Math.abs(value) > Math.abs(current) ? value : current;
  if (combine === "multiply") return (1 + current) * (1 + value) - 1;
  return current + value;
}

function propagationIsDynamic(propagation: Settings["propagation"]) {
  if (!propagation.enabled) return false;
  const active = propagation.deformers.filter(
    (deformer) => deformer.enabled !== false,
  );
  if (active.length === 0) return false;
  return active.some((deformer) => {
    if (deformer.type === "custom") return true;
    if (Math.abs(propagation.phaseSpeed) <= 0.000001) return false;
    if (deformer.type === "harmonics") {
      return deformer.waves.some(
        (wave) => Math.abs(finite(wave.phaseSpeed, 1)) > 0.000001,
      );
    }
    return Math.abs(finite(deformer.phaseSpeed, 1)) > 0.000001;
  });
}

function buildPropagatedPathSamples(
  source: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  time: number,
  settings: Settings,
  target: CurveSample[],
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
  audioDeformation = 0,
  audioFrequency = 1,
) {
  const propagation = settings.propagation;
  const activeDeformers = propagation.deformers.filter(
    (deformer) => deformer.enabled !== false,
  );
  const hasPropagation = propagation.enabled && activeDeformers.length > 0;
  const hasAudioDeformation = Math.abs(audioDeformation) > 0.000001;
  if (!hasPropagation && !hasAudioDeformation) {
    target.length = source.length;
    for (let index = 0; index < source.length; index++) {
      const sample = source[index]!;
      const output = target[index] ?? {
        x: 0,
        y: 0,
        speed: 1,
        progress: 0,
        arcProgress: 0,
      };
      output.x = sample.x;
      output.y = sample.y;
      output.speed = sample.speed;
      output.progress = sample.progress;
      output.arcProgress = sample.arcProgress;
      target[index] = output;
    }
    return target;
  }

  const uniqueCount =
    closed && source.length > 2 ? source.length - 1 : source.length;
  const timePhase = propagation.phaseOffset + time * propagation.phaseSpeed;
  const tangent = { x: 0, y: 0 };
  const normal = { x: 0, y: 0 };
  const point = { x: 0, y: 0 };
  const context: HeroWaveDeformationContext = {
    index: 0,
    count: source.length,
    time: timePhase,
    progress: 0,
    arcProgress: 0,
    point,
    tangent,
    normal,
  };
  const deformerOutput: HeroWaveDeformationOutput = {
    normal: 0,
    tangent: 0,
    x: 0,
    y: 0,
  };

  target.length = source.length;
  for (let index = 0; index < source.length; index++) {
    const sample = source[index];
    if (!sample) continue;
    const canonicalIndex = closed && index === source.length - 1 ? 0 : index;
    const previous =
      source[
        closed
          ? (canonicalIndex - 1 + uniqueCount) % uniqueCount
          : Math.max(0, canonicalIndex - 1)
      ] ?? sample;
    const next =
      source[
        closed
          ? (canonicalIndex + 1) % uniqueCount
          : Math.min(source.length - 1, canonicalIndex + 1)
      ] ?? sample;
    const tangentX = (next.x - previous.x) * width;
    const tangentY = (next.y - previous.y) * height;
    const tangentLength = Math.max(Math.hypot(tangentX, tangentY), 0.000001);
    tangent.x = tangentX / tangentLength;
    tangent.y = tangentY / tangentLength;
    normal.x = -tangent.y;
    normal.y = tangent.x;
    point.x = sample.x;
    point.y = sample.y;
    context.index = index;
    context.count = source.length;
    context.time = timePhase;
    context.progress = sample.progress;
    context.arcProgress = sample.arcProgress;

    const domain =
      propagation.domain === "travelTime"
        ? sample.progress
        : sample.arcProgress;
    let normalDisplacement = 0;
    let tangentDisplacement = 0;
    let xDisplacement = 0;
    let yDisplacement = 0;
    let firstNormal = true;
    let firstTangent = true;
    let firstX = true;
    let firstY = true;

    for (const deformer of hasPropagation ? activeDeformers : []) {
      evaluateDeformer(
        deformer,
        context,
        domain,
        timePhase,
        deformerOutput,
        onError,
      );
      const direction =
        deformer.direction ?? (deformer.type === "custom" ? "both" : "normal");
      if (direction === "normal" || direction === "both") {
        normalDisplacement = combineDeformationValue(
          normalDisplacement,
          deformerOutput.normal,
          propagation.combine,
          firstNormal,
        );
        firstNormal = false;
      }
      if (direction === "tangent" || direction === "both") {
        tangentDisplacement = combineDeformationValue(
          tangentDisplacement,
          deformerOutput.tangent,
          propagation.combine,
          firstTangent,
        );
        firstTangent = false;
      }
      if (direction === "x" || deformerOutput.x !== 0) {
        xDisplacement = combineDeformationValue(
          xDisplacement,
          deformerOutput.x,
          propagation.combine,
          firstX,
        );
        firstX = false;
      }
      if (direction === "y" || deformerOutput.y !== 0) {
        yDisplacement = combineDeformationValue(
          yDisplacement,
          deformerOutput.y,
          propagation.combine,
          firstY,
        );
        firstY = false;
      }
    }

    if (hasAudioDeformation) {
      const endpointEnvelope = closed
        ? 1
        : Math.sin(clamp(sample.arcProgress, 0, 1) * Math.PI) ** 2;
      normalDisplacement +=
        Math.sin((domain * Math.max(audioFrequency, 0.1) - time * 0.35) * TAU) *
        audioDeformation *
        endpointEnvelope;
    }

    const output = target[index] ?? {
      x: 0,
      y: 0,
      speed: 1,
      progress: 0,
      arcProgress: 0,
    };
    const normalPx = normalDisplacement * height;
    const tangentPx = tangentDisplacement * height;
    output.x =
      sample.x +
      (normal.x * normalPx + tangent.x * tangentPx + xDisplacement * height) /
        Math.max(width, 1);
    output.y =
      sample.y +
      (normal.y * normalPx + tangent.y * tangentPx + yDisplacement * height) /
        Math.max(height, 1);
    output.speed = sample.speed;
    output.progress = sample.progress;
    output.arcProgress = sample.arcProgress;
    target[index] = output;
  }
  if (propagation.recomputeArcLength) {
    recomputePathProgress(target, width, height, closed, true);
  }
  return target;
}

function pointToChordDistancePixels(
  point: CurveSample,
  start: CurveSample,
  end: CurveSample,
  width: number,
  height: number,
) {
  return pointToSegmentDistancePixels(point, start, end, width, height);
}

/**
 * Greedy error-bounded simplification of the already adaptively tessellated
 * spline. Far glow layers can use longer integration spans without changing
 * the path topology or imposing a fixed segment count.
 */
function simplifyPathSamplesForPass(
  source: readonly CurveSample[],
  width: number,
  height: number,
  maximumChordPx: number,
  maximumFlatnessPx: number,
  target: CurveSample[],
) {
  target.length = 0;
  const count = source.length;
  if (count === 0) return target;
  target.push(source[0]!);
  if (count === 1) return target;

  let anchorIndex = 0;
  let candidateIndex = 2;
  while (candidateIndex < count) {
    const anchor = source[anchorIndex]!;
    const candidate = source[candidateIndex]!;
    const chordLength = Math.hypot(
      (candidate.x - anchor.x) * width,
      (candidate.y - anchor.y) * height,
    );
    let maximumDeviation = 0;
    for (let index = anchorIndex + 1; index < candidateIndex; index++) {
      const point = source[index];
      if (!point) continue;
      maximumDeviation = Math.max(
        maximumDeviation,
        pointToChordDistancePixels(point, anchor, candidate, width, height),
      );
    }

    if (chordLength > maximumChordPx || maximumDeviation > maximumFlatnessPx) {
      const emittedIndex = Math.max(anchorIndex + 1, candidateIndex - 1);
      target.push(source[emittedIndex]!);
      anchorIndex = emittedIndex;
      candidateIndex = anchorIndex + 2;
      continue;
    }
    candidateIndex += 1;
  }

  const last = source[count - 1]!;
  if (target[target.length - 1] !== last) target.push(last);
  return target;
}

function smoothEndpointWeight(distance: number, featherPx: number) {
  const normalized = clamp(distance / Math.max(featherPx, 0.001), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * One instance represents one finite line integral span. Subdivision does not
 * change its total emitted energy because every span carries its screen-space
 * arc length and the fragment shader performs Gaussian quadrature along it.
 */
function buildIntegralSegmentData(
  samples: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  endpointFeatherPx: number,
  target: Float32Array,
) {
  if (samples.length < 2) return { floatCount: 0, segmentCount: 0 };

  let totalLength = 0;
  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1];
    const after = samples[index];
    if (!before || !after) continue;
    totalLength += Math.hypot(
      (after.x - before.x) * width,
      (after.y - before.y) * height,
    );
  }

  let cursor = 0;
  let segmentCount = 0;
  let traversed = 0;
  for (let index = 1; index < samples.length; index++) {
    const start = samples[index - 1];
    const end = samples[index];
    if (!start || !end) continue;
    const segmentLength = Math.hypot(
      (end.x - start.x) * width,
      (end.y - start.y) * height,
    );
    if (segmentLength <= 0.0001) continue;

    const startWeight = closed
      ? 1
      : smoothEndpointWeight(traversed, endpointFeatherPx) *
        smoothEndpointWeight(totalLength - traversed, endpointFeatherPx);
    traversed += segmentLength;
    const endWeight = closed
      ? 1
      : smoothEndpointWeight(traversed, endpointFeatherPx) *
        smoothEndpointWeight(totalLength - traversed, endpointFeatherPx);

    if (cursor + HERO_PATH_SEGMENT_STRIDE > target.length) break;
    target[cursor++] = start.x;
    target[cursor++] = start.y;
    target[cursor++] = end.x;
    target[cursor++] = end.y;
    target[cursor++] = start.progress;
    target[cursor++] = end.progress;
    target[cursor++] = startWeight;
    target[cursor++] = endWeight;
    segmentCount += 1;
  }

  return { floatCount: cursor, segmentCount };
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

const TERRAIN_DOTS_VERTEX_SHADER = `
attribute vec2 aGrid;
uniform vec2 uRes;
uniform float uTime;
uniform float uWidth;
uniform float uDepth;
uniform float uAmplitude;
uniform float uPointSize;
uniform float uSpeed;
uniform float uViewAngle;
uniform float uCameraDistance;
uniform float uFrequency;
uniform float uDpr;
uniform float uFitCover;
uniform float uTwinkle;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uTerrainPointerDisplacement;
varying float vHeight;
varying float vDepthFade;
varying float vGeometryEdge;
varying float vReflection;
varying float vTwinkle;
varying float vPointerInfluence;

void main() {
  float normalizedX = (aGrid.x - 0.5) * 2.0;
  float waveX = normalizedX * uWidth * 0.5;
  float z = aGrid.y * uDepth;
  float phase = uTime * uSpeed * 6.28318530718;
  float primary = sin(waveX * uFrequency + z * 0.88 - phase);
  float secondary = sin(waveX * uFrequency * 0.47 - z * 1.31 + phase * 0.73);
  float detail = sin((waveX + z) * uFrequency * 1.86 - phase * 1.18);
  float height = (primary * 0.58 + secondary * 0.3 + detail * 0.12) * uAmplitude;
  float angle = radians(uViewAngle);
  float cosine = cos(angle);
  float sine = sin(angle);
  float aspect = max(uRes.x / max(uRes.y, 1.0), 0.01);
  float focal = 1.42;
  float baseViewY = height * cosine + z * sine;
  float baseViewZ = uCameraDistance + z * cosine - height * sine;
  float baseProjectedY = (baseViewY - 0.52) * focal / max(baseViewZ, 0.2) - 0.39;
  float baseCoveredHalfWidth = baseViewZ * aspect / focal * 1.04;
  float baseX = mix(waveX, normalizedX * baseCoveredHalfWidth, uFitCover);
  vec2 baseClip = vec2(
    baseX * focal / max(baseViewZ, 0.2) / aspect,
    baseProjectedY
  );
  vec2 pointerDeltaPx = (baseClip * 0.5 + 0.5 - uDotPointer) * uRes;
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  vPointerInfluence = uDotPointerActive * (
    1.0 - smoothstep(
      pointerInnerRadius,
      max(uDotPointerRadius, pointerInnerRadius + 0.001),
      length(pointerDeltaPx)
    )
  );
  height += uTerrainPointerDisplacement * vPointerInfluence;
  float primaryCosine = cos(waveX * uFrequency + z * 0.88 - phase);
  float secondaryCosine = cos(waveX * uFrequency * 0.47 - z * 1.31 + phase * 0.73);
  float detailCosine = cos((waveX + z) * uFrequency * 1.86 - phase * 1.18);
  float slopeX = (
    primaryCosine * uFrequency * 0.58 +
    secondaryCosine * uFrequency * 0.47 * 0.3 +
    detailCosine * uFrequency * 1.86 * 0.12
  ) * uAmplitude;
  float slopeZ = (
    primaryCosine * 0.88 * 0.58 -
    secondaryCosine * 1.31 * 0.3 +
    detailCosine * uFrequency * 1.86 * 0.12
  ) * uAmplitude;
  vec3 surfaceNormal = normalize(vec3(-slopeX, 1.0, -slopeZ));
  vec3 lightDirection = normalize(vec3(-0.42, 0.82, -0.38));
  vec3 viewDirection = normalize(vec3(0.0, 0.72, -1.0));
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float diffuseReflection = max(dot(surfaceNormal, lightDirection), 0.0);
  float specularReflection = pow(
    max(dot(surfaceNormal, halfDirection), 0.0),
    28.0
  );
  vReflection = clamp(
    diffuseReflection * 0.22 + specularReflection * 1.35,
    0.0,
    1.0
  );

  float dotSeed = fract(
    sin(dot(aGrid, vec2(127.1, 311.7))) * 43758.5453123
  );
  float twinklePhase = uTime * (1.15 + dotSeed * 2.4) * 6.28318530718;
  vTwinkle = 0.5 + 0.5 * sin(twinklePhase + dotSeed * 19.73);

  float viewY = height * cosine + z * sine;
  float viewZ = uCameraDistance + z * cosine - height * sine;
  float coveredHalfWidth = viewZ * aspect / focal * 1.04;
  float x = mix(waveX, normalizedX * coveredHalfWidth, uFitCover);
  float projectedY = (viewY - 0.52) * focal / max(viewZ, 0.2) - 0.39;
  float nearViewZ = max(uCameraDistance, 0.2);
  float farViewZ = max(uCameraDistance + uDepth * cosine, 0.2);
  float nearY = -0.52 * focal / nearViewZ - 0.39;
  float farY = (uDepth * sine - 0.52) * focal / farViewZ - 0.39;
  float verticalSpan = max(abs(farY - nearY), 0.001);
  float coverScaleY = 2.08 / verticalSpan;
  float coveredY = (projectedY - (nearY + farY) * 0.5) * coverScaleY;
  vec2 clip = vec2(
    x * focal / max(viewZ, 0.2) / aspect,
    mix(projectedY, coveredY, uFitCover)
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = clamp(
    uPointSize * uDpr * (4.6 / max(viewZ, 0.2)) *
      (1.0 + abs(height) * 0.3) *
      mix(1.0, mix(0.82, 1.28, vTwinkle), uTwinkle),
    0.75,
    12.0 * uDpr
  );
  vHeight = clamp(height / max(uAmplitude, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
  vDepthFade = 1.0 - smoothstep(0.62, 1.0, aGrid.y);
  vGeometryEdge = min(
    min(aGrid.x, 1.0 - aGrid.x),
    min(aGrid.y, 1.0 - aGrid.y)
  );
}
`;

const TERRAIN_DOTS_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uDotMask;
uniform vec2 uRes;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform float uOpacity;
uniform float uContentFade;
uniform float uEdgeFade;
uniform float uThemeMode;
uniform float uTwinkle;
uniform float uReflect;
uniform vec3 uDotPointerColor;
uniform float uDotPointerBrightness;
uniform float uDotPointerColorStrength;
varying float vHeight;
varying float vDepthFade;
varying float vGeometryEdge;
varying float vReflection;
varying float vTwinkle;
varying float vPointerInfluence;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float circle = 1.0 - smoothstep(0.45, 1.0, dot(point, point));
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  float mask = texture2D(uDotMask, uv).r;
  vec2 contentSpace = (uv - vec2(0.5, 0.55)) * vec2(1.0, 1.65);
  float contentClearance = smoothstep(0.12, 0.48, length(contentSpace));
  float contentMask = mix(1.0, contentClearance, uContentFade);
  float edgeMask = uEdgeFade > 0.0001
    ? smoothstep(0.0, uEdgeFade, vGeometryEdge)
    : 1.0;
  vec3 color = mix(uColorLow, uColorHigh, smoothstep(0.05, 0.95, vHeight));
  float reflected = clamp(vReflection * uReflect, 0.0, 1.0);
  vec3 reflectionColor = mix(uColorHigh, vec3(1.0), 0.62);
  color = mix(color, reflectionColor, reflected * 0.72);
  color = mix(
    color,
    uDotPointerColor,
    vPointerInfluence * uDotPointerColorStrength
  );
  float twinkle = mix(1.0, mix(0.58, 1.42, vTwinkle), uTwinkle);
  color = mix(color, vec3(0.08, 0.12, 0.16), uThemeMode * 0.72);
  float alpha = circle * mask * contentMask * edgeMask * uOpacity *
    mix(0.28, 1.0, vDepthFade) * twinkle * (1.0 + reflected * 0.45) *
    max(0.0, 1.0 + vPointerInfluence * uDotPointerBrightness);
  gl_FragColor = vec4(color, alpha);
}
`;

const GLASS_BLUR_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uDirection;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec4 color = texture2D(uSource, uv) * 0.227027;
  color += texture2D(uSource, uv + uDirection * 1.384615) * 0.316216;
  color += texture2D(uSource, uv - uDirection * 1.384615) * 0.316216;
  color += texture2D(uSource, uv + uDirection * 3.230769) * 0.070270;
  color += texture2D(uSource, uv - uDirection * 3.230769) * 0.070270;
  gl_FragColor = color;
}
`;

const GLASS_COMPOSITE_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uScene;
uniform sampler2D uEffect;
uniform sampler2D uBlurEffect;
uniform vec2 uResolution;
uniform float uProgress;
uniform float uBlurMix;
uniform float uOffsetY;

void main() {
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  // WebGL Y points upward while Motion's positive Y points downward.
  // Sampling above the current fragment displays the layer below its target.
  vec2 effectUv = uv + vec2(
    0.0,
    uOffsetY * (1.0 - uProgress) / max(uResolution.y, 1.0)
  );
  vec3 scene = texture2D(uScene, uv).rgb;
  vec4 sharpEffect = texture2D(uEffect, effectUv);
  vec4 blurredEffect = texture2D(uBlurEffect, effectUv);
  vec4 effect = mix(sharpEffect, blurredEffect, uBlurMix) * uProgress;
  gl_FragColor = vec4(scene * (1.0 - effect.a) + effect.rgb, 1.0);
}
`;

const GLASS_TEXT_FRAGMENT_SHADER = `
precision __PRECISION__ float;
uniform sampler2D uScene;
uniform sampler2D uBlurScene;
uniform sampler2D uTextMask;
uniform vec2 uRes;
uniform float uTime;
uniform float uRefraction;
uniform float uEdgeWrap;
uniform float uSurfaceModel;
uniform float uBevelMode;
uniform float uSurfaceDepth;
uniform float uIor;
uniform vec2 uMagnification;
uniform vec2 uDisplacement;
uniform float uDiffusion;
uniform float uSdfRange;
uniform float uBlur;
uniform float uMicroDistortion;
uniform float uChromaticAberration;
uniform float uFrost;
uniform float uRoughness;
uniform float uBevel;
uniform float uRibStrength;
uniform float uRibWidth;
uniform float uRibAngle;
uniform float uLiquidStrength;
uniform float uLiquidScale;
uniform float uLiquidSpeed;
uniform float uEdgeStrength;
uniform float uSpecular;
uniform float uFresnel;
uniform float uTwinkle;
uniform float uTwinkleDensity;
uniform float uTwinkleSpeed;
uniform float uTwinkleSize;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uSaturation;
uniform float uBrightness;
uniform float uOpacity;

float hash21(vec2 value) {
  value = fract(value * vec2(123.34, 456.21));
  value += dot(value, value + 45.32);
  return fract(value.x * value.y);
}

float glassTwinkleAtCell(vec2 gridPosition, vec2 cell) {
  vec2 localPosition = gridPosition - cell - 0.5;
  float cellSeed = hash21(cell + vec2(17.31, 41.73));
  float sparkleTime = uTime * uTwinkleSpeed + cellSeed * 5.0;
  float cycle = floor(sparkleTime);
  float phase = fract(sparkleTime);
  float activeSeed = hash21(cell + vec2(cycle * 13.17, cycle * 7.91));
  float active = step(1.0 - uTwinkleDensity, activeSeed);
  vec2 sparkleOffset = vec2(
    hash21(cell + vec2(cycle * 3.71, cycle * 11.23)),
    hash21(cell + vec2(cycle * 19.43, cycle * 5.17))
  ) - 0.5;
  vec2 delta = localPosition - sparkleOffset * 0.52;
  float cellSize = max(uTwinkleSize, 4.0);
  vec2 sparklePixel = (cell + 0.5 + sparkleOffset * 0.52) * cellSize;
  vec2 sparkleUv = clamp(sparklePixel / max(uRes, vec2(1.0)), 0.0, 1.0);
  float sparkleOriginDistance =
    (texture2D(uTextMask, sparkleUv).g - 0.5) * 2.0 * uSdfRange;
  float sparkleOrigin = smoothstep(-0.5, 0.75, sparkleOriginDistance);
  float pulse = pow(max(sin(phase * 3.14159265359), 0.0), 16.0);
  float core = exp(-dot(delta, delta) * 520.0) * 2.25;
  float halo = exp(-dot(delta, delta) * 24.0) * 0.16;
  float horizontalRay = exp(-abs(delta.y) * 180.0)
    * exp(-abs(delta.x) * 5.0);
  float verticalRay = exp(-abs(delta.x) * 180.0)
    * exp(-abs(delta.y) * 5.0);
  vec2 diagonal = vec2(delta.x + delta.y, delta.x - delta.y) * 0.70710678;
  float diagonalA = exp(-abs(diagonal.y) * 150.0)
    * exp(-abs(diagonal.x) * 8.0);
  float diagonalB = exp(-abs(diagonal.x) * 150.0)
    * exp(-abs(diagonal.y) * 8.0);
  float star = core
    + halo
    + (horizontalRay + verticalRay) * 0.58
    + (diagonalA + diagonalB) * 0.16;
  return active * pulse * star * sparkleOrigin;
}

float glassTwinkle(vec2 fragmentPosition) {
  float cellSize = max(uTwinkleSize, 4.0);
  vec2 gridPosition = fragmentPosition / cellSize;
  vec2 cell = floor(gridPosition);
  float sparkle = 0.0;
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 0.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0, -1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0,  0.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell);
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0,  0.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2(-1.0,  1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 0.0,  1.0));
  sparkle += glassTwinkleAtCell(gridPosition, cell + vec2( 1.0,  1.0));
  return sparkle;
}

float readSignedDistance(vec2 uv) {
  return (texture2D(uTextMask, uv).g - 0.5) * 2.0 * uSdfRange;
}

float surfaceHeight(float inside, float depth) {
  if (inside <= 0.0) return 0.0;
  if (inside >= depth) return depth;
  return sqrt(max(inside * (2.0 * depth - inside), 0.0));
}

vec3 dispersedSample(vec2 uv, vec2 chroma, vec2 pixel) {
  vec2 minimumUv = pixel;
  vec2 maximumUv = vec2(1.0) - pixel;
  return vec3(
    texture2D(uScene, clamp(uv + chroma, minimumUv, maximumUv)).r,
    texture2D(uScene, clamp(uv, minimumUv, maximumUv)).g,
    texture2D(uScene, clamp(uv - chroma, minimumUv, maximumUv)).b
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));
  vec2 pixel = 1.0 / max(uRes, vec2(1.0));
  vec3 scene = texture2D(uScene, uv).rgb;
  vec2 maskSample = texture2D(uTextMask, uv).rg;
  float signedDistance = (maskSample.g - 0.5) * 2.0 * uSdfRange;
  float mask = maskSample.r;
  float sparkleReach = max(uTwinkleSize * 0.85, 6.0);
  float sparkleRegion = smoothstep(-sparkleReach, -sparkleReach + 2.0, signedDistance);
  if (mask <= 0.001 && (uTwinkle <= 0.001 || sparkleRegion <= 0.001)) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float left = texture2D(uTextMask, uv - vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float right = texture2D(uTextMask, uv + vec2(pixel.x, 0.0) * (1.0 + uBevel)).r;
  float down = texture2D(uTextMask, uv - vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  float up = texture2D(uTextMask, uv + vec2(0.0, pixel.y) * (1.0 + uBevel)).r;
  vec2 gradient = vec2(right - left, up - down);
  float simpleEdge = clamp(length(gradient) * 2.8, 0.0, 1.0);
  vec2 simpleNormal = gradient / max(length(gradient), 0.0001);

  float inside = max(signedDistance, 0.0);
  float depthRadius = max(uSurfaceDepth, 1.0);
  vec2 sdfPixel = 2.0 / max(uRes, vec2(1.0));
  float dR = max(readSignedDistance(uv + vec2(sdfPixel.x, 0.0)), 0.0);
  float dL = max(readSignedDistance(uv - vec2(sdfPixel.x, 0.0)), 0.0);
  float dU = max(readSignedDistance(uv + vec2(0.0, sdfPixel.y)), 0.0);
  float dD = max(readSignedDistance(uv - vec2(0.0, sdfPixel.y)), 0.0);
  float hC = surfaceHeight(inside, depthRadius);
  vec2 heightGradient = vec2(
    surfaceHeight(dR, depthRadius) - surfaceHeight(dL, depthRadius),
    surfaceHeight(dU, depthRadius) - surfaceHeight(dD, depthRadius)
  ) * 0.25;
  vec2 boundedHeightGradient = heightGradient / (vec2(1.0) + abs(heightGradient));
  vec3 volumeNormal = normalize(vec3(-heightGradient * (0.7 + uBevel * 0.18), 1.0));
  float volumeEdge = 1.0 - smoothstep(0.0, depthRadius * 0.9, inside);
  float useVolume = step(0.5, uSurfaceModel);
  float edge = mix(simpleEdge, volumeEdge, useVolume);
  vec2 normal = mix(simpleNormal, -volumeNormal.xy, useVolume);
  vec3 surfaceNormal = normalize(mix(
    vec3(simpleNormal * (0.35 + uBevel), 1.0),
    volumeNormal,
    useVolume
  ));

  float angle = radians(uRibAngle);
  vec2 ribDirection = vec2(cos(angle), sin(angle));
  float ribPhase = dot(gl_FragCoord.xy, ribDirection) / max(uRibWidth, 1.0);
  float rib = sin(ribPhase * 6.28318530718) * uRibStrength;
  vec2 ribNormal = vec2(-ribDirection.y, ribDirection.x) * rib;
  float liquidPhase = uTime * uLiquidSpeed * 6.28318530718;
  vec2 liquid = vec2(
    sin((uv.y * 1.37 + uv.x * 0.31) * uLiquidScale * 6.28318530718 + liquidPhase),
    cos((uv.x * 1.21 - uv.y * 0.28) * uLiquidScale * 6.28318530718 - liquidPhase * 0.83)
  ) * uLiquidStrength;
  float refractivePower = 1.0 - 1.0 / max(uIor, 1.01);
  float thickness = clamp(hC / depthRadius, 0.0, 1.0);
  vec2 biconvexRefraction = boundedHeightGradient * uRefraction
    * refractivePower * (1.65 + thickness * 0.85);
  vec2 sdfGradient = normalize(vec2(dR - dL, dU - dD) + vec2(0.0001));
  vec2 domeRefraction = -sdfGradient * uRefraction * thickness * 0.62;
  vec2 volumeRefraction = mix(
    biconvexRefraction,
    domeRefraction,
    step(0.5, uBevelMode)
  );
  vec2 simpleRefraction = normal * edge * uRefraction;
  vec2 micro = (vec2(
    hash21(gl_FragCoord.xy * 0.083),
    hash21(gl_FragCoord.yx * 0.071 + vec2(31.7, 9.2))
  ) - 0.5) * uMicroDistortion * 8.0;
  float edgeWrapWidth = max(
    3.0,
    min(uSdfRange * 0.9, depthRadius * 0.85)
  );
  float edgeWrapEnvelope = 1.0 - smoothstep(0.0, edgeWrapWidth, inside);
  vec2 edgeWrapPx = -normal * uEdgeWrap
    * edgeWrapEnvelope * edgeWrapEnvelope;
  vec2 distortionPx = mix(simpleRefraction, volumeRefraction, useVolume)
    + (ribNormal + liquid) * uRefraction
    + edgeWrapPx
    + micro;
  float lensTransition = max(
    2.0,
    min(depthRadius * 0.35, uSdfRange * 0.4)
  );
  float lensDepth = smoothstep(0.0, lensTransition, inside) * useVolume;
  vec2 lensContraction = vec2(1.0) - vec2(1.0) /
    (vec2(1.0) + max(uMagnification, vec2(0.0)));
  vec2 magnificationUv = -(uv - vec2(0.5)) * lensContraction * lensDepth;
  vec2 displacementUv = vec2(uDisplacement.x, -uDisplacement.y) * pixel;
  vec2 sampleUv = clamp(
    uv + distortionPx * pixel + magnificationUv + displacementUv,
    pixel,
    vec2(1.0) - pixel
  );
  vec2 chroma = normal * (0.3 + edge * 0.7) * uChromaticAberration * pixel;
  vec3 sharp = dispersedSample(sampleUv, chroma, pixel);

  float jitter = (hash21(gl_FragCoord.xy + floor(uTime * 17.0)) - 0.5) * 2.0;
  float blurRadius = 1.0 + uBlur * 12.0 + uFrost * (2.0 + uRoughness * 9.0) + jitter;
  vec2 blurOffset = pixel * max(blurRadius, 0.5);
  vec3 blurred = sharp * 0.2;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(blurOffset.x, 0.0), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv - vec2(0.0, blurOffset.y), chroma, pixel) * 0.12;
  blurred += dispersedSample(sampleUv + blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv - blurOffset * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(blurOffset.x, -blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  blurred += dispersedSample(sampleUv + vec2(-blurOffset.x, blurOffset.y) * 0.7, chroma, pixel) * 0.08;
  float blurMix = clamp(uBlur + uFrost * (0.42 + uRoughness * 0.38), 0.0, 1.0)
    * (1.0 - edge * 0.55);
  vec3 refracted = mix(sharp, blurred, blurMix);
  vec3 diffused = texture2D(uBlurScene, sampleUv).rgb;
  float diffusionMix = clamp(
    uDiffusion * (0.58 + 0.42 * thickness)
      + uBlur * 0.34
      + uFrost * (0.22 + uRoughness * 0.36),
    0.0,
    1.0
  );
  float diffusedLuminance = dot(diffused, vec3(0.299, 0.587, 0.114));
  vec3 diffusionBloom = diffused
    * smoothstep(0.025, 0.55, diffusedLuminance)
    * uDiffusion * 0.48;
  refracted = mix(refracted, diffused, diffusionMix) + diffusionBloom;
  float luminance = dot(refracted, vec3(0.299, 0.587, 0.114));
  refracted = mix(vec3(luminance), refracted, 1.0 + uSaturation);
  refracted *= 1.0 + uBrightness;
  refracted = mix(refracted, refracted * uTint, uTintStrength);

  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 lightA = normalize(vec3(-0.38, 0.72, 0.58));
  vec3 lightB = normalize(vec3(0.52, -0.28, 0.8));
  vec3 lightC = normalize(vec3(0.05, 0.88, 0.46));
  float highlightA = pow(max(dot(surfaceNormal, normalize(lightA + viewDirection)), 0.0), 72.0);
  float highlightB = pow(max(dot(surfaceNormal, normalize(lightB + viewDirection)), 0.0), 44.0) * 0.35;
  float highlightC = pow(max(dot(surfaceNormal, normalize(lightC + viewDirection)), 0.0), 110.0) * 0.55;
  float highlight = (highlightA + highlightB + highlightC) * uSpecular;
  float fresnel = pow(1.0 - abs(surfaceNormal.z), 4.0) * uFresnel;
  float innerStroke = (1.0 - smoothstep(1.0, 3.5, inside))
    * (0.45 + 0.55 * clamp(surfaceNormal.y * 0.5 + 0.5, 0.0, 1.0));
  float rim = edge * uEdgeStrength * 0.22;
  float sparkle = glassTwinkle(gl_FragCoord.xy)
    * uTwinkle
    * (0.62 + thickness * 0.38)
    * sparkleRegion;
  vec3 glass = refracted;
  glass += vec3(highlight);
  glass += mix(vec3(1.0), uTint, 0.16) * sparkle;
  glass += uTint * (fresnel * 0.24 + rim + innerStroke * uEdgeStrength * 0.32);
  float glassAlpha = max(mask * uOpacity, clamp(sparkle * 0.72, 0.0, 1.0));
  gl_FragColor = vec4(glass * glassAlpha, glassAlpha);
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
    clamp(uEnvelopeStationary, 0.0, 1.0)
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
uniform sampler2D uProfiles;
uniform mat3 uHueMatrix;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;
uniform float uPaletteOffset;
uniform float uPaletteWrap;
uniform vec4 uMaterialWeights0;
uniform vec4 uMaterialWeights1;
uniform float uVelocityWidthScale;
uniform float uVelocityGlowScale;
uniform float uVelocityReflectionScale;
uniform float uVisibility;

const float GLOW_PROFILE_MAX_DISTANCE = ${HERO_GLOW_PROFILE_MAX_DISTANCE.toFixed(8)};
const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float mirrorCoordinate(float value) {
  float wrapped = mod(value, 2.0);
  if (wrapped < 0.0) wrapped += 2.0;
  return wrapped <= 1.0 ? wrapped : 2.0 - wrapped;
}

float wrappedPaletteCoordinate(float value) {
  if (uPaletteWrap > 1.5) return mirrorCoordinate(value);
  if (uPaletteWrap > 0.5) return fract(value);
  return clamp(value, 0.0, 1.0);
}

vec3 spatialPalette(float position) {
  float wrapped = wrappedPaletteCoordinate(position - uPaletteOffset);
  float palettePosition;
  if (uPaletteWrap > 0.5 && uPaletteWrap < 1.5) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  } else {
    palettePosition = mix(
      0.5 * PALETTE_TEXEL,
      0.5 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  }
  return texture2D(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void sampleProfiles(
  float position,
  out float widthScale,
  out float opacityScale,
  out float intensityScale,
  out float glowScale,
  out float upperGlowSpreadScale,
  out float lowerGlowSpreadScale,
  out float reflectionScale,
  out float colorPositionOffset
) {
  float coordinate = clamp(position, 0.0, 1.0);
  vec4 primary = texture2D(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture2D(uProfiles, vec2(coordinate, 0.75));
  widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  opacityScale = primary.g * 4.0;
  intensityScale = primary.b * 4.0;
  glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  colorPositionOffset = secondary.g * 4.0 - 2.0;
}

vec3 filamentContribution(
  float normalizedDistance,
  float sideDirection,
  float position,
  float segmentAlpha,
  out float reflectionEnergy,
  out vec3 reflectionColor
) {
  float widthScale;
  float opacityScale;
  float intensityScale;
  float glowScale;
  float upperGlowSpreadScale;
  float lowerGlowSpreadScale;
  float reflectionScale;
  float colorPositionOffset;
  sampleProfiles(
    position,
    widthScale,
    opacityScale,
    intensityScale,
    glowScale,
    upperGlowSpreadScale,
    lowerGlowSpreadScale,
    reflectionScale,
    colorPositionOffset
  );
  float localDistance = normalizedDistance / widthScale;
  float visibleAlpha = segmentAlpha * opacityScale * uVisibility;
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, localDistance);
  float directionalSpread = mix(
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05),
    upperSide
  );
  float profileDistance = abs(localDistance)
    / directionalSpread
    / max(uBandSpread * glowScale, 0.001);
  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  vec3 paleColor = mix(waveColor, vec3(0.90, 1.0, 0.98), 0.18);
  reflectionColor = mix(waveColor, paleColor, 0.28);

  if (
    visibleAlpha <= 0.000001 ||
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
    * smoothstep(0.0, 0.14, localDistance);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, localDistance);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;
  vec3 wave = (
      waveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + waveColor * broad * uMaterialWeights0.y * outerBloom
      + waveColor * body * uMaterialWeights0.z * bodyBloom
      + paleColor * ridge * uMaterialWeights0.w
      + coreColor * core * uMaterialWeights1.x
      + waveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * intensityScale
      * longitudinal * visibleAlpha;
  wave = uHueMatrix * wave;

  float waveLuminance = dot(wave, LUMA);
  float saturationBase = 1.0 - core;
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), wave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  reflectionEnergy = profile1.b * visibleAlpha * reflectionScale;
  return saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
}
`;

const COMMON_THEME_GLSL = `
uniform float uThemeMode;

float lightThemeMix() {
  return step(0.5, uThemeMode);
}

vec3 themeBackground(vec2 uv) {
  vec3 darkBackground = mix(
    vec3(0.008, 0.011, 0.016),
    vec3(0.016, 0.021, 0.030),
    uv.y
  );
  return mix(darkBackground, vec3(1.0), lightThemeMix());
}

vec3 lightThemeTintColor(vec3 sourceColor) {
  vec3 positive = max(sourceColor, vec3(0.0));
  float peak = max(max(positive.r, positive.g), positive.b);
  if (peak <= 0.000001) {
    return vec3(0.30, 0.32, 0.36);
  }

  vec3 chroma = positive / peak;
  float chromaLuminance = clamp(dot(chroma, LUMA), 0.0, 1.0);
  // Bright cyan and green disappear against the light canvas when they are
  // pushed toward white. Preserve their hue while capping luminance so the
  // filament and its reflected dots retain contrast in the light theme.
  float contrastScale = min(1.0, 0.46 / max(chromaLuminance, 0.0001));
  return clamp(chroma * contrastScale, vec3(0.035), vec3(0.92));
}

vec3 composeThemedWave(vec3 background, vec3 wave) {
  vec3 darkResult = background + wave;
  vec3 positive = max(wave, vec3(0.0));
  float peak = max(max(positive.r, positive.g), positive.b);
  float coverage = clamp(1.0 - exp(-peak * 1.08), 0.0, 0.86);
  float coreHighlight = smoothstep(0.55, 2.4, peak);
  vec3 luminousTint = mix(
    lightThemeTintColor(positive),
    lightThemeTintColor(positive) * 0.72,
    coreHighlight * 0.28
  );
  vec3 lightResult = mix(
    background,
    luminousTint,
    coverage
  );
  return mix(darkResult, lightResult, lightThemeMix());
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
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uDotPointerBrightness;
uniform vec3 uDotPointerColor;
uniform float uDotPointerColorStrength;
uniform float uDotPointerMagnification;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec4 composeDots(
  vec2 fragmentCoordinate,
  vec2 uv,
  float reflectionEnergy,
  vec3 reflectionColor
) {
  vec2 pointerCoordinate = uDotPointer * uRes;
  float pointerDistance = length(fragmentCoordinate - pointerCoordinate);
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  float pointerInfluence = uDotPointerActive * (
    1.0 - smoothstep(
      pointerInnerRadius,
      max(uDotPointerRadius, pointerInnerRadius + 0.001),
      pointerDistance
    )
  );
  float magnification = mix(
    1.0,
    max(uDotPointerMagnification, 0.25),
    pointerInfluence
  );
  vec2 sampledCoordinate = pointerCoordinate +
    (fragmentCoordinate - pointerCoordinate) / magnification;
  vec2 grid = mix(fragmentCoordinate, sampledCoordinate, pointerInfluence)
    / uSpacing;
  vec2 cellId = floor(grid);
  vec2 cellPosition = (fract(grid) - 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2)) + random1 * 6.2831
  );
  pulse *= pulse;
  float twinklePulse = mix(pulse, 1.0 - pulse, lightThemeMix());
  float dotScale = (1.0 + 0.5 * uTwinkle * twinklePulse) * magnification;
  float dotAmplitude = mix(
    0.55,
    0.35 + 0.65 * twinklePulse,
    uTwinkle
  );
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
  dotColor = mix(
    dotColor,
    uDotPointerColor,
    pointerInfluence * uDotPointerColorStrength
  );
  float dotLuminance = uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  float dotEnergy = dotSignal * dotLuminance *
    max(0.0, 1.0 + pointerInfluence * uDotPointerBrightness);
  vec3 darkContribution = dotColor * dotEnergy;
  vec3 lightDotColor = mix(
    vec3(0.30, 0.32, 0.36),
    lightThemeTintColor(reflectionColor),
    0.10 + 0.72 * reflected
  );
  float lightCoverage = clamp(dotEnergy * 1.55, 0.0, 0.82);
  float lightTheme = lightThemeMix();
  return vec4(
    mix(darkContribution, lightDotColor, lightTheme),
    lightCoverage * lightTheme
  );
}

float displayNoise(vec2 fragmentCoordinate) {
  return (hash21(fragmentCoordinate + uNoisePhase) - 0.5) / 255.0 * 2.0;
}
`;

const SINE_FRAGMENT_SHADER = `
precision __PRECISION__ float;

${COMMON_SEGMENT_GLSL}
${COMMON_GLOW_GLSL}
${COMMON_THEME_GLSL}
${COMMON_DOTS_GLSL}

uniform float uBandHeight;
uniform float uCurveStrength;
uniform float uCurveScale;
uniform float uCurveFrequency;
uniform float uCurveMotion;
uniform float uGeometryAdvanceRatio;
uniform sampler2D uBackgroundImage;
uniform float uBackgroundOpacity;

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
  vec4 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  float lightTheme = lightThemeMix();
  vec4 imageBackground = texture2D(uBackgroundImage, uv);
  vec3 background = mix(
    themeBackground(uv),
    imageBackground.rgb,
    imageBackground.a * uBackgroundOpacity
  );
  vec3 color = composeThemedWave(background, wave);
  color += dots.rgb * (1.0 - lightTheme);
  color = mix(color, dots.rgb, dots.a);
  color += displayNoise(fragmentCoordinate) * (1.0 - lightTheme);
  gl_FragColor = vec4(color, 1.0);
}
`;

const FULLSCREEN_VERTEX_SHADER_300 = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const PATH_INTEGRAL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aCorner;
in vec2 aSegmentStart;
in vec2 aSegmentEnd;
in vec2 aProgressRange;
in vec2 aEndpointWeights;

uniform vec2 uTargetResolution;
uniform float uSupportRadiusPositivePx;
uniform float uSupportRadiusNegativePx;

flat out vec2 vSegmentStart;
flat out vec2 vSegmentEnd;
flat out vec2 vProgressRange;
flat out vec2 vEndpointWeights;

void main() {
  vec2 startPx = aSegmentStart * uTargetResolution;
  vec2 endPx = aSegmentEnd * uTargetResolution;
  vec2 direction = endPx - startPx;
  float directionLength = max(length(direction), 0.0001);
  vec2 tangent = direction / directionLength;
  vec2 normal = vec2(-tangent.y, tangent.x);
  float positiveRadius = max(uSupportRadiusPositivePx, 1.0);
  float negativeRadius = max(uSupportRadiusNegativePx, 1.0);
  float alongRadius = max(positiveRadius, negativeRadius);
  float acrossRadius = aCorner.y > 0.0
    ? positiveRadius
    : negativeRadius;
  vec2 base = aCorner.x < 0.0 ? startPx : endPx;
  vec2 positionPx = base
    + tangent * aCorner.x * alongRadius
    + normal * aCorner.y * acrossRadius;

  gl_Position = vec4(
    positionPx / uTargetResolution * 2.0 - 1.0,
    0.0,
    1.0
  );
  vSegmentStart = aSegmentStart;
  vSegmentEnd = aSegmentEnd;
  vProgressRange = aProgressRange;
  vEndpointWeights = aEndpointWeights;
}
`;

const PATH_INTEGRAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

flat in vec2 vSegmentStart;
flat in vec2 vSegmentEnd;
flat in vec2 vProgressRange;
flat in vec2 vEndpointWeights;

layout(location = 0) out vec4 outWave;
layout(location = 1) out vec4 outReflection;

uniform vec2 uTargetResolution;
uniform vec2 uCanvasResolution;
uniform sampler2D uPalette;
uniform sampler2D uK0Lut;
uniform sampler2D uProfiles;
uniform mat3 uHueMatrix;
uniform vec4 uLayerMask0;
uniform vec2 uLayerMask1;
uniform float uQuadraturePoints;
uniform float uTime;
uniform float uCurveTravel;
uniform float uEnvelopeStationary;
uniform float uStationaryCenter;
uniform float uSegmentLength;
uniform float uTailTaper;
uniform float uHeadTaper;
uniform float uPathClosed;
uniform float uClosedLoopTaper;
uniform float uBrightness;
uniform float uBandSpread;
uniform float uUpperGlowSpread;
uniform float uLowerGlowSpread;
uniform float uGlowAsymmetry;
uniform float uPaletteOffset;
uniform float uPaletteWrap;
uniform vec4 uMaterialWeights0;
uniform vec4 uMaterialWeights1;
uniform float uVelocityWidthScale;
uniform float uVelocityGlowScale;
uniform float uVelocityReflectionScale;
uniform float uVisibility;

const float PI = 3.14159265358979323846;
const float PALETTE_TEXEL = ${(1 / HERO_PALETTE_TEXTURE_WIDTH).toFixed(10)};
const float K0_MAX_ARGUMENT = ${HERO_PATH_K0_MAX_ARGUMENT.toFixed(8)};
const float K0_MIN_ARGUMENT = ${HERO_PATH_K0_MIN_ARGUMENT.toFixed(8)};
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float segmentCenter(float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  float outsidePadding = 0.06;
  float firstCenter = -0.5 * lengthValue - outsidePadding;
  float cycleLength = 1.0 + lengthValue + 2.0 * outsidePadding;
  float centeredOffset = 0.5 - firstCenter;
  float travelingCenter = firstCenter + mod(
    time * uCurveTravel + centeredOffset,
    cycleLength
  );
  return mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
}

float segmentPositionForValue(float value, float time) {
  float lengthValue = max(uSegmentLength, 0.05);
  return (
    value - (segmentCenter(time) - 0.5 * lengthValue)
  ) / lengthValue;
}

float pathSegmentPosition(float progress, float time) {
  if (uPathClosed < 0.5) {
    return segmentPositionForValue(progress, time);
  }
  float lengthValue = min(max(uSegmentLength, 0.05), 0.98);
  float travelingCenter = fract(time * uCurveTravel + 0.5);
  float center = mix(
    travelingCenter,
    uStationaryCenter,
    clamp(uEnvelopeStationary, 0.0, 1.0)
  );
  float delta = mod(progress - center + 0.5, 1.0) - 0.5;
  return delta / lengthValue + 0.5;
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

float mirrorCoordinate(float value) {
  float wrapped = mod(value, 2.0);
  if (wrapped < 0.0) wrapped += 2.0;
  return wrapped <= 1.0 ? wrapped : 2.0 - wrapped;
}

float wrappedPaletteCoordinate(float value) {
  if (uPaletteWrap > 1.5) return mirrorCoordinate(value);
  if (uPaletteWrap > 0.5) return fract(value);
  return clamp(value, 0.0, 1.0);
}

vec3 spatialPalette(float position) {
  float wrapped = wrappedPaletteCoordinate(position - uPaletteOffset);
  float palettePosition;
  if (uPaletteWrap > 0.5 && uPaletteWrap < 1.5) {
    palettePosition = mix(
      0.5 + 0.5 * PALETTE_TEXEL,
      1.0 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  } else {
    palettePosition = mix(
      0.5 * PALETTE_TEXEL,
      0.5 - 0.5 * PALETTE_TEXEL,
      wrapped
    );
  }
  return texture(uPalette, vec2(palettePosition, 0.5)).rgb;
}

void sampleProfiles(
  float position,
  out float widthScale,
  out float opacityScale,
  out float intensityScale,
  out float glowScale,
  out float upperGlowSpreadScale,
  out float lowerGlowSpreadScale,
  out float reflectionScale,
  out float colorPositionOffset
) {
  float coordinate = clamp(position, 0.0, 1.0);
  vec4 primary = texture(uProfiles, vec2(coordinate, 0.25));
  vec4 secondary = texture(uProfiles, vec2(coordinate, 0.75));
  widthScale = max(primary.r * 4.0 * uVelocityWidthScale, 0.0001);
  opacityScale = primary.g * 4.0;
  intensityScale = primary.b * 4.0;
  glowScale = max(primary.a * 4.0 * uVelocityGlowScale, 0.0001);
  upperGlowSpreadScale = max(secondary.b * 4.0, 0.0001);
  lowerGlowSpreadScale = max(secondary.a * 4.0, 0.0001);
  reflectionScale = secondary.r * 4.0 * uVelocityReflectionScale;
  colorPositionOffset = secondary.g * 4.0 - 2.0;
}

float sampleK0(float argument) {
  if (argument >= K0_MAX_ARGUMENT) return 0.0;
  float normalized = sqrt(
    clamp(
      max(argument, K0_MIN_ARGUMENT) / K0_MAX_ARGUMENT,
      0.0,
      1.0
    )
  );
  return texture(uK0Lut, vec2(normalized, 0.5)).r;
}

float lineKernel(float coefficient, float radius, float spread) {
  float safeSpread = max(spread, 0.00001);
  float effectiveCoefficient = coefficient / safeSpread;
  return (
    effectiveCoefficient / PI
  ) * sampleK0(effectiveCoefficient * radius);
}

void accumulateSource(
  float sourceParameter,
  float quadratureWeight,
  vec2 query,
  vec2 segmentStart,
  vec2 segmentVector,
  vec2 tangent,
  float segmentLength,
  inout vec3 waveSum,
  inout float coreSum,
  inout vec3 reflectionColorSum,
  inout float reflectionEnergySum
) {
  vec2 sourcePoint = segmentStart + segmentVector * sourceParameter;
  vec2 offset = query - sourcePoint;
  float signedPerpendicular =
    tangent.x * offset.y - tangent.y * offset.x;
  float perpendicularDistance = abs(signedPerpendicular);
  float sideDirection = signedPerpendicular >= 0.0 ? 1.0 : -1.0;
  float progress = mix(
    vProgressRange.x,
    vProgressRange.y,
    sourceParameter
  );
  float endpointWeight = mix(
    vEndpointWeights.x,
    vEndpointWeights.y,
    sourceParameter
  );

  float fullClosedLoop = step(0.5, uPathClosed)
    * (1.0 - step(0.5, uClosedLoopTaper));
  float position = mix(
    pathSegmentPosition(progress, uTime),
    progress,
    fullClosedLoop
  );
  float widthScale;
  float opacityScale;
  float intensityScale;
  float glowScale;
  float upperGlowSpreadScale;
  float lowerGlowSpreadScale;
  float reflectionScale;
  float colorPositionOffset;
  sampleProfiles(
    position,
    widthScale,
    opacityScale,
    intensityScale,
    glowScale,
    upperGlowSpreadScale,
    lowerGlowSpreadScale,
    reflectionScale,
    colorPositionOffset
  );
  float geometricAlpha = mix(
    pow(segmentEnvelope(position), 0.55),
    1.0,
    fullClosedLoop
  ) * endpointWeight;
  float segmentAlpha = geometricAlpha * opacityScale * uVisibility;
  if (segmentAlpha <= 0.000001) return;

  float taperWidth = mix(0.025, 1.0, geometricAlpha) * widthScale;
  float normalizedPerpendicular =
    perpendicularDistance / max(taperWidth, 0.000001);
  float upperSide = 0.5 + 0.5 * sideDirection
    * smoothstep(0.0, 0.03, normalizedPerpendicular);
  float directionalSpread = mix(
    max(uLowerGlowSpread * lowerGlowSpreadScale, 0.05),
    max(uUpperGlowSpread * upperGlowSpreadScale, 0.05),
    upperSide
  );
  float profileSpread =
    max(uBandSpread * glowScale, 0.001)
    * directionalSpread * taperWidth;
  float pixelRadius = 0.08 / max(uTargetResolution.y, 1.0);
  float radialDistance = sqrt(
    dot(offset, offset) + pixelRadius * pixelRadius
  );

  float atmosphere = uLayerMask0.x
    * lineKernel(4.6, radialDistance, profileSpread);
  float broad = uLayerMask0.y
    * lineKernel(6.2, radialDistance, profileSpread);
  float body = uLayerMask0.z
    * lineKernel(11.0, radialDistance, profileSpread);
  float ridge = uLayerMask0.w
    * lineKernel(20.0, radialDistance, profileSpread);
  float core = uLayerMask1.x
    * lineKernel(92.0, radialDistance, profileSpread);
  float veil = uLayerMask1.y
    * lineKernel(25.0, radialDistance, profileSpread);
  float arcWeight = segmentLength * quadratureWeight;

  vec3 waveColor = spatialPalette(position + colorPositionOffset);
  vec3 paleColor = mix(
    waveColor,
    vec3(0.90, 1.0, 0.98),
    0.18
  );
  vec3 coreColor = mix(paleColor, vec3(1.0), 0.05);
  float longitudinal = mix(
    0.80,
    1.0,
    smoothstep(0.08, 0.88, clamp(position, 0.0, 1.0))
  );
  float glowBias = clamp(uGlowAsymmetry, -1.0, 1.0);
  float outerDirection = sideDirection
    * smoothstep(0.0, 0.14, normalizedPerpendicular);
  float bodyDirection = sideDirection
    * smoothstep(0.0, 0.09, normalizedPerpendicular);
  float outerBloom = 0.72 + 0.44 * glowBias * outerDirection;
  float bodyBloom = 0.89 + 0.41 * glowBias * bodyDirection;

  vec3 sourceWave = (
      waveColor * atmosphere * uMaterialWeights0.x * outerBloom
      + waveColor * broad * uMaterialWeights0.y * outerBloom
      + waveColor * body * uMaterialWeights0.z * bodyBloom
      + paleColor * ridge * uMaterialWeights0.w
      + coreColor * core * uMaterialWeights1.x
      + waveColor * veil * uMaterialWeights1.y
    ) * uBrightness * uMaterialWeights1.z * intensityScale
      * longitudinal * segmentAlpha * arcWeight;
  sourceWave = uHueMatrix * sourceWave;
  float waveLuminance = dot(sourceWave, LUMA);
  float saturationBase = 1.0 - clamp(core * arcWeight, 0.0, 1.0);
  float saturationBoost = 1.0
    + 0.45 * uMaterialWeights1.w * saturationBase * saturationBase;
  vec3 saturatedWave = max(
    vec3(0.0),
    mix(vec3(waveLuminance), sourceWave, saturationBoost)
  );
  float saturatedLuminance = dot(saturatedWave, LUMA);
  waveSum += saturatedWave
    * waveLuminance / max(saturatedLuminance, 0.0001);
  coreSum += core * arcWeight;

  float reflectionEnergy = (
      broad * 0.36 + body * 0.54 + ridge * 0.34
    ) * segmentAlpha * reflectionScale * arcWeight;
  vec3 reflectionColor = mix(waveColor, paleColor, 0.28);
  reflectionColorSum += reflectionColor * reflectionEnergy;
  reflectionEnergySum += reflectionEnergy;
}

void main() {
  float aspect = uCanvasResolution.x
    / max(uCanvasResolution.y, 1.0);
  vec2 queryUv = gl_FragCoord.xy / uTargetResolution;
  vec2 query = vec2(queryUv.x * aspect, queryUv.y);
  vec2 start = vec2(vSegmentStart.x * aspect, vSegmentStart.y);
  vec2 end = vec2(vSegmentEnd.x * aspect, vSegmentEnd.y);
  vec2 segmentVector = end - start;
  float segmentLength = length(segmentVector);
  if (segmentLength <= 0.000001) discard;
  vec2 tangent = segmentVector / segmentLength;

  vec3 waveSum = vec3(0.0);
  float coreSum = 0.0;
  vec3 reflectionColorSum = vec3(0.0);
  float reflectionEnergySum = 0.0;

  if (uQuadraturePoints > 3.0) {
    accumulateSource(0.0694318442, 0.1739274226, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.3300094782, 0.3260725774, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.6699905218, 0.3260725774, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.9305681558, 0.1739274226, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
  } else {
    accumulateSource(0.2113248654, 0.5, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
    accumulateSource(0.7886751346, 0.5, query, start, segmentVector, tangent, segmentLength, waveSum, coreSum, reflectionColorSum, reflectionEnergySum);
  }

  outWave = vec4(waveSum, coreSum);
  outReflection = vec4(
    reflectionColorSum,
    reflectionEnergySum
  );
}
`;

const PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uFarWave;
uniform sampler2D uFarReflection;
uniform sampler2D uMidWave;
uniform sampler2D uMidReflection;
uniform sampler2D uCoreWave;
uniform sampler2D uDotMask;
uniform float uSpacing;
uniform float uDotR;
uniform float uDotAlpha;
uniform float uTwinkle;
uniform float uReflect;
uniform float uNoisePhase;
uniform vec2 uDotPointer;
uniform float uDotPointerActive;
uniform float uDotPointerRadius;
uniform float uDotPointerSoftness;
uniform float uDotPointerBrightness;
uniform vec3 uDotPointerColor;
uniform float uDotPointerColorStrength;
uniform float uDotPointerMagnification;
uniform sampler2D uBackgroundImage;
uniform float uBackgroundOpacity;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

${COMMON_THEME_GLSL}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec4 composeDots(
  vec2 fragmentCoordinate,
  vec2 uv,
  float reflectionEnergy,
  vec3 reflectionColor
) {
  vec2 pointerCoordinate = uDotPointer * uRes;
  float pointerDistance = length(fragmentCoordinate - pointerCoordinate);
  float pointerInnerRadius = uDotPointerRadius * (1.0 - uDotPointerSoftness);
  float pointerInfluence = uDotPointerActive * (
    1.0 - smoothstep(
      pointerInnerRadius,
      max(uDotPointerRadius, pointerInnerRadius + 0.001),
      pointerDistance
    )
  );
  float magnification = mix(
    1.0,
    max(uDotPointerMagnification, 0.25),
    pointerInfluence
  );
  vec2 sampledCoordinate = pointerCoordinate +
    (fragmentCoordinate - pointerCoordinate) / magnification;
  vec2 grid = mix(fragmentCoordinate, sampledCoordinate, pointerInfluence)
    / uSpacing;
  vec2 cellId = floor(grid);
  vec2 cellPosition = (fract(grid) - 0.5) * uSpacing;
  float radiusSquared = dot(cellPosition, cellPosition);
  float random1 = hash21(cellId);
  float random2 = hash21(cellId + 13.7);
  float pulse = 0.5 + 0.5 * sin(
    uTime * (6.2831 / (2.0 + 3.0 * random2))
      + random1 * 6.2831
  );
  pulse *= pulse;
  float twinklePulse = mix(pulse, 1.0 - pulse, lightThemeMix());
  float dotScale = (1.0 + 0.5 * uTwinkle * twinklePulse) * magnification;
  float dotAmplitude = mix(
    0.55,
    0.35 + 0.65 * twinklePulse,
    uTwinkle
  );
  float sigma = max(uDotR * dotScale, 0.0001);
  float dotSignal = exp(
    -radiusSquared / (2.0 * sigma * sigma)
  ) * dotAmplitude;
  float dotMask = texture(uDotMask, uv).r;
  float reflected = clamp(
    reflectionEnergy * uReflect,
    0.0,
    1.0
  );
  vec3 dotColor = mix(
    vec3(0.62, 0.66, 0.72),
    reflectionColor,
    0.10 + 0.85 * reflected
  );
  dotColor = mix(
    dotColor,
    uDotPointerColor,
    pointerInfluence * uDotPointerColorStrength
  );
  float dotLuminance =
    uDotAlpha * dotMask * (0.38 + 1.1 * reflected);
  float dotEnergy = dotSignal * dotLuminance *
    max(0.0, 1.0 + pointerInfluence * uDotPointerBrightness);
  vec3 darkContribution = dotColor * dotEnergy;
  vec3 lightDotColor = mix(
    vec3(0.30, 0.32, 0.36),
    lightThemeTintColor(reflectionColor),
    0.10 + 0.72 * reflected
  );
  float lightCoverage = clamp(dotEnergy * 1.55, 0.0, 0.82);
  float lightTheme = lightThemeMix();
  return vec4(
    mix(darkContribution, lightDotColor, lightTheme),
    lightCoverage * lightTheme
  );
}

float displayNoise(vec2 fragmentCoordinate) {
  return (
    hash21(fragmentCoordinate + uNoisePhase) - 0.5
  ) / 255.0 * 2.0;
}

void main() {
  vec2 fragmentCoordinate = gl_FragCoord.xy;
  vec2 uv = fragmentCoordinate / uRes;
  vec4 farWave = texture(uFarWave, uv);
  vec4 midWave = texture(uMidWave, uv);
  vec4 coreWave = texture(uCoreWave, uv);
  vec3 wave = farWave.rgb + midWave.rgb + coreWave.rgb;

  vec4 farReflection = texture(uFarReflection, uv);
  vec4 midReflection = texture(uMidReflection, uv);
  vec4 reflection = farReflection + midReflection;
  float reflectionEnergy = reflection.a;
  vec3 reflectionColor = reflectionEnergy > 0.000001
    ? reflection.rgb / reflectionEnergy
    : vec3(0.90, 0.95, 1.0);

  vec4 dots = composeDots(
    fragmentCoordinate,
    uv,
    reflectionEnergy,
    reflectionColor
  );
  float lightTheme = lightThemeMix();
  vec4 imageBackground = texture(uBackgroundImage, uv);
  vec3 background = mix(
    themeBackground(uv),
    imageBackground.rgb,
    imageBackground.a * uBackgroundOpacity
  );
  vec3 color = composeThemedWave(background, wave);
  color += dots.rgb * (1.0 - lightTheme);
  color = mix(color, dots.rgb, dots.a);
  color += displayNoise(fragmentCoordinate) * (1.0 - lightTheme);
  fragmentColor = vec4(color, 1.0);
}
`;

interface ProgramBundle {
  program: WebGLProgram;
  attributes: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface TerrainDotsResources {
  program: ProgramBundle;
  buffer: WebGLBuffer;
  columns: number;
  rows: number;
  pointCount: number;
}

interface GlassTextResources {
  program: ProgramBundle;
  blurProgram: ProgramBundle;
  compositeProgram: ProgramBundle;
  framebuffer: WebGLFramebuffer;
  blurFramebuffer: WebGLFramebuffer;
  sceneTexture: WebGLTexture;
  effectTexture: WebGLTexture;
  blurTextures: [WebGLTexture, WebGLTexture];
  maskTexture: WebGLTexture;
  maskCanvas: HTMLCanvasElement;
  maskWidth: number;
  maskHeight: number;
  width: number;
  height: number;
  blurWidth: number;
  blurHeight: number;
  maskSettingsKey: string;
  maskSizeRevision: number;
  fontRequestKey: string;
}

const TERRAIN_DOTS_UNIFORMS = [
  "uRes",
  "uTime",
  "uWidth",
  "uDepth",
  "uAmplitude",
  "uPointSize",
  "uSpeed",
  "uViewAngle",
  "uCameraDistance",
  "uFrequency",
  "uDpr",
  "uFitCover",
  "uTwinkle",
  "uReflect",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uTerrainPointerDisplacement",
  "uDotMask",
  "uColorLow",
  "uColorHigh",
  "uOpacity",
  "uContentFade",
  "uEdgeFade",
  "uThemeMode",
] as const;

const GLASS_TEXT_UNIFORMS = [
  "uScene",
  "uBlurScene",
  "uTextMask",
  "uRes",
  "uTime",
  "uRefraction",
  "uEdgeWrap",
  "uSurfaceModel",
  "uBevelMode",
  "uSurfaceDepth",
  "uIor",
  "uMagnification",
  "uDisplacement",
  "uDiffusion",
  "uSdfRange",
  "uBlur",
  "uMicroDistortion",
  "uChromaticAberration",
  "uFrost",
  "uRoughness",
  "uBevel",
  "uRibStrength",
  "uRibWidth",
  "uRibAngle",
  "uLiquidStrength",
  "uLiquidScale",
  "uLiquidSpeed",
  "uEdgeStrength",
  "uSpecular",
  "uFresnel",
  "uTwinkle",
  "uTwinkleDensity",
  "uTwinkleSpeed",
  "uTwinkleSize",
  "uTint",
  "uTintStrength",
  "uSaturation",
  "uBrightness",
  "uOpacity",
] as const;

const GLASS_BLUR_UNIFORMS = ["uSource", "uResolution", "uDirection"] as const;
const GLASS_COMPOSITE_UNIFORMS = [
  "uScene",
  "uEffect",
  "uBlurEffect",
  "uResolution",
  "uProgress",
  "uBlurMix",
  "uOffsetY",
] as const;

interface PathResources {
  integralProgram: ProgramBundle;
  compositeProgram: ProgramBundle;
  quadBuffer: WebGLBuffer;
  segmentBuffers: [WebGLBuffer, WebGLBuffer, WebGLBuffer];
  framebuffer: WebGLFramebuffer;
  waveTextures: [WebGLTexture, WebGLTexture, WebGLTexture];
  reflectionTextures: [WebGLTexture, WebGLTexture];
  k0Texture: WebGLTexture;
  passWidths: [number, number, number];
  passHeights: [number, number, number];
  segmentCounts: [number, number, number];
  staticSettingsRevision: number;
  staticSizeRevision: number;
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
  "uProfiles",
  "uHueMatrix",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uPaletteOffset",
  "uPaletteWrap",
  "uMaterialWeights0",
  "uMaterialWeights1",
  "uVelocityWidthScale",
  "uVelocityGlowScale",
  "uVelocityReflectionScale",
  "uVisibility",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uDotPointerMagnification",
  "uThemeMode",
  "uBandHeight",
  "uCurveStrength",
  "uCurveScale",
  "uCurveFrequency",
  "uCurveMotion",
  "uGeometryAdvanceRatio",
  "uBackgroundImage",
  "uBackgroundOpacity",
] as const;

const PATH_INTEGRAL_UNIFORMS = [
  "uTargetResolution",
  "uCanvasResolution",
  "uSupportRadiusPositivePx",
  "uSupportRadiusNegativePx",
  "uPalette",
  "uK0Lut",
  "uProfiles",
  "uHueMatrix",
  "uLayerMask0",
  "uLayerMask1",
  "uQuadraturePoints",
  "uTime",
  "uCurveTravel",
  "uEnvelopeStationary",
  "uStationaryCenter",
  "uSegmentLength",
  "uTailTaper",
  "uHeadTaper",
  "uPathClosed",
  "uClosedLoopTaper",
  "uBrightness",
  "uBandSpread",
  "uUpperGlowSpread",
  "uLowerGlowSpread",
  "uGlowAsymmetry",
  "uPaletteOffset",
  "uPaletteWrap",
  "uMaterialWeights0",
  "uMaterialWeights1",
  "uVelocityWidthScale",
  "uVelocityGlowScale",
  "uVelocityReflectionScale",
  "uVisibility",
] as const;

const PATH_INTEGRAL_COMPOSITE_UNIFORMS = [
  "uRes",
  "uTime",
  "uFarWave",
  "uFarReflection",
  "uMidWave",
  "uMidReflection",
  "uCoreWave",
  "uDotMask",
  "uSpacing",
  "uDotR",
  "uDotAlpha",
  "uTwinkle",
  "uReflect",
  "uNoisePhase",
  "uDotPointer",
  "uDotPointerActive",
  "uDotPointerRadius",
  "uDotPointerSoftness",
  "uDotPointerBrightness",
  "uDotPointerColor",
  "uDotPointerColorStrength",
  "uDotPointerMagnification",
  "uThemeMode",
  "uBackgroundImage",
  "uBackgroundOpacity",
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

function trackedTextWidth(
  context: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
) {
  return (
    context.measureText(text).width +
    Math.max(0, text.length - 1) * letterSpacing
  );
}

function wrapGlassText(
  context: CanvasRenderingContext2D,
  text: string,
  maximumWidth: number,
  letterSpacing: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (
        line &&
        trackedTextWidth(context, candidate, letterSpacing) > maximumWidth
      ) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  baselineY: number,
  letterSpacing: number,
) {
  const width = trackedTextWidth(context, text, letterSpacing);
  let x = centerX - width * 0.5;
  for (const character of text) {
    context.fillText(character, x, baselineY);
    x += context.measureText(character).width + letterSpacing;
  }
}

const HERO_GLASS_SDF_RANGE_CSS_PX = 128;
const HERO_GLASS_MASK_MAX_DIMENSION = 1280;
const HERO_GLASS_CHAMFER_DIAGONAL = Math.SQRT2;

function buildChamferDistance(
  alpha: Uint8Array,
  width: number,
  height: number,
  targetInside: boolean,
) {
  const distance = new Float32Array(width * height);
  for (let index = 0; index < distance.length; index++) {
    const inside = (alpha[index] ?? 0) >= 128;
    distance[index] = inside === targetInside ? 0 : Number.POSITIVE_INFINITY;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      let value = distance[index] ?? Number.POSITIVE_INFINITY;
      if (x > 0) value = Math.min(value, (distance[index - 1] ?? value) + 1);
      if (y > 0)
        value = Math.min(value, (distance[index - width] ?? value) + 1);
      if (x > 0 && y > 0) {
        value = Math.min(
          value,
          (distance[index - width - 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      if (x + 1 < width && y > 0) {
        value = Math.min(
          value,
          (distance[index - width + 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      distance[index] = value;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = y * width + x;
      let value = distance[index] ?? Number.POSITIVE_INFINITY;
      if (x + 1 < width)
        value = Math.min(value, (distance[index + 1] ?? value) + 1);
      if (y + 1 < height)
        value = Math.min(value, (distance[index + width] ?? value) + 1);
      if (x + 1 < width && y + 1 < height) {
        value = Math.min(
          value,
          (distance[index + width + 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      if (x > 0 && y + 1 < height) {
        value = Math.min(
          value,
          (distance[index + width - 1] ?? value) + HERO_GLASS_CHAMFER_DIAGONAL,
        );
      }
      distance[index] = value;
    }
  }
  return distance;
}

function encodeGlassSignedDistance(
  canvas: HTMLCanvasElement,
  rangePixels: number,
) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < alpha.length; index++) {
    alpha[index] = image.data[index * 4 + 3] ?? 0;
  }
  const distanceToInside = buildChamferDistance(
    alpha,
    canvas.width,
    canvas.height,
    true,
  );
  const distanceToOutside = buildChamferDistance(
    alpha,
    canvas.width,
    canvas.height,
    false,
  );
  const safeRange = Math.max(rangePixels, 1);
  for (let index = 0; index < alpha.length; index++) {
    const offset = index * 4;
    const inside = (alpha[index] ?? 0) >= 128;
    const signedDistance = inside
      ? (distanceToOutside[index] ?? 0)
      : -(distanceToInside[index] ?? 0);
    image.data[offset] = alpha[index] ?? 0;
    image.data[offset + 1] = Math.round(
      clamp(0.5 + signedDistance / (safeRange * 2), 0, 1) * 255,
    );
    image.data[offset + 2] = 0;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

function renderGlassTextMask(
  canvas: HTMLCanvasElement,
  settings: ResolvedGlassText,
  width: number,
  height: number,
  dpr: number,
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!settings.enabled) return;

  const maximumWidth = width * settings.maxWidth;
  const maximumHeight = height * settings.maxHeight;
  if (settings.shape === "svg") {
    if (!settings.svgPath.trim()) return;
    const [minX, minY, viewWidth, viewHeight] = settings.svgViewBox;
    const scale = Math.min(
      maximumWidth / Math.max(viewWidth, 0.000001),
      maximumHeight / Math.max(viewHeight, 0.000001),
    );
    context.save();
    try {
      const path = new Path2D(settings.svgPath);
      context.translate(width * settings.centerX, height * settings.centerY);
      context.scale(scale, scale);
      context.translate(-minX - viewWidth * 0.5, -minY - viewHeight * 0.5);
      context.fillStyle = "#ffffff";
      context.fill(path);
    } catch {
      // Invalid SVG path data produces an empty mask without breaking rendering.
    } finally {
      context.restore();
    }
    return;
  }
  if (!settings.text.trim()) return;
  const letterSpacing = settings.letterSpacing * dpr;
  const layoutAtSize = (fontSize: number) => {
    context.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`;
    const lines = wrapGlassText(
      context,
      settings.text,
      maximumWidth,
      letterSpacing,
    );
    const lineHeight = fontSize * settings.lineHeight;
    const textWidth = lines.reduce(
      (maximum, line) =>
        Math.max(maximum, trackedTextWidth(context, line, letterSpacing)),
      0,
    );
    return {
      fontSize,
      lines,
      lineHeight,
      textWidth,
      height: lines.length * lineHeight,
    };
  };

  let lower = Math.min(8 * dpr, settings.fontSize * dpr);
  let upper = settings.fontSize * dpr;
  let layout = layoutAtSize(upper);
  for (let iteration = 0; iteration < 10; iteration++) {
    if (layout.textWidth <= maximumWidth && layout.height <= maximumHeight) {
      lower = layout.fontSize;
    } else {
      upper = layout.fontSize;
    }
    layout = layoutAtSize((lower + upper) * 0.5);
  }
  if (layout.textWidth > maximumWidth || layout.height > maximumHeight) {
    layout = layoutAtSize(lower);
  }

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const top = height * settings.centerY - layout.height * 0.5;
  const baselineOffset = layout.fontSize * 0.79;
  layout.lines.forEach((line, index) => {
    drawTrackedText(
      context,
      line,
      width * settings.centerX,
      top + index * layout.lineHeight + baselineOffset,
      letterSpacing,
    );
  });
}

function createFollowAnchors(count: number): FollowAnchor[] {
  return Array.from({ length: count }, () => ({ x: 0.5, top: 0.5 }));
}

interface FilamentStyleTextures {
  palette: WebGLTexture;
  profiles: WebGLTexture;
  paletteHash: number;
  profileHash: number;
  settingsReference: Settings | null;
}

interface FilamentGeometryState {
  baseKey: number;
  deformationKey: number;
  meshKey: number;
  settingsReference: Settings | null;
  settingsSizeRevision: number;
  sourceSettingsKey: number;
  propagationSettingsKey: number;
  materialSettingsKey: number;
  baseSamples: CurveSample[];
  propagatedSamples: CurveSample[];
  followSamples: CurveSample[];
  morphSamples: CurveSample[];
  temporarySamples: CurveSample[];
  temporaryAnchors: FollowAnchor[];
  passSamples: [CurveSample[], CurveSample[], CurveSample[]];
  segmentData: [Float32Array, Float32Array, Float32Array];
  segmentCounts: [number, number, number];
  closed: boolean;
}

interface FollowRuntimeState {
  history: PointerTrailSample[];
  persistentHistory: FollowAnchor[];
  echoAnchors: FollowAnchor[];
  cascadeAnchors: FollowAnchor[];
  hybridAnchors: FollowAnchor[];
  hybridExactAnchors: FollowAnchor[];
  hybridRopeAnchors: FollowAnchor[];
  hybridResampledRopeAnchors: FollowAnchor[];
  persistentCumulative: Float32Array;
  anchorCumulative: Float32Array;
  targetX: number;
  targetTop: number;
  headX: number;
  headTop: number;
  idleCenterX: number;
  idleCenterTop: number;
  active: boolean;
  sourceBlend: number;
  lastMode: HeroWaveFollowMode | null;
  hybridInitialized: boolean;
  cascadeInitialized: boolean;
  cascadeInputInitialized: boolean;
  cascadeInputX: number;
  cascadeInputTop: number;
  inputRevision: number;
  cascadeProcessedInputRevision: number;
  lastInputTime: number;
  lastInputX: number;
  lastInputTop: number;
  lastSampleTime: number;
  rawVelocity: number;
  velocity: number;
  visibility: number;
}

interface FollowRuntimeModifiers {
  width: number;
  glow: number;
  reflection: number;
  intensity: number;
  hueDegrees: number;
  visibility: number;
}

function createFilamentGeometryState(): FilamentGeometryState {
  return {
    baseKey: -1,
    deformationKey: -1,
    meshKey: -1,
    settingsReference: null,
    settingsSizeRevision: -1,
    sourceSettingsKey: -1,
    propagationSettingsKey: -1,
    materialSettingsKey: -1,
    baseSamples: [],
    propagatedSamples: [],
    followSamples: [],
    morphSamples: [],
    temporarySamples: [],
    temporaryAnchors: [],
    passSamples: [[], [], []],
    segmentData: [
      new Float32Array(0),
      new Float32Array(0),
      new Float32Array(0),
    ],
    segmentCounts: [0, 0, 0],
    closed: false,
  };
}

function createFollowRuntimeState(): FollowRuntimeState {
  return {
    history: [],
    persistentHistory: [],
    echoAnchors: createFollowAnchors(HERO_ECHO_FOLLOW_POINT_COUNT),
    cascadeAnchors: createFollowAnchors(HERO_CASCADE_FOLLOW_POINT_COUNT),
    hybridAnchors: createFollowAnchors(HERO_FOLLOW_POINT_COUNT),
    hybridExactAnchors: createFollowAnchors(HERO_FOLLOW_POINT_COUNT),
    hybridRopeAnchors: createFollowAnchors(HERO_FOLLOW_POINT_COUNT),
    hybridResampledRopeAnchors: createFollowAnchors(HERO_FOLLOW_POINT_COUNT),
    persistentCumulative: new Float32Array(HERO_POINTER_HISTORY_LIMIT),
    anchorCumulative: new Float32Array(
      Math.max(HERO_FOLLOW_POINT_COUNT, HERO_CASCADE_FOLLOW_POINT_COUNT),
    ),
    targetX: 0.5,
    targetTop: 0.5,
    headX: 0.5,
    headTop: 0.5,
    idleCenterX: 0.5,
    idleCenterTop: 0.5,
    active: false,
    sourceBlend: 0,
    lastMode: null,
    hybridInitialized: false,
    cascadeInitialized: false,
    cascadeInputInitialized: false,
    cascadeInputX: 0.5,
    cascadeInputTop: 0.5,
    inputRevision: 0,
    cascadeProcessedInputRevision: -1,
    lastInputTime: Number.NEGATIVE_INFINITY,
    lastInputX: 0.5,
    lastInputTop: 0.5,
    lastSampleTime: Number.NEGATIVE_INFINITY,
    rawVelocity: 0,
    velocity: 0,
    visibility: 1,
  };
}

function activeFilaments(settings: Settings) {
  return settings.filaments.length > 0
    ? settings.filaments.filter((filament) => filament.enabled)
    : settings.enabled
      ? [settings]
      : [];
}

function paletteWrapUniform(wrap: HeroWavePaletteWrap) {
  return wrap === "repeat" ? 1 : wrap === "mirror" ? 2 : 0;
}

function ensureFloatCapacity(current: Float32Array, required: number) {
  if (current.length >= required) return current;
  let capacity = Math.max(256, current.length || 256);
  while (capacity < required) capacity *= 2;
  return new Float32Array(capacity);
}

interface SharedMediaAudioConnection {
  context: AudioContext;
  analyser: AnalyserNode;
}

interface MusicVisualizerRuntime {
  analyser: AnalyserNode | null;
  data: Uint8Array<ArrayBuffer>;
  sourceActive: boolean;
  energy: number;
  bass: number;
  mid: number;
  treble: number;
}

const sharedMediaAudioConnections = new WeakMap<
  HTMLMediaElement,
  SharedMediaAudioConnection
>();

function getSharedMediaAudioConnection(element: HTMLMediaElement) {
  const existing = sharedMediaAudioConnections.get(element);
  if (existing) return existing;
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  const source = context.createMediaElementSource(element);
  source.connect(analyser);
  analyser.connect(context.destination);
  const connection = { context, analyser };
  sharedMediaAudioConnections.set(element, connection);
  return connection;
}

function createMusicVisualizerRuntime(): MusicVisualizerRuntime {
  return {
    analyser: null,
    data: new Uint8Array(new ArrayBuffer(0)),
    sourceActive: false,
    energy: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };
}

const HdrHeroWaveBackground = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundCoreProps
>(function HdrHeroWaveBackground(
  {
    className,
    style,
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
    ...inputSettings
  },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const invalidateRef = useRef<() => void>(() => undefined);
  const currentTimeRef = useRef(0);
  const seekRequestRef = useRef<number | null>(null);
  const manualPausedRef = useRef(false);
  const settingsRevisionRef = useRef(0);
  const musicRuntimeRef = useRef<MusicVisualizerRuntime>(
    createMusicVisualizerRuntime(),
  );
  const callbacksRef = useRef({
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
  });
  callbacksRef.current = {
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
  };
  const settingsRef = useRef<Settings>(resolveSettings(inputSettings));
  const [contextEpoch, setContextEpoch] = useState(0);
  const resolvedSettings = resolveSettings(inputSettings);
  settingsRef.current = resolvedSettings;
  settingsRevisionRef.current += 1;
  const fadeInDuration = resolvedSettings.fadeInDuration;
  const fadeInEasing = resolvedSettings.fadeInEasing;
  const musicVisualizerConnectionKey = JSON.stringify({
    enabled: resolvedSettings.musicVisualizer.enabled,
    source: resolvedSettings.musicVisualizer.source,
    elementId: resolvedSettings.musicVisualizer.elementId,
  });
  const musicVisualizerAnalyserKey = JSON.stringify({
    fftSize: resolvedSettings.musicVisualizer.fftSize,
    smoothing: resolvedSettings.musicVisualizer.smoothing,
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      play() {
        manualPausedRef.current = false;
        invalidateRef.current();
      },
      pause() {
        manualPausedRef.current = true;
      },
      seek(time: number) {
        if (!Number.isFinite(time)) return;
        seekRequestRef.current = time;
        currentTimeRef.current = time;
        invalidateRef.current();
      },
      step(seconds: number) {
        if (!Number.isFinite(seconds)) return;
        const nextTime = currentTimeRef.current + seconds;
        seekRequestRef.current = nextTime;
        currentTimeRef.current = nextTime;
        invalidateRef.current();
      },
      getTime() {
        return currentTimeRef.current;
      },
      invalidate() {
        invalidateRef.current();
      },
    }),
    [],
  );

  useEffect(() => {
    const runtime = musicRuntimeRef.current;
    runtime.analyser = null;
    runtime.data = new Uint8Array(new ArrayBuffer(0));
    runtime.sourceActive = false;
    runtime.energy = 0;
    runtime.bass = 0;
    runtime.mid = 0;
    runtime.treble = 0;

    const config = settingsRef.current.musicVisualizer;
    if (!config.enabled) return;
    let disposed = false;
    let microphoneContext: AudioContext | null = null;
    let microphoneStream: MediaStream | null = null;
    let mediaElement: HTMLMediaElement | null = null;
    let onPlay: (() => void) | null = null;
    let onPause: (() => void) | null = null;

    const configureAnalyser = (analyser: AnalyserNode) => {
      analyser.fftSize = config.fftSize;
      analyser.smoothingTimeConstant = config.smoothing;
      runtime.analyser = analyser;
      runtime.data = new Uint8Array(
        new ArrayBuffer(analyser.frequencyBinCount),
      );
      invalidateRef.current();
    };

    if (config.source === "element") {
      const candidate = document.getElementById(config.elementId);
      if (!(candidate instanceof HTMLMediaElement)) {
        if (config.elementId) {
          console.warn(
            `HeroWaveBackground: audio element #${config.elementId} was not found.`,
          );
        }
        return;
      }
      mediaElement = candidate;
      try {
        const connection = getSharedMediaAudioConnection(candidate);
        configureAnalyser(connection.analyser);
        runtime.sourceActive = !candidate.paused && !candidate.ended;
        onPlay = () => {
          runtime.sourceActive = true;
          void connection.context.resume().catch(() => undefined);
          invalidateRef.current();
        };
        onPause = () => {
          runtime.sourceActive = false;
          invalidateRef.current();
        };
        candidate.addEventListener("play", onPlay);
        candidate.addEventListener("pause", onPause);
        candidate.addEventListener("ended", onPause);
      } catch (error) {
        callbacksRef.current.onRendererError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    } else {
      const connectMicrophone = async () => {
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (disposed) {
            for (const track of microphoneStream.getTracks()) track.stop();
            return;
          }
          microphoneContext = new AudioContext();
          const analyser = microphoneContext.createAnalyser();
          microphoneContext
            .createMediaStreamSource(microphoneStream)
            .connect(analyser);
          configureAnalyser(analyser);
          runtime.sourceActive = true;
          await microphoneContext.resume();
        } catch (error) {
          callbacksRef.current.onRendererError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      };
      void connectMicrophone();
    }

    return () => {
      disposed = true;
      if (mediaElement && onPlay && onPause) {
        mediaElement.removeEventListener("play", onPlay);
        mediaElement.removeEventListener("pause", onPause);
        mediaElement.removeEventListener("ended", onPause);
      }
      for (const track of microphoneStream?.getTracks() ?? []) track.stop();
      if (microphoneContext) void microphoneContext.close();
      runtime.analyser = null;
      runtime.sourceActive = false;
    };
  }, [musicVisualizerConnectionKey]);

  useEffect(() => {
    const runtime = musicRuntimeRef.current;
    const analyser = runtime.analyser;
    if (!analyser) return;
    const config = settingsRef.current.musicVisualizer;
    analyser.fftSize = config.fftSize;
    analyser.smoothingTimeConstant = config.smoothing;
    runtime.data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    invalidateRef.current();
  }, [musicVisualizerAnalyserKey]);

  useEffect(() => {
    invalidateRef.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    delete canvas.dataset.ready;

    let lastReportedStatus = "";
    const reportStatus = (status: HeroWaveRendererStatus) => {
      const key = `${status.renderer}:${status.supported}:${status.reason ?? ""}:${status.webglVersion ?? 0}`;
      if (key === lastReportedStatus) return;
      lastReportedStatus = key;
      canvas.dataset.pathRenderer = status.renderer;
      callbacksRef.current.onRendererStatus?.(status);
    };
    const reportError = (error: unknown, prefix: string) => {
      const resolved =
        error instanceof Error
          ? error
          : new Error(`${prefix}: ${String(error)}`);
      console.error(prefix, resolved);
      callbacksRef.current.onRendererError?.(resolved);
    };
    const reportDeformerError = (
      error: Error,
      deformer: HeroWaveCustomDeformer,
    ) => {
      const suffix = deformer.id ? ` (${deformer.id})` : "";
      reportError(error, `HeroWaveBackground custom deformer${suffix}`);
    };

    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    };
    const exactGl = canvas.getContext("webgl2", contextAttributes);
    const gl: WebGLRenderingContext | null =
      exactGl ?? canvas.getContext("webgl", contextAttributes);
    if (!gl) {
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "WebGL is unavailable.",
      });
      reportError(new Error("WebGL is unavailable."), "HeroWaveBackground");
      return;
    }
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
      reportError(error, "HeroWaveBackground sine shader");
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "The sine shader failed to compile.",
        webglVersion: exactGl ? 2 : 1,
      });
      return;
    }

    const fullscreenBuffer = gl.createBuffer();
    if (!fullscreenBuffer) {
      gl.deleteProgram(sineProgram.program);
      reportError(
        new Error("Unable to allocate the fullscreen buffer."),
        "HeroWaveBackground",
      );
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    let glowTexture0: WebGLTexture;
    let glowTexture1: WebGLTexture;
    let maskTexture: WebGLTexture;
    let backgroundTexture: WebGLTexture;
    try {
      glowTexture0 = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
      glowTexture1 = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
      maskTexture = createTexture(gl, 5, gl.LINEAR, gl.LINEAR);
      backgroundTexture = createTexture(gl, 6, gl.LINEAR, gl.LINEAR);
    } catch (error) {
      reportError(error, "HeroWaveBackground shared textures");
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      return;
    }
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
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

    const styleTextures = new Map<string, FilamentStyleTextures>();
    const geometryStates = new Map<string, FilamentGeometryState>();
    const followStates = new Map<string, FollowRuntimeState>();
    const hueMatrix = new Float32Array(9);
    const zeroFloat4 = new Float32Array(4);
    const cycleStates = new Map<
      string,
      { key: string; index: number | null }
    >();
    let lastPrunedSettingsRevision = -1;

    const getGeometryState = (id: string) => {
      let state = geometryStates.get(id);
      if (!state) {
        state = createFilamentGeometryState();
        geometryStates.set(id, state);
      }
      return state;
    };
    const getFollowState = (id: string) => {
      let state = followStates.get(id);
      if (!state) {
        state = createFollowRuntimeState();
        followStates.set(id, state);
      }
      return state;
    };
    const hasConditionalFollow = (settings: Settings) =>
      settings.pathMode !== "follow" &&
      settings.follow.activation !== "path-mode";
    const acceptsFollowInput = (settings: Settings) =>
      settings.pathMode === "follow" || hasConditionalFollow(settings);
    const followSourceIsActive = (settings: Settings) =>
      settings.pathMode === "follow" ||
      (hasConditionalFollow(settings) && getFollowState(settings.id).active);

    const getStyleTextures = (settings: Settings) => {
      let entry = styleTextures.get(settings.id);
      if (!entry) {
        entry = {
          palette: createTexture(gl, 0, gl.LINEAR, gl.LINEAR),
          profiles: createTexture(gl, 4, gl.LINEAR, gl.LINEAR),
          paletteHash: -1,
          profileHash: -1,
          settingsReference: null,
        };
        styleTextures.set(settings.id, entry);
      }
      if (entry.settingsReference === settings) return entry;
      const nextPaletteHash = hashColors(
        settings.colors,
        settings.paletteInterpolation,
        settings.paletteReverse,
      );
      if (nextPaletteHash !== entry.paletteHash) {
        gl.bindTexture(gl.TEXTURE_2D, entry.palette);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          HERO_PALETTE_TEXTURE_WIDTH,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          buildHeroPaletteTextureData(
            settings.colors,
            settings.paletteInterpolation,
            settings.paletteReverse,
          ),
        );
        entry.paletteHash = nextPaletteHash;
      }
      const nextProfileHash = hashProfiles(settings.profiles);
      if (nextProfileHash !== entry.profileHash) {
        gl.bindTexture(gl.TEXTURE_2D, entry.profiles);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          HERO_PROFILE_TEXTURE_WIDTH,
          HERO_PROFILE_TEXTURE_HEIGHT,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          buildLongitudinalProfileTextureData(settings.profiles),
        );
        entry.profileHash = nextProfileHash;
      }
      entry.settingsReference = settings;
      return entry;
    };

    let pathResources: PathResources | null | undefined;
    let terrainResources: TerrainDotsResources | null | undefined;
    let glassResources: GlassTextResources | null | undefined;
    let glassIntroStartedAt: number | null = null;
    let pathRendererErrorLogged = false;
    let canvasWidth = 1;
    let canvasHeight = 1;
    let dpr = 1;
    let sizeRevision = 0;
    let maskHash = -1;
    let maskSizeRevision = -1;
    const backgroundCanvas = document.createElement("canvas");
    let backgroundImageElement: HTMLImageElement | null = null;
    let backgroundImageSource = "";
    let backgroundImageFit: ResolvedBackgroundImage["fit"] | "" = "";
    let backgroundImageSizeRevision = -1;
    let backgroundImageRequest = 0;

    const destroyTerrainResources = (
      resources: TerrainDotsResources | null,
    ) => {
      if (!resources) return;
      gl.deleteProgram(resources.program.program);
      gl.deleteBuffer(resources.buffer);
    };

    const ensureTerrainResources = () => {
      if (terrainResources !== undefined) return terrainResources;
      let program: ProgramBundle | null = null;
      let buffer: WebGLBuffer | null = null;
      try {
        program = createProgramBundle(
          gl,
          TERRAIN_DOTS_VERTEX_SHADER,
          withPrecision(TERRAIN_DOTS_FRAGMENT_SHADER),
          ["aGrid"],
          TERRAIN_DOTS_UNIFORMS,
        );
        buffer = gl.createBuffer();
        if (!buffer)
          throw new Error("Unable to allocate the terrain grid buffer.");
        terrainResources = {
          program,
          buffer,
          columns: 0,
          rows: 0,
          pointCount: 0,
        };
      } catch (error) {
        reportError(error, "HeroWaveBackground terrain dots renderer");
        if (program) gl.deleteProgram(program.program);
        if (buffer) gl.deleteBuffer(buffer);
        terrainResources = null;
      }
      return terrainResources;
    };

    const updateTerrainGeometry = (
      resources: TerrainDotsResources,
      settings: ResolvedTerrainDots,
    ) => {
      const rows = settings.rows;
      const columns =
        settings.fit === "cover"
          ? Math.round(
              clamp(rows * (canvasWidth / Math.max(canvasHeight, 1)), 8, 320),
            )
          : settings.columns;
      if (resources.columns === columns && resources.rows === rows) {
        return;
      }
      const points = new Float32Array(columns * rows * 2);
      let cursor = 0;
      for (let row = 0; row < rows; row++) {
        const y = row / Math.max(rows - 1, 1);
        for (let column = 0; column < columns; column++) {
          points[cursor++] = column / Math.max(columns - 1, 1);
          points[cursor++] = y;
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
      resources.columns = columns;
      resources.rows = rows;
      resources.pointCount = columns * rows;
    };

    const destroyGlassResources = (resources: GlassTextResources | null) => {
      if (!resources) return;
      gl.deleteProgram(resources.program.program);
      gl.deleteProgram(resources.blurProgram.program);
      gl.deleteProgram(resources.compositeProgram.program);
      gl.deleteFramebuffer(resources.framebuffer);
      gl.deleteFramebuffer(resources.blurFramebuffer);
      gl.deleteTexture(resources.sceneTexture);
      gl.deleteTexture(resources.effectTexture);
      gl.deleteTexture(resources.blurTextures[0]);
      gl.deleteTexture(resources.blurTextures[1]);
      gl.deleteTexture(resources.maskTexture);
    };

    const allocateGlassTargets = (resources: GlassTextResources) => {
      if (
        resources.width === canvasWidth &&
        resources.height === canvasHeight
      ) {
        return false;
      }
      resources.width = canvasWidth;
      resources.height = canvasHeight;
      resources.blurWidth = Math.max(1, Math.round(canvasWidth * 0.25));
      resources.blurHeight = Math.max(1, Math.round(canvasHeight * 0.25));
      gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        canvasWidth,
        canvasHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindTexture(gl.TEXTURE_2D, resources.effectTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        exactGl ? exactGl.RGBA8 : gl.RGBA,
        canvasWidth,
        canvasHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        resources.sceneTexture,
        0,
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Incomplete glass scene framebuffer: ${status}`);
      }
      for (const texture of resources.blurTextures) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          exactGl ? exactGl.RGBA8 : gl.RGBA,
          resources.blurWidth,
          resources.blurHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0,
        );
        const blurStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (blurStatus !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          throw new Error(`Incomplete glass blur framebuffer: ${blurStatus}`);
        }
      }
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        resources.effectTexture,
        0,
      );
      const effectStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (effectStatus !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Incomplete glass effect framebuffer: ${effectStatus}`);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      resources.maskSettingsKey = "";
      resources.maskSizeRevision = -1;
      return true;
    };

    const ensureGlassResources = () => {
      if (glassResources !== undefined) return glassResources;
      let program: ProgramBundle | null = null;
      let blurProgram: ProgramBundle | null = null;
      let compositeProgram: ProgramBundle | null = null;
      let framebuffer: WebGLFramebuffer | null = null;
      let blurFramebuffer: WebGLFramebuffer | null = null;
      let sceneTexture: WebGLTexture | null = null;
      let effectTexture: WebGLTexture | null = null;
      let blurTextureA: WebGLTexture | null = null;
      let blurTextureB: WebGLTexture | null = null;
      let textMaskTexture: WebGLTexture | null = null;
      try {
        program = createProgramBundle(
          gl,
          FULLSCREEN_VERTEX_SHADER,
          withPrecision(GLASS_TEXT_FRAGMENT_SHADER),
          ["aPos"],
          GLASS_TEXT_UNIFORMS,
        );
        blurProgram = createProgramBundle(
          gl,
          FULLSCREEN_VERTEX_SHADER,
          withPrecision(GLASS_BLUR_FRAGMENT_SHADER),
          ["aPos"],
          GLASS_BLUR_UNIFORMS,
        );
        compositeProgram = createProgramBundle(
          gl,
          FULLSCREEN_VERTEX_SHADER,
          withPrecision(GLASS_COMPOSITE_FRAGMENT_SHADER),
          ["aPos"],
          GLASS_COMPOSITE_UNIFORMS,
        );
        framebuffer = gl.createFramebuffer();
        blurFramebuffer = gl.createFramebuffer();
        sceneTexture = createTexture(gl, 0, gl.LINEAR, gl.LINEAR);
        effectTexture = createTexture(gl, 7, gl.LINEAR, gl.LINEAR);
        blurTextureA = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
        blurTextureB = createTexture(gl, 3, gl.LINEAR, gl.LINEAR);
        textMaskTexture = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
        if (!framebuffer || !blurFramebuffer)
          throw new Error("Unable to allocate the glass framebuffer.");
        const resources: GlassTextResources = {
          program,
          blurProgram,
          compositeProgram,
          framebuffer,
          blurFramebuffer,
          sceneTexture,
          effectTexture,
          blurTextures: [blurTextureA, blurTextureB],
          maskTexture: textMaskTexture,
          maskCanvas: document.createElement("canvas"),
          maskWidth: 0,
          maskHeight: 0,
          width: 0,
          height: 0,
          blurWidth: 0,
          blurHeight: 0,
          maskSettingsKey: "",
          maskSizeRevision: -1,
          fontRequestKey: "",
        };
        allocateGlassTargets(resources);
        glassResources = resources;
      } catch (error) {
        reportError(error, "HeroWaveBackground glass text renderer");
        if (program) gl.deleteProgram(program.program);
        if (blurProgram) gl.deleteProgram(blurProgram.program);
        if (compositeProgram) gl.deleteProgram(compositeProgram.program);
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
        if (blurFramebuffer) gl.deleteFramebuffer(blurFramebuffer);
        if (sceneTexture) gl.deleteTexture(sceneTexture);
        if (effectTexture) gl.deleteTexture(effectTexture);
        if (blurTextureA) gl.deleteTexture(blurTextureA);
        if (blurTextureB) gl.deleteTexture(blurTextureB);
        if (textMaskTexture) gl.deleteTexture(textMaskTexture);
        glassResources = null;
      }
      return glassResources;
    };

    const glassIsActive = (settings: Settings) =>
      settings.glassText.enabled &&
      (settings.glassText.shape === "svg"
        ? settings.glassText.svgPath.trim().length > 0
        : settings.glassText.text.trim().length > 0);

    const bindSceneTarget = (settings: Settings) => {
      const resources = glassIsActive(settings) ? ensureGlassResources() : null;
      if (resources) {
        allocateGlassTargets(resources);
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      return resources;
    };

    const desiredIntegralPassSizes = (settings: Settings) => {
      const quality = settings.quality;
      const baseScales = [
        quality.farScale,
        quality.midScale,
        quality.coreScale,
      ] as const;
      const maximumDimensions = [
        quality.farMaxDimension,
        quality.midMaxDimension,
        quality.coreMaxDimension,
      ] as const;
      const longestSide = Math.max(canvasWidth, canvasHeight, 1);
      const scales = baseScales.map((baseScale, index) =>
        Math.min(baseScale, maximumDimensions[index]! / longestSide),
      );
      return {
        widths: scales.map((scale) =>
          Math.max(1, Math.round(canvasWidth * scale)),
        ) as [number, number, number],
        heights: scales.map((scale) =>
          Math.max(1, Math.round(canvasHeight * scale)),
        ) as [number, number, number],
      };
    };

    const attachIntegralPass = (resources: PathResources, pass: number) => {
      if (!exactGl) return;
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, resources.framebuffer);
      exactGl.framebufferTexture2D(
        exactGl.FRAMEBUFFER,
        exactGl.COLOR_ATTACHMENT0,
        exactGl.TEXTURE_2D,
        resources.waveTextures[pass]!,
        0,
      );
      if (pass < HERO_PATH_PASS_CORE) {
        exactGl.framebufferTexture2D(
          exactGl.FRAMEBUFFER,
          exactGl.COLOR_ATTACHMENT1,
          exactGl.TEXTURE_2D,
          resources.reflectionTextures[pass]!,
          0,
        );
        exactGl.drawBuffers([
          exactGl.COLOR_ATTACHMENT0,
          exactGl.COLOR_ATTACHMENT1,
        ]);
      } else {
        exactGl.framebufferTexture2D(
          exactGl.FRAMEBUFFER,
          exactGl.COLOR_ATTACHMENT1,
          exactGl.TEXTURE_2D,
          null,
          0,
        );
        exactGl.drawBuffers([exactGl.COLOR_ATTACHMENT0]);
      }
      exactGl.viewport(
        0,
        0,
        resources.passWidths[pass]!,
        resources.passHeights[pass]!,
      );
    };

    const allocatePathTargets = (
      resources: PathResources,
      settings: Settings,
    ) => {
      if (!exactGl) return false;
      const desired = desiredIntegralPassSizes(settings);
      const unchanged = desired.widths.every(
        (width, index) =>
          width === resources.passWidths[index] &&
          desired.heights[index] === resources.passHeights[index],
      );
      if (unchanged) return false;
      const allocateFloatTexture = (
        texture: WebGLTexture,
        width: number,
        height: number,
      ) => {
        exactGl.bindTexture(exactGl.TEXTURE_2D, texture);
        exactGl.texImage2D(
          exactGl.TEXTURE_2D,
          0,
          exactGl.RGBA16F,
          width,
          height,
          0,
          exactGl.RGBA,
          exactGl.HALF_FLOAT,
          null,
        );
      };
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        allocateFloatTexture(
          resources.waveTextures[pass]!,
          desired.widths[pass]!,
          desired.heights[pass]!,
        );
        if (pass < HERO_PATH_PASS_CORE) {
          allocateFloatTexture(
            resources.reflectionTextures[pass]!,
            desired.widths[pass]!,
            desired.heights[pass]!,
          );
        }
      }
      resources.passWidths = desired.widths;
      resources.passHeights = desired.heights;
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        attachIntegralPass(resources, pass);
        const status = exactGl.checkFramebufferStatus(exactGl.FRAMEBUFFER);
        if (status !== exactGl.FRAMEBUFFER_COMPLETE) {
          throw new Error(
            `Incomplete floating-point path framebuffer: ${status}`,
          );
        }
      }
      exactGl.bindFramebuffer(exactGl.FRAMEBUFFER, null);
      return true;
    };

    const destroyPathResources = (resources: PathResources | null) => {
      if (!resources || !exactGl) return;
      exactGl.deleteProgram(resources.integralProgram.program);
      exactGl.deleteProgram(resources.compositeProgram.program);
      exactGl.deleteBuffer(resources.quadBuffer);
      for (const buffer of resources.segmentBuffers)
        exactGl.deleteBuffer(buffer);
      exactGl.deleteFramebuffer(resources.framebuffer);
      for (const texture of resources.waveTextures)
        exactGl.deleteTexture(texture);
      for (const texture of resources.reflectionTextures)
        exactGl.deleteTexture(texture);
      exactGl.deleteTexture(resources.k0Texture);
    };

    const ensurePathResources = (settings: Settings) => {
      if (pathResources !== undefined) return pathResources;
      if (!exactGl) {
        const reason = "Exact paths require WebGL2.";
        if (!pathRendererErrorLogged) {
          reportError(new Error(reason), "HeroWaveBackground HDR renderer");
          pathRendererErrorLogged = true;
        }
        reportStatus({
          renderer: "unavailable",
          supported: false,
          reason,
          webglVersion: 1,
        });
        pathResources = null;
        return pathResources;
      }
      let integralProgram: ProgramBundle | null = null;
      let compositeProgram: ProgramBundle | null = null;
      let quadBuffer: WebGLBuffer | null = null;
      const segmentBuffers: WebGLBuffer[] = [];
      let framebuffer: WebGLFramebuffer | null = null;
      const waveTextures: WebGLTexture[] = [];
      const reflectionTextures: WebGLTexture[] = [];
      let k0Texture: WebGLTexture | null = null;
      try {
        const colorBufferFloat = exactGl.getExtension("EXT_color_buffer_float");
        const floatBlend = exactGl.getExtension("EXT_float_blend");
        if (!colorBufferFloat || !floatBlend) {
          throw new Error(
            "The exact renderer requires EXT_color_buffer_float and EXT_float_blend.",
          );
        }
        if (
          exactGl.getParameter(exactGl.MAX_DRAW_BUFFERS) < 2 ||
          exactGl.getParameter(exactGl.MAX_COLOR_ATTACHMENTS) < 2
        ) {
          throw new Error(
            "The exact renderer requires two floating-point draw buffers.",
          );
        }
        integralProgram = createProgramBundle(
          exactGl,
          PATH_INTEGRAL_VERTEX_SHADER,
          PATH_INTEGRAL_FRAGMENT_SHADER,
          [
            "aCorner",
            "aSegmentStart",
            "aSegmentEnd",
            "aProgressRange",
            "aEndpointWeights",
          ],
          PATH_INTEGRAL_UNIFORMS,
        );
        compositeProgram = createProgramBundle(
          exactGl,
          FULLSCREEN_VERTEX_SHADER_300,
          PATH_INTEGRAL_COMPOSITE_FRAGMENT_SHADER,
          ["aPos"],
          PATH_INTEGRAL_COMPOSITE_UNIFORMS,
        );
        quadBuffer = exactGl.createBuffer();
        framebuffer = exactGl.createFramebuffer();
        if (!quadBuffer || !framebuffer) {
          throw new Error("Unable to allocate exact path resources.");
        }
        exactGl.bindBuffer(exactGl.ARRAY_BUFFER, quadBuffer);
        exactGl.bufferData(
          exactGl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
          exactGl.STATIC_DRAW,
        );
        for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
          const buffer = exactGl.createBuffer();
          if (!buffer) throw new Error("Unable to allocate a segment buffer.");
          exactGl.bindBuffer(exactGl.ARRAY_BUFFER, buffer);
          exactGl.bufferData(
            exactGl.ARRAY_BUFFER,
            HERO_MAX_PATH_SAMPLES *
              HERO_PATH_SEGMENT_STRIDE *
              Float32Array.BYTES_PER_ELEMENT,
            exactGl.DYNAMIC_DRAW,
          );
          segmentBuffers.push(buffer);
        }
        const createFloatTarget = () =>
          createTexture(exactGl, 0, exactGl.LINEAR, exactGl.LINEAR);
        for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++)
          waveTextures.push(createFloatTarget());
        reflectionTextures.push(createFloatTarget(), createFloatTarget());
        k0Texture = createTexture(exactGl, 1, exactGl.NEAREST, exactGl.NEAREST);
        exactGl.bindTexture(exactGl.TEXTURE_2D, k0Texture);
        exactGl.texImage2D(
          exactGl.TEXTURE_2D,
          0,
          exactGl.R32F,
          HERO_PATH_K0_LUT_WIDTH,
          1,
          0,
          exactGl.RED,
          exactGl.FLOAT,
          buildPathK0TextureData(),
        );
        const resources: PathResources = {
          integralProgram,
          compositeProgram,
          quadBuffer,
          segmentBuffers: [
            segmentBuffers[0]!,
            segmentBuffers[1]!,
            segmentBuffers[2]!,
          ],
          framebuffer,
          waveTextures: [waveTextures[0]!, waveTextures[1]!, waveTextures[2]!],
          reflectionTextures: [reflectionTextures[0]!, reflectionTextures[1]!],
          k0Texture,
          passWidths: [0, 0, 0],
          passHeights: [0, 0, 0],
          segmentCounts: [0, 0, 0],
          staticSettingsRevision: -1,
          staticSizeRevision: -1,
        };
        allocatePathTargets(resources, settings);
        pathResources = resources;
        reportStatus({
          renderer: "hdr",
          supported: true,
          webglVersion: 2,
        });
      } catch (error) {
        reportError(
          error,
          "HeroWaveBackground exact multi-contribution renderer",
        );
        const reason = error instanceof Error ? error.message : String(error);
        reportStatus({
          renderer: "unavailable",
          supported: false,
          reason,
          webglVersion: 2,
        });
        if (integralProgram) exactGl.deleteProgram(integralProgram.program);
        if (compositeProgram) exactGl.deleteProgram(compositeProgram.program);
        if (quadBuffer) exactGl.deleteBuffer(quadBuffer);
        for (const buffer of segmentBuffers) exactGl.deleteBuffer(buffer);
        if (framebuffer) exactGl.deleteFramebuffer(framebuffer);
        for (const texture of waveTextures) exactGl.deleteTexture(texture);
        for (const texture of reflectionTextures)
          exactGl.deleteTexture(texture);
        if (k0Texture) exactGl.deleteTexture(k0Texture);
        pathResources = null;
      }
      return pathResources;
    };

    const resizeCanvas = () => {
      const quality = settingsRef.current.quality;
      dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (width === canvasWidth && height === canvasHeight) return false;
      canvasWidth = width;
      canvasHeight = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      sizeRevision += 1;
      for (const state of geometryStates.values()) {
        state.baseKey = -1;
        state.meshKey = -1;
      }
      if (pathResources)
        allocatePathTargets(pathResources, settingsRef.current);
      if (glassResources) allocateGlassTargets(glassResources);
      return true;
    };
    resizeCanvas();

    let raf = 0;
    let revealRaf = 0;
    let revealTimer = 0;
    let frameScheduled = false;
    let running = true;
    let previousDrawTimestamp: number | null = null;
    let clockTime = resolvedSettings.initialTime;
    currentTimeRef.current = clockTime;
    let inViewport = true;
    let reducedMotion = false;
    let readyReported = false;

    const requestFrame = () => {
      const settings = settingsRef.current;
      if (
        !running ||
        frameScheduled ||
        document.visibilityState === "hidden" ||
        (settings.pauseWhenOffscreen && !inViewport)
      ) {
        return;
      }
      frameScheduled = true;
      raf = requestAnimationFrame(loop);
    };
    invalidateRef.current = requestFrame;

    const uploadTransparentBackground = () => {
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]),
      );
      backgroundImageFit = "";
      backgroundImageSizeRevision = -1;
    };

    const rasterizeBackgroundImage = (settings: Settings) => {
      const image = backgroundImageElement;
      if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
      if (
        backgroundImageFit === settings.backgroundImage.fit &&
        backgroundImageSizeRevision === sizeRevision
      ) {
        return;
      }
      const scale = Math.min(1, 2048 / Math.max(canvasWidth, canvasHeight, 1));
      const width = Math.max(1, Math.round(canvasWidth * scale));
      const height = Math.max(1, Math.round(canvasHeight * scale));
      backgroundCanvas.width = width;
      backgroundCanvas.height = height;
      const context = backgroundCanvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (settings.backgroundImage.fit === "stretch") {
        context.drawImage(image, 0, 0, width, height);
      } else {
        const fitScale =
          settings.backgroundImage.fit === "cover"
            ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
            : Math.min(
                width / image.naturalWidth,
                height / image.naturalHeight,
              );
        const drawWidth = image.naturalWidth * fitScale;
        const drawHeight = image.naturalHeight * fitScale;
        context.drawImage(
          image,
          (width - drawWidth) * 0.5,
          (height - drawHeight) * 0.5,
          drawWidth,
          drawHeight,
        );
      }
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        backgroundCanvas,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      backgroundImageFit = settings.backgroundImage.fit;
      backgroundImageSizeRevision = sizeRevision;
    };

    const updateBackgroundImage = (settings: Settings) => {
      const source = settings.backgroundImage.src.trim();
      if (source !== backgroundImageSource) {
        backgroundImageSource = source;
        backgroundImageElement = null;
        backgroundImageRequest += 1;
        const request = backgroundImageRequest;
        uploadTransparentBackground();
        if (source) {
          const image = new Image();
          if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
          image.onload = () => {
            if (!running || request !== backgroundImageRequest) return;
            backgroundImageElement = image;
            backgroundImageFit = "";
            rasterizeBackgroundImage(settingsRef.current);
            requestFrame();
          };
          image.onerror = () => {
            if (!running || request !== backgroundImageRequest) return;
            reportError(
              new Error(`Unable to load background image: ${source}`),
              "HeroWaveBackground background image",
            );
          };
          image.src = source;
        }
      }
      rasterizeBackgroundImage(settings);
    };

    let canvasRect = canvas.getBoundingClientRect();
    let rectDirty = false;
    let resizePending = false;
    let dotPointerX = 0.5;
    let dotPointerY = 0.5;
    let dotPointerActive = false;
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

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            inViewport = entries[0]?.isIntersecting ?? true;
            if (inViewport) {
              previousDrawTimestamp = null;
              requestFrame();
            }
          })
        : null;
    intersectionObserver?.observe(canvas);

    const reducedMotionQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    const updateReducedMotion = () => {
      reducedMotion = Boolean(reducedMotionQuery?.matches);
      requestFrame();
    };
    updateReducedMotion();
    reducedMotionQuery?.addEventListener?.("change", updateReducedMotion);

    const nowSeconds = () => performance.now() * 0.001;
    const pointerEventTimeSeconds = (eventTime: number) => {
      const nowMilliseconds = performance.now();
      let candidate = eventTime;
      if (candidate > 1_000_000_000_000) candidate -= performance.timeOrigin;
      if (
        !Number.isFinite(candidate) ||
        Math.abs(candidate - nowMilliseconds) > 60_000
      ) {
        candidate = nowMilliseconds;
      }
      return candidate * 0.001;
    };

    const resolveTargetElement = (target: HeroWaveFollowTarget) => {
      if (!target || target === "window") return null;
      if (target === "canvas") return canvas;
      if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement)
        return target;
      return "current" in target ? target.current : target;
    };

    const seedFollowAnchors = (
      anchors: readonly FollowAnchor[],
      x: number,
      top: number,
    ) => {
      for (const anchor of anchors) {
        anchor.x = x;
        anchor.top = top;
      }
    };

    const followAnchorsForMode = (
      state: FollowRuntimeState,
      mode: HeroWaveFollowMode,
    ) =>
      mode === "echo"
        ? state.echoAnchors
        : mode === "cascade"
          ? state.cascadeAnchors
          : state.hybridAnchors;

    const followPolylineLengthCssPx = (anchors: readonly FollowAnchor[]) => {
      let length = 0;
      const width = Math.max(canvasRect.width, 1);
      const height = Math.max(canvasRect.height, 1);
      for (let index = 1; index < anchors.length; index++) {
        const point = anchors[index]!;
        const previous = anchors[index - 1]!;
        length += Math.hypot(
          (point.x - previous.x) * width,
          (point.top - previous.top) * height,
        );
      }
      return length;
    };

    const resetFollowModeState = (
      state: FollowRuntimeState,
      mode: HeroWaveFollowMode,
      time: number,
    ) => {
      const x = state.headX;
      const top = state.headTop;
      state.lastMode = mode;
      state.history.length = 0;
      state.history.push({ x, top, time });
      state.persistentHistory.length = 0;
      state.persistentHistory.push({ x, top });
      seedFollowAnchors(state.echoAnchors, x, top);
      seedFollowAnchors(state.cascadeAnchors, x, top);
      seedFollowAnchors(state.hybridAnchors, x, top);
      seedFollowAnchors(state.hybridExactAnchors, x, top);
      seedFollowAnchors(state.hybridRopeAnchors, x, top);
      seedFollowAnchors(state.hybridResampledRopeAnchors, x, top);
      state.persistentCumulative.fill(0);
      state.anchorCumulative.fill(0);
      state.hybridInitialized = true;
      state.cascadeInitialized = true;
      state.cascadeInputInitialized = true;
      state.cascadeInputX = x;
      state.cascadeInputTop = top;
      state.cascadeProcessedInputRevision = state.inputRevision;
      state.lastSampleTime = time;
      state.rawVelocity = 0;
      state.velocity = 0;
      state.visibility = 1;
    };

    const appendFollowSample = (
      state: FollowRuntimeState,
      x: number,
      top: number,
      sampleTime: number,
      force = false,
    ) => {
      const latest = state.history[state.history.length - 1];
      if (!latest) {
        state.history.push({ x, top, time: sampleTime });
        state.headX = x;
        state.headTop = top;
        state.targetX = x;
        state.targetTop = top;
        state.idleCenterX = x;
        state.idleCenterTop = top;
        state.lastSampleTime = sampleTime;
        return;
      }
      const time = Math.max(sampleTime, latest.time + 0.000001);
      const distanceCssPx = Math.hypot(
        (x - latest.x) * Math.max(canvasRect.width, 1),
        (top - latest.top) * Math.max(canvasRect.height, 1),
      );
      const elapsed = Math.max(time - latest.time, 0.000001);
      if (
        !force &&
        distanceCssPx <= HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX &&
        elapsed <= HERO_FOLLOW_MIN_SAMPLE_INTERVAL_SECONDS
      ) {
        latest.x = x;
        latest.top = top;
        latest.time = time;
      } else {
        state.history.push({ x, top, time });
      }
      if (state.history.length > HERO_POINTER_HISTORY_LIMIT) {
        state.history.splice(
          0,
          state.history.length - HERO_POINTER_HISTORY_LIMIT,
        );
      }
      state.lastSampleTime = time;
    };

    const preserveEchoHistoryAfterIdle = (
      state: FollowRuntimeState,
      mode: HeroWaveFollowMode,
      sampleTime: number,
    ) => {
      if (
        mode !== "echo" ||
        !state.active ||
        !Number.isFinite(state.lastInputTime)
      ) {
        return;
      }
      const frozenDuration =
        sampleTime - state.lastInputTime - HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS;
      if (frozenDuration <= 0) return;
      const latest = state.history[state.history.length - 1];
      const timelineShift = sampleTime - (latest?.time ?? state.lastInputTime);
      for (const sample of state.history) sample.time += timelineShift;
      if (Number.isFinite(state.lastSampleTime)) {
        state.lastSampleTime += timelineShift;
      }
    };

    const trimPersistentFollowHistory = (
      state: FollowRuntimeState,
      maximumCssPx: number,
    ) => {
      const history = state.persistentHistory;
      const width = Math.max(canvasRect.width, 1);
      const height = Math.max(canvasRect.height, 1);
      let accumulated = 0;
      let keepFrom = 0;
      for (let index = history.length - 2; index >= 0; index--) {
        const point = history[index]!;
        const leader = history[index + 1]!;
        const segmentLength = Math.hypot(
          (leader.x - point.x) * width,
          (leader.top - point.top) * height,
        );
        if (accumulated + segmentLength >= maximumCssPx) {
          const remaining = Math.max(maximumCssPx - accumulated, 0);
          const amount = segmentLength > 0 ? remaining / segmentLength : 0;
          point.x = leader.x + (point.x - leader.x) * amount;
          point.top = leader.top + (point.top - leader.top) * amount;
          keepFrom = index;
          break;
        }
        accumulated += segmentLength;
        keepFrom = index;
      }
      if (keepFrom > 0) history.splice(0, keepFrom);
      if (history.length > HERO_POINTER_HISTORY_LIMIT) {
        history.splice(0, history.length - HERO_POINTER_HISTORY_LIMIT);
      }
    };

    const appendPersistentFollowSample = (
      state: FollowRuntimeState,
      x: number,
      top: number,
      maximumCssPx: number,
    ) => {
      const history = state.persistentHistory;
      const latest = history[history.length - 1];
      const distance = latest
        ? Math.hypot(
            (x - latest.x) * Math.max(canvasRect.width, 1),
            (top - latest.top) * Math.max(canvasRect.height, 1),
          )
        : Number.POSITIVE_INFINITY;
      if (!latest || distance > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX) {
        history.push({ x, top });
      }
      trimPersistentFollowHistory(state, maximumCssPx);
    };

    const resampleFollowPath = (
      source: readonly FollowAnchor[],
      target: FollowAnchor[],
      cumulative: Float32Array,
      fallbackX: number,
      fallbackTop: number,
    ) => {
      const first = source[0];
      if (!first) {
        for (const anchor of target) {
          anchor.x = fallbackX;
          anchor.top = fallbackTop;
        }
        return 0;
      }
      const width = Math.max(canvasRect.width, 1);
      const height = Math.max(canvasRect.height, 1);
      cumulative[0] = 0;
      for (let index = 1; index < source.length; index++) {
        const point = source[index]!;
        const previous = source[index - 1]!;
        cumulative[index] =
          cumulative[index - 1]! +
          Math.hypot(
            (point.x - previous.x) * width,
            (point.top - previous.top) * height,
          );
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
        const anchor = target[index]!;
        anchor.x = before.x + (after.x - before.x) * amount;
        anchor.top = before.top + (after.top - before.top) * amount;
      }
      return totalLength;
    };

    const recordFollowInput = (
      state: FollowRuntimeState,
      x: number,
      top: number,
      sampleTime: number,
    ) => {
      const elapsed = sampleTime - state.lastInputTime;
      const hasPreviousInput = Number.isFinite(state.lastInputTime);
      const distanceCssPx = hasPreviousInput
        ? Math.hypot(
            (x - state.lastInputX) * Math.max(canvasRect.width, 1),
            (top - state.lastInputTop) * Math.max(canvasRect.height, 1),
          )
        : Number.POSITIVE_INFINITY;
      if (hasPreviousInput && elapsed > 0 && elapsed <= 0.35) {
        const instantaneousVelocity = distanceCssPx / elapsed;
        state.rawVelocity = Math.max(
          state.rawVelocity * 0.35,
          instantaneousVelocity,
        );
      } else {
        state.rawVelocity = 0;
      }
      state.lastInputX = x;
      state.lastInputTop = top;
      state.lastInputTime = sampleTime;
      const cascadeDistanceCssPx = state.cascadeInputInitialized
        ? Math.hypot(
            (x - state.cascadeInputX) * Math.max(canvasRect.width, 1),
            (top - state.cascadeInputTop) * Math.max(canvasRect.height, 1),
          )
        : Number.POSITIVE_INFINITY;
      if (cascadeDistanceCssPx > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX) {
        state.cascadeInputInitialized = true;
        state.cascadeInputX = x;
        state.cascadeInputTop = top;
        state.inputRevision += 1;
      }
    };

    const updateFilamentPointer = (
      settings: Settings,
      clientX: number,
      clientY: number,
      sampleTime: number,
      pointerType: string,
    ) => {
      if (!acceptsFollowInput(settings)) return;
      if (
        !settings.follow.pointerTypes.includes(
          pointerType as HeroWavePointerType,
        )
      ) {
        return;
      }
      const state = getFollowState(settings.id);
      if (state.lastMode !== settings.follow.mode) {
        resetFollowModeState(state, settings.follow.mode, sampleTime);
      }
      const conditional = hasConditionalFollow(settings);
      const target = conditional
        ? settings.follow.activation === "canvas"
          ? "canvas"
          : "window"
        : settings.follow.target;
      const element = resolveTargetElement(target);
      const targetRect = element?.getBoundingClientRect();
      const isInside =
        target === "window" ||
        (targetRect !== undefined &&
          clientX >= targetRect.left &&
          clientX <= targetRect.right &&
          clientY >= targetRect.top &&
          clientY <= targetRect.bottom);
      if (!isInside) {
        state.active = false;
        return;
      }
      const x = clamp(
        (clientX - canvasRect.left) / Math.max(canvasRect.width, 1),
        -HERO_FOLLOW_OVERSCAN,
        1 + HERO_FOLLOW_OVERSCAN,
      );
      const top = clamp(
        (clientY - canvasRect.top) / Math.max(canvasRect.height, 1),
        -HERO_FOLLOW_OVERSCAN,
        1 + HERO_FOLLOW_OVERSCAN,
      );
      if (conditional && !state.active) {
        state.headX = x;
        state.headTop = top;
        state.targetX = x;
        state.targetTop = top;
        resetFollowModeState(state, settings.follow.mode, sampleTime);
      }
      preserveEchoHistoryAfterIdle(state, settings.follow.mode, sampleTime);
      recordFollowInput(state, x, top, sampleTime);
      state.targetX = x;
      state.targetTop = top;
      state.idleCenterX = x;
      state.idleCenterTop = top;
      state.active = true;
      if (
        settings.follow.mode === "hybrid" &&
        settings.follow.headResponse >= 0.999
      ) {
        appendPersistentFollowSample(
          state,
          x,
          top,
          settings.follow.lengthCssPx,
        );
      } else if (
        settings.follow.mode === "echo" &&
        (settings.follow.headResponse >= 0.999 || state.history.length === 0)
      ) {
        appendFollowSample(state, x, top, sampleTime);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (rectDirty) {
        canvasRect = canvas.getBoundingClientRect();
        rectDirty = false;
      }
      const coalesced = event.getCoalescedEvents?.() ?? [];
      const samples = coalesced.length > 0 ? coalesced : [event];
      const latestSample = samples[samples.length - 1] ?? event;
      const root = settingsRef.current;
      const pointerInsideCanvas =
        latestSample.clientX >= canvasRect.left &&
        latestSample.clientX <= canvasRect.right &&
        latestSample.clientY >= canvasRect.top &&
        latestSample.clientY <= canvasRect.bottom;
      const nextDotPointerActive =
        root.dotsEnabled && root.dotInteraction.enabled && pointerInsideCanvas;
      const previousDotPointerActive = dotPointerActive;
      const previousDotPointerX = dotPointerX;
      const previousDotPointerY = dotPointerY;
      dotPointerActive = nextDotPointerActive;
      if (nextDotPointerActive) {
        dotPointerX = clamp(
          (latestSample.clientX - canvasRect.left) /
            Math.max(canvasRect.width, 1),
          0,
          1,
        );
        dotPointerY =
          1 -
          clamp(
            (latestSample.clientY - canvasRect.top) /
              Math.max(canvasRect.height, 1),
            0,
            1,
          );
      }
      const dotPointerChanged =
        previousDotPointerActive !== dotPointerActive ||
        Math.abs(previousDotPointerX - dotPointerX) > 0.0001 ||
        Math.abs(previousDotPointerY - dotPointerY) > 0.0001;
      const scene = activeFilaments(root);
      if (!scene.some(acceptsFollowInput)) {
        if (dotPointerChanged) requestFrame();
        return;
      }
      for (const sample of samples) {
        const sampleTime = pointerEventTimeSeconds(sample.timeStamp);
        for (const filament of scene) {
          updateFilamentPointer(
            filament,
            sample.clientX,
            sample.clientY,
            sampleTime,
            sample.pointerType || event.pointerType || "mouse",
          );
        }
      }
      requestFrame();
    };
    const deactivatePointers = () => {
      dotPointerActive = false;
      for (const state of followStates.values()) state.active = false;
      requestFrame();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", deactivatePointers);
    document.addEventListener("pointerleave", deactivatePointers);

    const sampleHistoryAt = (
      history: readonly PointerTrailSample[],
      targetTime: number,
      fallbackX: number,
      fallbackTop: number,
    ) => {
      const first = history[0];
      if (!first) return { x: fallbackX, top: fallbackTop };
      const last = history[history.length - 1] ?? first;
      if (targetTime <= first.time) return { x: first.x, top: first.top };
      if (targetTime >= last.time) return { x: last.x, top: last.top };
      let low = 1;
      let high = history.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) * 0.5);
        if ((history[middle]?.time ?? 0) < targetTime) low = middle + 1;
        else high = middle;
      }
      const after = history[low] ?? last;
      const before = history[Math.max(0, low - 1)] ?? first;
      const amount = clamp(
        (targetTime - before.time) /
          Math.max(after.time - before.time, 0.000001),
        0,
        1,
      );
      return {
        x: before.x + (after.x - before.x) * amount,
        top: before.top + (after.top - before.top) * amount,
      };
    };

    const updateExternalFollowPosition = (
      settings: Settings,
      state: FollowRuntimeState,
      time: number,
    ) => {
      const position = settings.follow.position;
      if (!position || position.active === false) return false;
      let x = position.x;
      let top = position.y;
      if (position.space === "client") {
        x = (position.x - canvasRect.left) / Math.max(canvasRect.width, 1);
        top = (position.y - canvasRect.top) / Math.max(canvasRect.height, 1);
      }
      x = clamp(x, -HERO_FOLLOW_OVERSCAN, 1 + HERO_FOLLOW_OVERSCAN);
      top = clamp(top, -HERO_FOLLOW_OVERSCAN, 1 + HERO_FOLLOW_OVERSCAN);
      preserveEchoHistoryAfterIdle(state, settings.follow.mode, time);
      recordFollowInput(state, x, top, time);
      state.targetX = x;
      state.targetTop = top;
      state.idleCenterX = x;
      state.idleCenterTop = top;
      state.active = true;
      if (
        settings.follow.mode === "hybrid" &&
        settings.follow.headResponse >= 0.999
      ) {
        appendPersistentFollowSample(
          state,
          x,
          top,
          settings.follow.lengthCssPx,
        );
      } else if (
        settings.follow.mode === "echo" &&
        (settings.follow.headResponse >= 0.999 || state.history.length === 0)
      ) {
        appendFollowSample(state, x, top, time);
      }
      return true;
    };

    const updateFollowRuntime = (
      settings: Settings,
      frameDelta: number,
      time: number,
    ) => {
      const state = getFollowState(settings.id);
      if (state.lastMode !== settings.follow.mode) {
        resetFollowModeState(state, settings.follow.mode, time);
      }
      updateExternalFollowPosition(settings, state, time);
      const idleAge = time - state.lastInputTime;
      if (!state.active) {
        if (
          settings.follow.leaveBehavior === "idle" &&
          idleAge >= settings.follow.idleDelay
        ) {
          state.targetX =
            state.idleCenterX +
            (Math.cos(time * settings.follow.idleSpeedX) *
              settings.follow.idleRadiusX) /
              Math.max(canvasRect.width, 1);
          state.targetTop =
            state.idleCenterTop +
            (Math.sin(time * settings.follow.idleSpeedY) *
              settings.follow.idleRadiusY) /
              Math.max(canvasRect.height, 1);
        } else if (settings.follow.leaveBehavior === "freeze") {
          state.rawVelocity = 0;
        }
      }
      const delta = clamp(frameDelta || 1 / 60, 1 / 240, 0.1);
      const headResponse = settings.follow.headResponse;
      const headAmount =
        headResponse >= 0.999
          ? 1
          : 1 - Math.exp(-(2 + headResponse * 80) * delta);
      if (state.active || settings.follow.leaveBehavior !== "freeze") {
        state.headX += (state.targetX - state.headX) * headAmount;
        state.headTop += (state.targetTop - state.headTop) * headAmount;
      }
      const headDistanceToTargetCssPx = Math.hypot(
        (state.targetX - state.headX) * Math.max(canvasRect.width, 1),
        (state.targetTop - state.headTop) * Math.max(canvasRect.height, 1),
      );
      if (
        settings.follow.mode === "hybrid" &&
        settings.follow.headResponse < 0.999 &&
        (idleAge <= 0.08 ||
          headDistanceToTargetCssPx > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX)
      ) {
        appendPersistentFollowSample(
          state,
          state.headX,
          state.headTop,
          settings.follow.lengthCssPx,
        );
      }
      const velocityResponse =
        1 -
        Math.exp(
          -settings.follow.velocityInfluence.response * Math.max(delta, 0.0001),
        );
      state.velocity += (state.rawVelocity - state.velocity) * velocityResponse;
      state.rawVelocity *= Math.exp(-8 * delta);
      const targetVisibility =
        !state.active &&
        settings.follow.leaveBehavior === "fade" &&
        idleAge >= settings.follow.idleDelay
          ? 0
          : 1;
      const visibilityResponse =
        1 - Math.exp((-4.6 * delta) / settings.follow.fadeDuration);
      state.visibility +=
        (targetVisibility - state.visibility) * visibilityResponse;

      const recentInput = idleAge <= HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS;
      const syntheticIdle =
        !state.active &&
        settings.follow.leaveBehavior === "idle" &&
        idleAge >= settings.follow.idleDelay;
      const collapseRequested =
        !state.active && settings.follow.leaveBehavior === "collapse";
      const selectedAnchors = () =>
        followAnchorsForMode(state, settings.follow.mode);

      if (
        settings.follow.mode === "echo" &&
        state.active &&
        idleAge >= HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS &&
        settings.follow.stationaryBehavior === "freeze"
      ) {
        return { state, anchors: state.echoAnchors };
      }

      if (
        !state.active &&
        settings.follow.leaveBehavior === "freeze" &&
        (state.hybridInitialized ||
          state.cascadeInitialized ||
          state.history.length > 0)
      ) {
        return { state, anchors: selectedAnchors() };
      }

      if (settings.follow.mode === "echo") {
        const stationaryAge = Math.max(
          idleAge - HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS,
          0,
        );
        const echoTime =
          state.active &&
          settings.follow.stationaryBehavior === "collapse" &&
          stationaryAge > 0
            ? state.lastInputTime +
              HERO_ECHO_IDLE_FREEZE_DELAY_SECONDS +
              stationaryAge *
                (settings.follow.memorySeconds /
                  settings.follow.stationaryCollapseDuration)
            : time;
        if (state.history.length === 0) {
          appendFollowSample(state, state.headX, state.headTop, echoTime, true);
        }
        const latest = state.history[state.history.length - 1];
        if (
          latest &&
          echoTime - latest.time >= HERO_FOLLOW_STATIONARY_INTERVAL_SECONDS
        ) {
          appendFollowSample(state, state.headX, state.headTop, echoTime, true);
        }
        const cutoff =
          echoTime -
          settings.follow.memorySeconds -
          HERO_FOLLOW_HISTORY_MARGIN_SECONDS;
        while (
          state.history.length > 2 &&
          (state.history[1]?.time ?? echoTime) < cutoff
        ) {
          state.history.shift();
        }
        const echoCount = state.echoAnchors.length;
        for (let index = 0; index < echoCount; index++) {
          const age =
            settings.follow.memorySeconds *
            (1 - index / Math.max(echoCount - 1, 1));
          const sampled = sampleHistoryAt(
            state.history,
            echoTime - age,
            state.headX,
            state.headTop,
          );
          const anchor = state.echoAnchors[index]!;
          anchor.x = sampled.x;
          anchor.top = sampled.top;
        }
      } else if (settings.follow.mode === "cascade") {
        if (!state.cascadeInitialized) {
          for (const anchor of state.cascadeAnchors) {
            anchor.x = state.headX;
            anchor.top = state.headTop;
          }
          state.cascadeInitialized = true;
          state.cascadeProcessedInputRevision = state.inputRevision;
        }
        const head = state.cascadeAnchors[state.cascadeAnchors.length - 1]!;
        const headMoved =
          Math.hypot(
            (state.headX - head.x) * Math.max(canvasRect.width, 1),
            (state.headTop - head.top) * Math.max(canvasRect.height, 1),
          ) > HERO_FOLLOW_MIN_SAMPLE_DISTANCE_CSS_PX;
        const hasNewInput =
          state.cascadeProcessedInputRevision !== state.inputRevision;
        const shouldAdvance =
          hasNewInput ||
          (settings.follow.headResponse < 0.999 && headMoved) ||
          syntheticIdle ||
          collapseRequested;
        head.x = state.headX;
        head.top = state.headTop;
        if (shouldAdvance) {
          const lag = clamp(
            (settings.follow.memorySeconds - 0.28) / 1.42,
            0,
            1,
          );
          const responseRate = 90 - lag * 60;
          // Cascade is input-driven. Advancing for every idle render frame made
          // the entire chain converge to the head and periodically disappear.
          const cascadeDelta = clamp(frameDelta || 1 / 60, 1 / 240, 1 / 60);
          const response = 1 - Math.exp(-responseRate * cascadeDelta);
          for (
            let index = state.cascadeAnchors.length - 2;
            index >= 0;
            index--
          ) {
            const anchor = state.cascadeAnchors[index]!;
            const leader = state.cascadeAnchors[index + 1]!;
            anchor.x += (leader.x - anchor.x) * response;
            anchor.top += (leader.top - anchor.top) * response;
          }
        }
        if (hasNewInput) {
          state.cascadeProcessedInputRevision = state.inputRevision;
        }
      } else {
        if (state.persistentHistory.length === 0) {
          state.persistentHistory.push({ x: state.headX, top: state.headTop });
        }
        if (syntheticIdle) {
          appendPersistentFollowSample(
            state,
            state.headX,
            state.headTop,
            settings.follow.lengthCssPx,
          );
        }
        if (collapseRequested && state.persistentHistory.length > 1) {
          const removeCount = Math.min(
            state.persistentHistory.length - 1,
            Math.max(1, Math.ceil(delta * state.persistentHistory.length * 5)),
          );
          state.persistentHistory.splice(0, removeCount);
        }
        trimPersistentFollowHistory(state, settings.follow.lengthCssPx);
        const exactLength = resampleFollowPath(
          state.persistentHistory,
          state.hybridExactAnchors,
          state.persistentCumulative,
          state.headX,
          state.headTop,
        );
        if (!state.hybridInitialized) {
          for (let index = 0; index < state.hybridRopeAnchors.length; index++) {
            const source = state.hybridExactAnchors[index]!;
            const target = state.hybridRopeAnchors[index]!;
            target.x = source.x;
            target.top = source.top;
          }
          state.hybridInitialized = true;
        }
        const ropeHead =
          state.hybridRopeAnchors[state.hybridRopeAnchors.length - 1]!;
        ropeHead.x = state.headX;
        ropeHead.top = state.headTop;
        if (recentInput || syntheticIdle || collapseRequested) {
          const response = 1 - Math.exp(-18 * delta);
          const spacing = collapseRequested
            ? 0
            : Math.max(
                exactLength / Math.max(state.hybridRopeAnchors.length - 1, 1),
                2,
              );
          for (let pass = 0; pass < 3; pass++) {
            for (
              let index = state.hybridRopeAnchors.length - 2;
              index >= 0;
              index--
            ) {
              const anchor = state.hybridRopeAnchors[index]!;
              const leader = state.hybridRopeAnchors[index + 1]!;
              const dx = (leader.x - anchor.x) * Math.max(canvasRect.width, 1);
              const dy =
                (leader.top - anchor.top) * Math.max(canvasRect.height, 1);
              const distance = Math.max(Math.hypot(dx, dy), 0.0001);
              const correction = ((distance - spacing) / distance) * response;
              anchor.x += (leader.x - anchor.x) * correction;
              anchor.top += (leader.top - anchor.top) * correction;
            }
          }
        }
        resampleFollowPath(
          state.hybridRopeAnchors,
          state.hybridResampledRopeAnchors,
          state.anchorCumulative,
          state.headX,
          state.headTop,
        );
        for (let index = 0; index < state.hybridAnchors.length; index++) {
          const anchor = state.hybridAnchors[index]!;
          const exact = state.hybridExactAnchors[index]!;
          const rope = state.hybridResampledRopeAnchors[index]!;
          anchor.x = exact.x + (rope.x - exact.x) * settings.follow.viscosity;
          anchor.top =
            exact.top + (rope.top - exact.top) * settings.follow.viscosity;
        }
      }

      const anchors = selectedAnchors();
      const head = anchors[anchors.length - 1]!;
      head.x = state.headX;
      head.top = state.headTop;
      return { state, anchors };
    };

    const followModifiers = (
      settings: Settings,
      state: FollowRuntimeState | null,
    ): FollowRuntimeModifiers => {
      if (!state) {
        return {
          width: 1,
          glow: 1,
          reflection: 1,
          intensity: 1,
          hueDegrees: 0,
          visibility: 1,
        };
      }
      const influence = settings.follow.velocityInfluence;
      const normalized = clamp(
        state.velocity / Math.max(influence.maxVelocityCssPx, 1),
        0,
        1,
      );
      return {
        width: Math.max(0.05, 1 + influence.width * normalized),
        glow: Math.max(0.05, 1 + influence.glow * normalized),
        reflection: Math.max(0, 1 + influence.reflection * normalized),
        intensity: Math.max(0, 1 + influence.intensity * normalized),
        hueDegrees: influence.hue * normalized,
        visibility: state.visibility,
      };
    };

    const updateMusicRuntime = () => {
      const runtime = musicRuntimeRef.current;
      const analyser = runtime.analyser;
      if (analyser && runtime.sourceActive) {
        if (runtime.data.length !== analyser.frequencyBinCount) {
          runtime.data = new Uint8Array(
            new ArrayBuffer(analyser.frequencyBinCount),
          );
        }
        analyser.getByteFrequencyData(runtime.data);
      }
      const sampleRate = analyser?.context.sampleRate ?? 48_000;
      const fftSize = analyser?.fftSize ?? 1024;
      const bandRms = (minimumHz: number, maximumHz: number) => {
        if (!analyser || !runtime.sourceActive || runtime.data.length === 0) {
          return 0;
        }
        const hzPerBin = sampleRate / fftSize;
        const start = clamp(
          Math.floor(minimumHz / hzPerBin),
          0,
          runtime.data.length - 1,
        );
        const end = clamp(
          Math.ceil(maximumHz / hzPerBin),
          start + 1,
          runtime.data.length,
        );
        let squareSum = 0;
        for (let index = start; index < end; index++) {
          const normalized = (runtime.data[index] ?? 0) / 255;
          squareSum += normalized * normalized;
        }
        return Math.sqrt(squareSum / Math.max(end - start, 1));
      };
      const approach = (current: number, target: number) =>
        current + (target - current) * (target > current ? 0.42 : 0.16);
      runtime.energy = approach(runtime.energy, bandRms(30, 14_000));
      runtime.bass = approach(runtime.bass, bandRms(30, 250));
      runtime.mid = approach(runtime.mid, bandRms(250, 2_000));
      runtime.treble = approach(runtime.treble, bandRms(2_000, 14_000));
    };

    const musicLevel = (settings: Settings) => {
      const config = settings.musicVisualizer;
      if (!config.enabled) return 0;
      const runtime = musicRuntimeRef.current;
      const value =
        config.band === "bass"
          ? runtime.bass
          : config.band === "mid"
            ? runtime.mid
            : config.band === "treble"
              ? runtime.treble
              : runtime.energy;
      return clamp(value * config.sensitivity, 0, 2);
    };

    const musicModifiers = (settings: Settings): FollowRuntimeModifiers => {
      const level = musicLevel(settings);
      const config = settings.musicVisualizer;
      return {
        width: Math.max(0.05, 1 + config.width * level),
        glow: Math.max(0.05, 1 + config.glow * level),
        reflection: Math.max(0, 1 + config.reflection * level),
        intensity: Math.max(0, 1 + config.intensity * level),
        hueDegrees: config.hue * level,
        visibility: 1,
      };
    };

    const combineRuntimeModifiers = (
      first: FollowRuntimeModifiers,
      second: FollowRuntimeModifiers,
    ): FollowRuntimeModifiers => ({
      width: first.width * second.width,
      glow: first.glow * second.glow,
      reflection: first.reflection * second.reflection,
      intensity: first.intensity * second.intensity,
      hueDegrees: first.hueDegrees + second.hueDegrees,
      visibility: first.visibility * second.visibility,
    });

    const musicDeformation = (settings: Settings) =>
      settings.musicVisualizer.enabled
        ? settings.musicVisualizer.deformation * musicLevel(settings)
        : 0;

    const sourceGeometryKey = (settings: Settings) => {
      let hash = hashString(2_166_136_261, settings.pathMode);
      hash = hashMix(hash, canvasWidth);
      hash = hashMix(hash, canvasHeight);
      hash = hashTrajectory(settings.trajectoryPoints) ^ hash;
      hash = hashUnknown(settings.organic, hash);
      hash = hashString(hash, settings.svgPath);
      hash = hashUnknown(settings.svgViewBox, hash);
      hash = hashUnknown(settings.pathTransform, hash);
      hash = hashString(hash, settings.trajectoryInterpolation);
      hash = hashFloat(hash, settings.trajectoryTension);
      hash = hashMix(hash, settings.trajectoryClosed ? 1 : 0);
      hash = hashFloat(hash, settings.waveY);
      hash = hashFloat(hash, settings.curveStrength);
      hash = hashFloat(hash, settings.curveScale);
      hash = hashFloat(hash, settings.curveFrequency);
      hash = hashFloat(hash, settings.curveMotion);
      hash = hashUnknown(settings.quality, hash);
      return hash >>> 0;
    };

    const buildBeforeFollowDeformation = (
      settings: Settings,
      anchors: readonly FollowAnchor[],
      localTime: number,
      state: FilamentGeometryState,
    ) => {
      state.temporarySamples.length = anchors.length;
      for (let index = 0; index < anchors.length; index++) {
        const anchor = anchors[index]!;
        const sample = state.temporarySamples[index] ?? {
          x: 0,
          y: 0,
          speed: 1,
          progress: 0,
          arcProgress: 0,
        };
        sample.x = anchor.x;
        sample.y = 1 - anchor.top;
        sample.speed = 1;
        sample.progress = 0;
        sample.arcProgress = 0;
        state.temporarySamples[index] = sample;
      }
      recomputePathProgress(
        state.temporarySamples,
        canvasWidth,
        canvasHeight,
        false,
      );
      buildPropagatedPathSamples(
        state.temporarySamples,
        false,
        canvasWidth,
        canvasHeight,
        localTime,
        settings,
        state.propagatedSamples,
        reportDeformerError,
      );
      state.temporaryAnchors.length = state.propagatedSamples.length;
      for (let index = 0; index < state.propagatedSamples.length; index++) {
        const sample = state.propagatedSamples[index]!;
        const anchor = state.temporaryAnchors[index] ?? { x: 0, top: 0 };
        anchor.x = sample.x;
        anchor.top = 1 - sample.y;
        state.temporaryAnchors[index] = anchor;
      }
      return state.temporaryAnchors;
    };

    const buildConfiguredPath = (settings: Settings, localTime: number) => {
      let closed = settings.trajectoryClosed;
      let samples: CurveSample[] = [];
      if (settings.pathMode === "sine") {
        closed = false;
        samples = buildAdaptiveSinePathSamples(
          settings,
          canvasWidth,
          canvasHeight,
          localTime,
        );
      } else if (settings.pathMode === "svg") {
        samples =
          buildSvgPathSamples(settings, canvasWidth, canvasHeight) ?? [];
      } else {
        const trajectory =
          settings.pathMode === "organic"
            ? createHeroOrganicTrajectory(
                settings.trajectorySeed,
                settings.organic.pointCount,
                settings.organic,
              )
            : normalizeTrajectoryPoints(settings.trajectoryPoints);
        samples = buildAdaptivePathSamples(
          trajectory,
          closed,
          canvasWidth,
          canvasHeight,
          settings,
        );
      }
      return { samples, closed };
    };

    const buildFollowPath = (
      settings: Settings,
      localTime: number,
      frameDelta: number,
      state: FilamentGeometryState,
    ) => {
      const updated = updateFollowRuntime(settings, frameDelta, nowSeconds());
      const anchors =
        settings.propagation.enabled &&
        settings.propagation.stage === "before-follow"
          ? buildBeforeFollowDeformation(
              settings,
              updated.anchors,
              localTime,
              state,
            )
          : updated.anchors;
      return buildAdaptiveFollowPathSamples(
        anchors,
        canvasWidth,
        canvasHeight,
        state.followSamples,
        settings,
      );
    };

    const buildBasePath = (
      settings: Settings,
      localTime: number,
      frameDelta: number,
      state: FilamentGeometryState,
    ) => {
      const conditional = hasConditionalFollow(settings);
      const followState = conditional ? getFollowState(settings.id) : null;
      if (
        conditional &&
        settings.follow.transitionDuration > 0 &&
        followState
      ) {
        const targetBlend = followState.active ? 1 : 0;
        const blendStep =
          Math.max(frameDelta, 1 / 240) / settings.follow.transitionDuration;
        followState.sourceBlend += clamp(
          targetBlend - followState.sourceBlend,
          -blendStep,
          blendStep,
        );
        followState.sourceBlend = clamp(followState.sourceBlend, 0, 1);

        const configured = buildConfiguredPath(settings, localTime);
        if (followState.sourceBlend <= 0.0001) return configured;

        const followSamples = buildFollowPath(
          settings,
          localTime,
          frameDelta,
          state,
        );
        if (followState.sourceBlend >= 0.9999) {
          return { samples: followSamples, closed: false };
        }

        const blend =
          followState.sourceBlend *
          followState.sourceBlend *
          (3 - 2 * followState.sourceBlend);
        return {
          samples: blendCurveSamplePaths(
            configured.samples,
            followSamples,
            blend,
            canvasWidth,
            canvasHeight,
            state.morphSamples,
          ),
          closed: false,
        };
      }

      if (followSourceIsActive(settings)) {
        return {
          samples: buildFollowPath(settings, localTime, frameDelta, state),
          closed: false,
        };
      }
      return buildConfiguredPath(settings, localTime);
    };

    const updateGeometryState = (
      settings: Settings,
      localTime: number,
      frameDelta: number,
    ) => {
      const state = getGeometryState(settings.id);
      const conditionalFollow = hasConditionalFollow(settings);
      const followActive = followSourceIsActive(settings);
      const conditionalFollowState = conditionalFollow
        ? getFollowState(settings.id)
        : null;
      const followTransitioning = Boolean(
        conditionalFollowState &&
          settings.follow.transitionDuration > 0 &&
          Math.abs(
            conditionalFollowState.sourceBlend -
              (conditionalFollowState.active ? 1 : 0),
          ) > 0.0001,
      );
      const sineMoves =
        !followActive &&
        settings.pathMode === "sine" &&
        settings.motionMode === "travel" &&
        Math.abs(settings.pathDrift) > 0.000001;
      const sourceDynamic = followActive || followTransitioning || sineMoves;
      if (
        state.settingsReference !== settings ||
        state.settingsSizeRevision !== sizeRevision
      ) {
        state.settingsReference = settings;
        state.settingsSizeRevision = sizeRevision;
        state.sourceSettingsKey = sourceGeometryKey(settings);
        state.propagationSettingsKey = hashUnknown({
          propagation: settings.propagation,
          musicVisualizer: settings.musicVisualizer,
        });
        state.materialSettingsKey = hashUnknown({
          glow: settings.glow,
          upper: settings.upperGlowSpread,
          lower: settings.lowerGlowSpread,
          bounds: settings.profileBounds,
          quality: settings.quality,
        });
      }
      const sourceKey = conditionalFollow
        ? hashMix(state.sourceSettingsKey, followActive ? 1 : 0)
        : state.sourceSettingsKey;
      let sourceChanged = false;
      if (sourceDynamic || state.baseKey !== sourceKey) {
        const built = buildBasePath(settings, localTime, frameDelta, state);
        state.baseSamples = built.samples;
        state.closed = built.closed;
        state.baseKey = sourceKey;
        state.deformationKey = -1;
        state.meshKey = -1;
        sourceChanged = true;
      }

      const audioDeformation = musicDeformation(settings);
      const audioDeformationEnabled =
        settings.musicVisualizer.enabled &&
        settings.musicVisualizer.deformation > 0.000001;
      const propagationAfter =
        settings.propagation.enabled &&
        !(followActive && settings.propagation.stage === "before-follow");
      const applyAfter = propagationAfter || audioDeformationEnabled;
      const propagationDynamic =
        (propagationAfter && propagationIsDynamic(settings.propagation)) ||
        audioDeformationEnabled;
      const deformationKey = applyAfter
        ? hashMix(sourceKey, state.propagationSettingsKey)
        : sourceKey;
      let renderSamples = state.baseSamples;
      if (applyAfter) {
        if (
          sourceChanged ||
          propagationDynamic ||
          state.deformationKey !== deformationKey
        ) {
          buildPropagatedPathSamples(
            state.baseSamples,
            state.closed,
            canvasWidth,
            canvasHeight,
            localTime,
            settings,
            state.propagatedSamples,
            reportDeformerError,
            audioDeformation,
            settings.musicVisualizer.deformationFrequency,
          );
          state.deformationKey = deformationKey;
          state.meshKey = -1;
        }
        renderSamples = state.propagatedSamples;
      } else {
        state.deformationKey = deformationKey;
      }
      const dynamic = sourceDynamic || propagationDynamic;
      const materialKey = hashMix(deformationKey, state.materialSettingsKey);
      if (!dynamic && state.meshKey === materialKey) {
        return {
          state,
          followState:
            followActive || (conditionalFollowState?.sourceBlend ?? 0) > 0.0001
              ? getFollowState(settings.id)
              : null,
        };
      }
      const minimumSpread = Math.min(
        Math.max(
          settings.upperGlowSpread *
            settings.profileBounds.maximumUpperGlowSpread,
          0.02,
        ),
        Math.max(
          settings.lowerGlowSpread *
            settings.profileBounds.maximumLowerGlowSpread,
          0.02,
        ),
      );
      const narrowness = Math.sqrt(
        clamp(
          settings.glow *
            minimumSpread *
            settings.profileBounds.maximumGlow *
            settings.profileBounds.maximumWidth,
          0.025,
          1,
        ),
      );
      const maximumChords = [
        Math.max(16, settings.quality.farMaxChordPx * narrowness),
        Math.max(6, settings.quality.midMaxChordPx * narrowness),
        Math.max(2, settings.quality.coreMaxChordPx * narrowness),
      ];
      const flatnesses = [
        Math.max(0.5, settings.quality.farFlatnessPx * narrowness),
        Math.max(0.12, settings.quality.midFlatnessPx * narrowness),
        Math.max(0.04, settings.quality.coreFlatnessPx * narrowness),
      ];
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        const passSamples = state.passSamples[pass]!;
        simplifyPathSamplesForPass(
          renderSamples,
          canvasWidth,
          canvasHeight,
          maximumChords[pass]!,
          flatnesses[pass]!,
          passSamples,
        );
        const required =
          Math.max(0, passSamples.length - 1) * HERO_PATH_SEGMENT_STRIDE;
        state.segmentData[pass] = ensureFloatCapacity(
          state.segmentData[pass]!,
          required,
        );
        const built = buildIntegralSegmentData(
          passSamples,
          state.closed,
          canvasWidth,
          canvasHeight,
          HERO_PATH_ENDPOINT_FEATHER_CSS_PX * dpr,
          state.segmentData[pass]!,
        );
        state.segmentCounts[pass] = built.segmentCount;
      }
      state.meshKey = materialKey;
      return {
        state,
        followState:
          followActive || (conditionalFollowState?.sourceBlend ?? 0) > 0.0001
            ? getFollowState(settings.id)
            : null,
      };
    };

    const updateMaskTexture = (settings: Settings) => {
      const nextHash = hashMasks(settings.dotMasks, settings.maskFeather);
      if (nextHash === maskHash && maskSizeRevision === sizeRevision) return;
      const mask = buildDotMaskTextureData(
        settings.dotMasks,
        settings.maskFeather,
        canvasWidth / Math.max(canvasHeight, 1),
      );
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      if (exactGl) {
        exactGl.texImage2D(
          exactGl.TEXTURE_2D,
          0,
          exactGl.R8,
          mask.width,
          mask.height,
          0,
          exactGl.RED,
          exactGl.UNSIGNED_BYTE,
          mask.data,
        );
      } else {
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
      }
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

    const bindIntegralGeometry = (resources: PathResources, pass: number) => {
      if (!exactGl) return;
      const bundle = resources.integralProgram;
      const corner = bundle.attributes.aCorner ?? -1;
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.quadBuffer);
      if (corner >= 0) {
        exactGl.enableVertexAttribArray(corner);
        exactGl.vertexAttribPointer(corner, 2, exactGl.FLOAT, false, 0, 0);
        exactGl.vertexAttribDivisor(corner, 0);
      }
      const stride = HERO_PATH_SEGMENT_STRIDE * Float32Array.BYTES_PER_ELEMENT;
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[pass]!);
      const bindAttribute = (name: string, size: number, offset: number) => {
        const location = bundle.attributes[name] ?? -1;
        if (location < 0) return;
        exactGl.enableVertexAttribArray(location);
        exactGl.vertexAttribPointer(
          location,
          size,
          exactGl.FLOAT,
          false,
          stride,
          offset * Float32Array.BYTES_PER_ELEMENT,
        );
        exactGl.vertexAttribDivisor(location, 1);
      };
      bindAttribute("aSegmentStart", 2, 0);
      bindAttribute("aSegmentEnd", 2, 2);
      bindAttribute("aProgressRange", 2, 4);
      bindAttribute("aEndpointWeights", 2, 6);
    };

    const bindCompositeTextures = (resources: PathResources) => {
      if (!exactGl) return;
      exactGl.activeTexture(exactGl.TEXTURE0);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[0]);
      exactGl.activeTexture(exactGl.TEXTURE1);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.reflectionTextures[0]);
      exactGl.activeTexture(exactGl.TEXTURE2);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[1]);
      exactGl.activeTexture(exactGl.TEXTURE3);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.reflectionTextures[1]);
      exactGl.activeTexture(exactGl.TEXTURE4);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.waveTextures[2]);
      exactGl.activeTexture(exactGl.TEXTURE5);
      exactGl.bindTexture(exactGl.TEXTURE_2D, maskTexture);
    };

    const localVisualTime = (settings: Settings) =>
      (clockTime * settings.filamentPlaybackRate + settings.timeOffset) *
      settings.speed;
    const paletteOffsetFor = (settings: Settings, visualTime: number) =>
      visualTime * settings.colorSpeed * 0.12;
    const fillHueMatrix = (
      settings: Settings,
      visualTime: number,
      hueOffsetDegrees: number,
    ) => {
      buildHueMatrix(
        ((settings.hue + visualTime * settings.hueDrift + hueOffsetDegrees) *
          Math.PI) /
          180,
        hueMatrix,
      );
    };

    const updateGlassTextMask = (
      resources: GlassTextResources,
      settings: Settings,
    ) => {
      const maskSettingsKey = [
        settings.glassText.shape,
        settings.glassText.text,
        settings.glassText.svgPath,
        ...settings.glassText.svgViewBox,
        settings.glassText.fontFamily,
        settings.glassText.fontWeight,
        settings.glassText.fontSize,
        settings.glassText.lineHeight,
        settings.glassText.letterSpacing,
        settings.glassText.centerX,
        settings.glassText.centerY,
        settings.glassText.maxWidth,
        settings.glassText.maxHeight,
      ].join("\u001f");
      if (
        resources.maskSettingsKey === maskSettingsKey &&
        resources.maskSizeRevision === sizeRevision
      ) {
        return;
      }
      const maskScale = Math.min(
        1,
        HERO_GLASS_MASK_MAX_DIMENSION / Math.max(canvasWidth, canvasHeight, 1),
      );
      const maskWidth = Math.max(1, Math.round(canvasWidth * maskScale));
      const maskHeight = Math.max(1, Math.round(canvasHeight * maskScale));
      renderGlassTextMask(
        resources.maskCanvas,
        settings.glassText,
        maskWidth,
        maskHeight,
        dpr * maskScale,
      );
      encodeGlassSignedDistance(
        resources.maskCanvas,
        HERO_GLASS_SDF_RANGE_CSS_PX * dpr * maskScale,
      );
      resources.maskWidth = maskWidth;
      resources.maskHeight = maskHeight;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, resources.maskTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      if (exactGl) {
        exactGl.texImage2D(
          exactGl.TEXTURE_2D,
          0,
          exactGl.RGBA8,
          exactGl.RGBA,
          exactGl.UNSIGNED_BYTE,
          resources.maskCanvas,
        );
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          resources.maskCanvas,
        );
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      resources.maskSettingsKey = maskSettingsKey;
      resources.maskSizeRevision = sizeRevision;

      const fontRequestKey =
        settings.glassText.shape === "text"
          ? `${settings.glassText.fontWeight}:${settings.glassText.fontSize}:${settings.glassText.fontFamily}`
          : "";
      if (
        settings.glassText.shape === "text" &&
        resources.fontRequestKey !== fontRequestKey &&
        typeof document.fonts?.load === "function"
      ) {
        resources.fontRequestKey = fontRequestKey;
        void document.fonts
          .load(
            `${settings.glassText.fontWeight} ${settings.glassText.fontSize}px ${settings.glassText.fontFamily}`,
            settings.glassText.text,
          )
          .then(() => {
            if (!running || glassResources !== resources) return;
            resources.maskSettingsKey = "";
            requestFrame();
          });
      }
    };

    const applyDotInteractionUniforms = (
      context: WebGLRenderingContext,
      bundle: ProgramBundle,
      settings: Settings,
    ) => {
      const interaction = settings.dotInteraction;
      const active =
        settings.dotsEnabled && interaction.enabled && dotPointerActive;
      const pointerColor = hexToVec3(interaction.color);
      uniform2f(context, bundle, "uDotPointer", dotPointerX, dotPointerY);
      uniform1f(context, bundle, "uDotPointerActive", active ? 1 : 0);
      uniform1f(context, bundle, "uDotPointerRadius", interaction.radius * dpr);
      uniform1f(context, bundle, "uDotPointerSoftness", interaction.softness);
      uniform1f(
        context,
        bundle,
        "uDotPointerBrightness",
        interaction.brightness,
      );
      context.uniform3f(
        bundle.uniforms.uDotPointerColor ?? null,
        ...pointerColor,
      );
      uniform1f(
        context,
        bundle,
        "uDotPointerColorStrength",
        interaction.colorStrength,
      );
      uniform1f(
        context,
        bundle,
        "uDotPointerMagnification",
        interaction.magnification,
      );
      uniform1f(
        context,
        bundle,
        "uTerrainPointerDisplacement",
        interaction.terrainDisplacement,
      );
    };

    const drawTerrainDots = (settings: Settings) => {
      if (!settings.dotsEnabled || settings.dotMode !== "terrain") return;
      const resources = ensureTerrainResources();
      if (!resources) return;
      updateTerrainGeometry(resources, settings.terrainDots);
      updateMaskTexture(settings);
      bindSceneTarget(settings);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      activateProgram(resources.program.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
      const location = resources.program.attributes.aGrid ?? -1;
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      }
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      uniform1i(gl, resources.program, "uDotMask", 5);
      uniform2f(gl, resources.program, "uRes", canvasWidth, canvasHeight);
      uniform1f(gl, resources.program, "uTime", clockTime);
      uniform1f(gl, resources.program, "uWidth", settings.terrainDots.width);
      uniform1f(gl, resources.program, "uDepth", settings.terrainDots.depth);
      uniform1f(
        gl,
        resources.program,
        "uAmplitude",
        settings.terrainDots.amplitude,
      );
      uniform1f(
        gl,
        resources.program,
        "uPointSize",
        settings.terrainDots.pointSize,
      );
      uniform1f(gl, resources.program, "uSpeed", settings.terrainDots.speed);
      uniform1f(
        gl,
        resources.program,
        "uViewAngle",
        settings.terrainDots.viewAngle,
      );
      uniform1f(
        gl,
        resources.program,
        "uCameraDistance",
        settings.terrainDots.cameraDistance,
      );
      uniform1f(
        gl,
        resources.program,
        "uFrequency",
        settings.terrainDots.frequency,
      );
      uniform1f(gl, resources.program, "uDpr", dpr);
      uniform1f(
        gl,
        resources.program,
        "uFitCover",
        settings.terrainDots.fit === "cover" ? 1 : 0,
      );
      uniform1f(gl, resources.program, "uTwinkle", settings.twinkle);
      uniform1f(gl, resources.program, "uReflect", settings.reflect);
      const low = hexToVec3(settings.terrainDots.colorLow);
      const high = hexToVec3(settings.terrainDots.colorHigh);
      gl.uniform3f(resources.program.uniforms.uColorLow ?? null, ...low);
      gl.uniform3f(resources.program.uniforms.uColorHigh ?? null, ...high);
      uniform1f(
        gl,
        resources.program,
        "uOpacity",
        settings.terrainDots.opacity,
      );
      uniform1f(
        gl,
        resources.program,
        "uContentFade",
        settings.terrainDots.contentFade,
      );
      uniform1f(
        gl,
        resources.program,
        "uEdgeFade",
        settings.terrainDots.edgeFade,
      );
      uniform1f(
        gl,
        resources.program,
        "uThemeMode",
        settings.theme === "light" ? 1 : 0,
      );
      applyDotInteractionUniforms(gl, resources.program, settings);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, resources.pointCount);
      gl.disable(gl.BLEND);
    };

    const blurGlassScene = (
      resources: GlassTextResources,
      settings: Settings,
    ) => {
      const strength = Math.max(
        settings.glassText.blur,
        settings.glassText.frost,
        settings.glassText.diffusion,
      );
      if (strength <= 0.0001) return resources.sceneTexture;

      const drawBlurPass = (
        source: WebGLTexture,
        target: WebGLTexture,
        directionX: number,
        directionY: number,
      ) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          target,
          0,
        );
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        uniform1i(gl, resources.blurProgram, "uSource", 0);
        uniform2f(
          gl,
          resources.blurProgram,
          "uResolution",
          resources.blurWidth,
          resources.blurHeight,
        );
        uniform2f(
          gl,
          resources.blurProgram,
          "uDirection",
          directionX,
          directionY,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      gl.viewport(0, 0, resources.blurWidth, resources.blurHeight);
      gl.disable(gl.BLEND);
      activateProgram(resources.blurProgram.program);
      bindFullscreen(resources.blurProgram);
      const iterations = 2 + Math.round(settings.glassText.diffusion * 2);
      const baseStep =
        0.45 +
        settings.glassText.blur * 1.2 +
        settings.glassText.frost * 1.8 +
        settings.glassText.diffusion * 2.8;
      let source = resources.sceneTexture;
      for (let iteration = 0; iteration < iterations; iteration++) {
        const step = baseStep * (1 + iteration * 0.28);
        drawBlurPass(
          source,
          resources.blurTextures[0],
          step / resources.blurWidth,
          0,
        );
        drawBlurPass(
          resources.blurTextures[0],
          resources.blurTextures[1],
          0,
          step / resources.blurHeight,
        );
        source = resources.blurTextures[1];
      }
      return resources.blurTextures[1];
    };

    const blurGlassEffect = (
      resources: GlassTextResources,
      radiusPhysicalPx: number,
    ) => {
      if (radiusPhysicalPx <= 0.001) return resources.effectTexture;
      const drawPass = (
        source: WebGLTexture,
        target: WebGLTexture,
        directionX: number,
        directionY: number,
      ) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          target,
          0,
        );
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source);
        uniform1i(gl, resources.blurProgram, "uSource", 0);
        uniform2f(
          gl,
          resources.blurProgram,
          "uResolution",
          resources.blurWidth,
          resources.blurHeight,
        );
        uniform2f(
          gl,
          resources.blurProgram,
          "uDirection",
          directionX,
          directionY,
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      gl.viewport(0, 0, resources.blurWidth, resources.blurHeight);
      gl.disable(gl.BLEND);
      activateProgram(resources.blurProgram.program);
      bindFullscreen(resources.blurProgram);
      const normalizedRadius = radiusPhysicalPx * 0.55;
      drawPass(
        resources.effectTexture,
        resources.blurTextures[0],
        normalizedRadius / Math.max(canvasWidth, 1),
        0,
      );
      drawPass(
        resources.blurTextures[0],
        resources.blurTextures[1],
        0,
        normalizedRadius / Math.max(canvasHeight, 1),
      );
      return resources.blurTextures[1];
    };

    const compositeGlassText = (settings: Settings) => {
      if (!glassIsActive(settings)) {
        glassIntroStartedAt = null;
        return;
      }
      if (glassIntroStartedAt === null) glassIntroStartedAt = clockTime;
      const resources = ensureGlassResources();
      if (!resources) return;
      updateGlassTextMask(resources, settings);
      const introElapsedMs = Math.max(
        0,
        (clockTime - glassIntroStartedAt) * 1000 -
          settings.glassText.introDelay,
      );
      const introLinear =
        settings.glassText.introDuration <= 0
          ? 1
          : clamp(introElapsedMs / settings.glassText.introDuration, 0, 1);
      const introProgress = evaluateFadeEasing(
        introLinear,
        settings.glassText.introEasing,
      );
      const blurredScene = blurGlassScene(resources, settings);
      gl.bindFramebuffer(gl.FRAMEBUFFER, resources.blurFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        resources.effectTexture,
        0,
      );
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      activateProgram(resources.program.program);
      bindFullscreen(resources.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, resources.maskTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, blurredScene);
      uniform1i(gl, resources.program, "uScene", 0);
      uniform1i(gl, resources.program, "uTextMask", 1);
      uniform1i(gl, resources.program, "uBlurScene", 2);
      uniform2f(gl, resources.program, "uRes", canvasWidth, canvasHeight);
      uniform1f(gl, resources.program, "uTime", clockTime);
      uniform1f(
        gl,
        resources.program,
        "uRefraction",
        settings.glassText.refraction * dpr,
      );
      uniform1f(
        gl,
        resources.program,
        "uEdgeWrap",
        settings.glassText.edgeWrap * dpr,
      );
      uniform1f(
        gl,
        resources.program,
        "uSurfaceModel",
        settings.glassText.surfaceModel === "volumetric" ? 1 : 0,
      );
      uniform1f(
        gl,
        resources.program,
        "uBevelMode",
        settings.glassText.bevelMode === "dome" ? 1 : 0,
      );
      uniform1f(
        gl,
        resources.program,
        "uSurfaceDepth",
        settings.glassText.surfaceDepth * dpr,
      );
      uniform1f(gl, resources.program, "uIor", settings.glassText.ior);
      uniform2f(
        gl,
        resources.program,
        "uMagnification",
        settings.glassText.magnificationX,
        settings.glassText.magnificationY,
      );
      uniform2f(
        gl,
        resources.program,
        "uDisplacement",
        settings.glassText.displacementX * dpr,
        settings.glassText.displacementY * dpr,
      );
      uniform1f(
        gl,
        resources.program,
        "uDiffusion",
        settings.glassText.diffusion,
      );
      uniform1f(
        gl,
        resources.program,
        "uSdfRange",
        HERO_GLASS_SDF_RANGE_CSS_PX * dpr,
      );
      uniform1f(gl, resources.program, "uBlur", settings.glassText.blur);
      uniform1f(
        gl,
        resources.program,
        "uMicroDistortion",
        settings.glassText.distortion,
      );
      uniform1f(
        gl,
        resources.program,
        "uChromaticAberration",
        settings.glassText.chromaticAberration * dpr,
      );
      uniform1f(gl, resources.program, "uFrost", settings.glassText.frost);
      uniform1f(
        gl,
        resources.program,
        "uRoughness",
        settings.glassText.roughness,
      );
      uniform1f(gl, resources.program, "uBevel", settings.glassText.bevel);
      uniform1f(
        gl,
        resources.program,
        "uRibStrength",
        settings.glassText.ribStrength,
      );
      uniform1f(
        gl,
        resources.program,
        "uRibWidth",
        settings.glassText.ribWidth * dpr,
      );
      uniform1f(
        gl,
        resources.program,
        "uRibAngle",
        settings.glassText.ribAngle,
      );
      uniform1f(
        gl,
        resources.program,
        "uLiquidStrength",
        settings.glassText.liquidStrength,
      );
      uniform1f(
        gl,
        resources.program,
        "uLiquidScale",
        settings.glassText.liquidScale,
      );
      uniform1f(
        gl,
        resources.program,
        "uLiquidSpeed",
        settings.glassText.liquidSpeed,
      );
      uniform1f(
        gl,
        resources.program,
        "uEdgeStrength",
        settings.glassText.edgeStrength,
      );
      uniform1f(
        gl,
        resources.program,
        "uSpecular",
        settings.glassText.specular,
      );
      uniform1f(gl, resources.program, "uFresnel", settings.glassText.fresnel);
      uniform1f(gl, resources.program, "uTwinkle", settings.glassText.twinkle);
      uniform1f(
        gl,
        resources.program,
        "uTwinkleDensity",
        settings.glassText.twinkleDensity,
      );
      uniform1f(
        gl,
        resources.program,
        "uTwinkleSpeed",
        settings.glassText.twinkleSpeed,
      );
      uniform1f(
        gl,
        resources.program,
        "uTwinkleSize",
        settings.glassText.twinkleSize * dpr,
      );
      const tint = hexToVec3(settings.glassText.tint);
      gl.uniform3f(resources.program.uniforms.uTint ?? null, ...tint);
      uniform1f(
        gl,
        resources.program,
        "uTintStrength",
        settings.glassText.tintStrength,
      );
      uniform1f(
        gl,
        resources.program,
        "uSaturation",
        settings.glassText.saturation,
      );
      uniform1f(
        gl,
        resources.program,
        "uBrightness",
        settings.glassText.brightness,
      );
      uniform1f(gl, resources.program, "uOpacity", settings.glassText.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const introBlurPhysicalPx =
        settings.glassText.introBlur * dpr * (1 - introProgress);
      const blurredEffect = blurGlassEffect(resources, introBlurPhysicalPx);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      activateProgram(resources.compositeProgram.program);
      bindFullscreen(resources.compositeProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, resources.sceneTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, resources.effectTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, blurredEffect);
      uniform1i(gl, resources.compositeProgram, "uScene", 0);
      uniform1i(gl, resources.compositeProgram, "uEffect", 1);
      uniform1i(gl, resources.compositeProgram, "uBlurEffect", 2);
      uniform2f(
        gl,
        resources.compositeProgram,
        "uResolution",
        canvasWidth,
        canvasHeight,
      );
      uniform1f(gl, resources.compositeProgram, "uProgress", introProgress);
      uniform1f(
        gl,
        resources.compositeProgram,
        "uBlurMix",
        introBlurPhysicalPx > 0.001 ? clamp((1 - introProgress) * 2, 0, 1) : 0,
      );
      uniform1f(
        gl,
        resources.compositeProgram,
        "uOffsetY",
        settings.glassText.introOffsetY * dpr,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const drawSine = (settings: Settings) => {
      const style = getStyleTextures(settings);
      updateMaskTexture(settings);
      updateBackgroundImage(settings);
      const visualTime = localVisualTime(settings);
      const runtimeModifiers = musicModifiers(settings);
      bindSceneTarget(settings);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      activateProgram(sineProgram.program);
      bindFullscreen(sineProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, style.palette);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glowTexture0);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, glowTexture1);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, style.profiles);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      uniform2f(gl, sineProgram, "uRes", canvasWidth, canvasHeight);
      uniform1i(gl, sineProgram, "uPalette", 0);
      uniform1i(gl, sineProgram, "uGlowProfile0", 1);
      uniform1i(gl, sineProgram, "uGlowProfile1", 2);
      uniform1i(gl, sineProgram, "uProfiles", 4);
      uniform1i(gl, sineProgram, "uDotMask", 5);
      uniform1i(gl, sineProgram, "uBackgroundImage", 6);
      uniform1f(
        gl,
        sineProgram,
        "uBackgroundOpacity",
        settings.backgroundImage.opacity,
      );
      uniform1f(gl, sineProgram, "uTime", visualTime);
      uniform1f(
        gl,
        sineProgram,
        "uBrightness",
        settings.intensity * runtimeModifiers.intensity,
      );
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
        settings.motionMode === "propagate" && settings.propagation.enabled
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
      uniform1f(
        gl,
        sineProgram,
        "uPaletteOffset",
        paletteOffsetFor(settings, visualTime),
      );
      uniform1f(
        gl,
        sineProgram,
        "uPaletteWrap",
        paletteWrapUniform(settings.paletteWrap),
      );
      gl.uniform4f(
        sineProgram.uniforms.uMaterialWeights0 ?? null,
        settings.material.atmosphere,
        settings.material.broad,
        settings.material.body,
        settings.material.ridge,
      );
      gl.uniform4f(
        sineProgram.uniforms.uMaterialWeights1 ?? null,
        settings.material.core,
        settings.material.veil,
        settings.material.exposure,
        settings.material.saturation,
      );
      uniform1f(gl, sineProgram, "uVelocityWidthScale", runtimeModifiers.width);
      uniform1f(gl, sineProgram, "uVelocityGlowScale", runtimeModifiers.glow);
      uniform1f(
        gl,
        sineProgram,
        "uVelocityReflectionScale",
        runtimeModifiers.reflection,
      );
      uniform1f(gl, sineProgram, "uVisibility", 1);
      fillHueMatrix(settings, visualTime, runtimeModifiers.hueDegrees);
      gl.uniformMatrix3fv(
        sineProgram.uniforms.uHueMatrix ?? null,
        false,
        hueMatrix,
      );
      uniform1f(gl, sineProgram, "uSpacing", settings.dotSpacing * dpr);
      uniform1f(gl, sineProgram, "uDotR", 1.1 * dpr);
      uniform1f(
        gl,
        sineProgram,
        "uDotAlpha",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.dotOpacity
          : 0,
      );
      uniform1f(gl, sineProgram, "uTwinkle", settings.twinkle);
      uniform1f(
        gl,
        sineProgram,
        "uReflect",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.reflect
          : 0,
      );
      uniform1f(gl, sineProgram, "uNoisePhase", (visualTime % 1) * 61.7);
      uniform1f(
        gl,
        sineProgram,
        "uThemeMode",
        settings.theme === "light" ? 1 : 0,
      );
      applyDotInteractionUniforms(gl, sineProgram, settings);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      reportStatus({
        renderer: "sine",
        supported: true,
        webglVersion: exactGl ? 2 : 1,
      });
    };

    const pathPassProfileRadius = (pass: number) =>
      pass === HERO_PATH_PASS_FAR
        ? HERO_PATH_FAR_PROFILE_RADIUS
        : pass === HERO_PATH_PASS_MID
          ? HERO_PATH_MID_PROFILE_RADIUS
          : HERO_PATH_CORE_PROFILE_RADIUS;

    const applyIntegralUniforms = (
      resources: PathResources,
      settings: Settings,
      style: FilamentStyleTextures,
      modifiers: FollowRuntimeModifiers,
      visualTime: number,
      pass: number,
      closed: boolean,
      followBlend: number,
    ) => {
      if (!exactGl) return;
      const bundle = resources.integralProgram;
      const passWidth = resources.passWidths[pass]!;
      const passHeight = resources.passHeights[pass]!;
      const profileRadius = pathPassProfileRadius(pass);
      const maximumRadius = Math.hypot(passWidth, passHeight) + 2;
      const commonRadius =
        profileRadius *
        Math.max(settings.glow, 0.02) *
        settings.profileBounds.maximumGlow *
        settings.profileBounds.maximumWidth *
        modifiers.glow *
        modifiers.width *
        passHeight;
      const positiveRadius = Math.min(
        maximumRadius,
        commonRadius *
          Math.max(
            settings.upperGlowSpread *
              settings.profileBounds.maximumUpperGlowSpread,
            0.02,
          ) +
          2,
      );
      const negativeRadius = Math.min(
        maximumRadius,
        commonRadius *
          Math.max(
            settings.lowerGlowSpread *
              settings.profileBounds.maximumLowerGlowSpread,
            0.02,
          ) +
          2,
      );
      exactGl.activeTexture(exactGl.TEXTURE0);
      exactGl.bindTexture(exactGl.TEXTURE_2D, style.palette);
      exactGl.activeTexture(exactGl.TEXTURE1);
      exactGl.bindTexture(exactGl.TEXTURE_2D, resources.k0Texture);
      exactGl.activeTexture(exactGl.TEXTURE2);
      exactGl.bindTexture(exactGl.TEXTURE_2D, style.profiles);
      uniform1i(exactGl, bundle, "uPalette", 0);
      uniform1i(exactGl, bundle, "uK0Lut", 1);
      uniform1i(exactGl, bundle, "uProfiles", 2);
      uniform2f(exactGl, bundle, "uTargetResolution", passWidth, passHeight);
      uniform2f(
        exactGl,
        bundle,
        "uCanvasResolution",
        canvasWidth,
        canvasHeight,
      );
      uniform1f(exactGl, bundle, "uSupportRadiusPositivePx", positiveRadius);
      uniform1f(exactGl, bundle, "uSupportRadiusNegativePx", negativeRadius);
      if (pass === HERO_PATH_PASS_FAR) {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 1, 1, 1, 0);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 0);
      } else if (pass === HERO_PATH_PASS_MID) {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 1);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 0, 1);
      } else {
        exactGl.uniform4f(bundle.uniforms.uLayerMask0 ?? null, 0, 0, 0, 0);
        exactGl.uniform2f(bundle.uniforms.uLayerMask1 ?? null, 1, 0);
      }
      uniform1f(
        exactGl,
        bundle,
        "uQuadraturePoints",
        pass === HERO_PATH_PASS_FAR
          ? Math.min(settings.quality.quadrature, 2)
          : settings.quality.quadrature,
      );
      uniform1f(exactGl, bundle, "uTime", visualTime);
      uniform1f(exactGl, bundle, "uCurveTravel", settings.curveTravel);
      uniform1f(
        exactGl,
        bundle,
        "uEnvelopeStationary",
        settings.motionMode !== "travel" ? 1 : followBlend,
      );
      uniform1f(
        exactGl,
        bundle,
        "uStationaryCenter",
        0.5 + (0.82 - 0.5) * followBlend,
      );
      uniform1f(exactGl, bundle, "uSegmentLength", settings.segmentLength);
      uniform1f(exactGl, bundle, "uTailTaper", settings.tailTaper);
      uniform1f(exactGl, bundle, "uHeadTaper", settings.headTaper);
      uniform1f(exactGl, bundle, "uPathClosed", closed ? 1 : 0);
      uniform1f(
        exactGl,
        bundle,
        "uClosedLoopTaper",
        settings.closedLoopTaper ? 1 : 0,
      );
      uniform1f(
        exactGl,
        bundle,
        "uBrightness",
        settings.intensity * modifiers.intensity,
      );
      uniform1f(exactGl, bundle, "uBandSpread", settings.glow);
      uniform1f(exactGl, bundle, "uUpperGlowSpread", settings.upperGlowSpread);
      uniform1f(exactGl, bundle, "uLowerGlowSpread", settings.lowerGlowSpread);
      uniform1f(exactGl, bundle, "uGlowAsymmetry", settings.glowAsymmetry);
      uniform1f(
        exactGl,
        bundle,
        "uPaletteOffset",
        paletteOffsetFor(settings, visualTime),
      );
      uniform1f(
        exactGl,
        bundle,
        "uPaletteWrap",
        paletteWrapUniform(settings.paletteWrap),
      );
      exactGl.uniform4f(
        bundle.uniforms.uMaterialWeights0 ?? null,
        settings.material.atmosphere,
        settings.material.broad,
        settings.material.body,
        settings.material.ridge,
      );
      exactGl.uniform4f(
        bundle.uniforms.uMaterialWeights1 ?? null,
        settings.material.core,
        settings.material.veil,
        settings.material.exposure,
        settings.material.saturation,
      );
      uniform1f(exactGl, bundle, "uVelocityWidthScale", modifiers.width);
      uniform1f(exactGl, bundle, "uVelocityGlowScale", modifiers.glow);
      uniform1f(
        exactGl,
        bundle,
        "uVelocityReflectionScale",
        modifiers.reflection,
      );
      uniform1f(exactGl, bundle, "uVisibility", modifiers.visibility);
      fillHueMatrix(settings, visualTime, modifiers.hueDegrees);
      exactGl.uniformMatrix3fv(
        bundle.uniforms.uHueMatrix ?? null,
        false,
        hueMatrix,
      );
    };

    const uploadAndDrawFilament = (
      resources: PathResources,
      geometry: FilamentGeometryState,
      pass: number,
    ) => {
      if (!exactGl) return;
      const count = geometry.segmentCounts[pass] ?? 0;
      if (count <= 0) return;
      const floatCount = count * HERO_PATH_SEGMENT_STRIDE;
      exactGl.bindBuffer(exactGl.ARRAY_BUFFER, resources.segmentBuffers[pass]!);
      exactGl.bufferSubData(
        exactGl.ARRAY_BUFFER,
        0,
        geometry.segmentData[pass]!.subarray(0, floatCount),
      );
      resources.segmentCounts[pass] = count;
      bindIntegralGeometry(resources, pass);
      exactGl.drawArraysInstanced(
        exactGl.TRIANGLES,
        0,
        HERO_PATH_QUAD_VERTEX_COUNT,
        count,
      );
    };

    const clearIntegralPass = (resources: PathResources, pass: number) => {
      if (!exactGl) return;
      attachIntegralPass(resources, pass);
      exactGl.clearBufferfv(exactGl.COLOR, 0, zeroFloat4);
      if (pass < HERO_PATH_PASS_CORE)
        exactGl.clearBufferfv(exactGl.COLOR, 1, zeroFloat4);
    };

    const compositePath = (resources: PathResources, settings: Settings) => {
      if (!exactGl) return;
      updateMaskTexture(settings);
      updateBackgroundImage(settings);
      bindSceneTarget(settings);
      exactGl.viewport(0, 0, canvasWidth, canvasHeight);
      exactGl.disable(exactGl.BLEND);
      bindCompositeTextures(resources);
      activateProgram(resources.compositeProgram.program);
      bindFullscreen(resources.compositeProgram);
      uniform2f(
        exactGl,
        resources.compositeProgram,
        "uRes",
        canvasWidth,
        canvasHeight,
      );
      uniform1i(exactGl, resources.compositeProgram, "uFarWave", 0);
      uniform1i(exactGl, resources.compositeProgram, "uFarReflection", 1);
      uniform1i(exactGl, resources.compositeProgram, "uMidWave", 2);
      uniform1i(exactGl, resources.compositeProgram, "uMidReflection", 3);
      uniform1i(exactGl, resources.compositeProgram, "uCoreWave", 4);
      uniform1i(exactGl, resources.compositeProgram, "uDotMask", 5);
      exactGl.activeTexture(exactGl.TEXTURE6);
      exactGl.bindTexture(exactGl.TEXTURE_2D, backgroundTexture);
      uniform1i(exactGl, resources.compositeProgram, "uBackgroundImage", 6);
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uBackgroundOpacity",
        settings.backgroundImage.opacity,
      );
      uniform1f(exactGl, resources.compositeProgram, "uTime", clockTime);
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uSpacing",
        settings.dotSpacing * dpr,
      );
      uniform1f(exactGl, resources.compositeProgram, "uDotR", 1.1 * dpr);
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uDotAlpha",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.dotOpacity
          : 0,
      );
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uTwinkle",
        settings.twinkle,
      );
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uReflect",
        settings.dotsEnabled && settings.dotMode === "flat"
          ? settings.reflect
          : 0,
      );
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uNoisePhase",
        (clockTime % 1) * 61.7,
      );
      uniform1f(
        exactGl,
        resources.compositeProgram,
        "uThemeMode",
        settings.theme === "light" ? 1 : 0,
      );
      applyDotInteractionUniforms(
        exactGl,
        resources.compositeProgram,
        settings,
      );
      exactGl.drawArrays(exactGl.TRIANGLES, 0, 3);
    };

    const drawUnavailablePath = (settings: Settings) => {
      bindSceneTarget(settings);
      gl.viewport(0, 0, canvasWidth, canvasHeight);
      gl.disable(gl.BLEND);
      if (settings.theme === "light") gl.clearColor(1, 1, 1, 1);
      else gl.clearColor(0.008, 0.011, 0.016, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    const drawPathScene = (
      root: Settings,
      scene: readonly Settings[],
      frameDelta: number,
    ) => {
      const resources = ensurePathResources(root);
      if (!resources || !exactGl) {
        drawUnavailablePath(root);
        return;
      }
      allocatePathTargets(resources, root);
      const prepared = scene.map((settings) => {
        const visualTime = localVisualTime(settings);
        const geometry = updateGeometryState(settings, visualTime, frameDelta);
        const rawFollowBlend =
          settings.pathMode === "follow"
            ? 1
            : hasConditionalFollow(settings)
              ? settings.follow.transitionDuration > 0
                ? (geometry.followState?.sourceBlend ?? 0)
                : geometry.followState
                  ? 1
                  : 0
              : 0;
        const followBlend =
          rawFollowBlend * rawFollowBlend * (3 - 2 * rawFollowBlend);
        return {
          settings,
          visualTime,
          geometry: geometry.state,
          followBlend,
          style: getStyleTextures(settings),
          modifiers: combineRuntimeModifiers(
            followModifiers(settings, geometry.followState),
            musicModifiers(settings),
          ),
        };
      });
      activateProgram(resources.integralProgram.program);
      exactGl.enable(exactGl.BLEND);
      exactGl.blendEquation(exactGl.FUNC_ADD);
      exactGl.blendFunc(exactGl.ONE, exactGl.ONE);
      for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
        clearIntegralPass(resources, pass);
        for (const entry of prepared) {
          if ((entry.geometry.segmentCounts[pass] ?? 0) <= 0) continue;
          applyIntegralUniforms(
            resources,
            entry.settings,
            entry.style,
            entry.modifiers,
            entry.visualTime,
            pass,
            entry.geometry.closed,
            entry.followBlend,
          );
          uploadAndDrawFilament(resources, entry.geometry, pass);
        }
      }
      exactGl.disable(exactGl.BLEND);
      compositePath(resources, root);
    };

    const pruneSceneCaches = (scene: readonly Settings[]) => {
      if (lastPrunedSettingsRevision === settingsRevisionRef.current) return;
      lastPrunedSettingsRevision = settingsRevisionRef.current;
      const activeIds = new Set(scene.map((settings) => settings.id));
      for (const [id, entry] of styleTextures) {
        if (activeIds.has(id)) continue;
        gl.deleteTexture(entry.palette);
        gl.deleteTexture(entry.profiles);
        styleTextures.delete(id);
      }
      for (const id of geometryStates.keys()) {
        if (!activeIds.has(id)) geometryStates.delete(id);
      }
      for (const id of followStates.keys()) {
        if (!activeIds.has(id)) followStates.delete(id);
      }
      for (const id of cycleStates.keys()) {
        if (!activeIds.has(id)) cycleStates.delete(id);
      }
    };

    const completedCycleIndex = (settings: Settings, visualTime: number) => {
      if (
        settings.motionMode !== "travel" ||
        followSourceIsActive(settings) ||
        Math.abs(settings.curveTravel) <= 0.000001
      ) {
        return null;
      }
      const phase = visualTime * settings.curveTravel;
      if (settings.pathMode !== "sine" && settings.trajectoryClosed) {
        return Math.floor(phase + (phase >= 0 ? 0.5 : -0.5));
      }
      const length = Math.max(settings.segmentLength, 0.05);
      const outsidePadding = 0.06;
      const firstCenter = -0.5 * length - outsidePadding;
      const centeredOffset = 0.5 - firstCenter;
      const cycleLength = 1 + length + 2 * outsidePadding;
      return Math.floor((phase + centeredOffset) / cycleLength);
    };

    const notifyCycles = (scene: readonly Settings[]) => {
      for (const settings of scene) {
        const visualTime = localVisualTime(settings);
        const key = `${settings.motionMode}:${settings.pathMode}:${settings.trajectoryClosed}:${settings.segmentLength}:${settings.curveTravel}`;
        const index = completedCycleIndex(settings, visualTime);
        const previous = cycleStates.get(settings.id);
        if (!previous || previous.key !== key) {
          cycleStates.set(settings.id, { key, index });
          continue;
        }
        if (
          index !== null &&
          previous.index !== null &&
          index !== previous.index
        ) {
          const direction: 1 | -1 =
            settings.curveTravel *
              settings.speed *
              settings.filamentPlaybackRate >=
            0
              ? 1
              : -1;
          previous.index = index;
          callbacksRef.current.onCycle?.({
            index,
            direction,
            time: clockTime,
            filamentId: settings.id,
          });
        } else previous.index = index;
      }
    };

    const draw = (frameDelta: number) => {
      updateMusicRuntime();
      if (resizePending) {
        resizePending = false;
        resizeCanvas();
      }
      const root = settingsRef.current;
      const scene = activeFilaments(root);
      pruneSceneCaches(scene);
      const directSine =
        root.filaments.length === 0 &&
        scene.length === 1 &&
        scene[0] === root &&
        root.pathMode === "sine" &&
        !root.requiresPathPipeline;
      if (directSine) drawSine(root);
      else drawPathScene(root, scene, frameDelta);
      drawTerrainDots(root);
      compositeGlassText(root);
      notifyCycles(scene);
      callbacksRef.current.onFrame?.(clockTime, frameDelta);
    };

    const followNeedsAnimation = (scene: readonly Settings[]) =>
      scene.some((settings) => {
        if (!acceptsFollowInput(settings)) return false;
        const state = followStates.get(settings.id);
        if (!state) return true;
        if (hasConditionalFollow(settings) && !state.active) {
          return (
            settings.follow.transitionDuration > 0 && state.sourceBlend > 0.0001
          );
        }
        if (
          settings.follow.position?.active !== false &&
          settings.follow.position
        )
          return true;
        if (state.active) return true;
        if (settings.follow.leaveBehavior === "idle") return true;
        if (settings.follow.leaveBehavior === "collapse") {
          return (
            followPolylineLengthCssPx(
              followAnchorsForMode(state, settings.follow.mode),
            ) > 0.5
          );
        }
        if (settings.follow.leaveBehavior === "fade")
          return state.visibility > 0.001;
        return false;
      });

    function loop(timestamp: number) {
      frameScheduled = false;
      if (!running) return;
      const root = settingsRef.current;
      const scene = activeFilaments(root);
      const minimumFrameInterval =
        root.quality.maxFps > 0 ? 1000 / root.quality.maxFps : 0;
      if (
        previousDrawTimestamp !== null &&
        minimumFrameInterval > 0 &&
        timestamp - previousDrawTimestamp < minimumFrameInterval
      ) {
        requestFrame();
        return;
      }
      const frameDelta =
        previousDrawTimestamp === null
          ? 0
          : Math.min((timestamp - previousDrawTimestamp) / 1000, 0.1);
      previousDrawTimestamp = timestamp;
      const requestedSeek = seekRequestRef.current;
      if (requestedSeek !== null) {
        clockTime = requestedSeek;
        seekRequestRef.current = null;
      }
      if (root.controlledTime !== undefined) {
        clockTime = root.controlledTime;
      } else {
        const autonomousPaused =
          root.paused ||
          manualPausedRef.current ||
          (root.respectReducedMotion && reducedMotion);
        if (!autonomousPaused) {
          clockTime += frameDelta * root.playbackRate;
          if (Math.abs(clockTime) > 32768) clockTime %= 4096;
        }
      }
      currentTimeRef.current = clockTime;
      draw(frameDelta);
      const clockRuns =
        root.controlledTime === undefined &&
        !root.paused &&
        !manualPausedRef.current &&
        !(root.respectReducedMotion && reducedMotion);
      const interactionRuns =
        !root.paused && !manualPausedRef.current && followNeedsAnimation(scene);
      if (clockRuns || interactionRuns) requestFrame();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        previousDrawTimestamp = null;
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
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "WebGL context lost.",
        webglVersion: exactGl ? 2 : 1,
      });
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
      if (!readyReported) {
        readyReported = true;
        callbacksRef.current.onReady?.();
      }
    };
    revealRaf = requestAnimationFrame(() => {
      revealRaf = requestAnimationFrame(reveal);
    });
    revealTimer = window.setTimeout(reveal, 120);
    requestFrame();

    (
      canvas as HTMLCanvasElement & {
        __waveDebug?: { time: () => number; step: (seconds: number) => void };
      }
    ).__waveDebug = {
      time: () => clockTime,
      step: (seconds: number) => {
        const safeSeconds = finite(seconds, 0);
        clockTime += safeSeconds;
        currentTimeRef.current = clockTime;
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
      window.removeEventListener("blur", deactivatePointers);
      document.removeEventListener("pointerleave", deactivatePointers);
      window.removeEventListener("scroll", markRectDirty, true);
      window.removeEventListener("resize", markRectDirty);
      reducedMotionQuery?.removeEventListener?.("change", updateReducedMotion);
      intersectionObserver?.disconnect();
      resizeObserver.disconnect();
      delete (
        canvas as HTMLCanvasElement & {
          __waveDebug?: { time: () => number; step: (seconds: number) => void };
        }
      ).__waveDebug;
      destroyPathResources(pathResources ?? null);
      destroyTerrainResources(terrainResources ?? null);
      destroyGlassResources(glassResources ?? null);
      for (const entry of styleTextures.values()) {
        gl.deleteTexture(entry.palette);
        gl.deleteTexture(entry.profiles);
      }
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      gl.deleteTexture(glowTexture0);
      gl.deleteTexture(glowTexture1);
      gl.deleteTexture(maskTexture);
      gl.deleteTexture(backgroundTexture);
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
      data-theme={resolvedSettings.theme}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0,
        transitionProperty: "opacity",
        willChange: "opacity",
        backgroundColor:
          resolvedSettings.theme === "light" ? "#ffffff" : "#020304",
        ...style,
        transitionDuration: `${fadeInDuration}ms`,
        transitionTimingFunction: fadeInEasing,
      }}
      className={className}
    />
  );
});

interface LegacyAdapterResult {
  props: LegacyHeroWaveProps;
  approximationReasons: readonly string[];
  filamentId: string;
  /** Timeline rate before the selected filament's local speed is applied. */
  clockPlaybackRate: number;
}

function profileMatchesConstant(
  profile: HeroWaveScalarProfile,
  expected: number,
) {
  return (
    typeof profile === "number" && Math.abs(profile - expected) <= 0.000001
  );
}

function pathTransformIsIdentity(transform: Required<HeroWavePathTransform>) {
  return (
    Math.abs(transform.x) <= 0.000001 &&
    Math.abs(transform.y) <= 0.000001 &&
    Math.abs(transform.scaleX - 1) <= 0.000001 &&
    Math.abs(transform.scaleY - 1) <= 0.000001 &&
    Math.abs(transform.rotation) <= 0.000001 &&
    Math.abs(transform.anchorX - 0.5) <= 0.000001 &&
    Math.abs(transform.anchorY - 0.5) <= 0.000001
  );
}

function legacyAdapterFrom(
  props: HeroWaveBackgroundProps,
  onCycleComplete: () => void,
  onFrame: (delta: number) => void,
  paused: boolean,
): LegacyAdapterResult | null {
  const {
    pathRenderer: _pathRenderer,
    className: _className,
    style: _style,
    ...core
  } = props;
  const root = resolveSettings(core);
  const source =
    root.filaments.find((filament) => filament.enabled) ??
    (root.filaments.length === 0 ? root : null);
  if (!source) return null;

  const reasons: string[] = [];
  if (root.theme === "light") {
    reasons.push(
      "light theme is approximated with CSS inversion in the WebGL1 renderer",
    );
  }
  if (root.filaments.length > 1) {
    reasons.push("only the first enabled filament is rendered");
  }
  if (source.pathMode === "svg") {
    reasons.push(
      "SVG paths are approximated with the resolved custom trajectory",
    );
  }
  if (source.trajectoryInterpolation !== "catmull-rom") {
    reasons.push(
      "advanced path interpolation is reduced to legacy Catmull–Rom",
    );
  }
  if (!pathTransformIsIdentity(source.pathTransform)) {
    reasons.push("path transforms are not reproduced by the legacy renderer");
  }
  if (
    source.propagation.enabled &&
    source.propagation.deformers.some((deformer) => deformer.enabled !== false)
  ) {
    reasons.push(
      "the modular deformation stack is approximated by legacy propagate",
    );
  }
  if (
    !profileMatchesConstant(source.profiles.width, 1) ||
    !profileMatchesConstant(source.profiles.opacity, 1) ||
    !profileMatchesConstant(source.profiles.intensity, 1) ||
    !profileMatchesConstant(source.profiles.glow, 1) ||
    !profileMatchesConstant(source.profiles.reflection, 1) ||
    !profileMatchesConstant(source.profiles.colorPosition, 0)
  ) {
    reasons.push(
      "longitudinal profiles are not available in WebGL1 legacy mode",
    );
  }
  if (
    source.paletteInterpolation !== "srgb" ||
    source.paletteWrap !== "clamp" ||
    source.paletteReverse ||
    source.colors.some(
      (stop, index) =>
        stop.easing !== undefined ||
        (stop.offset !== undefined &&
          Math.abs(
            stop.offset - index / Math.max(source.colors.length - 1, 1),
          ) > 0.000001),
    )
  ) {
    reasons.push(
      "advanced palette interpolation and stop positions are approximated",
    );
  }

  const defaultMaterial = MATERIAL_PRESETS["soft-aurora"];
  if (
    source.material.preset !== "soft-aurora" ||
    Math.abs(source.material.atmosphere - defaultMaterial.atmosphere) >
      0.000001 ||
    Math.abs(source.material.broad - defaultMaterial.broad) > 0.000001 ||
    Math.abs(source.material.body - defaultMaterial.body) > 0.000001 ||
    Math.abs(source.material.ridge - defaultMaterial.ridge) > 0.000001 ||
    Math.abs(source.material.core - defaultMaterial.core) > 0.000001 ||
    Math.abs(source.material.veil - defaultMaterial.veil) > 0.000001 ||
    Math.abs(source.material.exposure - defaultMaterial.exposure) > 0.000001 ||
    Math.abs(source.material.saturation - defaultMaterial.saturation) > 0.000001
  ) {
    reasons.push(
      "HDR material weights are reduced to legacy glow and intensity controls",
    );
  }

  if (
    source.pathMode === "follow" &&
    (source.follow.position !== undefined ||
      source.follow.target !== "window" ||
      source.follow.stationaryBehavior !== "collapse" ||
      Math.abs(
        source.follow.stationaryCollapseDuration - source.follow.memorySeconds,
      ) > 0.000001 ||
      Math.abs(source.follow.velocityInfluence.intensity) > 0.000001 ||
      Math.abs(source.follow.velocityInfluence.width) > 0.000001 ||
      Math.abs(source.follow.velocityInfluence.glow) > 0.000001 ||
      Math.abs(source.follow.velocityInfluence.hue) > 0.000001 ||
      Math.abs(source.follow.velocityInfluence.reflection) > 0.000001)
  ) {
    reasons.push(
      "advanced follow interaction and velocity response are approximated",
    );
  }
  if (source.dotMasks.some((mask) => mask.feather !== undefined)) {
    reasons.push("per-mask feather is reduced to the global legacy feather");
  }
  if (
    root.controlledTime !== undefined ||
    Math.abs(source.timeOffset) > 0.000001
  ) {
    reasons.push(
      "controlled time and per-filament time offsets cannot seek WebGL1 legacy output",
    );
  }

  const pathMode: Exclude<HeroWavePathMode, "svg"> =
    source.pathMode === "svg" ? "custom" : source.pathMode;
  const effectiveSpeed =
    source.speed * source.filamentPlaybackRate * root.playbackRate;
  const followLag = clamp((source.follow.memorySeconds - 0.28) / 1.42, 0, 1);

  return {
    filamentId: source.id,
    clockPlaybackRate: root.playbackRate,
    approximationReasons: reasons,
    props: {
      className: "absolute inset-0 size-full",
      motionMode: source.motionMode,
      pathMode,
      followMode: source.follow.mode,
      followDrift: source.follow.viscosity,
      followLag,
      trajectorySeed: source.trajectorySeed,
      trajectoryPoints: source.trajectoryPoints,
      trajectoryClosed: source.trajectoryClosed,
      closedLoopTaper: source.closedLoopTaper,
      waveY: source.waveY,
      curveStrength: source.curveStrength,
      curveScale: source.curveScale,
      curveFrequency: source.curveFrequency,
      curveTravel: source.curveTravel,
      pathDrift: source.pathDrift,
      curveMotion: source.curveMotion,
      segmentLength: source.segmentLength,
      tailTaper: source.tailTaper,
      headTaper: source.headTaper,
      speed: effectiveSpeed,
      glow: source.glow,
      upperGlowSpread: source.upperGlowSpread,
      lowerGlowSpread: source.lowerGlowSpread,
      glowAsymmetry: source.glowAsymmetry,
      intensity: source.intensity,
      colorSpeed: source.colorSpeed,
      colors: source.colors,
      hue: source.hue,
      hueDrift: source.hueDrift,
      materialPreset: source.material.preset,
      ...(source.follow.position !== undefined
        ? { followPosition: source.follow.position }
        : {}),
      dotSpacing: source.dotSpacing,
      dotOpacity: source.dotsEnabled ? source.dotOpacity : 0,
      twinkle: source.twinkle,
      reflect: source.reflect,
      maskFeather: source.maskFeather,
      dotMasks: source.dotMasks,
      fadeInDuration: root.fadeInDuration,
      fadeInEasing: root.fadeInEasing,
      paused,
      onCycleComplete,
      onFrame,
    },
  };
}

const LegacyHeroWaveBridge = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundProps
>(function LegacyHeroWaveBridge(props, ref) {
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(
    Number.isFinite(props.time)
      ? (props.time as number)
      : finite(props.initialTime, 0),
  );
  const cycleIndexRef = useRef(0);
  const readyReportedRef = useRef(false);
  const adapterRef = useRef<LegacyAdapterResult | null>(null);
  const controlledTime = Number.isFinite(props.time);
  const lightTheme = props.theme === "light";
  const effectivePaused = Boolean(
    props.paused ||
      manuallyPaused ||
      reducedMotion ||
      offscreen ||
      controlledTime,
  );

  const handleLegacyCycle = () => {
    const current = adapterRef.current;
    cycleIndexRef.current += 1;
    const speed = current?.props.speed ?? 1;
    const travel = current?.props.curveTravel ?? 0;
    props.onCycle?.({
      index: cycleIndexRef.current,
      direction: speed * travel >= 0 ? 1 : -1,
      time: timeRef.current,
      filamentId: current?.filamentId ?? "primary",
    });
  };

  const handleLegacyFrame = (delta: number) => {
    if (controlledTime) {
      timeRef.current = props.time as number;
    } else if (!effectivePaused) {
      timeRef.current += delta * (adapterRef.current?.clockPlaybackRate ?? 1);
    }
    props.onFrame?.(timeRef.current, delta);
  };

  const adapter = legacyAdapterFrom(
    props,
    handleLegacyCycle,
    handleLegacyFrame,
    effectivePaused,
  );
  adapterRef.current = adapter;

  useImperativeHandle(
    ref,
    () => ({
      play() {
        setManuallyPaused(false);
      },
      pause() {
        setManuallyPaused(true);
      },
      seek(time: number) {
        if (Number.isFinite(time)) timeRef.current = time;
      },
      step(seconds: number) {
        if (Number.isFinite(seconds)) timeRef.current += seconds;
      },
      getTime() {
        return timeRef.current;
      },
      invalidate() {},
    }),
    [],
  );

  useEffect(() => {
    if (Number.isFinite(props.time)) timeRef.current = props.time as number;
  }, [props.time]);

  useEffect(() => {
    if (props.respectReducedMotion === false || typeof window === "undefined") {
      setReducedMotion(false);
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, [props.respectReducedMotion]);

  useEffect(() => {
    const element = containerRef.current;
    if (
      props.pauseWhenOffscreen === false ||
      !element ||
      typeof IntersectionObserver === "undefined"
    ) {
      setOffscreen(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOffscreen(Boolean(entry && !entry.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.pauseWhenOffscreen]);

  const approximationKey = adapter?.approximationReasons.join("|") ?? "empty";
  useEffect(() => {
    props.onRendererStatus?.({
      renderer: "legacy",
      supported: true,
      approximate: Boolean(adapter?.approximationReasons.length),
      webglVersion: 1,
      reason: adapter?.approximationReasons.length
        ? `Legacy approximation: ${adapter.approximationReasons.join("; ")}.`
        : "WebGL1 legacy renderer selected.",
    });
  }, [approximationKey, props.onRendererStatus]);

  useEffect(() => {
    if (readyReportedRef.current || !props.onReady) return;
    const callback = props.onReady;
    const frame = requestAnimationFrame(() => {
      if (readyReportedRef.current) return;
      readyReportedRef.current = true;
      callback();
    });
    return () => cancelAnimationFrame(frame);
  }, [props.onReady]);

  if (!adapter) {
    return (
      <div
        ref={containerRef}
        aria-hidden
        className={props.className}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundColor: lightTheme ? "#ffffff" : undefined,
          ...props.style,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden
      data-theme={lightTheme ? "light" : "dark"}
      className={props.className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundColor: lightTheme ? "#ffffff" : undefined,
        isolation: "isolate",
        ...props.style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ...(lightTheme
            ? {
                filter: "invert(1) hue-rotate(180deg)",
                transform: "translateZ(0)",
              }
            : {}),
        }}
      >
        <Suspense fallback={null}>
          <LegacyHeroWaveBackground {...adapter.props} />
        </Suspense>
      </div>
    </div>
  );
});

function rendererRequirementKey(props: HeroWaveBackgroundCoreProps) {
  // A scene always uses the shared HDR accumulation pipeline, even when every
  // individual filament happens to be analytic.
  if (props.filaments && props.filaments.length > 0) return "exact-path";

  const path = props.path;
  const mode = path?.mode ?? (path?.svgPath ? "svg" : "organic");
  const transform = path?.transform;
  const transformIsIdentity =
    !transform ||
    (Math.abs(finite(transform.x, 0)) <= 0.000001 &&
      Math.abs(finite(transform.y, 0)) <= 0.000001 &&
      Math.abs(finite(transform.scaleX, 1) - 1) <= 0.000001 &&
      Math.abs(finite(transform.scaleY, 1) - 1) <= 0.000001 &&
      Math.abs(finite(transform.rotation, 0)) <= 0.000001 &&
      Math.abs(finite(transform.anchorX, 0.5) - 0.5) <= 0.000001 &&
      Math.abs(finite(transform.anchorY, 0.5) - 0.5) <= 0.000001);
  const propagationEnabled =
    props.propagation?.enabled ??
    (props.propagation !== undefined || props.motion?.mode === "propagate");
  const hasActiveDeformer =
    props.propagation?.deformers?.some(
      (deformer) => deformer.enabled !== false,
    ) ?? propagationEnabled;
  const requiresPath =
    mode !== "sine" ||
    props.interaction?.follow?.activation === "canvas" ||
    props.interaction?.follow?.activation === "viewport" ||
    Boolean(path?.svgPath) ||
    !transformIsIdentity ||
    Boolean(
      props.musicVisualizer?.enabled &&
        finite(props.musicVisualizer.deformation, 0) > 0.000001,
    ) ||
    (propagationEnabled && hasActiveDeformer);
  return requiresPath ? "exact-path" : "analytic-sine";
}

export const HeroWaveBackground = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundProps
>(function HeroWaveBackground({ pathRenderer = "auto", ...props }, ref) {
  const requirementKey = rendererRequirementKey(props);
  const [fallbackRequirement, setFallbackRequirement] = useState<string | null>(
    null,
  );
  const autoFallback =
    pathRenderer === "auto" && fallbackRequirement === requirementKey;

  useEffect(() => {
    if (pathRenderer !== "auto") {
      if (fallbackRequirement !== null) setFallbackRequirement(null);
      return;
    }
    if (
      fallbackRequirement !== null &&
      fallbackRequirement !== requirementKey
    ) {
      setFallbackRequirement(null);
    }
  }, [fallbackRequirement, pathRenderer, requirementKey]);

  const userStatus = props.onRendererStatus;
  const handleStatus = (status: HeroWaveRendererStatus) => {
    userStatus?.(status);
    if (
      pathRenderer === "auto" &&
      status.renderer === "unavailable" &&
      !status.supported
    ) {
      setFallbackRequirement(requirementKey);
    }
  };

  if (pathRenderer === "legacy" || autoFallback) {
    return <LegacyHeroWaveBridge ref={ref} {...props} />;
  }

  return (
    <HdrHeroWaveBackground
      ref={ref}
      {...props}
      onRendererStatus={handleStatus}
    />
  );
});

/** Explicit scene alias with a required `filaments` configuration. */
export const HeroWaveScene = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveSceneProps
>(function HeroWaveScene(props, ref) {
  return <HeroWaveBackground {...props} ref={ref} />;
});
