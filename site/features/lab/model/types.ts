import type {
  HeroDotMask,
  HeroTrajectoryPoint,
  HeroWaveColorStop,
  HeroWaveDeformationCombine,
  HeroWaveDeformationDirection,
  HeroWaveDeformationDomain,
  HeroWaveDeformationStage,
  HeroWaveFollowActivation,
  HeroWaveFollowLeaveBehavior,
  HeroWaveFollowMode,
  HeroWaveFollowStationaryBehavior,
  HeroWaveMaterialPreset,
  HeroWaveMotionMode,
  HeroWavePaletteInterpolation,
  HeroWavePaletteWrap,
  HeroWavePathInterpolation,
  HeroWavePathMode,
  HeroWaveQualityPreset,
  HeroWaveTheme,
} from "@/hero-wave-background";

export type DeformerKind = "harmonics" | "sampled" | "noise" | "pulse";

export type LabPanelSection =
  | "renderer"
  | "inputs"
  | "path"
  | "motion"
  | "material"
  | "palette"
  | "scene"
  | "glass"
  | "lifecycle";

export type DeformerEnvelope =
  | "flat"
  | "sin2"
  | "smoothstep"
  | "bell"
  | "head"
  | "tail";

export type ProfilePreset = "flat" | "comet" | "center-glow" | "segmented";

export type FadeCurvePreset =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "custom";

export type ProfileSourceMode = "preset" | "custom";

export type LabPresetId =
  | "reference"
  | "sampled"
  | "noise"
  | "pulse"
  | "follow"
  | "svg"
  | "scene";

export type SelectedPreset = LabPresetId | "custom";

export interface SceneFilamentState {
  id: string;
  enabled: boolean;
  timeOffset: number;
  playbackRate: number;
  /** The complete editable renderer state for this filament. */
  settings: FilamentLabState;
}

export interface ProfileKeyState {
  id: string;
  position: number;
  width: number;
  opacity: number;
  intensity: number;
  glow: number;
  upperGlowSpread: number;
  lowerGlowSpread: number;
  reflection: number;
  colorPosition: number;
}

export interface HarmonicState {
  id: string;
  amplitude: number;
  frequency: number;
  phase: number;
  phaseSpeed: number;
}

export interface LabDeformerState {
  id: string;
  enabled: boolean;
  type: DeformerKind;
  amplitude: number;
  envelope: DeformerEnvelope;
  direction: HeroWaveDeformationDirection;
  tangentAmount: number;
  harmonics: HarmonicState[];
  sampledPattern: string;
  sampledFrequency: number;
  sampledPhase: number;
  sampledPhaseSpeed: number;
  sampledInterpolation: "linear" | "smooth" | "cubic";
  sampledWrap: "clamp" | "repeat" | "mirror";
  noiseSeed: number;
  noiseFrequency: number;
  noisePhaseSpeed: number;
  noiseOctaves: number;
  noiseLacunarity: number;
  noisePersistence: number;
  pulseWidth: number;
  pulsePhase: number;
  pulsePhaseSpeed: number;
  pulseCount: number;
  pulseShape: "gaussian" | "smooth" | "triangle";
}

