import type { CSSProperties } from "react";

const TAU = Math.PI * 2;

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

export type HeroWaveMotionMode = "travel" | "propagate" | "anchored";
export type HeroWavePathMode = "sine" | "organic" | "custom" | "svg" | "follow";
export type HeroWaveFollowMode = "hybrid" | "cascade" | "echo";
export type HeroWaveFollowStationaryBehavior = "freeze" | "collapse";
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
export type HeroWaveFilamentPointerDirection = "push" | "pull" | "alternate";
export interface HeroWaveFilamentPointerConfig {
  enabled?: boolean;
  /** Area that receives pointer input. The pointer still has to reach the filament radius. */
  target?: "canvas" | "viewport";
  pointerTypes?: readonly HeroWavePointerType[];
  /** Maximum pointer-to-filament distance in CSS pixels. */
  radius?: number;
  /** Peak normal displacement relative to canvas height. */
  strength?: number;
  /** Wave-front speed in normalized path lengths per second. */
  propagationSpeed?: number;
  /** Oscillation frequency behind the propagating front. */
  frequency?: number;
  /** Temporal exponential damping. */
  damping?: number;
  /** Energy loss per normalized path length. */
  spatialDecay?: number;
  /** Lifetime of one impulse in seconds. */
  duration?: number;
  /** Minimum delay between generated impulses in seconds. */
  cooldown?: number;
  /** Maximum simultaneous impulses retained per filament. */
  maxImpulses?: number;
  direction?: HeroWaveFilamentPointerDirection;
}
export interface HeroWaveInteractionConfig {
  follow?: HeroWaveFollowOptions;
  /** Propagates local deformations when the pointer crosses the rendered filament. */
  filament?: HeroWaveFilamentPointerConfig;
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
export type HeroWaveDomTarget =
  | string
  | HTMLElement
  | { readonly current: HTMLElement | null };
export interface HeroWaveGlassTextDomConfig {
  /** CSS selector, element, or React ref whose layout the glass text mirrors. */
  target: HeroWaveDomTarget;
  /** Reads the rendered element text, including explicit line breaks. */
  syncContent?: boolean;
  /** Reads font family, weight, size, line height, and letter spacing. */
  syncTypography?: boolean;
  /** Extra room around the measured element, in CSS pixels. */
  padding?: number | { x?: number; y?: number };
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
  /** Automatic word wrapping, or explicit newlines only. */
  wrap?: "auto" | "explicit";
  /** Center of the glass mask in normalized canvas coordinates. */
  center?: { x?: number; y?: number };
  /** Maximum text width as a fraction of the canvas width. */
  maxWidth?: number;
  /** Maximum text height as a fraction of the canvas height. */
  maxHeight?: number;
  /** Keeps a text mask aligned with a real DOM element. Text masks only. */
  dom?: HeroWaveGlassTextDomConfig;
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
  renderer: "sine" | "hdr" | "unavailable";
  supported: boolean;
  /** True when the renderer intentionally approximates unsupported features. */
  approximate?: boolean;
  reason?: string;
  webglVersion?: 1 | 2;
}
export interface HeroWavePerformanceSample {
  /** Monotonic rendered-frame index for this component instance. */
  frame: number;
  /** Renderer clock in seconds. */
  time: number;
  /** Time between rendered frames, excluding intentionally throttled RAF callbacks. */
  frameMs: number;
  /** Main-thread time spent preparing and submitting the sampled frame. */
  cpuMs: number;
  /** Asynchronous GPU time when EXT_disjoint_timer_query_webgl2 is available. */
  gpuMs?: number;
  /** True when the GPU invalidated the timer result, for example after clock changes. */
  gpuDisjoint?: boolean;
  renderer: "sine" | "hdr" | "unavailable";
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

export interface HeroWaveBackgroundProps {
  className?: string;
  style?: CSSProperties;
  /** Visual composition. Light uses a white canvas and luminous tinted blending. */
  theme?: HeroWaveTheme;
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
  /** Includes the glass overlay in the initial scene fade when enabled. */
  fadeInAffectsGlassText?: boolean;
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
  /**
   * Optional low-frequency diagnostics. Enabling this samples CPU and GPU time
   * without synchronously reading GPU results.
   */
  onPerformance?: (sample: HeroWavePerformanceSample) => void;
}

export interface HeroWaveSceneProps extends HeroWaveBackgroundProps {
  filaments: readonly HeroWaveFilamentConfig[];
}
