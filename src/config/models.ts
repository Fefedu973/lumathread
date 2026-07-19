import type {
  HeroDotMask,
  HeroTrajectoryPoint,
  HeroWaveColorStop,
  HeroWaveDeformer,
  HeroWaveDotMode,
  HeroWaveFollowActivation,
  HeroWaveFollowLeaveBehavior,
  HeroWaveFollowMode,
  HeroWaveFollowPosition,
  HeroWaveFollowStationaryBehavior,
  HeroWaveFollowTarget,
  HeroWaveLongitudinalProfiles,
  HeroWaveMaterialPreset,
  HeroWaveMotionMode,
  HeroWaveMusicVisualizerBand,
  HeroWaveMusicVisualizerSource,
  HeroWaveOrganicOptions,
  HeroWavePaletteInterpolation,
  HeroWavePaletteWrap,
  HeroWavePathInterpolation,
  HeroWavePathMode,
  HeroWavePathTransform,
  HeroWavePointerType,
  HeroWavePropagationOptions,
  HeroWaveQualityPreset,
  HeroWaveTheme,
  HeroWaveVelocityInfluence,
} from "../types";
import type { ResolvedFilamentPointerConfig } from "../interaction/filament-disturbance";

export interface ResolvedQuality {
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
export interface ResolvedMaterial {
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
export interface ResolvedFollow {
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
export interface ResolvedProfileBounds {
  maximumWidth: number;
  maximumGlow: number;
  maximumUpperGlowSpread: number;
  maximumLowerGlowSpread: number;
}
export interface ResolvedTerrainDots {
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
export interface ResolvedDotInteraction {
  enabled: boolean;
  radius: number;
  softness: number;
  brightness: number;
  color: string;
  colorStrength: number;
  magnification: number;
  terrainDisplacement: number;
}
export interface ResolvedGlassText {
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
  textWrap: "auto" | "explicit";
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
export interface ResolvedBackgroundImage {
  src: string;
  fit: "cover" | "contain" | "stretch";
  opacity: number;
}
export interface ResolvedMusicVisualizer {
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
export interface Settings {
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
  filamentInteraction: ResolvedFilamentPointerConfig;
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
  fadeInEasingPoints: readonly [number, number, number, number];
  fadeInAffectsGlassText: boolean;
  paused: boolean;
  controlledTime: number | undefined;
  initialTime: number;
  playbackRate: number;
  respectReducedMotion: boolean;
  pauseWhenOffscreen: boolean;
  filaments: readonly Settings[];
  requiresPathPipeline: boolean;
}