export interface LabQualityConfig {
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

export interface LabState {
  theme: HeroWaveTheme;
  quality: HeroWaveQualityPreset;
  qualityAdvanced: boolean;
  qualityConfig: LabQualityConfig;
  pathMode: HeroWavePathMode;
  textMode: boolean;
  text: string;
  textHeight: number;
  textLetterSpacing: number;
  textY: number;
  textHueSpread: number;
  textStagger: number;
  interpolation: HeroWavePathInterpolation;
  pathTension: number;
  closed: boolean;
  closedLoopTaper: boolean;
  pathPoints: HeroTrajectoryPoint[];
  svgPath: string;
  svgViewBox: [number, number, number, number];
  organic: {
    seed: number;
    pointCount: number;
    turns: number;
    amplitude: number;
    roughness: number;
    horizontalJitter: number;
    speedVariation: number;
    symmetry: number;
  };
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    anchorX: number;
    anchorY: number;
  };
  shape: {
    waveY: number;
    strength: number;
    scale: number;
    frequency: number;
  };
  motion: {
    mode: HeroWaveMotionMode;
    curveTravel: number;
    pathDrift: number;
    curveMotion: number;
    segmentLength: number;
    tailTaper: number;
    headTaper: number;
    speed: number;
  };
  propagationEnabled: boolean;
  propagationPhaseOffset: number;
  propagationPhaseSpeed: number;
  propagationDeformers: LabDeformerState[];
  propagationDomain: HeroWaveDeformationDomain;
  propagationCombine: HeroWaveDeformationCombine;
  propagationStage: HeroWaveDeformationStage;
  recomputeArcLength: boolean;
  profilePreset: ProfilePreset;
  profileSource: ProfileSourceMode;
  profileKeys: ProfileKeyState[];
  profileInterpolation: "linear" | "smooth" | "cubic";
  profileWrap: "clamp" | "repeat" | "mirror";
  profileStrength: number;
  profileWidth: number;
  profileOpacity: number;
  profileIntensity: number;
  profileGlow: number;
  profileUpperGlowSpread: number;
  profileLowerGlowSpread: number;
  profileReflection: number;
  profileColorPosition: number;
  materialPreset: HeroWaveMaterialPreset;
  materialAdvanced: boolean;
  materialAtmosphere: number;
  materialBroad: number;
  materialBody: number;
  materialRidge: number;
  materialCore: number;
  materialVeil: number;
  materialIntensity: number;
  materialGlow: number;
  materialExposure: number;
  materialSaturation: number;
  upperGlowSpread: number;
  lowerGlowSpread: number;
  glowAsymmetry: number;
  paletteStops: HeroWaveColorStop[];
  paletteInterpolation: HeroWavePaletteInterpolation;
  paletteWrap: HeroWavePaletteWrap;
  paletteReverse: boolean;
  paletteSpeed: number;
  hue: number;
  hueDrift: number;
  followMode: HeroWaveFollowMode;
  followActivation: HeroWaveFollowActivation;
  followTransitionDuration: number;
  followTarget: "window" | "canvas";
  followPointerMouse: boolean;
  followPointerPen: boolean;
  followPointerTouch: boolean;
  followExternalEnabled: boolean;
  followExternalSpace: "normalized" | "client";
  followExternalX: number;
  followExternalY: number;
  followLeaveBehavior: HeroWaveFollowLeaveBehavior;
  followHeadResponse: number;
  followMemorySeconds: number;
  followStationaryBehavior: HeroWaveFollowStationaryBehavior;
  followStationaryCollapseDuration: number;
  followLengthCssPx: number;
  followViscosity: number;
  followCascadeLag: number;
  followFadeDuration: number;
  followIdleDelay: number;
  followIdleRadiusX: number;
  followIdleRadiusY: number;
  followIdleSpeedX: number;
  followIdleSpeedY: number;
  followVelocityIntensity: number;
  followVelocityWidth: number;
  followVelocityGlow: number;
  followVelocityHue: number;
  followVelocityReflection: number;
  followVelocityResponse: number;
  followMaxVelocityCssPx: number;
  filamentInteractionEnabled: boolean;
  filamentInteractionTarget: "canvas" | "viewport";
  filamentInteractionMouse: boolean;
  filamentInteractionPen: boolean;
  filamentInteractionTouch: boolean;
  filamentInteractionRadius: number;
  filamentInteractionStrength: number;
  filamentInteractionPropagationSpeed: number;
  filamentInteractionFrequency: number;
  filamentInteractionDamping: number;
  filamentInteractionSpatialDecay: number;
  filamentInteractionDuration: number;
  filamentInteractionCooldown: number;
  filamentInteractionMaxImpulses: number;
  filamentInteractionDirection: "push" | "pull" | "alternate";
  dotsEnabled: boolean;
  dotMode: "flat" | "terrain";
  dotSpacing: number;
  dotOpacity: number;
  twinkle: number;
  reflect: number;
  dotInteractionEnabled: boolean;
  dotInteractionRadius: number;
  dotInteractionSoftness: number;
  dotInteractionBrightness: number;
  dotInteractionColor: string;
  dotInteractionColorStrength: number;
  dotInteractionMagnification: number;
  terrainPointerDisplacement: number;
  maskFeather: number;
  dotMasks: HeroDotMask[];
  terrainColumns: number;
  terrainRows: number;
  terrainWidth: number;
  terrainDepth: number;
  terrainAmplitude: number;
  terrainPointSize: number;
  terrainSpeed: number;
  terrainViewAngle: number;
  terrainCameraDistance: number;
  terrainFrequency: number;
  terrainOpacity: number;
  terrainEdgeFade: number;
  terrainFit: "fixed" | "cover";
  terrainContentFade: number;
  terrainColorLow: string;
  terrainColorHigh: string;
  backgroundImageSrc: string;
  backgroundImageFit: "cover" | "contain" | "stretch";
  backgroundImageOpacity: number;
  musicVisualizerEnabled: boolean;
  musicVisualizerSource: "element" | "microphone";
  musicAudioSrc: string;
  musicFftSize: 256 | 512 | 1024 | 2048;
  musicSmoothing: number;
  musicSensitivity: number;
  musicBand: "energy" | "bass" | "mid" | "treble";
  musicDeformation: number;
  musicDeformationFrequency: number;
  musicWidth: number;
  musicIntensity: number;
  musicGlow: number;
  musicHue: number;
  musicReflection: number;
  glassTextEnabled: boolean;
  glassShape: "text" | "svg";
  glassText: string;
  glassDomTargetEnabled: boolean;
  glassDomSyncContent: boolean;
  glassDomSyncTypography: boolean;
  glassDomPaddingX: number;
  glassDomPaddingY: number;
  glassSvgPath: string;
  glassSvgViewBox: [number, number, number, number];
  glassFontSize: number;
  glassCenterX: number;
  glassCenterY: number;
  glassMaxWidth: number;
  glassMaxHeight: number;
  glassRefraction: number;
  glassEdgeWrap: number;
  glassSurfaceModel: "simple" | "volumetric";
  glassBevelMode: "biconvex" | "dome";
  glassSurfaceDepth: number;
  glassIor: number;
  glassMagnification: number;
  glassMagnificationY: number;
  glassDisplacementX: number;
  glassDisplacementY: number;
  glassDiffusion: number;
  glassBlur: number;
  glassDistortion: number;
  glassChromaticAberration: number;
  glassFrost: number;
  glassRoughness: number;
  glassBevel: number;
  glassRibStrength: number;
  glassRibWidth: number;
  glassRibAngle: number;
  glassLiquidStrength: number;
  glassLiquidScale: number;
  glassLiquidSpeed: number;
  glassEdgeStrength: number;
  glassSpecular: number;
  glassFresnel: number;
  glassTwinkle: number;
  glassTwinkleDensity: number;
  glassTwinkleSpeed: number;
  glassTwinkleSize: number;
  glassTint: string;
  glassTintStrength: number;
  glassSaturation: number;
  glassBrightness: number;
  glassOpacity: number;
  glassIntroDelay: number;
  glassIntroDuration: number;
  glassIntroBlur: number;
  glassIntroOffsetY: number;
  glassIntroCurvePreset: FadeCurvePreset;
  glassIntroCurve: [number, number, number, number];
  sceneMode: boolean;
  primaryFilamentEnabled: boolean;
  primaryFilamentTimeOffset: number;
  primaryFilamentPlaybackRate: number;
  sceneFilaments: SceneFilamentState[];
  fadeInDuration: number;
  fadeCurvePreset: FadeCurvePreset;
  fadeCurve: [number, number, number, number];
  fadeInAffectsGlassText: boolean;
  paused: boolean;
  controlledTime: boolean;
  initialTime: number;
  timelineTime: number;
  playbackRate: number;
  respectReducedMotion: boolean;
  pauseWhenOffscreen: boolean;
}

/**
 * Lab fields represented by `HeroWaveFilamentConfig`. Everything else belongs
 * to the shared scene (canvas, dots, glass, inputs and lifecycle).
 */
export const FILAMENT_STATE_KEYS = [
  "quality",
  "qualityAdvanced",
  "qualityConfig",
  "pathMode",
  "interpolation",
  "pathTension",
  "closed",
  "closedLoopTaper",
  "pathPoints",
  "svgPath",
  "svgViewBox",
  "organic",
  "transform",
  "shape",
  "motion",
  "propagationEnabled",
  "propagationPhaseOffset",
  "propagationPhaseSpeed",
  "propagationDeformers",
  "propagationDomain",
  "propagationCombine",
  "propagationStage",
  "recomputeArcLength",
  "profilePreset",
  "profileSource",
  "profileKeys",
  "profileInterpolation",
  "profileWrap",
  "profileStrength",
  "profileWidth",
  "profileOpacity",
  "profileIntensity",
  "profileGlow",
  "profileUpperGlowSpread",
  "profileLowerGlowSpread",
  "profileReflection",
  "profileColorPosition",
  "materialPreset",
  "materialAdvanced",
  "materialAtmosphere",
  "materialBroad",
  "materialBody",
  "materialRidge",
  "materialCore",
  "materialVeil",
  "materialIntensity",
  "materialGlow",
  "materialExposure",
  "materialSaturation",
  "upperGlowSpread",
  "lowerGlowSpread",
  "glowAsymmetry",
  "paletteStops",
  "paletteInterpolation",
  "paletteWrap",
  "paletteReverse",
  "paletteSpeed",
  "hue",
  "hueDrift",
  "followMode",
  "followActivation",
  "followTransitionDuration",
  "followTarget",
  "followPointerMouse",
  "followPointerPen",
  "followPointerTouch",
  "followExternalEnabled",
  "followExternalSpace",
  "followExternalX",
  "followExternalY",
  "followLeaveBehavior",
  "followHeadResponse",
  "followMemorySeconds",
  "followStationaryBehavior",
  "followStationaryCollapseDuration",
  "followLengthCssPx",
  "followViscosity",
  "followCascadeLag",
  "followFadeDuration",
  "followIdleDelay",
  "followIdleRadiusX",
  "followIdleRadiusY",
  "followIdleSpeedX",
  "followIdleSpeedY",
  "followVelocityIntensity",
  "followVelocityWidth",
  "followVelocityGlow",
  "followVelocityHue",
  "followVelocityReflection",
  "followVelocityResponse",
  "followMaxVelocityCssPx",
  "filamentInteractionEnabled",
  "filamentInteractionTarget",
  "filamentInteractionMouse",
  "filamentInteractionPen",
  "filamentInteractionTouch",
  "filamentInteractionRadius",
  "filamentInteractionStrength",
  "filamentInteractionPropagationSpeed",
  "filamentInteractionFrequency",
  "filamentInteractionDamping",
  "filamentInteractionSpatialDecay",
  "filamentInteractionDuration",
  "filamentInteractionCooldown",
  "filamentInteractionMaxImpulses",
  "filamentInteractionDirection",
] as const satisfies readonly (keyof LabState)[];

export type FilamentStateKey = (typeof FILAMENT_STATE_KEYS)[number];
export type FilamentLabState = Pick<LabState, FilamentStateKey>;
