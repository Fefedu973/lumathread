"use client";

/**
 * Development-only laboratory for the structured HeroWaveBackground API.
 *
 * The page intentionally exercises the new configuration domains instead of
 * retaining the removed flat API. It includes serialization, custom paths,
 * propagation stacks, longitudinal profiles, palette offsets, follow mode,
 * renderer/quality controls, deterministic time and a shared HDR scene.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Activity,
  Check,
  Copy,
  Dices,
  Gauge,
  Infinity as InfinityIcon,
  MousePointer2,
  MoveRight,
  Orbit,
  Palette,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Type as TypeIcon,
  Waves,
} from "lucide-react";
import {
  HERO_DEFAULT_TRAJECTORY,
  HeroWaveBackground,
  HeroWaveScene,
  MAX_HERO_DOT_MASKS,
  MIN_HERO_TRAJECTORY_POINTS,
  createHeroOrganicTrajectory,
  getHeroTrajectoryVerticalScale,
  type HeroDotMask,
  type HeroTrajectoryPoint,
  type HeroWaveBackgroundHandle,
  type HeroWaveBackgroundProps,
  type HeroWaveColorStop,
  type HeroWaveDeformationCombine,
  type HeroWaveDeformationDirection,
  type HeroWaveDeformationDomain,
  type HeroWaveDeformationStage,
  type HeroWaveDeformer,
  type HeroWaveFilamentConfig,
  type HeroWaveFadeEasing,
  type HeroWaveFollowActivation,
  type HeroWaveFollowLeaveBehavior,
  type HeroWaveFollowMode,
  type HeroWaveFollowStationaryBehavior,
  type HeroWaveLongitudinalProfiles,
  type HeroWaveMaterialPreset,
  type HeroWaveMotionMode,
  type HeroWavePaletteInterpolation,
  type HeroWavePaletteWrap,
  type HeroWavePathInterpolation,
  type HeroWavePathMode,
  type HeroWaveQualityPreset,
  type HeroWaveRendererStatus,
  type HeroWaveScalarProfile,
  type HeroWaveTheme,
} from "@/hero-wave-background";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import "./lab.css";

type DeformerKind = "harmonics" | "sampled" | "noise" | "pulse";
type LabPanelSection =
  | "renderer"
  | "inputs"
  | "path"
  | "motion"
  | "material"
  | "palette"
  | "scene"
  | "glass"
  | "lifecycle";

const LAB_PANEL_SECTIONS: readonly {
  id: LabPanelSection;
  label: string;
  detail: string;
}[] = [
  { id: "renderer", label: "Renderer", detail: "Quality" },
  { id: "inputs", label: "Inputs", detail: "Media" },
  { id: "path", label: "Path", detail: "Geometry" },
  { id: "motion", label: "Motion", detail: "Deformers" },
  { id: "material", label: "Material", detail: "Profiles" },
  { id: "palette", label: "Palette", detail: "Color" },
  { id: "scene", label: "Scene", detail: "Dots" },
  { id: "glass", label: "Glass", detail: "Mask" },
  { id: "lifecycle", label: "Lifecycle", detail: "Time" },
];
type DeformerEnvelope =
  | "flat"
  | "sin2"
  | "smoothstep"
  | "bell"
  | "head"
  | "tail";
type ProfilePreset = "flat" | "comet" | "center-glow" | "segmented";
type FadeCurvePreset =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "custom";
type ProfileSourceMode = "preset" | "custom";
type LabPresetId =
  | "reference"
  | "sampled"
  | "noise"
  | "pulse"
  | "follow"
  | "svg"
  | "scene";
type SelectedPreset = LabPresetId | "custom";

const LAB_MATERIAL_LAYERS: Record<
  HeroWaveMaterialPreset,
  {
    atmosphere: number;
    broad: number;
    body: number;
    ridge: number;
    core: number;
    veil: number;
  }
> = {
  "soft-aurora": {
    atmosphere: 0.06,
    broad: 0.24,
    body: 0.3,
    ridge: 0.46,
    core: 0.28,
    veil: 0.04,
  },
  mist: {
    atmosphere: 0.11,
    broad: 0.32,
    body: 0.34,
    ridge: 0.27,
    core: 0.12,
    veil: 0.09,
  },
  neon: {
    atmosphere: 0.015,
    broad: 0.08,
    body: 0.17,
    ridge: 0.68,
    core: 0.72,
    veil: 0.025,
  },
  plasma: {
    atmosphere: 0.05,
    broad: 0.2,
    body: 0.36,
    ridge: 0.52,
    core: 0.38,
    veil: 0.08,
  },
};

interface SceneFilamentState {
  id: string;
  enabled: boolean;
  pathMode: HeroWavePathMode;
  closed: boolean;
  seedOffset: number;
  timeOffset: number;
  playbackRate: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  waveY: number;
  shapeStrength: number;
  shapeScale: number;
  shapeFrequency: number;
  motionMode: HeroWaveMotionMode;
  curveTravel: number;
  curveMotion: number;
  segmentLength: number;
  tailTaper: number;
  headTaper: number;
  propagationEnabled: boolean;
  profileWidth: number;
  profileOpacity: number;
  profileGlow: number;
  profileReflection: number;
  materialPreset: HeroWaveMaterialPreset;
  intensity: number;
  glow: number;
  exposure: number;
  saturation: number;
  upperGlowSpread: number;
  lowerGlowSpread: number;
  glowAsymmetry: number;
  hue: number;
  paletteSpeed: number;
  quality: HeroWaveQualityPreset;
}

interface ProfileKeyState {
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

interface HarmonicState {
  id: string;
  amplitude: number;
  frequency: number;
  phase: number;
  phaseSpeed: number;
}

interface LabDeformerState {
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

interface LabQualityConfig {
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

const QUALITY_CONTROLS = [
  { key: "maxDpr", label: "Max DPR", min: 0.5, max: 2, step: 0.05 },
  { key: "maxFps", label: "Max FPS", min: 0, max: 240, step: 1 },
  {
    key: "flatnessPx",
    label: "Base flatness",
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  {
    key: "maxChordPx",
    label: "Base max chord",
    min: 0.25,
    max: 32,
    step: 0.25,
  },
  {
    key: "maxSamples",
    label: "Max samples",
    min: 1024,
    max: 32768,
    step: 1024,
  },
  {
    key: "maxSubdivisionDepth",
    label: "Subdivision depth",
    min: 4,
    max: 20,
    step: 1,
  },
  { key: "farScale", label: "Far scale", min: 0.01, max: 1, step: 0.005 },
  { key: "midScale", label: "Mid scale", min: 0.01, max: 1, step: 0.005 },
  { key: "coreScale", label: "Core scale", min: 0.1, max: 1, step: 0.01 },
  {
    key: "farMaxDimension",
    label: "Far max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "midMaxDimension",
    label: "Mid max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "coreMaxDimension",
    label: "Core max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "farMaxChordPx",
    label: "Far max chord",
    min: 1,
    max: 256,
    step: 1,
  },
  {
    key: "midMaxChordPx",
    label: "Mid max chord",
    min: 1,
    max: 128,
    step: 1,
  },
  {
    key: "coreMaxChordPx",
    label: "Core max chord",
    min: 1,
    max: 64,
    step: 1,
  },
  {
    key: "farFlatnessPx",
    label: "Far flatness",
    min: 0.05,
    max: 16,
    step: 0.05,
  },
  {
    key: "midFlatnessPx",
    label: "Mid flatness",
    min: 0.01,
    max: 8,
    step: 0.01,
  },
  {
    key: "coreFlatnessPx",
    label: "Core flatness",
    min: 0.01,
    max: 2,
    step: 0.01,
  },
] as const satisfies readonly {
  key: Exclude<keyof LabQualityConfig, "quadrature">;
  label: string;
  min: number;
  max: number;
  step: number;
}[];

interface LabState {
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
  sceneMode: boolean;
  sceneFilaments: SceneFilamentState[];
  fadeInDuration: number;
  fadeCurvePreset: FadeCurvePreset;
  fadeCurve: [number, number, number, number];
  paused: boolean;
  controlledTime: boolean;
  initialTime: number;
  timelineTime: number;
  playbackRate: number;
  respectReducedMotion: boolean;
  pauseWhenOffscreen: boolean;
}

const SVG_LOOP = "M 10 55 C 65 0, 135 0, 190 55 C 135 110, 65 110, 10 55 Z";

const LOOP_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "loop-0", x: 0.5, y: 0.92, speed: 1 },
  { id: "loop-1", x: 0.72, y: 0.66, speed: 1 },
  { id: "loop-2", x: 0.8, y: 0, speed: 1 },
  { id: "loop-3", x: 0.72, y: -0.66, speed: 1 },
  { id: "loop-4", x: 0.5, y: -0.92, speed: 1 },
  { id: "loop-5", x: 0.28, y: -0.66, speed: 1 },
  { id: "loop-6", x: 0.2, y: 0, speed: 1 },
  { id: "loop-7", x: 0.28, y: 0.66, speed: 1 },
];

const FIGURE_EIGHT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "figure-eight-0", x: 0.5, y: 0, speed: 1 },
  { id: "figure-eight-1", x: 0.28, y: 0.88, speed: 1 },
  { id: "figure-eight-2", x: 0.1, y: 0, speed: 1 },
  { id: "figure-eight-3", x: 0.28, y: -0.88, speed: 1 },
  { id: "figure-eight-4", x: 0.5, y: 0, speed: 1 },
  { id: "figure-eight-5", x: 0.72, y: 0.88, speed: 1 },
  { id: "figure-eight-6", x: 0.9, y: 0, speed: 1 },
  { id: "figure-eight-7", x: 0.72, y: -0.88, speed: 1 },
];

const WAVE_ORBIT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "wave-orbit-0", x: 0.01, y: 0.12, speed: 0.5 },
  { id: "wave-orbit-1", x: 0.1, y: 0.46, speed: 0.5 },
  { id: "wave-orbit-2", x: 0.2, y: 0.14, speed: 0.55 },
  { id: "wave-orbit-3", x: 0.31, y: 0.74, speed: 0.7 },
  { id: "wave-orbit-4", x: 0.5, y: 1, speed: 2.2 },
  { id: "wave-orbit-5", x: 0.68, y: 0.75, speed: 2.2 },
  { id: "wave-orbit-6", x: 0.76, y: 0.12, speed: 2.2 },
  { id: "wave-orbit-7", x: 0.68, y: -0.66, speed: 2.2 },
  { id: "wave-orbit-8", x: 0.5, y: -0.96, speed: 2.2 },
  { id: "wave-orbit-9", x: 0.32, y: -0.66, speed: 2.2 },
  { id: "wave-orbit-10", x: 0.24, y: 0.12, speed: 2.2 },
  { id: "wave-orbit-11", x: 0.32, y: 0.75, speed: 2.2 },
  { id: "wave-orbit-12", x: 0.5, y: 1, speed: 1.4 },
  { id: "wave-orbit-13", x: 0.7, y: 0.54, speed: 0.8 },
  { id: "wave-orbit-14", x: 0.84, y: 0.06, speed: 0.65 },
  { id: "wave-orbit-15", x: 0.99, y: 0.42, speed: 0.65 },
];

type GlyphPoint = readonly [number, number];
type GlyphStroke = readonly GlyphPoint[];

const STROKE_GLYPHS: Record<string, readonly GlyphStroke[]> = {
  A: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
    [
      [0.2, 0.62],
      [0.8, 0.62],
    ],
  ],
  B: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
      [0.65, 0.5],
      [1, 0.76],
      [0.62, 1],
      [0, 1],
    ],
  ],
  C: [
    [
      [1, 0.08],
      [0.72, 0],
      [0.18, 0.08],
      [0, 0.5],
      [0.18, 0.92],
      [0.72, 1],
      [1, 0.92],
    ],
  ],
  D: [
    [
      [0, 1],
      [0, 0],
      [0.55, 0],
      [1, 0.22],
      [1, 0.78],
      [0.55, 1],
      [0, 1],
    ],
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 1],
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  F: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  G: [
    [
      [1, 0.1],
      [0.68, 0],
      [0.16, 0.1],
      [0, 0.5],
      [0.16, 0.9],
      [0.7, 1],
      [1, 0.82],
      [1, 0.56],
      [0.58, 0.56],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
      [0, 0.5],
      [1, 0.5],
      [1, 0],
      [1, 1],
    ],
  ],
  I: [
    [
      [0, 0],
      [1, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
      [1, 1],
    ],
  ],
  J: [
    [
      [0, 0],
      [1, 0],
      [0.72, 0],
      [0.72, 0.78],
      [0.52, 1],
      [0.16, 0.94],
      [0, 0.76],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
      [0, 0.5],
      [1, 0],
      [0, 0.5],
      [1, 1],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  M: [
    [
      [0, 1],
      [0, 0],
      [0.5, 0.48],
      [1, 0],
      [1, 1],
    ],
  ],
  N: [
    [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0],
    ],
  ],
  O: [
    [
      [0.5, 0],
      [0.16, 0.08],
      [0, 0.5],
      [0.16, 0.92],
      [0.5, 1],
      [0.84, 0.92],
      [1, 0.5],
      [0.84, 0.08],
      [0.5, 0],
    ],
  ],
  P: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
    ],
  ],
  Q: [
    [
      [0.5, 0],
      [0.16, 0.08],
      [0, 0.5],
      [0.16, 0.92],
      [0.5, 1],
      [0.84, 0.92],
      [1, 0.5],
      [0.84, 0.08],
      [0.5, 0],
    ],
    [
      [0.58, 0.65],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
      [0.55, 0.5],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 0.08],
      [0.7, 0],
      [0.18, 0.08],
      [0, 0.35],
      [0.22, 0.5],
      [0.78, 0.5],
      [1, 0.68],
      [0.82, 0.94],
      [0.28, 1],
      [0, 0.9],
    ],
  ],
  T: [
    [
      [0, 0],
      [1, 0],
      [0.5, 0],
      [0.5, 1],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 0.75],
      [0.2, 1],
      [0.8, 1],
      [1, 0.75],
      [1, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [0.2, 1],
      [0.5, 0.58],
      [0.8, 1],
      [1, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  ],
  Y: [
    [
      [0, 0],
      [0.5, 0.5],
      [1, 0],
      [0.5, 0.5],
      [0.5, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  "0": [
    [
      [0.5, 0],
      [0.12, 0.1],
      [0, 0.5],
      [0.12, 0.9],
      [0.5, 1],
      [0.88, 0.9],
      [1, 0.5],
      [0.88, 0.1],
      [0.5, 0],
    ],
  ],
  "1": [
    [
      [0.2, 0.2],
      [0.5, 0],
      [0.5, 1],
      [0.2, 1],
      [0.8, 1],
    ],
  ],
  "2": [
    [
      [0, 0.2],
      [0.25, 0],
      [0.8, 0],
      [1, 0.25],
      [0, 1],
      [1, 1],
    ],
  ],
  "3": [
    [
      [0, 0.08],
      [0.75, 0],
      [1, 0.25],
      [0.55, 0.5],
      [1, 0.75],
      [0.75, 1],
      [0, 0.92],
    ],
  ],
  "4": [
    [
      [0.8, 1],
      [0.8, 0],
      [0, 0.68],
      [1, 0.68],
    ],
  ],
  "5": [
    [
      [1, 0],
      [0, 0],
      [0, 0.5],
      [0.78, 0.5],
      [1, 0.72],
      [0.78, 1],
      [0, 0.92],
    ],
  ],
  "6": [
    [
      [0.9, 0.08],
      [0.25, 0],
      [0, 0.55],
      [0.18, 0.95],
      [0.75, 1],
      [1, 0.72],
      [0.75, 0.5],
      [0, 0.55],
    ],
  ],
  "7": [
    [
      [0, 0],
      [1, 0],
      [0.25, 1],
    ],
  ],
  "8": [
    [
      [0.5, 0.5],
      [0.08, 0.25],
      [0.5, 0],
      [0.92, 0.25],
      [0.5, 0.5],
      [0.08, 0.75],
      [0.5, 1],
      [0.92, 0.75],
      [0.5, 0.5],
    ],
  ],
  "9": [
    [
      [1, 0.45],
      [0.82, 0.05],
      [0.25, 0],
      [0, 0.28],
      [0.25, 0.5],
      [1, 0.45],
      [0.75, 1],
      [0.1, 0.92],
    ],
  ],
  "-": [
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
  ],
};

function textStrokeIsClosed(stroke: GlyphStroke) {
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  return Boolean(
    first &&
      last &&
      Math.abs(first[0] - last[0]) < 0.0001 &&
      Math.abs(first[1] - last[1]) < 0.0001,
  );
}

function densifyTextStroke(stroke: GlyphStroke, closed: boolean) {
  const source = closed ? stroke.slice(0, -1) : [...stroke];
  if (source.length >= MIN_HERO_TRAJECTORY_POINTS) return source;
  const points = [...source];
  while (points.length < MIN_HERO_TRAJECTORY_POINTS) {
    let longestIndex = 0;
    let longestLength = -1;
    const segmentCount = closed ? points.length : points.length - 1;
    for (let index = 0; index < segmentCount; index++) {
      const from = points[index]!;
      const to = points[(index + 1) % points.length]!;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index;
      }
    }
    const from = points[longestIndex]!;
    const to = points[(longestIndex + 1) % points.length]!;
    points.splice(longestIndex + 1, 0, [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
    ]);
  }
  return points;
}

function buildTextFilaments(state: LabState): HeroWaveFilamentConfig[] {
  const text = state.text.toUpperCase().slice(0, 12);
  const glyphWidth = state.textHeight * 0.62;
  const gap = glyphWidth * state.textLetterSpacing;
  const advances = Array.from(text, (character) =>
    character === " " ? glyphWidth * 0.7 : glyphWidth + gap,
  );
  const totalWidth = Math.max(
    0,
    advances.reduce((sum, value) => sum + value, 0) - gap,
  );
  const verticalScale = getHeroTrajectoryVerticalScale(
    state.shape.scale,
    state.shape.strength,
  );
  let cursor = 0.5 - totalWidth / 2;
  let filamentIndex = 0;
  const filaments: HeroWaveFilamentConfig[] = [];
  Array.from(text).forEach((character, characterIndex) => {
    if (character === " ") {
      cursor += advances[characterIndex] ?? glyphWidth;
      return;
    }
    const strokes = STROKE_GLYPHS[character] ?? STROKE_GLYPHS.X!;
    strokes.forEach((stroke, strokeIndex) => {
      const closed = textStrokeIsClosed(stroke);
      const points = densifyTextStroke(stroke, closed).map(
        ([localX, localTop], pointIndex) => {
          const top = state.textY + (localTop - 0.5) * state.textHeight;
          return {
            id: `text-${characterIndex}-${strokeIndex}-${pointIndex}`,
            x: cursor + localX * glyphWidth,
            y: (state.shape.waveY - top) / verticalScale,
            speed: 1,
          } satisfies HeroTrajectoryPoint;
        },
      );
      filaments.push({
        id: `text-${characterIndex}-${strokeIndex}`,
        timeOffset: characterIndex * state.textStagger,
        path: {
          mode: "custom",
          points,
          closed,
          closedLoopTaper: false,
          interpolation: "linear",
        },
        motion: {
          mode: "anchored",
          curveTravel: 0,
          pathDrift: 0,
          curveMotion: 0,
          segmentLength: 1.5,
          tailTaper: closed ? 0.001 : 0.025,
          headTaper: closed ? 0.001 : 0.025,
          speed: state.motion.speed,
        },
        palette: {
          hue: state.hue + filamentIndex * state.textHueSpread,
          speed: state.paletteSpeed,
          hueDrift: state.hueDrift,
        },
      });
      filamentIndex += 1;
    });
    cursor += advances[characterIndex] ?? glyphWidth;
  });
  return filaments;
}

function createSceneFilament(
  index: number,
  overrides: Partial<SceneFilamentState> = {},
): SceneFilamentState {
  return {
    id: `scene-filament-${index + 1}`,
    enabled: true,
    pathMode: "organic",
    closed: false,
    seedOffset: 819 + index * 977,
    timeOffset: 1.3 + index * 0.8,
    playbackRate: 0.72 - index * 0.08,
    offsetX: 0,
    offsetY: 0.08 + index * 0.04,
    scaleX: 1.02,
    scaleY: Math.max(0.42, 0.66 - index * 0.08),
    rotation: -3 + index * 4,
    waveY: 0.68,
    shapeStrength: 1,
    shapeScale: 0.62,
    shapeFrequency: 1.4,
    motionMode: "anchored",
    curveTravel: 0.025,
    curveMotion: 0.28,
    segmentLength: 1.08,
    tailTaper: 0.4,
    headTaper: 0.3,
    propagationEnabled: true,
    profileWidth: 0.78,
    profileOpacity: 0.72,
    profileGlow: 1.35,
    profileReflection: 0.55,
    materialPreset: "mist",
    intensity: 0.44,
    glow: 1.45,
    exposure: 0.94,
    saturation: 0.82,
    upperGlowSpread: 1,
    lowerGlowSpread: 1,
    glowAsymmetry: 1,
    hue: index * 18,
    paletteSpeed: 0.32,
    quality: "high",
    ...overrides,
  };
}

function createLabDeformer(
  type: DeformerKind,
  index: number,
  overrides: Partial<LabDeformerState> = {},
): LabDeformerState {
  return {
    id: `deformer-${type}-${index + 1}`,
    enabled: true,
    type,
    amplitude: type === "noise" ? 0.025 : 0.055,
    envelope: "sin2",
    direction: "normal",
    tangentAmount: 0.35,
    harmonics: [
      {
        id: `harmonic-${index + 1}-1`,
        amplitude: 0.78,
        frequency: 1.4,
        phase: 0,
        phaseSpeed: -1,
      },
      {
        id: `harmonic-${index + 1}-2`,
        amplitude: 0.22,
        frequency: 1.17,
        phase: 1.1 / (Math.PI * 2),
        phaseSpeed: 0.63,
      },
    ],
    sampledPattern: "0, 0.1, 0.5, 1, 0.4, -0.5, -1, -0.2, 0",
    sampledFrequency: 2,
    sampledPhase: 0,
    sampledPhaseSpeed: 0.18,
    sampledInterpolation: "cubic",
    sampledWrap: "repeat",
    noiseSeed: 731 + index * 997,
    noiseFrequency: 6,
    noisePhaseSpeed: 0.2,
    noiseOctaves: 3,
    noiseLacunarity: 2.1,
    noisePersistence: 0.48,
    pulseWidth: 0.08,
    pulsePhase: 0,
    pulsePhaseSpeed: 0.17,
    pulseCount: 1,
    pulseShape: "gaussian",
    ...overrides,
  };
}

const INITIAL_STATE: LabState = {
  theme: "dark",
  quality: "high",
  qualityAdvanced: false,
  qualityConfig: {
    maxDpr: 1.5,
    maxFps: 60,
    flatnessPx: 0.08,
    maxChordPx: 2.5,
    maxSamples: 32768,
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
  pathMode: "organic",
  textMode: false,
  text: "REPLAY",
  textHeight: 0.3,
  textLetterSpacing: 0.2,
  textY: 0.5,
  textHueSpread: 8,
  textStagger: 0.08,
  interpolation: "centripetal-catmull-rom",
  pathTension: 0,
  closed: false,
  closedLoopTaper: true,
  pathPoints: HERO_DEFAULT_TRAJECTORY.map((point) => ({ ...point })),
  svgPath: SVG_LOOP,
  svgViewBox: [0, 0, 200, 110],
  organic: {
    seed: 731,
    pointCount: 18,
    turns: 1.55,
    amplitude: 0.92,
    roughness: 0.28,
    horizontalJitter: 0.14,
    speedVariation: 0.7,
    symmetry: 0,
  },
  transform: {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
  },
  shape: {
    waveY: 0.68,
    strength: 1,
    scale: 0.62,
    frequency: 1.4,
  },
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
  propagationEnabled: false,
  propagationPhaseOffset: 0,
  propagationPhaseSpeed: 1,
  propagationDeformers: [createLabDeformer("harmonics", 0)],
  propagationDomain: "arcLength",
  propagationCombine: "add",
  propagationStage: "after-follow",
  recomputeArcLength: false,
  profilePreset: "flat",
  profileSource: "preset",
  profileInterpolation: "cubic",
  profileWrap: "clamp",
  profileKeys: [
    {
      id: "profile-start",
      position: 0,
      width: 0.35,
      opacity: 0,
      intensity: 0.2,
      glow: 0.45,
      upperGlowSpread: 1,
      lowerGlowSpread: 1,
      reflection: 0.25,
      colorPosition: 0,
    },
    {
      id: "profile-middle",
      position: 0.5,
      width: 1,
      opacity: 1,
      intensity: 1,
      glow: 1.25,
      upperGlowSpread: 1,
      lowerGlowSpread: 1,
      reflection: 1,
      colorPosition: 0.08,
    },
    {
      id: "profile-end",
      position: 1,
      width: 0.35,
      opacity: 0,
      intensity: 0.2,
      glow: 0.45,
      upperGlowSpread: 1,
      lowerGlowSpread: 1,
      reflection: 0.25,
      colorPosition: 0,
    },
  ],
  profileStrength: 1,
  profileWidth: 1,
  profileOpacity: 1,
  profileIntensity: 1,
  profileGlow: 1,
  profileUpperGlowSpread: 1,
  profileLowerGlowSpread: 1,
  profileReflection: 1,
  profileColorPosition: 0,
  materialPreset: "soft-aurora",
  materialAdvanced: false,
  materialAtmosphere: LAB_MATERIAL_LAYERS["soft-aurora"].atmosphere,
  materialBroad: LAB_MATERIAL_LAYERS["soft-aurora"].broad,
  materialBody: LAB_MATERIAL_LAYERS["soft-aurora"].body,
  materialRidge: LAB_MATERIAL_LAYERS["soft-aurora"].ridge,
  materialCore: LAB_MATERIAL_LAYERS["soft-aurora"].core,
  materialVeil: LAB_MATERIAL_LAYERS["soft-aurora"].veil,
  materialIntensity: 1,
  materialGlow: 1,
  materialExposure: 1,
  materialSaturation: 1,
  upperGlowSpread: 1,
  lowerGlowSpread: 1,
  glowAsymmetry: 1,
  paletteStops: [
    { id: "blue", color: "#2438ff", offset: 0, easing: "smooth" },
    { id: "cyan", color: "#1adff5", offset: 0.22, easing: "smooth" },
    { id: "green", color: "#22f25f", offset: 0.82, easing: "smooth" },
    { id: "white", color: "#eaffff", offset: 1, easing: "linear" },
  ],
  paletteInterpolation: "oklab",
  paletteWrap: "repeat",
  paletteReverse: false,
  paletteSpeed: 1,
  hue: 0,
  hueDrift: 0,
  followMode: "hybrid",
  followActivation: "path-mode",
  followTransitionDuration: 0.48,
  followTarget: "window",
  followPointerMouse: true,
  followPointerPen: true,
  followPointerTouch: true,
  followExternalEnabled: false,
  followExternalSpace: "normalized",
  followExternalX: 0.5,
  followExternalY: 0.5,
  followLeaveBehavior: "idle",
  followHeadResponse: 1,
  followMemorySeconds: 1.05,
  followStationaryBehavior: "collapse",
  followStationaryCollapseDuration: 1.2,
  followLengthCssPx: 1500,
  followViscosity: 0.45,
  followCascadeLag: 0.45,
  followFadeDuration: 0.35,
  followIdleDelay: 0.45,
  followIdleRadiusX: 120,
  followIdleRadiusY: 75,
  followIdleSpeedX: 0.52,
  followIdleSpeedY: 0.41,
  followVelocityIntensity: 0.12,
  followVelocityWidth: 0.09,
  followVelocityGlow: 0.12,
  followVelocityHue: 9.6,
  followVelocityReflection: 0.12,
  followVelocityResponse: 14,
  followMaxVelocityCssPx: 1500,
  filamentInteractionEnabled: false,
  filamentInteractionTarget: "canvas",
  filamentInteractionMouse: true,
  filamentInteractionPen: true,
  filamentInteractionTouch: true,
  filamentInteractionRadius: 80,
  filamentInteractionStrength: 0.045,
  filamentInteractionPropagationSpeed: 0.72,
  filamentInteractionFrequency: 2.8,
  filamentInteractionDamping: 2.2,
  filamentInteractionSpatialDecay: 0.8,
  filamentInteractionDuration: 2.4,
  filamentInteractionCooldown: 0.07,
  filamentInteractionMaxImpulses: 8,
  filamentInteractionDirection: "push",
  dotsEnabled: true,
  dotMode: "flat",
  dotSpacing: 26,
  dotOpacity: 0.45,
  twinkle: 0.6,
  reflect: 0.8,
  dotInteractionEnabled: false,
  dotInteractionRadius: 140,
  dotInteractionSoftness: 0.55,
  dotInteractionBrightness: 1.1,
  dotInteractionColor: "#1adff5",
  dotInteractionColorStrength: 0.65,
  dotInteractionMagnification: 1.55,
  terrainPointerDisplacement: 0.55,
  maskFeather: 0.55,
  dotMasks: [
    { id: "left", x: 0.26, y: 0.52, radius: 0.72, feather: 0.55 },
    { id: "right", x: 0.78, y: 0.5, radius: 0.74, feather: 0.55 },
  ],
  terrainColumns: 112,
  terrainRows: 72,
  terrainWidth: 7.2,
  terrainDepth: 6.2,
  terrainAmplitude: 0.42,
  terrainPointSize: 2.1,
  terrainSpeed: 0.28,
  terrainViewAngle: 52,
  terrainCameraDistance: 3.2,
  terrainFrequency: 1.5,
  terrainOpacity: 0.52,
  terrainEdgeFade: 0.12,
  terrainFit: "fixed",
  terrainContentFade: 0.48,
  terrainColorLow: "#2438ff",
  terrainColorHigh: "#22f25f",
  backgroundImageSrc: "",
  backgroundImageFit: "cover",
  backgroundImageOpacity: 1,
  musicVisualizerEnabled: false,
  musicVisualizerSource: "element",
  musicAudioSrc: "",
  musicFftSize: 1024,
  musicSmoothing: 0.78,
  musicSensitivity: 1,
  musicBand: "energy",
  musicDeformation: 0.035,
  musicDeformationFrequency: 3,
  musicWidth: 0.18,
  musicIntensity: 0.3,
  musicGlow: 0.28,
  musicHue: 10,
  musicReflection: 0.2,
  glassTextEnabled: false,
  glassShape: "text",
  glassText: "Replay the market.\nProve the strategy.",
  glassSvgPath: SVG_LOOP,
  glassSvgViewBox: [0, 0, 200, 110],
  glassFontSize: 96,
  glassCenterX: 50,
  glassCenterY: 50,
  glassMaxWidth: 0.82,
  glassMaxHeight: 0.42,
  glassRefraction: 18,
  glassEdgeWrap: 0,
  glassSurfaceModel: "volumetric",
  glassBevelMode: "biconvex",
  glassSurfaceDepth: 40,
  glassIor: 1.5,
  glassMagnification: 1.1,
  glassMagnificationY: 1.1,
  glassDisplacementX: 0,
  glassDisplacementY: 0,
  glassDiffusion: 0.72,
  glassBlur: 0.2,
  glassDistortion: 0.04,
  glassChromaticAberration: 2.4,
  glassFrost: 0.08,
  glassRoughness: 0.18,
  glassBevel: 1,
  glassRibStrength: 0,
  glassRibWidth: 18,
  glassRibAngle: -18,
  glassLiquidStrength: 0,
  glassLiquidScale: 3.2,
  glassLiquidSpeed: 0.22,
  glassEdgeStrength: 0.72,
  glassSpecular: 0.68,
  glassFresnel: 0.5,
  glassTwinkle: 0,
  glassTwinkleDensity: 0.28,
  glassTwinkleSpeed: 0.8,
  glassTwinkleSize: 28,
  glassTint: "#dffcff",
  glassTintStrength: 0.08,
  glassSaturation: 0,
  glassBrightness: 0,
  glassOpacity: 0.92,
  sceneMode: false,
  sceneFilaments: [createSceneFilament(0)],
  fadeInDuration: 900,
  fadeCurvePreset: "ease-out",
  fadeCurve: [0.16, 1, 0.3, 1],
  paused: false,
  controlledTime: false,
  initialTime: 0,
  timelineTime: 2,
  playbackRate: 1,
  respectReducedMotion: true,
  pauseWhenOffscreen: true,
};

const PRESET_LABELS: Record<LabPresetId, string> = {
  reference: "Reference structured",
  sampled: "Drawn sampled wave",
  noise: "Organic noise plasma",
  pulse: "Closed pulse loop",
  follow: "Cursor trail + ripple",
  svg: "Imported SVG neon",
  scene: "Shared HDR scene",
};

const GLASS_PRESETS = {
  "diffused-lens": {
    label: "Diffused convex lens",
    values: {
      glassSurfaceModel: "volumetric",
      glassBevelMode: "biconvex",
      glassSurfaceDepth: 64,
      glassIor: 1.5,
      glassMagnification: 1.25,
      glassMagnificationY: 1.25,
      glassDiffusion: 0.88,
      glassRefraction: 44,
      glassEdgeWrap: 52,
      glassBlur: 0.32,
      glassDistortion: 0,
      glassChromaticAberration: 2.2,
      glassFrost: 0.28,
      glassRoughness: 0.4,
      glassBevel: 2.2,
      glassRibStrength: 0,
      glassLiquidStrength: 0,
      glassEdgeStrength: 0.55,
      glassSpecular: 0.85,
      glassFresnel: 0.95,
      glassTint: "#dffcff",
      glassTintStrength: 0.07,
      glassSaturation: 0.08,
      glassBrightness: 0.03,
      glassOpacity: 0.94,
    },
  },
  "clear-crystal": {
    label: "Clear crystal",
    values: {
      glassSurfaceModel: "volumetric",
      glassBevelMode: "biconvex",
      glassSurfaceDepth: 40,
      glassIor: 1.52,
      glassMagnification: 0.85,
      glassMagnificationY: 0.85,
      glassDiffusion: 0.24,
      glassRefraction: 32,
      glassEdgeWrap: 38,
      glassBlur: 0.08,
      glassDistortion: 0,
      glassChromaticAberration: 1.6,
      glassFrost: 0.04,
      glassRoughness: 0.14,
      glassBevel: 1.7,
      glassRibStrength: 0,
      glassLiquidStrength: 0,
      glassEdgeStrength: 0.9,
      glassSpecular: 1.15,
      glassFresnel: 0.9,
      glassTint: "#e8fdff",
      glassTintStrength: 0.04,
      glassSaturation: 0.04,
      glassBrightness: 0.02,
      glassOpacity: 0.96,
    },
  },
  "dome-magnifier": {
    label: "Dome magnifier",
    values: {
      glassSurfaceModel: "volumetric",
      glassBevelMode: "dome",
      glassSurfaceDepth: 72,
      glassIor: 1.47,
      glassMagnification: 2,
      glassMagnificationY: 2,
      glassDiffusion: 0.42,
      glassRefraction: 28,
      glassEdgeWrap: 58,
      glassBlur: 0.12,
      glassDistortion: 0,
      glassChromaticAberration: 1.2,
      glassFrost: 0.08,
      glassRoughness: 0.18,
      glassBevel: 2.4,
      glassRibStrength: 0,
      glassLiquidStrength: 0,
      glassEdgeStrength: 0.7,
      glassSpecular: 0.9,
      glassFresnel: 1.1,
      glassTint: "#e6fbff",
      glassTintStrength: 0.05,
      glassSaturation: 0.08,
      glassBrightness: 0.04,
      glassOpacity: 0.95,
    },
  },
  "soft-frosted": {
    label: "Soft frosted lens",
    values: {
      glassSurfaceModel: "volumetric",
      glassBevelMode: "biconvex",
      glassSurfaceDepth: 52,
      glassIor: 1.46,
      glassMagnification: 0.9,
      glassMagnificationY: 0.9,
      glassDiffusion: 0.75,
      glassRefraction: 30,
      glassEdgeWrap: 28,
      glassBlur: 0.65,
      glassDistortion: 0,
      glassChromaticAberration: 0.8,
      glassFrost: 0.78,
      glassRoughness: 0.65,
      glassBevel: 2,
      glassRibStrength: 0,
      glassLiquidStrength: 0,
      glassEdgeStrength: 0.35,
      glassSpecular: 0.5,
      glassFresnel: 0.75,
      glassTint: "#dff8ff",
      glassTintStrength: 0.12,
      glassSaturation: -0.08,
      glassBrightness: 0.06,
      glassOpacity: 0.92,
    },
  },
} as const;

type GlassPresetId = keyof typeof GLASS_PRESETS;
type GlassPresetSelection = GlassPresetId | "custom";

function selectedGlassPreset(state: LabState): GlassPresetSelection {
  const stateRecord = state as unknown as Record<string, unknown>;
  for (const [id, preset] of Object.entries(GLASS_PRESETS)) {
    const matches = Object.entries(preset.values).every(
      ([key, value]) => stateRecord[key] === value,
    );
    if (matches) return id as GlassPresetId;
  }
  return "custom";
}

function cloneInitialState(): LabState {
  return {
    ...INITIAL_STATE,
    pathPoints: INITIAL_STATE.pathPoints.map((point) => ({ ...point })),
    svgViewBox: [...INITIAL_STATE.svgViewBox],
    glassSvgViewBox: [...INITIAL_STATE.glassSvgViewBox],
    qualityConfig: { ...INITIAL_STATE.qualityConfig },
    organic: { ...INITIAL_STATE.organic },
    transform: { ...INITIAL_STATE.transform },
    shape: { ...INITIAL_STATE.shape },
    motion: { ...INITIAL_STATE.motion },
    propagationDeformers: INITIAL_STATE.propagationDeformers.map(
      (deformer) => ({
        ...deformer,
        harmonics: deformer.harmonics.map((harmonic) => ({ ...harmonic })),
      }),
    ),
    profileKeys: INITIAL_STATE.profileKeys.map((key) => ({ ...key })),
    paletteStops: INITIAL_STATE.paletteStops.map((stop) => ({ ...stop })),
    dotMasks: INITIAL_STATE.dotMasks.map((mask) => ({ ...mask })),
    sceneFilaments: INITIAL_STATE.sceneFilaments.map((filament) => ({
      ...filament,
    })),
    fadeCurve: [...INITIAL_STATE.fadeCurve],
  };
}

function stateForPreset(preset: LabPresetId): LabState {
  const state = cloneInitialState();
  if (preset === "sampled") {
    state.pathMode = "custom";
    state.motion.mode = "propagate";
    state.propagationEnabled = true;
    state.propagationDeformers = [
      createLabDeformer("sampled", 0, {
        amplitude: 0.072,
        sampledFrequency: 2,
        sampledPhaseSpeed: 0.18,
      }),
    ];
    state.profilePreset = "comet";
    state.paletteWrap = "mirror";
    state.paletteSpeed = 0.5;
    return state;
  }
  if (preset === "noise") {
    state.pathMode = "organic";
    state.motion.mode = "propagate";
    state.propagationEnabled = true;
    state.propagationDeformers = [
      createLabDeformer("noise", 0, {
        amplitude: 0.025,
        noiseFrequency: 8,
        noisePhaseSpeed: 0.2,
        noiseOctaves: 4,
      }),
    ];
    state.profilePreset = "center-glow";
    state.materialPreset = "plasma";
    state.materialIntensity = 1.18;
    state.materialGlow = 1.22;
    state.materialSaturation = 1.25;
    state.hueDrift = 5;
    return state;
  }
  if (preset === "pulse") {
    state.pathMode = "svg";
    state.closed = true;
    state.closedLoopTaper = false;
    state.motion.mode = "anchored";
    state.propagationEnabled = true;
    state.propagationDeformers = [
      createLabDeformer("pulse", 0, {
        amplitude: 0.026,
        pulseCount: 1,
        pulsePhaseSpeed: 0.17,
        pulseWidth: 0.065,
      }),
    ];
    state.profilePreset = "segmented";
    state.materialPreset = "neon";
    state.materialIntensity = 1.22;
    state.materialGlow = 0.72;
    state.paletteWrap = "repeat";
    return state;
  }
  if (preset === "follow") {
    state.pathMode = "follow";
    state.followActivation = "path-mode";
    state.motion.mode = "anchored";
    state.propagationEnabled = true;
    state.propagationPhaseSpeed = 0.7;
    state.propagationDeformers = [
      createLabDeformer("harmonics", 0, {
        amplitude: 0.012,
        harmonics: [
          {
            id: "follow-harmonic",
            amplitude: 1,
            frequency: 4,
            phase: 0,
            phaseSpeed: -1,
          },
        ],
      }),
    ];
    state.propagationStage = "after-follow";
    state.followMode = "cascade";
    state.followLeaveBehavior = "idle";
    state.followVelocityIntensity = 0.18;
    state.followVelocityWidth = 0.12;
    state.followVelocityGlow = 0.18;
    state.followVelocityHue = 14;
    state.followVelocityReflection = 0.18;
    state.profilePreset = "comet";
    state.materialPreset = "neon";
    state.materialIntensity = 1.08;
    state.materialGlow = 0.82;
    return state;
  }
  if (preset === "svg") {
    state.pathMode = "svg";
    state.closed = true;
    state.closedLoopTaper = false;
    state.motion.mode = "travel";
    state.motion.segmentLength = 0.38;
    state.motion.curveTravel = 0.12;
    state.propagationEnabled = true;
    state.propagationPhaseSpeed = 0.4;
    state.propagationDeformers = [
      createLabDeformer("harmonics", 0, {
        amplitude: 0.008,
        harmonics: [
          {
            id: "svg-harmonic",
            amplitude: 1,
            frequency: 7,
            phase: 0,
            phaseSpeed: -1,
          },
        ],
      }),
    ];
    state.materialPreset = "neon";
    state.materialIntensity = 1.28;
    state.materialGlow = 0.68;
    state.paletteWrap = "repeat";
    return state;
  }
  if (preset === "scene") {
    state.sceneMode = true;
    state.pathMode = "custom";
    state.motion.mode = "travel";
    state.propagationEnabled = true;
    state.profilePreset = "comet";
    state.quality = "high";
    return state;
  }
  return state;
}

function sliderValue(value: number | readonly number[], fallback: number) {
  return typeof value === "number" ? value : (value[0] ?? fallback);
}

interface PreviewPoint {
  x: number;
  y: number;
}

function previewPointAt(
  points: readonly HeroTrajectoryPoint[],
  index: number,
  closed: boolean,
) {
  const count = points.length;
  if (count === 0) return HERO_DEFAULT_TRAJECTORY[0]!;
  const pointIndex = closed
    ? ((index % count) + count) % count
    : Math.min(count - 1, Math.max(0, index));
  return points[pointIndex] ?? points[0] ?? HERO_DEFAULT_TRAJECTORY[0]!;
}

function previewCubicBezier(
  a: number,
  b: number,
  c: number,
  d: number,
  time: number,
) {
  const inverse = 1 - time;
  return (
    inverse ** 3 * a +
    3 * inverse * inverse * time * b +
    3 * inverse * time * time * c +
    time ** 3 * d
  );
}

function previewCatmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  time: number,
  tension: number,
) {
  const tangentScale = 1 - Math.min(1, Math.max(-1, tension));
  const m1 = ((p2 - p0) * tangentScale) / 2;
  const m2 = ((p3 - p1) * tangentScale) / 2;
  const time2 = time * time;
  const time3 = time2 * time;
  return (
    (2 * time3 - 3 * time2 + 1) * p1 +
    (time3 - 2 * time2 + time) * m1 +
    (-2 * time3 + 3 * time2) * p2 +
    (time3 - time2) * m2
  );
}

function previewParameterStep(from: PreviewPoint, to: PreviewPoint) {
  return Math.max(Math.hypot(to.x - from.x, to.y - from.y) ** 0.5, 0.001);
}

function previewInterpolatePoint(
  from: PreviewPoint,
  to: PreviewPoint,
  fromTime: number,
  toTime: number,
  time: number,
) {
  const amount = (time - fromTime) / Math.max(toTime - fromTime, 0.000001);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function previewCentripetalPoint(
  p0: PreviewPoint,
  p1: PreviewPoint,
  p2: PreviewPoint,
  p3: PreviewPoint,
  localTime: number,
) {
  const t0 = 0;
  const t1 = t0 + previewParameterStep(p0, p1);
  const t2 = t1 + previewParameterStep(p1, p2);
  const t3 = t2 + previewParameterStep(p2, p3);
  const time = t1 + (t2 - t1) * localTime;
  const a1 = previewInterpolatePoint(p0, p1, t0, t1, time);
  const a2 = previewInterpolatePoint(p1, p2, t1, t2, time);
  const a3 = previewInterpolatePoint(p2, p3, t2, t3, time);
  const b1 = previewInterpolatePoint(a1, a2, t0, t2, time);
  const b2 = previewInterpolatePoint(a2, a3, t1, t3, time);
  return previewInterpolatePoint(b1, b2, t1, t2, time);
}

function buildEditorPath({
  points,
  interpolation,
  tension,
  closed,
  waveY,
  verticalScale,
  width,
  height,
}: {
  points: readonly HeroTrajectoryPoint[];
  interpolation: HeroWavePathInterpolation;
  tension: number;
  closed: boolean;
  waveY: number;
  verticalScale: number;
  width: number;
  height: number;
}) {
  const segmentCount = closed ? points.length : points.length - 1;
  if (segmentCount <= 0) return "";
  const bandHeight = 1 - waveY;
  const pointY = (point: HeroTrajectoryPoint) =>
    bandHeight + point.y * verticalScale;
  const samples: PreviewPoint[] = [];
  const samplesPerSegment = 24;
  const finiteValue = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? (value as number) : fallback;

  for (let segment = 0; segment < segmentCount; segment++) {
    const p0 = previewPointAt(points, segment - 1, closed);
    const p1 = previewPointAt(points, segment, closed);
    const p2 = previewPointAt(points, segment + 1, closed);
    const p3 = previewPointAt(points, segment + 2, closed);
    for (
      let sampleIndex = segment === 0 ? 0 : 1;
      sampleIndex <= samplesPerSegment;
      sampleIndex++
    ) {
      const time = sampleIndex / samplesPerSegment;
      let x = 0;
      let y = 0;
      if (interpolation === "linear") {
        x = p1.x + (p2.x - p1.x) * time;
        y = pointY(p1) + (pointY(p2) - pointY(p1)) * time;
      } else if (interpolation === "centripetal-catmull-rom") {
        const point = previewCentripetalPoint(
          { x: p0.x * width, y: pointY(p0) * height },
          { x: p1.x * width, y: pointY(p1) * height },
          { x: p2.x * width, y: pointY(p2) * height },
          { x: p3.x * width, y: pointY(p3) * height },
          time,
        );
        x = point.x / Math.max(width, 1);
        y = point.y / Math.max(height, 1);
      } else if (interpolation === "bezier") {
        const tangentScale = (1 - tension) / 6;
        const outX = p1.x + finiteValue(p1.outX, (p2.x - p0.x) * tangentScale);
        const outY =
          pointY(p1) +
          finiteValue(p1.outY, (pointY(p2) - pointY(p0)) * tangentScale);
        const inX = p2.x + finiteValue(p2.inX, -(p3.x - p1.x) * tangentScale);
        const inY =
          pointY(p2) +
          finiteValue(p2.inY, -(pointY(p3) - pointY(p1)) * tangentScale);
        x = previewCubicBezier(p1.x, outX, inX, p2.x, time);
        y = previewCubicBezier(pointY(p1), outY, inY, pointY(p2), time);
      } else {
        x = previewCatmullRom(p0.x, p1.x, p2.x, p3.x, time, tension);
        y = previewCatmullRom(
          pointY(p0),
          pointY(p1),
          pointY(p2),
          pointY(p3),
          time,
          tension,
        );
      }
      samples.push({ x, y: 1 - y });
    }
  }

  return samples
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${(point.x * 100).toFixed(3)} ${(point.y * 100).toFixed(3)}`,
    )
    .join(" ");
}

function createRandomPathConfiguration(): Pick<
  LabState,
  "organic" | "pathPoints" | "shape"
> {
  const seed = Math.floor(Math.random() * 2_000_000_000) + 1;
  const organicBase = {
    seed,
    pointCount: 12 + Math.floor(Math.random() * 17),
    turns: 0.8 + Math.random() * 3,
    amplitude: 1,
    roughness: 0.15 + Math.random() * 0.65,
    horizontalJitter: 0.04 + Math.random() * 0.2,
    speedVariation: 0.35 + Math.random() * 1.15,
    symmetry: Math.random() * 0.65,
  };
  const sourcePoints = createHeroOrganicTrajectory(
    seed,
    organicBase.pointCount,
    organicBase,
  );
  const minimumY = Math.min(...sourcePoints.map((point) => point.y));
  const maximumY = Math.max(...sourcePoints.map((point) => point.y));
  const sourceSpan = Math.max(maximumY - minimumY, 0.001);
  const topEdge = 0.06 + Math.random() * 0.08;
  const bottomEdge = 0.86 + Math.random() * 0.08;
  const shapeScale = 0.85 + Math.random() * 0.45;
  const verticalScale = getHeroTrajectoryVerticalScale(shapeScale, 1);
  const amplitude = Math.min(
    4,
    Math.max(0.1, (bottomEdge - topEdge) / (sourceSpan * verticalScale)),
  );
  const organic = { ...organicBase, amplitude };
  return {
    organic,
    pathPoints: createHeroOrganicTrajectory(seed, organic.pointCount, organic),
    shape: {
      waveY: topEdge + maximumY * amplitude * verticalScale,
      strength: 1,
      scale: shapeScale,
      frequency: 0.7 + Math.random() * 2.5,
    },
  };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function parseSampledPattern(pattern: string) {
  const values = pattern
    .split(/[\s,;]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  return values.length > 1 ? values : [0, 1, 0, -1, 0];
}

function makeCurveProfile(
  first: number,
  middle: number,
  last: number,
): HeroWaveScalarProfile {
  return {
    type: "curve",
    interpolation: "cubic",
    keys: [
      { position: 0, value: first },
      { position: 0.52, value: middle },
      { position: 1, value: last },
    ],
  };
}

function buildPresetProfiles(state: LabState): HeroWaveLongitudinalProfiles {
  const strength = state.profileStrength;
  if (state.profilePreset === "comet") {
    return {
      width: {
        type: "curve",
        interpolation: "cubic",
        keys: [
          { position: 0, value: 0.05 },
          { position: 0.2, value: 0.35 * strength },
          { position: 0.72, value: 1.15 * strength },
          { position: 1, value: 0.08 },
        ],
      },
      opacity: "sin2",
      intensity: {
        type: "curve",
        interpolation: "cubic",
        keys: [
          { position: 0, value: 0 },
          { position: 0.58, value: 0.72 * strength },
          { position: 0.88, value: 1.55 * strength },
          { position: 1, value: 0 },
        ],
      },
      glow: makeCurveProfile(0.35, 1.15 * strength, 0.3),
      reflection: "head",
      colorPosition: makeCurveProfile(0, 0.08, 0),
    };
  }
  if (state.profilePreset === "center-glow") {
    return {
      width: makeCurveProfile(0.35, 1.25 * strength, 0.35),
      opacity: "bell",
      intensity: "bell",
      glow: makeCurveProfile(0.5, 1.6 * strength, 0.5),
      reflection: "bell",
      colorPosition: {
        type: "sampled",
        interpolation: "smooth",
        values: [0, 0.04, 0.12, -0.04, 0],
      },
    };
  }
  if (state.profilePreset === "segmented") {
    return {
      width: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0.1, 1 * strength, 0.18, 0.9 * strength, 0.1],
      },
      opacity: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0, 1, 0.1, 0.9, 0],
      },
      intensity: {
        type: "sampled",
        interpolation: "cubic",
        wrap: "repeat",
        values: [0.2, 1.4 * strength, 0.15, 1.1 * strength, 0.2],
      },
      glow: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0.4, 1.3 * strength, 0.45, 1.1 * strength, 0.4],
      },
      reflection: 1,
      colorPosition: {
        type: "sampled",
        interpolation: "linear",
        wrap: "repeat",
        values: [0, 0.08, 0.18, 0.02, 0],
      },
    };
  }
  return {
    width: 1,
    opacity: 1,
    intensity: 1,
    glow: 1,
    reflection: 1,
    colorPosition: 0,
  };
}

function transformProfile(
  profile: HeroWaveScalarProfile | undefined,
  multiplier: number,
  offset: number,
  fallback: number,
): HeroWaveScalarProfile {
  if (profile === undefined || profile === "flat") {
    return fallback * multiplier + offset;
  }
  if (typeof profile === "number") return profile * multiplier + offset;
  if (typeof profile === "object") {
    if (profile.type === "curve") {
      return {
        ...profile,
        keys: profile.keys.map((key) => ({
          ...key,
          value: key.value * multiplier + offset,
          ...(key.inTangent === undefined
            ? {}
            : { inTangent: key.inTangent * multiplier }),
          ...(key.outTangent === undefined
            ? {}
            : { outTangent: key.outTangent * multiplier }),
        })),
      };
    }
    return {
      ...profile,
      values: Array.from(profile.values, (value) =>
        Number.isFinite(value) ? value * multiplier + offset : offset,
      ),
    };
  }
  const values = Array.from({ length: 65 }, (_, index) => {
    const progress = index / 64;
    const smooth = progress * progress * (3 - 2 * progress);
    const base =
      profile === "sin2"
        ? Math.sin(Math.PI * progress) ** 2
        : profile === "smoothstep"
          ? smooth
          : profile === "bell"
            ? Math.exp(-0.5 * ((progress - 0.5) / 0.22) ** 2)
            : profile === "head"
              ? smooth
              : 1 - smooth;
    return base * multiplier + offset;
  });
  return { type: "sampled", interpolation: "cubic", values };
}

function buildProfiles(state: LabState): HeroWaveLongitudinalProfiles {
  const sortedKeys = [...(state.profileKeys ?? INITIAL_STATE.profileKeys)].sort(
    (left, right) => left.position - right.position,
  );
  const curveFor = (
    channel: keyof Omit<ProfileKeyState, "id" | "position">,
  ) => {
    const fallback = channel === "colorPosition" ? 0 : 1;
    return {
      type: "curve",
      interpolation: state.profileInterpolation,
      wrap: state.profileWrap,
      keys: sortedKeys.map((key) => ({
        position: key.position,
        value: Number.isFinite(key[channel]) ? key[channel] : fallback,
      })),
    } as const;
  };
  const profiles: HeroWaveLongitudinalProfiles =
    state.profileSource === "custom"
      ? {
          width: curveFor("width"),
          opacity: curveFor("opacity"),
          intensity: curveFor("intensity"),
          glow: curveFor("glow"),
          upperGlowSpread: curveFor("upperGlowSpread"),
          lowerGlowSpread: curveFor("lowerGlowSpread"),
          reflection: curveFor("reflection"),
          colorPosition: curveFor("colorPosition"),
        }
      : buildPresetProfiles(state);
  return {
    width: transformProfile(profiles.width, state.profileWidth, 0, 1),
    opacity: transformProfile(profiles.opacity, state.profileOpacity, 0, 1),
    intensity: transformProfile(
      profiles.intensity,
      state.profileIntensity,
      0,
      1,
    ),
    glow: transformProfile(profiles.glow, state.profileGlow, 0, 1),
    upperGlowSpread: transformProfile(
      profiles.upperGlowSpread,
      state.profileUpperGlowSpread ?? 1,
      0,
      1,
    ),
    lowerGlowSpread: transformProfile(
      profiles.lowerGlowSpread,
      state.profileLowerGlowSpread ?? 1,
      0,
      1,
    ),
    reflection: transformProfile(
      profiles.reflection,
      state.profileReflection,
      0,
      1,
    ),
    colorPosition: transformProfile(
      profiles.colorPosition,
      1,
      state.profileColorPosition,
      0,
    ),
  };
}

function buildDeformer(deformer: LabDeformerState): HeroWaveDeformer {
  const common = {
    id: deformer.id,
    enabled: deformer.enabled,
    amplitude: deformer.amplitude,
    envelope: deformer.envelope,
    direction: deformer.direction,
    tangentAmount: deformer.tangentAmount,
  } as const;

  if (deformer.type === "sampled") {
    return {
      ...common,
      type: "sampled",
      values: parseSampledPattern(deformer.sampledPattern),
      frequency: deformer.sampledFrequency,
      phase: deformer.sampledPhase,
      phaseSpeed: deformer.sampledPhaseSpeed,
      interpolation: deformer.sampledInterpolation,
      wrap: deformer.sampledWrap,
    };
  }
  if (deformer.type === "noise") {
    return {
      ...common,
      type: "noise",
      seed: deformer.noiseSeed,
      frequency: deformer.noiseFrequency,
      phaseSpeed: deformer.noisePhaseSpeed,
      octaves: deformer.noiseOctaves,
      lacunarity: deformer.noiseLacunarity,
      persistence: deformer.noisePersistence,
    };
  }
  if (deformer.type === "pulse") {
    return {
      ...common,
      type: "pulse",
      width: deformer.pulseWidth,
      phase: deformer.pulsePhase,
      count: Math.max(1, Math.round(deformer.pulseCount)),
      phaseSpeed: deformer.pulsePhaseSpeed,
      shape: deformer.pulseShape,
    };
  }
  return {
    ...common,
    type: "harmonics",
    waves: deformer.harmonics.map((harmonic) => ({
      amplitude: harmonic.amplitude,
      frequency: harmonic.frequency,
      phase: harmonic.phase,
      phaseSpeed: harmonic.phaseSpeed,
    })),
  };
}

function buildBackgroundProps(state: LabState): HeroWaveBackgroundProps {
  const path = {
    mode: state.pathMode,
    points: state.pathPoints,
    closed: state.closed,
    closedLoopTaper: state.closedLoopTaper,
    interpolation: state.interpolation,
    tension: state.pathTension,
    ...(state.pathMode === "svg"
      ? { svgPath: state.svgPath, svgViewBox: state.svgViewBox }
      : {}),
    transform: state.transform,
    organic: state.organic,
  } satisfies NonNullable<HeroWaveBackgroundProps["path"]>;
  const fadeInEasing: HeroWaveFadeEasing =
    state.fadeCurvePreset === "custom"
      ? state.fadeCurve
      : state.fadeCurvePreset;

  const props: HeroWaveBackgroundProps = {
    theme: state.theme,
    path,
    shape: state.shape,
    motion: state.motion,
    propagation: {
      enabled: state.propagationEnabled,
      domain: state.propagationDomain,
      phaseOffset: state.propagationPhaseOffset,
      phaseSpeed: state.propagationPhaseSpeed,
      combine: state.propagationCombine,
      stage: state.propagationStage,
      recomputeArcLength: state.recomputeArcLength,
      deformers: (
        state.propagationDeformers ?? INITIAL_STATE.propagationDeformers
      ).map(buildDeformer),
    },
    profiles: buildProfiles(state),
    material: {
      preset: state.materialPreset,
      ...(state.materialAdvanced
        ? {
            atmosphere: state.materialAtmosphere,
            broad: state.materialBroad,
            body: state.materialBody,
            ridge: state.materialRidge,
            core: state.materialCore,
            veil: state.materialVeil,
          }
        : {}),
      intensity: state.materialIntensity,
      glow: state.materialGlow,
      exposure: state.materialExposure,
      saturation: state.materialSaturation,
      upperGlowSpread: state.upperGlowSpread,
      lowerGlowSpread: state.lowerGlowSpread,
      glowAsymmetry: state.glowAsymmetry,
    },
    palette: {
      stops: state.paletteStops,
      interpolation: state.paletteInterpolation,
      wrap: state.paletteWrap,
      reverse: state.paletteReverse,
      speed: state.paletteSpeed,
      hue: state.hue,
      hueDrift: state.hueDrift,
    },
    interaction: {
      follow: {
        mode: state.followMode,
        activation: state.followActivation,
        transitionDuration: state.followTransitionDuration,
        target: state.followTarget,
        headResponse: state.followHeadResponse,
        viscosity: state.followViscosity,
        memorySeconds:
          state.followMode === "cascade"
            ? 0.28 + state.followCascadeLag * 1.42
            : state.followMemorySeconds,
        stationaryBehavior: state.followStationaryBehavior,
        stationaryCollapseDuration: state.followStationaryCollapseDuration,
        lengthCssPx: state.followLengthCssPx,
        leaveBehavior: state.followLeaveBehavior,
        fadeDuration: state.followFadeDuration,
        idleDelay: state.followIdleDelay,
        idleRadiusX: state.followIdleRadiusX,
        idleRadiusY: state.followIdleRadiusY,
        idleSpeedX: state.followIdleSpeedX,
        idleSpeedY: state.followIdleSpeedY,
        pointerTypes: [
          ...(state.followPointerMouse ? (["mouse"] as const) : []),
          ...(state.followPointerPen ? (["pen"] as const) : []),
          ...(state.followPointerTouch ? (["touch"] as const) : []),
        ],
        ...(state.followExternalEnabled
          ? {
              position: {
                x: state.followExternalX,
                y: state.followExternalY,
                space: state.followExternalSpace,
                active: true,
              },
            }
          : {}),
        velocityInfluence: {
          intensity: state.followVelocityIntensity,
          width: state.followVelocityWidth,
          glow: state.followVelocityGlow,
          hue: state.followVelocityHue,
          reflection: state.followVelocityReflection,
          response: state.followVelocityResponse,
          maxVelocityCssPx: state.followMaxVelocityCssPx,
        },
      },
      filament: {
        enabled: state.filamentInteractionEnabled,
        target: state.filamentInteractionTarget,
        pointerTypes: [
          ...(state.filamentInteractionMouse ? (["mouse"] as const) : []),
          ...(state.filamentInteractionPen ? (["pen"] as const) : []),
          ...(state.filamentInteractionTouch ? (["touch"] as const) : []),
        ],
        radius: state.filamentInteractionRadius,
        strength: state.filamentInteractionStrength,
        propagationSpeed: state.filamentInteractionPropagationSpeed,
        frequency: state.filamentInteractionFrequency,
        damping: state.filamentInteractionDamping,
        spatialDecay: state.filamentInteractionSpatialDecay,
        duration: state.filamentInteractionDuration,
        cooldown: state.filamentInteractionCooldown,
        maxImpulses: state.filamentInteractionMaxImpulses,
        direction: state.filamentInteractionDirection,
      },
    },
    dots: {
      enabled: state.dotsEnabled,
      mode: state.dotMode,
      spacing: state.dotSpacing,
      opacity: state.dotOpacity,
      twinkle: state.twinkle,
      reflect: state.reflect,
      interaction: {
        enabled: state.dotInteractionEnabled,
        radius: state.dotInteractionRadius,
        softness: state.dotInteractionSoftness,
        brightness: state.dotInteractionBrightness,
        color: state.dotInteractionColor,
        colorStrength: state.dotInteractionColorStrength,
        magnification: state.dotInteractionMagnification,
        terrainDisplacement: state.terrainPointerDisplacement,
      },
      maskFeather: state.maskFeather,
      masks: state.dotMasks,
      terrain: {
        columns: state.terrainColumns,
        rows: state.terrainRows,
        width: state.terrainWidth,
        depth: state.terrainDepth,
        amplitude: state.terrainAmplitude,
        pointSize: state.terrainPointSize,
        speed: state.terrainSpeed,
        viewAngle: state.terrainViewAngle,
        cameraDistance: state.terrainCameraDistance,
        frequency: state.terrainFrequency,
        opacity: state.terrainOpacity,
        edgeFade: state.terrainEdgeFade,
        fit: state.terrainFit,
        contentFade: state.terrainContentFade,
        colorLow: state.terrainColorLow,
        colorHigh: state.terrainColorHigh,
      },
    },
    glassText: {
      enabled: state.glassTextEnabled,
      shape: state.glassShape,
      text: state.glassText,
      svgPath: state.glassSvgPath,
      svgViewBox: state.glassSvgViewBox,
      fontSize: state.glassFontSize,
      center: {
        x: state.glassCenterX / 100,
        y: state.glassCenterY / 100,
      },
      maxWidth: state.glassMaxWidth,
      maxHeight: state.glassMaxHeight,
      refraction: state.glassRefraction,
      edgeWrap: state.glassEdgeWrap,
      surfaceModel: state.glassSurfaceModel,
      bevelMode: state.glassBevelMode,
      surfaceDepth: state.glassSurfaceDepth,
      ior: state.glassIor,
      magnificationX: state.glassMagnification,
      magnificationY: state.glassMagnificationY,
      displacement: {
        x: state.glassDisplacementX,
        y: state.glassDisplacementY,
      },
      diffusion: state.glassDiffusion,
      blur: state.glassBlur,
      distortion: state.glassDistortion,
      chromaticAberration: state.glassChromaticAberration,
      frost: state.glassFrost,
      roughness: state.glassRoughness,
      bevel: state.glassBevel,
      ribStrength: state.glassRibStrength,
      ribWidth: state.glassRibWidth,
      ribAngle: state.glassRibAngle,
      liquidStrength: state.glassLiquidStrength,
      liquidScale: state.glassLiquidScale,
      liquidSpeed: state.glassLiquidSpeed,
      edgeStrength: state.glassEdgeStrength,
      specular: state.glassSpecular,
      fresnel: state.glassFresnel,
      twinkle: state.glassTwinkle,
      twinkleDensity: state.glassTwinkleDensity,
      twinkleSpeed: state.glassTwinkleSpeed,
      twinkleSize: state.glassTwinkleSize,
      tint: state.glassTint,
      tintStrength: state.glassTintStrength,
      saturation: state.glassSaturation,
      brightness: state.glassBrightness,
      opacity: state.glassOpacity,
    },
    backgroundImage: {
      src: state.backgroundImageSrc,
      fit: state.backgroundImageFit,
      opacity: state.backgroundImageOpacity,
    },
    musicVisualizer: {
      enabled: state.musicVisualizerEnabled,
      source: state.musicVisualizerSource,
      elementId: "hero-wave-lab-audio",
      fftSize: state.musicFftSize,
      smoothing: state.musicSmoothing,
      sensitivity: state.musicSensitivity,
      band: state.musicBand,
      deformation: state.musicDeformation,
      deformationFrequency: state.musicDeformationFrequency,
      width: state.musicWidth,
      intensity: state.musicIntensity,
      glow: state.musicGlow,
      hue: state.musicHue,
      reflection: state.musicReflection,
    },
    quality: state.qualityAdvanced
      ? { preset: state.quality, ...state.qualityConfig }
      : state.quality,
    fadeInDuration: state.fadeInDuration,
    fadeInEasing,
    paused: state.paused,
    initialTime: state.initialTime,
    playbackRate: state.playbackRate,
    respectReducedMotion: state.respectReducedMotion,
    pauseWhenOffscreen: state.pauseWhenOffscreen,
    ...(state.controlledTime ? { time: state.timelineTime } : {}),
  };
  return props;
}

function buildSceneFilaments(state: LabState): HeroWaveFilamentConfig[] {
  return [
    { id: "primary" },
    ...state.sceneFilaments.map((filament, index) => ({
      id: filament.id,
      enabled: filament.enabled,
      timeOffset: filament.timeOffset,
      playbackRate: filament.playbackRate,
      path: {
        mode: filament.pathMode,
        points: state.pathPoints,
        closed: filament.closed,
        closedLoopTaper: filament.closed ? state.closedLoopTaper : true,
        interpolation: state.interpolation,
        tension: state.pathTension,
        ...(filament.pathMode === "svg"
          ? { svgPath: state.svgPath, svgViewBox: state.svgViewBox }
          : {}),
        organic: {
          ...state.organic,
          seed: state.organic.seed + filament.seedOffset,
          pointCount: Math.max(8, state.organic.pointCount + index * 2),
        },
        transform: {
          x: filament.offsetX,
          y: filament.offsetY,
          scaleX: filament.scaleX,
          scaleY: filament.scaleY,
          rotation: filament.rotation,
        },
      },
      shape: {
        waveY: filament.waveY,
        strength: filament.shapeStrength,
        scale: filament.shapeScale,
        frequency: filament.shapeFrequency,
      },
      motion: {
        mode: filament.motionMode,
        curveTravel: filament.curveTravel,
        curveMotion: filament.curveMotion,
        segmentLength: filament.segmentLength,
        tailTaper: filament.tailTaper,
        headTaper: filament.headTaper,
        speed: state.motion.speed,
      },
      propagation: {
        enabled: filament.propagationEnabled,
      },
      profiles: {
        width: filament.profileWidth,
        opacity: filament.profileOpacity,
        intensity: filament.profileOpacity,
        glow: filament.profileGlow,
        reflection: filament.profileReflection,
        colorPosition: index * 0.08,
      },
      material: {
        preset: filament.materialPreset,
        intensity: filament.intensity,
        glow: filament.glow,
        exposure: filament.exposure,
        saturation: filament.saturation,
        upperGlowSpread: filament.upperGlowSpread,
        lowerGlowSpread: filament.lowerGlowSpread,
        glowAsymmetry: filament.glowAsymmetry,
      },
      palette: {
        speed: filament.paletteSpeed,
        hue: filament.hue,
        hueDrift: state.hueDrift,
      },
      quality: filament.quality,
    })),
  ];
}

function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  const safeValue = Number.isFinite(value) ? value : min;
  return (
    <div
      className="space-y-1.5 transition-opacity data-[disabled=true]:opacity-40"
      data-disabled={disabled}
    >
      <Label className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <span className="font-mono text-foreground">
          {safeValue.toFixed(decimals)}
          {suffix}
        </span>
      </Label>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[safeValue]}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => onChange(sliderValue(next, safeValue))}
      />
    </div>
  );
}

function SectionHeading({
  children,
  detail,
}: {
  children: string;
  detail?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <Label className="text-xs font-medium text-foreground">{children}</Label>
      {detail ? (
        <span className="text-[10px] text-muted-foreground">{detail}</span>
      ) : null}
    </div>
  );
}

function DeformerEditor({
  deformer,
  index,
  propagationEnabled,
  onChange,
  onRemove,
  onUpdateHarmonic,
}: {
  deformer: LabDeformerState;
  index: number;
  propagationEnabled: boolean;
  onChange: (changes: Partial<Omit<LabDeformerState, "id">>) => void;
  onRemove: () => void;
  onUpdateHarmonic: (
    harmonicId: string,
    changes: Partial<Omit<HarmonicState, "id">>,
  ) => void;
}) {
  const disabled = !propagationEnabled || !deformer.enabled;
  return (
    <div className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={deformer.enabled}
            disabled={!propagationEnabled}
            onCheckedChange={(checked) =>
              onChange({ enabled: checked === true })
            }
          />
          Deformer {index + 1}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={`Remove deformer ${index + 1}`}
          aria-label={`Remove deformer ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={deformer.type}
          disabled={!propagationEnabled}
          onValueChange={(value) => {
            if (
              value === "harmonics" ||
              value === "sampled" ||
              value === "noise" ||
              value === "pulse"
            ) {
              onChange({ type: value });
            }
          }}
        >
          <SelectTrigger size="sm" aria-label={`Deformer ${index + 1} type`}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="harmonics">harmonics</SelectItem>
            <SelectItem value="sampled">sampled</SelectItem>
            <SelectItem value="noise">noise</SelectItem>
            <SelectItem value="pulse">pulse</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={deformer.envelope}
          disabled={disabled}
          onValueChange={(value) => {
            if (
              value === "flat" ||
              value === "sin2" ||
              value === "smoothstep" ||
              value === "bell" ||
              value === "head" ||
              value === "tail"
            ) {
              onChange({ envelope: value });
            }
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Deformer ${index + 1} envelope`}
          >
            <SelectValue placeholder="Envelope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">flat</SelectItem>
            <SelectItem value="sin2">sin²</SelectItem>
            <SelectItem value="smoothstep">smoothstep</SelectItem>
            <SelectItem value="bell">bell</SelectItem>
            <SelectItem value="head">head</SelectItem>
            <SelectItem value="tail">tail</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select
        value={deformer.direction}
        disabled={disabled}
        onValueChange={(value) => {
          if (
            value === "normal" ||
            value === "tangent" ||
            value === "both" ||
            value === "x" ||
            value === "y"
          ) {
            onChange({ direction: value });
          }
        }}
      >
        <SelectTrigger size="sm" aria-label={`Deformer ${index + 1} direction`}>
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">normal</SelectItem>
          <SelectItem value="tangent">tangent</SelectItem>
          <SelectItem value="both">both</SelectItem>
          <SelectItem value="x">x</SelectItem>
          <SelectItem value="y">y</SelectItem>
        </SelectContent>
      </Select>
      <NumberSlider
        label="Amplitude"
        value={deformer.amplitude}
        min={0}
        max={0.25}
        step={0.001}
        disabled={disabled}
        onChange={(value) => onChange({ amplitude: value })}
      />
      <NumberSlider
        label="Tangent amount"
        value={deformer.tangentAmount}
        min={-2}
        max={2}
        step={0.01}
        disabled={disabled || deformer.direction === "normal"}
        onChange={(value) => onChange({ tangentAmount: value })}
      />

      {deformer.type === "harmonics" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              Harmonics {deformer.harmonics.length}/8
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              title="Add harmonic"
              aria-label={`Add harmonic to deformer ${index + 1}`}
              disabled={disabled || deformer.harmonics.length >= 8}
              onClick={() =>
                onChange({
                  harmonics: [
                    ...deformer.harmonics,
                    {
                      id: `harmonic-${Date.now()}`,
                      amplitude: 0.25,
                      frequency: 2,
                      phase: 0,
                      phaseSpeed: 1,
                    },
                  ],
                })
              }
            >
              <Plus />
            </Button>
          </div>
          {deformer.harmonics.map((harmonic, harmonicIndex) => (
            <div
              key={harmonic.id}
              className="space-y-2 border-t border-border/50 pt-2 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">Wave {harmonicIndex + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title={`Remove harmonic ${harmonicIndex + 1}`}
                  aria-label={`Remove harmonic ${harmonicIndex + 1}`}
                  disabled={disabled || deformer.harmonics.length <= 1}
                  onClick={() =>
                    onChange({
                      harmonics: deformer.harmonics.filter(
                        (candidate) => candidate.id !== harmonic.id,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <NumberSlider
                label="Weight"
                value={harmonic.amplitude}
                min={-2}
                max={2}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { amplitude: value })
                }
              />
              <NumberSlider
                label="Frequency"
                value={harmonic.frequency}
                min={0.05}
                max={32}
                step={0.05}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { frequency: value })
                }
              />
              <NumberSlider
                label="Phase"
                value={harmonic.phase}
                min={-2}
                max={2}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { phase: value })
                }
              />
              <NumberSlider
                label="Phase speed"
                value={harmonic.phaseSpeed}
                min={-4}
                max={4}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { phaseSpeed: value })
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {deformer.type === "sampled" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <Label
            htmlFor={`sampled-pattern-${deformer.id}`}
            className="text-xs text-muted-foreground"
          >
            Sample values
          </Label>
          <Textarea
            id={`sampled-pattern-${deformer.id}`}
            value={deformer.sampledPattern}
            rows={2}
            spellCheck={false}
            disabled={disabled}
            className="min-h-14 resize-y text-[10px]"
            onChange={(event) =>
              onChange({ sampledPattern: event.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={deformer.sampledInterpolation}
              disabled={disabled}
              onValueChange={(value) => {
                if (
                  value === "linear" ||
                  value === "smooth" ||
                  value === "cubic"
                ) {
                  onChange({ sampledInterpolation: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Deformer ${index + 1} sampled interpolation`}
              >
                <SelectValue placeholder="Interpolation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">linear</SelectItem>
                <SelectItem value="smooth">smooth</SelectItem>
                <SelectItem value="cubic">cubic</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={deformer.sampledWrap}
              disabled={disabled}
              onValueChange={(value) => {
                if (
                  value === "clamp" ||
                  value === "repeat" ||
                  value === "mirror"
                ) {
                  onChange({ sampledWrap: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Deformer ${index + 1} sampled wrap`}
              >
                <SelectValue placeholder="Wrap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clamp">clamp</SelectItem>
                <SelectItem value="repeat">repeat</SelectItem>
                <SelectItem value="mirror">mirror</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberSlider
            label="Frequency"
            value={deformer.sampledFrequency}
            min={0.05}
            max={32}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ sampledFrequency: value })}
          />
          <NumberSlider
            label="Phase"
            value={deformer.sampledPhase}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ sampledPhase: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.sampledPhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ sampledPhaseSpeed: value })}
          />
        </div>
      ) : null}

      {deformer.type === "noise" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <NumberSlider
            label="Seed"
            value={deformer.noiseSeed}
            min={0}
            max={10_000}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ noiseSeed: Math.round(value) })}
          />
          <NumberSlider
            label="Frequency"
            value={deformer.noiseFrequency}
            min={0.05}
            max={32}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ noiseFrequency: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.noisePhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ noisePhaseSpeed: value })}
          />
          <NumberSlider
            label="Octaves"
            value={deformer.noiseOctaves}
            min={1}
            max={8}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ noiseOctaves: Math.round(value) })}
          />
          <NumberSlider
            label="Lacunarity"
            value={deformer.noiseLacunarity}
            min={1}
            max={4}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ noiseLacunarity: value })}
          />
          <NumberSlider
            label="Persistence"
            value={deformer.noisePersistence}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ noisePersistence: value })}
          />
        </div>
      ) : null}

      {deformer.type === "pulse" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <Select
            value={deformer.pulseShape}
            disabled={disabled}
            onValueChange={(value) => {
              if (
                value === "gaussian" ||
                value === "smooth" ||
                value === "triangle"
              ) {
                onChange({ pulseShape: value });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={`Deformer ${index + 1} pulse shape`}
            >
              <SelectValue placeholder="Pulse shape" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gaussian">gaussian</SelectItem>
              <SelectItem value="smooth">smooth</SelectItem>
              <SelectItem value="triangle">triangle</SelectItem>
            </SelectContent>
          </Select>
          <NumberSlider
            label="Width"
            value={deformer.pulseWidth}
            min={0.005}
            max={0.5}
            step={0.005}
            disabled={disabled}
            onChange={(value) => onChange({ pulseWidth: value })}
          />
          <NumberSlider
            label="Count"
            value={deformer.pulseCount}
            min={1}
            max={32}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ pulseCount: Math.round(value) })}
          />
          <NumberSlider
            label="Phase"
            value={deformer.pulsePhase}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ pulsePhase: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.pulsePhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ pulsePhaseSpeed: value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function HeroBackgroundLab() {
  const [state, setState] = useState<LabState>(() => cloneInitialState());
  const [preset, setPreset] = useState<SelectedPreset>("reference");
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelDocked, setPanelDocked] = useState(false);
  const [panelSection, setPanelSection] = useState<LabPanelSection>("path");
  const [copied, setCopied] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [showPathEditor, setShowPathEditor] = useState(false);
  const [showMaskGuides, setShowMaskGuides] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [rendererStatus, setRendererStatus] =
    useState<HeroWaveRendererStatus | null>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [autoRandomPath, setAutoRandomPath] = useState(false);
  const [autoCycle, setAutoCycle] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const [renderEpoch, setRenderEpoch] = useState(0);
  const [rendererFps, setRendererFps] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HeroWaveBackgroundHandle>(null);
  const frameStatsRef = useRef({ count: 0, startedAt: 0, lastFrameAt: 0 });

  useEffect(() => {
    const source = state.backgroundImageSrc;
    return () => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    };
  }, [state.backgroundImageSrc]);

  useEffect(() => {
    const source = state.musicAudioSrc;
    return () => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    };
  }, [state.musicAudioSrc]);

  const backgroundProps = useMemo(() => buildBackgroundProps(state), [state]);
  const sceneFilaments = useMemo(
    () =>
      state.textMode ? buildTextFilaments(state) : buildSceneFilaments(state),
    [state],
  );
  const sceneActive = state.sceneMode || state.textMode;
  const activeFilamentCount = state.textMode
    ? sceneFilaments.filter((filament) => filament.enabled !== false).length
    : state.sceneMode
      ? 1 + state.sceneFilaments.filter((filament) => filament.enabled).length
      : 1;
  const verticalScale = getHeroTrajectoryVerticalScale(
    state.shape.scale,
    state.shape.strength,
  );
  const automaticTerrainColumns = Math.round(
    Math.min(
      320,
      Math.max(
        8,
        state.terrainRows *
          (viewportSize.width / Math.max(viewportSize.height, 1)),
      ),
    ),
  );

  const editorPath = useMemo(
    () =>
      buildEditorPath({
        points: state.pathPoints,
        interpolation: state.interpolation,
        tension: state.pathTension,
        closed: state.closed,
        waveY: state.shape.waveY,
        verticalScale,
        width: viewportSize.width,
        height: viewportSize.height,
      }),
    [
      state.pathPoints,
      state.interpolation,
      state.pathTension,
      state.closed,
      state.shape.waveY,
      verticalScale,
      viewportSize,
    ],
  );

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const time = Number(parameters.get("time"));
    if (Number.isFinite(time)) {
      setState((previous) => ({
        ...previous,
        controlledTime: true,
        timelineTime: time,
        paused: true,
      }));
    } else if (parameters.has("paused")) {
      setState((previous) => ({ ...previous, paused: true }));
    }
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateViewportSize = () => {
      const rect = stage.getBoundingClientRect();
      setViewportSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(stage);
    updateViewportSize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        frameStatsRef.current.lastFrameAt > 0 &&
        performance.now() - frameStatsRef.current.lastFrameAt > 900
      ) {
        setRendererFps(0);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const markCustom = () => setPreset("custom");
  const glassPreset = selectedGlassPreset(state);

  const applyGlassPreset = (id: GlassPresetId) => {
    setState((previous) => ({
      ...previous,
      ...GLASS_PRESETS[id].values,
      glassTextEnabled: true,
    }));
  };

  const applyPreset = (id: LabPresetId) => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setState({ ...stateForPreset(id), textMode: false });
    setPreset(id);
    setShowPathEditor(id === "sampled" || id === "scene");
    setSelectedPoint(0);
  };

  const randomize = () => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    const kinds: DeformerKind[] = ["harmonics", "sampled", "noise", "pulse"];
    const materials: HeroWaveMaterialPreset[] = [
      "soft-aurora",
      "mist",
      "neon",
      "plasma",
    ];
    const profiles: ProfilePreset[] = [
      "flat",
      "comet",
      "center-glow",
      "segmented",
    ];
    const paletteId = Date.now().toString(36);
    const hue = Math.random() * 360;
    const randomKind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const randomPath = createRandomPathConfiguration();
    setState((previous) => ({
      ...previous,
      textMode: false,
      pathMode: Math.random() > 0.72 ? "custom" : "organic",
      ...randomPath,
      motion: {
        ...previous.motion,
        mode: (["travel", "propagate", "anchored"] as const)[
          Math.floor(Math.random() * 3)
        ]!,
        curveTravel: 0.025 + Math.random() * 0.16,
        curveMotion: Math.random() * 1.2,
        segmentLength: 0.45 + Math.random() * 0.75,
        speed: 0.35 + Math.random() * 1.25,
      },
      propagationEnabled: Math.random() > 0.2,
      propagationPhaseSpeed: 0.08 + Math.random() * 1.1,
      propagationDeformers: [
        createLabDeformer(randomKind, 0, {
          amplitude: 0.006 + Math.random() * 0.06,
          sampledFrequency: 0.8 + Math.random() * 8,
          noiseFrequency: 0.8 + Math.random() * 8,
          pulseCount: 1 + Math.floor(Math.random() * 5),
        }),
      ],
      profilePreset: profiles[Math.floor(Math.random() * profiles.length)]!,
      profileStrength: 0.65 + Math.random() * 0.9,
      materialPreset: materials[Math.floor(Math.random() * materials.length)]!,
      materialIntensity: 0.65 + Math.random() * 0.9,
      materialGlow: 0.55 + Math.random() * 1.3,
      paletteStops: [0, 1, 2, 3].map((index) => ({
        id: `random-${paletteId}-${index}`,
        color: hslToHex(hue + index * (35 + Math.random() * 35), 0.9, 0.58),
        offset: index / 3,
        easing: index < 3 ? "smooth" : "linear",
      })),
      hueDrift: Math.random() * 10,
      sceneMode: Math.random() > 0.72,
      paused: false,
      controlledTime: false,
    }));
    setPreset("custom");
  };

  const regenerateAutoPath = () => {
    const randomPath = createRandomPathConfiguration();
    setState((previous) => ({
      ...previous,
      textMode: false,
      ...randomPath,
      pathMode: "organic",
      closed: false,
      sceneMode: false,
      paused: false,
      controlledTime: false,
      motion: {
        ...previous.motion,
        mode: "travel",
        curveTravel: Math.max(Math.abs(previous.motion.curveTravel), 0.08),
        speed: Math.max(Math.abs(previous.motion.speed), 0.35),
      },
    }));
  };

  const startAutoPath = () => {
    regenerateAutoPath();
    setAutoRandomPath(true);
    setAutoCycle(1);
    setPreset("custom");
    setShowPathEditor(false);
    setSelectedPoint(0);
  };

  const startTextMode = () => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setState((previous) => ({
      ...previous,
      textMode: true,
      sceneMode: false,
      pathMode: "custom",
      paused: false,
      controlledTime: false,
    }));
    setPreset("custom");
    setShowPathEditor(false);
    setShowMaskGuides(false);
  };

  const applyTrajectoryPreset = (
    points: readonly HeroTrajectoryPoint[],
    closed: boolean,
    options: {
      shape?: Partial<LabState["shape"]>;
      motion?: Partial<LabState["motion"]>;
    } = {},
  ) => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setState((previous) => ({
      ...previous,
      textMode: false,
      pathMode: "custom",
      interpolation: "centripetal-catmull-rom",
      pathPoints: points.map((point, index) => ({
        ...point,
        id: `preset-${point.id}-${index}`,
      })),
      closed,
      closedLoopTaper: closed ? false : previous.closedLoopTaper,
      shape: { ...previous.shape, ...options.shape },
      motion: {
        ...previous.motion,
        mode: "travel",
        ...options.motion,
      },
      sceneMode: false,
      paused: false,
      controlledTime: false,
    }));
    setPreset("custom");
    setShowPathEditor(true);
    setSelectedPoint(0);
  };

  const copyConfiguration = async () => {
    const serializable = sceneActive
      ? { ...backgroundProps, filaments: sceneFilaments }
      : backgroundProps;
    const componentName = sceneActive ? "HeroWaveScene" : "HeroWaveBackground";
    const text = `const heroWaveConfig = ${JSON.stringify(
      serializable,
      null,
      2,
    )} satisfies HeroWaveBackgroundProps;\n\n<${componentName} {...heroWaveConfig} />;`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const updatePointPosition = (
    index: number,
    clientX: number,
    clientY: number,
  ) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - rect.left) / Math.max(rect.width, 1);
    const top = (clientY - rect.top) / Math.max(rect.height, 1);
    setState((previous) => ({
      ...previous,
      pathMode: "custom",
      pathPoints: previous.pathPoints.map((point, pointIndex) =>
        pointIndex === index
          ? {
              ...point,
              x: Math.min(1, Math.max(0, x)),
              y: Math.min(
                4,
                Math.max(-4, (previous.shape.waveY - top) / verticalScale),
              ),
            }
          : point,
      ),
    }));
  };

  const addPoint = () => {
    const index = Math.min(selectedPoint, state.pathPoints.length - 1);
    const current = state.pathPoints[index];
    if (!current) return;
    const next = state.pathPoints[index + 1];
    const inserted: HeroTrajectoryPoint = next
      ? {
          id: `point-${Date.now()}`,
          x: (current.x + next.x) / 2,
          y: (current.y + next.y) / 2,
          speed: (current.speed + next.speed) / 2,
        }
      : {
          id: `point-${Date.now()}`,
          x: Math.min(1, current.x + 0.08),
          y: current.y,
          speed: current.speed,
        };
    setState((previous) => {
      const points = [...previous.pathPoints];
      points.splice(index + 1, 0, inserted);
      return { ...previous, pathMode: "custom", pathPoints: points };
    });
    setSelectedPoint(index + 1);
  };

  const removePoint = () => {
    if (state.pathPoints.length <= MIN_HERO_TRAJECTORY_POINTS) return;
    setState((previous) => ({
      ...previous,
      pathPoints: previous.pathPoints.filter(
        (_point, index) => index !== selectedPoint,
      ),
    }));
    setSelectedPoint((index) => Math.max(0, index - 1));
  };

  const addPaletteStop = () => {
    setState((previous) => {
      const count = previous.paletteStops.length;
      return {
        ...previous,
        paletteStops: [
          ...previous.paletteStops,
          {
            id: `palette-${Date.now()}`,
            color: hslToHex(Math.random() * 360, 0.9, 0.58),
            offset: count === 0 ? 0 : 1,
            easing: "smooth",
          },
        ],
      };
    });
  };

  const addMask = () => {
    setState((previous) => {
      if (previous.dotMasks.length >= MAX_HERO_DOT_MASKS) return previous;
      const offset = previous.dotMasks.length * 0.07;
      return {
        ...previous,
        dotMasks: [
          ...previous.dotMasks,
          {
            id: `mask-${Date.now()}`,
            x: Math.min(0.85, 0.42 + offset),
            y: Math.max(0.2, 0.58 - offset),
            radius: 0.42,
            feather: previous.maskFeather,
          },
        ],
      };
    });
  };

  const updateMaskFromPointer = (
    index: number,
    mode: "center" | "radius",
    clientX: number,
    clientY: number,
  ) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setState((previous) => ({
      ...previous,
      dotMasks: previous.dotMasks.map((mask, maskIndex) => {
        if (maskIndex !== index) return mask;
        if (mode === "center") {
          return {
            ...mask,
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height)),
          };
        }
        const centerX = rect.left + mask.x * rect.width;
        const centerY = rect.top + (1 - mask.y) * rect.height;
        return {
          ...mask,
          radius: Math.min(
            1.5,
            Math.max(
              0.05,
              Math.hypot(clientX - centerX, clientY - centerY) /
                Math.max(rect.height, 1),
            ),
          ),
        };
      }),
    }));
  };

  const addSceneFilament = () => {
    setState((previous) => {
      if (previous.sceneFilaments.length >= 5) return previous;
      return {
        ...previous,
        sceneMode: true,
        sceneFilaments: [
          ...previous.sceneFilaments,
          createSceneFilament(previous.sceneFilaments.length),
        ],
      };
    });
  };

  const updateSceneFilament = (
    index: number,
    changes: Partial<SceneFilamentState>,
  ) => {
    setState((previous) => ({
      ...previous,
      sceneFilaments: previous.sceneFilaments.map((filament, filamentIndex) =>
        filamentIndex === index ? { ...filament, ...changes } : filament,
      ),
    }));
  };

  const removeSceneFilament = (index: number) => {
    setState((previous) => ({
      ...previous,
      sceneFilaments: previous.sceneFilaments.filter(
        (_filament, filamentIndex) => filamentIndex !== index,
      ),
    }));
  };

  const updateFadeCurve = (index: number, value: number) => {
    setState((previous) => {
      const fadeCurve: [number, number, number, number] = [
        ...previous.fadeCurve,
      ];
      fadeCurve[index] = value;
      return { ...previous, fadeCurve };
    });
  };

  const addProfileKey = () => {
    setState((previous) => {
      if (previous.profileKeys.length >= 12) return previous;
      const keys = [...previous.profileKeys].sort(
        (left, right) => left.position - right.position,
      );
      let left = keys[0]!;
      let right = keys[keys.length - 1]!;
      let largestGap = -1;
      for (let index = 1; index < keys.length; index++) {
        const candidateLeft = keys[index - 1]!;
        const candidateRight = keys[index]!;
        const gap = candidateRight.position - candidateLeft.position;
        if (gap > largestGap) {
          largestGap = gap;
          left = candidateLeft;
          right = candidateRight;
        }
      }
      const average = (key: keyof Omit<ProfileKeyState, "id" | "position">) => {
        const fallback = key === "colorPosition" ? 0 : 1;
        const leftValue = Number.isFinite(left[key]) ? left[key] : fallback;
        const rightValue = Number.isFinite(right[key]) ? right[key] : fallback;
        return (leftValue + rightValue) / 2;
      };
      return {
        ...previous,
        profileSource: "custom",
        profileKeys: [
          ...previous.profileKeys,
          {
            id: `profile-${Date.now()}`,
            position: (left.position + right.position) / 2,
            width: average("width"),
            opacity: average("opacity"),
            intensity: average("intensity"),
            glow: average("glow"),
            upperGlowSpread: average("upperGlowSpread"),
            lowerGlowSpread: average("lowerGlowSpread"),
            reflection: average("reflection"),
            colorPosition: average("colorPosition"),
          },
        ],
      };
    });
  };

  const updateProfileKey = (
    id: string,
    changes: Partial<Omit<ProfileKeyState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      profileKeys: previous.profileKeys.map((key) =>
        key.id === id ? { ...key, ...changes } : key,
      ),
    }));
  };

  const updateDeformer = (
    id: string,
    changes: Partial<Omit<LabDeformerState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      propagationDeformers: previous.propagationDeformers.map((deformer) =>
        deformer.id === id ? { ...deformer, ...changes } : deformer,
      ),
    }));
  };

  const addDeformer = (type: DeformerKind) => {
    setState((previous) => {
      if (previous.propagationDeformers.length >= 8) return previous;
      return {
        ...previous,
        propagationEnabled: true,
        propagationDeformers: [
          ...previous.propagationDeformers,
          createLabDeformer(type, previous.propagationDeformers.length),
        ],
      };
    });
  };

  const updateHarmonic = (
    deformerId: string,
    harmonicId: string,
    changes: Partial<Omit<HarmonicState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      propagationDeformers: previous.propagationDeformers.map((deformer) =>
        deformer.id === deformerId
          ? {
              ...deformer,
              harmonics: deformer.harmonics.map((harmonic) =>
                harmonic.id === harmonicId
                  ? { ...harmonic, ...changes }
                  : harmonic,
              ),
            }
          : deformer,
      ),
    }));
  };

  const statusLabel = rendererStatus
    ? `${rendererStatus.renderer}${rendererStatus.approximate ? " · approx." : ""}`
    : "initializing";

  const handleRendererFrame = () => {
    const now = performance.now();
    const stats = frameStatsRef.current;
    if (stats.startedAt === 0) stats.startedAt = now;
    stats.count += 1;
    stats.lastFrameAt = now;
    const elapsed = now - stats.startedAt;
    if (elapsed < 500) return;
    setRendererFps((stats.count * 1000) / elapsed);
    stats.count = 0;
    stats.startedAt = now;
  };

  const commonCallbacks = {
    onRendererStatus: setRendererStatus,
    onRendererError: (error: Error) => console.error(error),
    onFrame: handleRendererFrame,
    onCycle: () => {
      setCycleCount((value) => value + 1);
      if (autoRandomPath) {
        setAutoCycle((value) => value + 1);
        regenerateAutoPath();
      }
    },
  };
  const lightTheme = state.theme === "light";

  return (
    <div
      data-theme={state.theme}
      className={`relative min-h-svh overflow-hidden ${
        lightTheme ? "bg-white text-black" : "bg-[#04060a] text-white"
      }`}
    >
      <div
        ref={stageRef}
        className={`absolute inset-y-0 left-0 overflow-hidden transition-[right] duration-200 ${
          panelDocked && panelOpen ? "right-0 md:right-[25rem]" : "right-0"
        }`}
      >
        {sceneActive ? (
          <HeroWaveScene
            key={`scene-${renderEpoch}`}
            ref={waveRef}
            {...backgroundProps}
            {...commonCallbacks}
            filaments={sceneFilaments}
          />
        ) : (
          <HeroWaveBackground
            key={`wave-${renderEpoch}`}
            ref={waveRef}
            {...backgroundProps}
            {...commonCallbacks}
          />
        )}

        {showMaskGuides ? (
          <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
            {state.dotMasks.map((mask, index) => {
              const diameter = mask.radius * viewportSize.height * 2;
              const pointerHandlers = (mode: "center" | "radius") => ({
                onPointerDown: (
                  event: ReactPointerEvent<HTMLButtonElement>,
                ) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateMaskFromPointer(
                    index,
                    mode,
                    event.clientX,
                    event.clientY,
                  );
                },
                onPointerMove: (
                  event: ReactPointerEvent<HTMLButtonElement>,
                ) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return;
                  updateMaskFromPointer(
                    index,
                    mode,
                    event.clientX,
                    event.clientY,
                  );
                },
                onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                },
              });
              return (
                <div
                  key={mask.id}
                  className="absolute rounded-full border border-cyan-300/50 bg-cyan-300/3"
                  style={{
                    left: `${mask.x * 100}%`,
                    top: `${(1 - mask.y) * 100}%`,
                    width: diameter,
                    height: diameter,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <button
                    type="button"
                    className="pointer-events-auto absolute top-1/2 left-1/2 grid size-6 -translate-1/2 cursor-move place-items-center rounded-full border border-cyan-100 bg-black/85 font-mono text-[10px] text-cyan-100 shadow-[0_0_14px_rgb(34_211_238/0.55)] outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    aria-label={`Move dot mask ${index + 1}`}
                    title={`Move mask ${index + 1}`}
                    {...pointerHandlers("center")}
                  >
                    {index + 1}
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto absolute top-1/2 right-0 size-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-50 bg-cyan-400 shadow-[0_0_12px_rgb(34_211_238/0.7)] outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    aria-label={`Resize dot mask ${index + 1}`}
                    title={`Resize mask ${index + 1}`}
                    {...pointerHandlers("radius")}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {showPathEditor && state.pathMode === "custom" ? (
          <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
            <svg
              aria-hidden
              className="absolute inset-0 size-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={`${editorPath}${state.closed ? " Z" : ""}`}
                fill="none"
                stroke="rgb(103 232 249 / 0.55)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {state.pathPoints.map((point, index) => {
              const selected = selectedPoint === index;
              const top = state.shape.waveY - point.y * verticalScale;
              return (
                <button
                  key={point.id}
                  type="button"
                  aria-label={`Trajectory point ${index + 1}`}
                  aria-pressed={selected}
                  className={`pointer-events-auto absolute -translate-1/2 cursor-move rounded-full border border-cyan-100 bg-cyan-400 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${
                    selected
                      ? "size-5 shadow-[0_0_18px_rgb(255_255_255/0.9)] ring-2 ring-white"
                      : "size-4 shadow-[0_0_14px_rgb(34_211_238/0.7)]"
                  }`}
                  style={{
                    left: `${point.x * 100}%`,
                    top: `${Math.min(0.98, Math.max(0.02, top)) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    setSelectedPoint(index);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updatePointPosition(index, event.clientX, event.clientY);
                  }}
                  onPointerMove={(event) => {
                    if (
                      event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                      updatePointPosition(index, event.clientX, event.clientY);
                    }
                  }}
                  onPointerUp={(event) => {
                    if (
                      event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                    }
                  }}
                />
              );
            })}
          </div>
        ) : null}

        {showContent ? (
          <div className="pointer-events-none relative z-10 flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
            <p
              className={`text-xs font-medium tracking-[0.3em] uppercase ${
                lightTheme ? "text-black/60" : "text-white/60"
              }`}
            >
              Hero Wave / Structured API Lab
            </p>
            <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
              Compose light, motion and geometry.
            </h1>
            <p
              className={`max-w-2xl text-balance ${
                lightTheme ? "text-black/60" : "text-white/60"
              }`}
            >
              Paths, serializable deformers, longitudinal profiles, advanced
              palettes, cursor trails and shared HDR filaments in one reusable
              scene.
            </p>
            <div className="flex gap-3">
              <span
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  lightTheme ? "bg-black text-white" : "bg-white text-black"
                }`}
              >
                Structured configuration
              </span>
              <span
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                  lightTheme ? "border-black/20" : "border-white/20"
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <p
              className={`text-xs ${
                lightTheme ? "text-black/40" : "text-white/40"
              }`}
            >
              Cycle {cycleCount} · {state.quality} quality ·{" "}
              {rendererFps.toFixed(1)} FPS · {activeFilamentCount} filament
              {activeFilamentCount === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>

      <Collapsible
        open={panelOpen}
        onOpenChange={setPanelOpen}
        className="dark fixed top-4 right-4 z-20"
      >
        {!panelOpen ? (
          <CollapsibleTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="border-border/70 bg-background/88 shadow-lg backdrop-blur-xl"
                aria-label="Expand controls"
                title="Expand controls"
              />
            }
          >
            <PanelRightOpen />
          </CollapsibleTrigger>
        ) : null}

        {panelOpen ? (
          <Card
            size="sm"
            className="w-[24rem] border-0 bg-background/88 font-mono text-[11px] shadow-2xl backdrop-blur-xl"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-3">
              <CardTitle className="min-w-0 truncate">
                hero-wave structured lab
              </CardTitle>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant={panelDocked ? "secondary" : "ghost"}
                  size="icon-xs"
                  title={panelDocked ? "Overlay controls" : "Dock controls"}
                  aria-label={
                    panelDocked ? "Overlay controls" : "Dock controls"
                  }
                  aria-pressed={panelDocked}
                  onClick={() => setPanelDocked((value) => !value)}
                >
                  <PanelRight />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Reset"
                  aria-label="Reset"
                  onClick={() => applyPreset("reference")}
                >
                  <RotateCcw />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Copy structured config"
                  aria-label="Copy structured config"
                  onClick={copyConfiguration}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Collapse controls"
                      title="Collapse controls"
                    />
                  }
                >
                  <PanelRightClose />
                </CollapsibleTrigger>
              </div>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="max-h-[calc(100svh-5.5rem)] space-y-3 overflow-y-auto pb-2">
                <div className="flex items-center gap-2">
                  <Select
                    value={preset}
                    onValueChange={(value) => {
                      if (value && value in PRESET_LABELS) {
                        applyPreset(value as LabPresetId);
                      }
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Preset"
                      className="min-w-0 flex-1"
                    >
                      <SelectValue placeholder="Preset" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {Object.entries(PRESET_LABELS).map(([id, label]) => (
                        <SelectItem key={id} value={id}>
                          {label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" disabled>
                        Custom / edited
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Randomize"
                    aria-label="Randomize"
                    onClick={randomize}
                  >
                    <Dices />
                  </Button>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-[10px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <Activity className="size-3" /> Renderer
                    </span>
                    <span className="text-foreground">{statusLabel}</span>
                  </div>
                  {rendererStatus?.reason ? (
                    <p className="mt-1 leading-relaxed">
                      {rendererStatus.reason}
                    </p>
                  ) : null}
                </div>

                <nav
                  className="sticky top-0 z-10 -mx-1 grid grid-cols-3 gap-1 border-y border-border/70 bg-background/95 p-1 backdrop-blur-xl"
                  aria-label="Configuration domains"
                >
                  {LAB_PANEL_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`min-w-0 border px-2 py-1.5 text-left transition-colors ${
                        panelSection === section.id
                          ? "border-border bg-secondary text-secondary-foreground"
                          : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground"
                      }`}
                      aria-current={
                        panelSection === section.id ? "page" : undefined
                      }
                      onClick={() => setPanelSection(section.id)}
                    >
                      <span className="block truncate text-[10px] font-medium">
                        {section.label}
                      </span>
                      <span className="block truncate text-[9px] opacity-60">
                        {section.detail}
                      </span>
                    </button>
                  ))}
                </nav>

                <Separator
                  className={panelSection === "renderer" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "renderer" ? "space-y-2" : "hidden"
                  }
                >
                  <SectionHeading detail="exact HDR renderer + adaptive quality">
                    Renderer & quality
                  </SectionHeading>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={state.theme}
                      onValueChange={(value) => {
                        if (value === "dark" || value === "light") {
                          setState((previous) => ({
                            ...previous,
                            theme: value,
                          }));
                          markCustom();
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Theme">
                        <SelectValue placeholder="Theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">dark</SelectItem>
                        <SelectItem value="light">light</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.quality}
                      onValueChange={(value) => {
                        if (
                          value === "auto" ||
                          value === "ultra" ||
                          value === "high" ||
                          value === "balanced" ||
                          value === "low"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            quality: value,
                          }));
                          markCustom();
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Quality">
                        <SelectValue placeholder="Quality" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          ["auto", "ultra", "high", "balanced", "low"] as const
                        ).map((quality) => (
                          <SelectItem key={quality} value={quality}>
                            {quality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.qualityAdvanced}
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          qualityAdvanced: checked === true,
                        }))
                      }
                    />
                    Advanced quality
                  </Label>
                  {state.qualityAdvanced ? (
                    <div className="space-y-2.5 border-l border-border/70 pl-3">
                      {QUALITY_CONTROLS.map((control) => (
                        <NumberSlider
                          key={control.key}
                          label={control.label}
                          value={state.qualityConfig[control.key]}
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              qualityConfig: {
                                ...previous.qualityConfig,
                                [control.key]: value,
                              },
                            }))
                          }
                        />
                      ))}
                      <Select
                        value={String(state.qualityConfig.quadrature)}
                        onValueChange={(value) => {
                          if (value === "2" || value === "4") {
                            setState((previous) => ({
                              ...previous,
                              qualityConfig: {
                                ...previous.qualityConfig,
                                quadrature: Number(value) as 2 | 4,
                              },
                            }));
                          }
                        }}
                      >
                        <SelectTrigger size="sm" aria-label="Quadrature">
                          <SelectValue placeholder="Quadrature" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 samples</SelectItem>
                          <SelectItem value="4">4 samples</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </section>

                <Separator
                  className={panelSection === "inputs" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "inputs" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="shader scene input and frequency response">
                    Background & audio
                  </SectionHeading>
                  <Label className="text-xs" htmlFor="wave-background-url">
                    Background image
                  </Label>
                  <Input
                    id="wave-background-url"
                    type="url"
                    value={state.backgroundImageSrc}
                    placeholder="https://... or upload an image"
                    onChange={(event) =>
                      setState((previous) => ({
                        ...previous,
                        backgroundImageSrc: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    aria-label="Upload shader background image"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setState((previous) => ({
                        ...previous,
                        backgroundImageSrc: URL.createObjectURL(file),
                      }));
                      event.currentTarget.value = "";
                    }}
                  />
                  <Select
                    value={state.backgroundImageFit ?? "cover"}
                    onValueChange={(value) => {
                      if (
                        value !== "cover" &&
                        value !== "contain" &&
                        value !== "stretch"
                      ) {
                        return;
                      }
                      setState((previous) => ({
                        ...previous,
                        backgroundImageFit: value,
                      }));
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Background image fit">
                      <SelectValue placeholder="Image fit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Cover</SelectItem>
                      <SelectItem value="contain">Contain</SelectItem>
                      <SelectItem value="stretch">Stretch</SelectItem>
                    </SelectContent>
                  </Select>
                  <NumberSlider
                    label="Background opacity"
                    value={state.backgroundImageOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        backgroundImageOpacity: value,
                      }))
                    }
                  />

                  <Separator />

                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.musicVisualizerEnabled}
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          musicVisualizerEnabled: checked === true,
                        }))
                      }
                    />
                    Music visualizer
                  </Label>
                  <Select
                    value={state.musicVisualizerSource ?? "element"}
                    onValueChange={(value) => {
                      if (value !== "element" && value !== "microphone") return;
                      setState((previous) => ({
                        ...previous,
                        musicVisualizerSource: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Music visualizer source"
                    >
                      <SelectValue placeholder="Audio source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="element">Audio file</SelectItem>
                      <SelectItem value="microphone">Microphone</SelectItem>
                    </SelectContent>
                  </Select>
                  {state.musicVisualizerSource === "element" ? (
                    <>
                      <Input
                        type="file"
                        accept="audio/*"
                        aria-label="Choose music file"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setState((previous) => ({
                            ...previous,
                            musicAudioSrc: URL.createObjectURL(file),
                          }));
                          event.currentTarget.value = "";
                        }}
                      />
                      <audio
                        id="hero-wave-lab-audio"
                        className="h-9 w-full"
                        src={state.musicAudioSrc || undefined}
                        controls
                        aria-label="Music visualizer audio"
                      />
                    </>
                  ) : (
                    <audio id="hero-wave-lab-audio" className="hidden" />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={String(state.musicFftSize ?? 1024)}
                      onValueChange={(value) => {
                        const fftSize = Number(value);
                        if (
                          fftSize !== 256 &&
                          fftSize !== 512 &&
                          fftSize !== 1024 &&
                          fftSize !== 2048
                        ) {
                          return;
                        }
                        setState((previous) => ({
                          ...previous,
                          musicFftSize: fftSize,
                        }));
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="FFT size">
                        <SelectValue placeholder="FFT size" />
                      </SelectTrigger>
                      <SelectContent>
                        {[256, 512, 1024, 2048].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            FFT {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.musicBand ?? "energy"}
                      onValueChange={(value) => {
                        if (
                          value !== "energy" &&
                          value !== "bass" &&
                          value !== "mid" &&
                          value !== "treble"
                        ) {
                          return;
                        }
                        setState((previous) => ({
                          ...previous,
                          musicBand: value,
                        }));
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Reactive frequency band"
                      >
                        <SelectValue placeholder="Frequency band" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="energy">Full spectrum</SelectItem>
                        <SelectItem value="bass">Bass</SelectItem>
                        <SelectItem value="mid">Midrange</SelectItem>
                        <SelectItem value="treble">Treble</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NumberSlider
                    label="FFT smoothing"
                    value={state.musicSmoothing}
                    min={0}
                    max={0.99}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        musicSmoothing: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Sensitivity"
                    value={state.musicSensitivity}
                    min={0}
                    max={4}
                    step={0.05}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        musicSensitivity: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Ribbon deformation"
                    value={state.musicDeformation}
                    min={0}
                    max={0.2}
                    step={0.0025}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        musicDeformation: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Deformation frequency"
                    value={state.musicDeformationFrequency}
                    min={0.25}
                    max={16}
                    step={0.25}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        musicDeformationFrequency: value,
                      }))
                    }
                  />
                  {(
                    [
                      ["Width response", "musicWidth", -0.9, 2, 0.02],
                      ["Intensity response", "musicIntensity", -1, 4, 0.02],
                      ["Glow response", "musicGlow", -0.9, 4, 0.02],
                      ["Hue response", "musicHue", -180, 180, 1],
                      ["Reflection response", "musicReflection", -1, 4, 0.02],
                    ] as const
                  ).map(([label, key, min, max, step]) => (
                    <NumberSlider
                      key={key}
                      label={label}
                      value={state[key]}
                      min={min}
                      max={max}
                      step={step}
                      suffix={key === "musicHue" ? "°" : undefined}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          [key]: value,
                        }))
                      }
                    />
                  ))}
                </section>

                <Separator
                  className={panelSection === "path" ? undefined : "hidden"}
                />

                <section
                  className={panelSection === "path" ? "space-y-2.5" : "hidden"}
                >
                  <SectionHeading detail="source → interpolation → transform">
                    Path
                  </SectionHeading>
                  <ToggleGroup
                    value={[
                      autoRandomPath
                        ? "auto"
                        : state.textMode
                          ? "text"
                          : state.pathMode,
                    ]}
                    onValueChange={(selection) => {
                      const mode = selection[0] as
                        | HeroWavePathMode
                        | "text"
                        | "auto"
                        | undefined;
                      if (mode === "auto") {
                        startAutoPath();
                        return;
                      }
                      if (mode === "text") {
                        startTextMode();
                        return;
                      }
                      if (
                        mode === "sine" ||
                        mode === "organic" ||
                        mode === "custom" ||
                        mode === "svg" ||
                        mode === "follow"
                      ) {
                        setAutoRandomPath(false);
                        setAutoCycle(0);
                        setState((previous) => ({
                          ...previous,
                          textMode: false,
                          pathMode: mode,
                          followActivation:
                            mode === "follow"
                              ? "path-mode"
                              : previous.followActivation,
                          closed: mode === "svg" ? true : previous.closed,
                        }));
                        setShowPathEditor(mode === "custom");
                        markCustom();
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    className="grid w-full grid-cols-7"
                  >
                    <ToggleGroupItem value="sine" className="px-1 text-[9px]">
                      sine
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="organic"
                      className="px-1 text-[9px]"
                    >
                      organic
                    </ToggleGroupItem>
                    <ToggleGroupItem value="custom" className="px-1 text-[9px]">
                      custom
                    </ToggleGroupItem>
                    <ToggleGroupItem value="svg" className="px-1 text-[9px]">
                      svg
                    </ToggleGroupItem>
                    <ToggleGroupItem value="follow" className="px-1 text-[9px]">
                      follow
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="text"
                      className="gap-0.5 px-1 text-[9px]"
                    >
                      <TypeIcon className="size-2.5" />
                      text
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="auto"
                      className="gap-0.5 px-1 text-[9px]"
                    >
                      <RefreshCw className="size-2.5" />
                      auto
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Select
                    value={state.followActivation}
                    disabled={state.pathMode === "follow"}
                    onValueChange={(value) => {
                      if (
                        value === "path-mode" ||
                        value === "canvas" ||
                        value === "viewport"
                      ) {
                        setState((previous) => ({
                          ...previous,
                          followActivation: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Follow activation">
                      <SelectValue placeholder="Follow activation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="path-mode">
                        Follow only as path mode
                      </SelectItem>
                      <SelectItem value="canvas">
                        Follow while inside canvas
                      </SelectItem>
                      <SelectItem value="viewport">
                        Follow while inside viewport
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {state.followActivation !== "path-mode" ? (
                    <NumberSlider
                      label="Source transition"
                      value={state.followTransitionDuration}
                      min={0}
                      max={2}
                      step={0.02}
                      suffix="s"
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          followTransitionDuration: value,
                        }))
                      }
                    />
                  ) : null}

                  {state.pathMode === "follow" ||
                  state.followActivation !== "path-mode" ? (
                    <div className="space-y-2.5 border-l border-border/70 pl-3">
                      <SectionHeading detail="pointer source + velocity response">
                        Follow interaction
                      </SectionHeading>
                      <ToggleGroup
                        className="grid w-full grid-cols-3"
                        value={[state.followMode]}
                        onValueChange={(selection) => {
                          const value = selection[0];
                          if (
                            value === "hybrid" ||
                            value === "cascade" ||
                            value === "echo"
                          ) {
                            setState((previous) => ({
                              ...previous,
                              followMode: value,
                            }));
                          }
                        }}
                      >
                        <ToggleGroupItem value="hybrid">Hybrid</ToggleGroupItem>
                        <ToggleGroupItem value="cascade">
                          Cascade
                        </ToggleGroupItem>
                        <ToggleGroupItem value="echo">Echo</ToggleGroupItem>
                      </ToggleGroup>
                      <div className="space-y-2.5 border-l border-border/70 pl-3">
                        <NumberSlider
                          label="Head response"
                          value={state.followHeadResponse}
                          min={0.05}
                          max={1}
                          step={0.01}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              followHeadResponse: value,
                            }))
                          }
                        />
                        {state.followMode === "hybrid" ? (
                          <>
                            <NumberSlider
                              label="Hybrid drift"
                              value={state.followViscosity}
                              min={0}
                              max={1}
                              step={0.01}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  followViscosity: value,
                                }))
                              }
                            />
                            <NumberSlider
                              label="Trail length"
                              value={state.followLengthCssPx}
                              min={100}
                              max={4000}
                              step={25}
                              suffix="px"
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  followLengthCssPx: value,
                                }))
                              }
                            />
                          </>
                        ) : null}
                        {state.followMode === "cascade" ? (
                          <NumberSlider
                            label="Cascade lag"
                            value={state.followCascadeLag}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followCascadeLag: value,
                              }))
                            }
                          />
                        ) : null}
                        {state.followMode === "echo" ? (
                          <>
                            <NumberSlider
                              label="Echo memory"
                              value={state.followMemorySeconds}
                              min={0.05}
                              max={4}
                              step={0.05}
                              suffix="s"
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  followMemorySeconds: value,
                                }))
                              }
                            />
                            <Select
                              value={state.followStationaryBehavior}
                              onValueChange={(value) => {
                                if (
                                  value === "freeze" ||
                                  value === "collapse"
                                ) {
                                  setState((previous) => ({
                                    ...previous,
                                    followStationaryBehavior: value,
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label="Echo stationary behavior"
                              >
                                <SelectValue placeholder="When stationary" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="collapse">
                                  Collapse along trail
                                </SelectItem>
                                <SelectItem value="freeze">
                                  Freeze trail
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {state.followStationaryBehavior === "collapse" ? (
                              <NumberSlider
                                label="Collapse duration"
                                value={state.followStationaryCollapseDuration}
                                min={0.1}
                                max={8}
                                step={0.05}
                                suffix="s"
                                onChange={(value) =>
                                  setState((previous) => ({
                                    ...previous,
                                    followStationaryCollapseDuration: value,
                                  }))
                                }
                              />
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={state.followTarget}
                          disabled={
                            state.followExternalEnabled ||
                            state.followActivation !== "path-mode"
                          }
                          onValueChange={(value) => {
                            if (value === "window" || value === "canvas") {
                              setState((previous) => ({
                                ...previous,
                                followTarget: value,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger size="sm" aria-label="Follow target">
                            <SelectValue placeholder="Target" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="window">window</SelectItem>
                            <SelectItem value="canvas">canvas</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={state.followLeaveBehavior}
                          onValueChange={(value) => {
                            if (
                              value === "freeze" ||
                              value === "collapse" ||
                              value === "idle" ||
                              value === "fade"
                            ) {
                              setState((previous) => ({
                                ...previous,
                                followLeaveBehavior: value,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger size="sm" aria-label="Leave behavior">
                            <SelectValue placeholder="Leave" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="freeze">freeze</SelectItem>
                            <SelectItem value="collapse">collapse</SelectItem>
                            <SelectItem value="idle">idle</SelectItem>
                            <SelectItem value="fade">fade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-2">
                        {(
                          [
                            ["Mouse", "followPointerMouse"],
                            ["Pen", "followPointerPen"],
                            ["Touch", "followPointerTouch"],
                          ] as const
                        ).map(([label, key]) => (
                          <Label
                            key={key}
                            className="flex items-center gap-2 text-xs"
                          >
                            <Checkbox
                              checked={state[key]}
                              disabled={state.followExternalEnabled}
                              onCheckedChange={(checked) =>
                                setState((previous) => ({
                                  ...previous,
                                  [key]: checked === true,
                                }))
                              }
                            />
                            {label}
                          </Label>
                        ))}
                      </div>
                      <Label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={state.followExternalEnabled}
                          onCheckedChange={(checked) =>
                            setState((previous) => ({
                              ...previous,
                              followExternalEnabled: checked === true,
                            }))
                          }
                        />
                        External position
                      </Label>
                      {state.followExternalEnabled ? (
                        <div className="space-y-2.5 border-l border-border/70 pl-3">
                          <Select
                            value={state.followExternalSpace}
                            onValueChange={(value) => {
                              if (
                                value === "normalized" ||
                                value === "client"
                              ) {
                                setState((previous) => ({
                                  ...previous,
                                  followExternalSpace: value,
                                  followExternalX:
                                    value === "normalized"
                                      ? 0.5
                                      : viewportSize.width / 2,
                                  followExternalY:
                                    value === "normalized"
                                      ? 0.5
                                      : viewportSize.height / 2,
                                }));
                              }
                            }}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label="External position space"
                            >
                              <SelectValue placeholder="Space" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normalized">
                                normalized
                              </SelectItem>
                              <SelectItem value="client">
                                client pixels
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <NumberSlider
                            label="External X"
                            value={state.followExternalX}
                            min={0}
                            max={
                              state.followExternalSpace === "normalized"
                                ? 1
                                : viewportSize.width
                            }
                            step={
                              state.followExternalSpace === "normalized"
                                ? 0.01
                                : 1
                            }
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followExternalX: value,
                              }))
                            }
                          />
                          <NumberSlider
                            label="External Y"
                            value={state.followExternalY}
                            min={0}
                            max={
                              state.followExternalSpace === "normalized"
                                ? 1
                                : viewportSize.height
                            }
                            step={
                              state.followExternalSpace === "normalized"
                                ? 0.01
                                : 1
                            }
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followExternalY: value,
                              }))
                            }
                          />
                        </div>
                      ) : null}
                      <NumberSlider
                        label="Leave fade"
                        value={state.followFadeDuration}
                        min={0.05}
                        max={3}
                        step={0.05}
                        suffix="s"
                        disabled={state.followLeaveBehavior !== "fade"}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followFadeDuration: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Idle delay"
                        value={state.followIdleDelay}
                        min={0}
                        max={3}
                        step={0.05}
                        suffix="s"
                        disabled={
                          state.followLeaveBehavior !== "idle" &&
                          state.followLeaveBehavior !== "fade"
                        }
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followIdleDelay: value,
                          }))
                        }
                      />
                      {state.followLeaveBehavior === "idle" ? (
                        <>
                          <NumberSlider
                            label="Idle radius X"
                            value={state.followIdleRadiusX}
                            min={0}
                            max={500}
                            step={5}
                            suffix="px"
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followIdleRadiusX: value,
                              }))
                            }
                          />
                          <NumberSlider
                            label="Idle radius Y"
                            value={state.followIdleRadiusY}
                            min={0}
                            max={500}
                            step={5}
                            suffix="px"
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followIdleRadiusY: value,
                              }))
                            }
                          />
                          <NumberSlider
                            label="Idle speed X"
                            value={state.followIdleSpeedX}
                            min={-3}
                            max={3}
                            step={0.05}
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followIdleSpeedX: value,
                              }))
                            }
                          />
                          <NumberSlider
                            label="Idle speed Y"
                            value={state.followIdleSpeedY}
                            min={-3}
                            max={3}
                            step={0.05}
                            onChange={(value) =>
                              setState((previous) => ({
                                ...previous,
                                followIdleSpeedY: value,
                              }))
                            }
                          />
                        </>
                      ) : null}
                      <SectionHeading detail="per visual channel">
                        Velocity response
                      </SectionHeading>
                      <NumberSlider
                        label="Intensity"
                        value={state.followVelocityIntensity}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityIntensity: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Width"
                        value={state.followVelocityWidth}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityWidth: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Glow"
                        value={state.followVelocityGlow}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityGlow: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Hue"
                        value={state.followVelocityHue}
                        min={-180}
                        max={180}
                        step={1}
                        suffix="°"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityHue: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Reflection"
                        value={state.followVelocityReflection}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityReflection: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Response"
                        value={state.followVelocityResponse}
                        min={0.1}
                        max={60}
                        step={0.5}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followVelocityResponse: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Velocity ceiling"
                        value={state.followMaxVelocityCssPx}
                        min={100}
                        max={5000}
                        step={50}
                        suffix="px/s"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            followMaxVelocityCssPx: value,
                          }))
                        }
                      />
                    </div>
                  ) : null}

                  {state.textMode ? (
                    <div className="space-y-2.5 border-l border-border/70 pl-3">
                      <Input
                        value={state.text}
                        maxLength={12}
                        aria-label="Filament text"
                        className="h-8 font-mono uppercase"
                        onChange={(event) =>
                          setState((previous) => ({
                            ...previous,
                            text: event.target.value.toUpperCase(),
                          }))
                        }
                      />
                      <NumberSlider
                        label="Text height"
                        value={state.textHeight}
                        min={0.05}
                        max={0.7}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            textHeight: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Letter spacing"
                        value={state.textLetterSpacing}
                        min={-0.2}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            textLetterSpacing: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Text Y"
                        value={state.textY}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            textY: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Stroke hue spread"
                        value={state.textHueSpread}
                        min={-45}
                        max={45}
                        step={1}
                        suffix="°"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            textHueSpread: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Stroke time stagger"
                        value={state.textStagger}
                        min={-1}
                        max={1}
                        step={0.01}
                        suffix="s"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            textStagger: value,
                          }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-w-0 flex-1 justify-start"
                              aria-label="Trajectory presets"
                            />
                          }
                        >
                          <PenLine />
                          Trajectory presets
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Custom paths</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                applyTrajectoryPreset(
                                  HERO_DEFAULT_TRAJECTORY,
                                  false,
                                  {
                                    shape: { waveY: 0.5, scale: 0.9 },
                                  },
                                )
                              }
                            >
                              <Waves />
                              Open wave
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                applyTrajectoryPreset(
                                  WAVE_ORBIT_TRAJECTORY,
                                  false,
                                  {
                                    shape: { waveY: 0.5, scale: 0.9 },
                                    motion: {
                                      curveTravel: 0.09,
                                      segmentLength: 0.34,
                                    },
                                  },
                                )
                              }
                            >
                              <Gauge />
                              Wave, orbit, wave
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() =>
                                applyTrajectoryPreset(LOOP_TRAJECTORY, true, {
                                  shape: { waveY: 0.5, scale: 0.95 },
                                })
                              }
                            >
                              <Orbit />
                              Closed loop
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                applyTrajectoryPreset(
                                  FIGURE_EIGHT_TRAJECTORY,
                                  true,
                                  {
                                    shape: { waveY: 0.5, scale: 0.95 },
                                  },
                                )
                              }
                            >
                              <InfinityIcon />
                              Figure eight
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {autoRandomPath ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          cycle {autoCycle}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {state.pathMode === "custom" && !state.textMode ? (
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Select
                        value={state.interpolation}
                        onValueChange={(value) => {
                          if (
                            value === "linear" ||
                            value === "catmull-rom" ||
                            value === "centripetal-catmull-rom" ||
                            value === "bezier"
                          ) {
                            setState((previous) => ({
                              ...previous,
                              interpolation: value,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label="Path interpolation"
                        >
                          <SelectValue placeholder="Interpolation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linear">linear</SelectItem>
                          <SelectItem value="catmull-rom">
                            catmull-rom
                          </SelectItem>
                          <SelectItem value="centripetal-catmull-rom">
                            centripetal
                          </SelectItem>
                          <SelectItem value="bezier">bezier</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant={showPathEditor ? "secondary" : "outline"}
                        size="icon-sm"
                        title="Edit path points"
                        aria-label="Edit path points"
                        onClick={() => setShowPathEditor((value) => !value)}
                      >
                        <PenLine />
                      </Button>
                    </div>
                  ) : null}

                  {state.pathMode === "custom" &&
                  !state.textMode &&
                  state.interpolation !== "linear" ? (
                    <NumberSlider
                      label="Path tension"
                      value={state.pathTension}
                      min={-1}
                      max={1}
                      step={0.01}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          pathTension: value,
                        }))
                      }
                    />
                  ) : null}

                  {state.pathMode === "organic" ? (
                    <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
                      <NumberSlider
                        label="Seed"
                        value={state.organic.seed}
                        min={1}
                        max={5000}
                        step={1}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: { ...previous.organic, seed: value },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Point count"
                        value={state.organic.pointCount}
                        min={MIN_HERO_TRAJECTORY_POINTS}
                        max={64}
                        step={1}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: {
                              ...previous.organic,
                              pointCount: Math.round(value),
                            },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Turns"
                        value={state.organic.turns}
                        min={0.2}
                        max={6}
                        step={0.05}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: { ...previous.organic, turns: value },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Amplitude"
                        value={state.organic.amplitude}
                        min={0}
                        max={4}
                        step={0.02}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: {
                              ...previous.organic,
                              amplitude: value,
                            },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Roughness"
                        value={state.organic.roughness}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: { ...previous.organic, roughness: value },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Symmetry"
                        value={state.organic.symmetry}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: { ...previous.organic, symmetry: value },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Horizontal jitter"
                        value={state.organic.horizontalJitter}
                        min={0}
                        max={0.45}
                        step={0.01}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: {
                              ...previous.organic,
                              horizontalJitter: value,
                            },
                          }))
                        }
                      />
                      <NumberSlider
                        label="Speed variation"
                        value={state.organic.speedVariation}
                        min={0}
                        max={3}
                        step={0.02}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            organic: {
                              ...previous.organic,
                              speedVariation: value,
                            },
                          }))
                        }
                      />
                    </div>
                  ) : null}

                  {state.pathMode === "svg" ? (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="svg-path"
                        className="text-xs text-muted-foreground"
                      >
                        SVG path data
                      </Label>
                      <Textarea
                        id="svg-path"
                        value={state.svgPath}
                        rows={3}
                        spellCheck={false}
                        className="min-h-20 resize-y text-[10px] leading-relaxed"
                        onChange={(event) =>
                          setState((previous) => ({
                            ...previous,
                            svgPath: event.target.value,
                          }))
                        }
                      />
                      {(
                        [
                          ["ViewBox min X", 0, -1000, 1000, 1],
                          ["ViewBox min Y", 1, -1000, 1000, 1],
                          ["ViewBox width", 2, 1, 2000, 1],
                          ["ViewBox height", 3, 1, 2000, 1],
                        ] as const
                      ).map(([label, index, min, max, step]) => (
                        <NumberSlider
                          key={label}
                          label={label}
                          value={state.svgViewBox[index]}
                          min={min}
                          max={max}
                          step={step}
                          onChange={(value) =>
                            setState((previous) => {
                              const svgViewBox: [
                                number,
                                number,
                                number,
                                number,
                              ] = [...previous.svgViewBox];
                              svgViewBox[index] = value;
                              return { ...previous, svgViewBox };
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.closed}
                        disabled={
                          state.textMode ||
                          state.pathMode === "sine" ||
                          state.pathMode === "follow"
                        }
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            closed: checked === true,
                          }))
                        }
                      />
                      Closed
                    </Label>
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.closedLoopTaper}
                        disabled={!state.closed}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            closedLoopTaper: checked === true,
                          }))
                        }
                      />
                      Loop taper
                    </Label>
                  </div>

                  <NumberSlider
                    label="Band Y"
                    value={state.shape.waveY}
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        shape: { ...previous.shape, waveY: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Snake curve"
                    value={state.shape.strength}
                    min={0}
                    max={1.5}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        shape: { ...previous.shape, strength: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Vertical scale"
                    value={state.shape.scale}
                    min={0.05}
                    max={1.6}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        shape: { ...previous.shape, scale: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Sine frequency"
                    value={state.shape.frequency}
                    min={0.2}
                    max={6}
                    step={0.05}
                    disabled={state.pathMode !== "sine"}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        shape: { ...previous.shape, frequency: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Path rotation"
                    value={state.transform.rotation}
                    min={-45}
                    max={45}
                    step={1}
                    suffix="°"
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, rotation: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Path offset X"
                    value={state.transform.x}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, x: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Path offset Y"
                    value={state.transform.y}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, y: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Path scale X"
                    value={state.transform.scaleX}
                    min={0.1}
                    max={2}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, scaleX: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Path scale Y"
                    value={state.transform.scaleY}
                    min={0.1}
                    max={2}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, scaleY: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Transform anchor X"
                    value={state.transform.anchorX}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, anchorX: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Transform anchor Y"
                    value={state.transform.anchorY}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        transform: { ...previous.transform, anchorY: value },
                      }))
                    }
                  />

                  {showPathEditor &&
                  state.pathMode === "custom" &&
                  !state.textMode ? (
                    <div className="space-y-2 rounded-lg border bg-muted/25 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          Point {selectedPoint + 1} / {state.pathPoints.length}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title="Add point"
                            aria-label="Add point"
                            onClick={addPoint}
                          >
                            <Plus />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-xs"
                            title="Remove point"
                            aria-label="Remove point"
                            disabled={
                              state.pathPoints.length <=
                              MIN_HERO_TRAJECTORY_POINTS
                            }
                            onClick={removePoint}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      <NumberSlider
                        label="Local speed"
                        value={state.pathPoints[selectedPoint]?.speed ?? 1}
                        min={0.05}
                        max={4}
                        step={0.05}
                        suffix="×"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            pathPoints: previous.pathPoints.map(
                              (point, index) =>
                                index === selectedPoint
                                  ? { ...point, speed: value }
                                  : point,
                            ),
                          }))
                        }
                      />
                      {state.interpolation === "bezier"
                        ? (
                            [
                              ["Incoming X", "inX"],
                              ["Incoming Y", "inY"],
                              ["Outgoing X", "outX"],
                              ["Outgoing Y", "outY"],
                            ] as const
                          ).map(([label, key]) => (
                            <NumberSlider
                              key={key}
                              label={label}
                              value={
                                state.pathPoints[selectedPoint]?.[key] ?? 0
                              }
                              min={-1}
                              max={1}
                              step={0.01}
                              onChange={(value) =>
                                setState((previous) => ({
                                  ...previous,
                                  pathPoints: previous.pathPoints.map(
                                    (point, index) =>
                                      index === selectedPoint
                                        ? { ...point, [key]: value }
                                        : point,
                                  ),
                                }))
                              }
                            />
                          ))
                        : null}
                    </div>
                  ) : null}
                </section>

                <Separator
                  className={panelSection === "motion" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "motion" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="envelope and base motion">
                    Motion
                  </SectionHeading>
                  <ToggleGroup
                    value={[state.motion.mode]}
                    onValueChange={(selection) => {
                      const mode = selection[0] as
                        | HeroWaveMotionMode
                        | undefined;
                      if (
                        mode === "travel" ||
                        mode === "propagate" ||
                        mode === "anchored"
                      ) {
                        setState((previous) => ({
                          ...previous,
                          motion: { ...previous.motion, mode },
                          propagationEnabled:
                            mode === "propagate"
                              ? true
                              : previous.propagationEnabled,
                        }));
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    className="grid w-full grid-cols-3"
                  >
                    <ToggleGroupItem
                      value="travel"
                      className="gap-1 text-[10px]"
                    >
                      <MoveRight className="size-3" /> travel
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="propagate"
                      className="gap-1 text-[10px]"
                    >
                      <Waves className="size-3" /> propagate
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="anchored"
                      className="gap-1 text-[10px]"
                    >
                      <Orbit className="size-3" /> anchored
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <NumberSlider
                    label="Motion speed"
                    value={state.motion.speed}
                    min={-2}
                    max={2}
                    step={0.05}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, speed: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Envelope travel"
                    value={state.motion.curveTravel}
                    min={-0.3}
                    max={0.3}
                    step={0.005}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, curveTravel: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Travel path drift"
                    value={state.motion.pathDrift}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={state.motion.mode !== "travel"}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, pathDrift: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Shape morph"
                    value={state.motion.curveMotion}
                    min={0}
                    max={1.5}
                    step={0.01}
                    disabled={state.motion.mode === "anchored"}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, curveMotion: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Filament length"
                    value={state.motion.segmentLength}
                    min={0.1}
                    max={1.5}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, segmentLength: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Tail taper"
                    value={state.motion.tailTaper}
                    min={0.01}
                    max={0.6}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, tailTaper: value },
                      }))
                    }
                  />
                  <NumberSlider
                    label="Head taper"
                    value={state.motion.headTaper}
                    min={0.01}
                    max={0.6}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        motion: { ...previous.motion, headTaper: value },
                      }))
                    }
                  />
                </section>

                <Separator
                  className={panelSection === "motion" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "motion" ? "space-y-2.5" : "hidden"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading detail="pointer-triggered travelling deformation">
                      Filament interaction
                    </SectionHeading>
                    <Checkbox
                      checked={state.filamentInteractionEnabled}
                      aria-label="Enable filament pointer interaction"
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          filamentInteractionEnabled: checked === true,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={state.filamentInteractionTarget}
                      disabled={!state.filamentInteractionEnabled}
                      onValueChange={(value) => {
                        if (value === "canvas" || value === "viewport") {
                          setState((previous) => ({
                            ...previous,
                            filamentInteractionTarget: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Pointer target">
                        <SelectValue placeholder="Target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="canvas">canvas</SelectItem>
                        <SelectItem value="viewport">viewport</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.filamentInteractionDirection}
                      disabled={!state.filamentInteractionEnabled}
                      onValueChange={(value) => {
                        if (
                          value === "push" ||
                          value === "pull" ||
                          value === "alternate"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            filamentInteractionDirection: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Impulse direction">
                        <SelectValue placeholder="Direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="push">push away</SelectItem>
                        <SelectItem value="pull">pull inward</SelectItem>
                        <SelectItem value="alternate">alternate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    {(
                      [
                        ["Mouse", "filamentInteractionMouse"],
                        ["Pen", "filamentInteractionPen"],
                        ["Touch", "filamentInteractionTouch"],
                      ] as const
                    ).map(([label, key]) => (
                      <Label
                        key={key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={state[key]}
                          disabled={!state.filamentInteractionEnabled}
                          onCheckedChange={(checked) =>
                            setState((previous) => ({
                              ...previous,
                              [key]: checked === true,
                            }))
                          }
                        />
                        {label}
                      </Label>
                    ))}
                  </div>
                  <NumberSlider
                    label="Trigger radius"
                    value={state.filamentInteractionRadius}
                    min={4}
                    max={320}
                    step={2}
                    suffix="px"
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionRadius: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Impulse strength"
                    value={state.filamentInteractionStrength}
                    min={0}
                    max={0.25}
                    step={0.0025}
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionStrength: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Propagation speed"
                    value={state.filamentInteractionPropagationSpeed}
                    min={0.05}
                    max={4}
                    step={0.01}
                    suffix=" path/s"
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionPropagationSpeed: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Wave frequency"
                    value={state.filamentInteractionFrequency}
                    min={0.05}
                    max={16}
                    step={0.05}
                    suffix="Hz"
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionFrequency: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Temporal damping"
                    value={state.filamentInteractionDamping}
                    min={0}
                    max={10}
                    step={0.05}
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionDamping: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Spatial decay"
                    value={state.filamentInteractionSpatialDecay}
                    min={0}
                    max={10}
                    step={0.05}
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionSpatialDecay: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Impulse lifetime"
                    value={state.filamentInteractionDuration}
                    min={0.1}
                    max={8}
                    step={0.05}
                    suffix="s"
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionDuration: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Retrigger cooldown"
                    value={state.filamentInteractionCooldown}
                    min={0}
                    max={1}
                    step={0.01}
                    suffix="s"
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionCooldown: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Concurrent impulses"
                    value={state.filamentInteractionMaxImpulses}
                    min={1}
                    max={24}
                    step={1}
                    disabled={!state.filamentInteractionEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        filamentInteractionMaxImpulses: value,
                      }))
                    }
                  />
                </section>

                <Separator
                  className={panelSection === "motion" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "motion" ? "space-y-2.5" : "hidden"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading detail="serializable CPU stack">
                      Propagation
                    </SectionHeading>
                    <Checkbox
                      checked={state.propagationEnabled}
                      aria-label="Enable propagation"
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          propagationEnabled: checked === true,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs">
                      Deformers {state.propagationDeformers.length}/8
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            title="Add deformer"
                            aria-label="Add deformer"
                            disabled={state.propagationDeformers.length >= 8}
                          />
                        }
                      >
                        <Plus />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => addDeformer("harmonics")}
                        >
                          <Waves /> Harmonics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => addDeformer("sampled")}
                        >
                          <Activity /> Sampled
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addDeformer("noise")}>
                          <Dices /> Noise
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addDeformer("pulse")}>
                          <Orbit /> Pulse
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-3 border-l border-border/70 pl-3">
                    {state.propagationDeformers.map((deformer, index) => (
                      <DeformerEditor
                        key={deformer.id}
                        deformer={deformer}
                        index={index}
                        propagationEnabled={state.propagationEnabled}
                        onChange={(changes) =>
                          updateDeformer(deformer.id, changes)
                        }
                        onRemove={() =>
                          setState((previous) => ({
                            ...previous,
                            propagationDeformers:
                              previous.propagationDeformers.filter(
                                (candidate) => candidate.id !== deformer.id,
                              ),
                          }))
                        }
                        onUpdateHarmonic={(harmonicId, changes) =>
                          updateHarmonic(deformer.id, harmonicId, changes)
                        }
                      />
                    ))}
                  </div>
                  <NumberSlider
                    label="Global phase offset"
                    value={state.propagationPhaseOffset}
                    min={-4}
                    max={4}
                    step={0.01}
                    disabled={!state.propagationEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        propagationPhaseOffset: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Global phase speed"
                    value={state.propagationPhaseSpeed}
                    min={-4}
                    max={4}
                    step={0.01}
                    disabled={!state.propagationEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        propagationPhaseSpeed: value,
                      }))
                    }
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={state.propagationDomain}
                      onValueChange={(value) => {
                        if (value === "arcLength" || value === "travelTime") {
                          setState((previous) => ({
                            ...previous,
                            propagationDomain: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Domain">
                        <SelectValue placeholder="Domain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arcLength">arc</SelectItem>
                        <SelectItem value="travelTime">travel</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.propagationCombine}
                      onValueChange={(value) => {
                        if (
                          value === "add" ||
                          value === "max" ||
                          value === "multiply"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            propagationCombine: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Combine">
                        <SelectValue placeholder="Combine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add">add</SelectItem>
                        <SelectItem value="max">max</SelectItem>
                        <SelectItem value="multiply">multiply</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.propagationStage}
                      onValueChange={(value) => {
                        if (
                          value === "before-follow" ||
                          value === "after-follow"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            propagationStage: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Follow stage">
                        <SelectValue placeholder="Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before-follow">before</SelectItem>
                        <SelectItem value="after-follow">after</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.recomputeArcLength}
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          recomputeArcLength: checked === true,
                        }))
                      }
                    />
                    Recompute progress after deformation
                  </Label>
                </section>

                <Separator
                  className={panelSection === "material" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "material" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="LUT profiles + shared material">
                    Profiles & material
                  </SectionHeading>
                  <ToggleGroup
                    className="grid w-full grid-cols-2"
                    value={[state.profileSource]}
                    onValueChange={(selection) => {
                      const value = selection[0];
                      if (value === "preset" || value === "custom") {
                        setState((previous) => ({
                          ...previous,
                          profileSource: value,
                        }));
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                  >
                    <ToggleGroupItem value="preset">Preset</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Curve</ToggleGroupItem>
                  </ToggleGroup>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      disabled={state.profileSource === "custom"}
                      value={state.profilePreset}
                      onValueChange={(value) => {
                        if (
                          value === "flat" ||
                          value === "comet" ||
                          value === "center-glow" ||
                          value === "segmented"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            profilePreset: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Profile preset">
                        <SelectValue placeholder="Profiles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">flat</SelectItem>
                        <SelectItem value="comet">comet</SelectItem>
                        <SelectItem value="center-glow">center glow</SelectItem>
                        <SelectItem value="segmented">segmented</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.materialPreset}
                      onValueChange={(value) => {
                        if (
                          value === "soft-aurora" ||
                          value === "mist" ||
                          value === "neon" ||
                          value === "plasma"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            materialPreset: value,
                            ...(previous.materialAdvanced
                              ? {
                                  materialAtmosphere:
                                    LAB_MATERIAL_LAYERS[value].atmosphere,
                                  materialBroad:
                                    LAB_MATERIAL_LAYERS[value].broad,
                                  materialBody: LAB_MATERIAL_LAYERS[value].body,
                                  materialRidge:
                                    LAB_MATERIAL_LAYERS[value].ridge,
                                  materialCore: LAB_MATERIAL_LAYERS[value].core,
                                  materialVeil: LAB_MATERIAL_LAYERS[value].veil,
                                }
                              : {}),
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Material preset">
                        <SelectValue placeholder="Material" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soft-aurora">soft aurora</SelectItem>
                        <SelectItem value="mist">mist</SelectItem>
                        <SelectItem value="neon">neon</SelectItem>
                        <SelectItem value="plasma">plasma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {state.profileSource === "preset" &&
                  state.profilePreset !== "flat" ? (
                    <NumberSlider
                      label="Preset shape strength"
                      value={state.profileStrength}
                      min={0.2}
                      max={2}
                      step={0.02}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          profileStrength: value,
                        }))
                      }
                    />
                  ) : null}
                  {state.profileSource === "custom" ? (
                    <div className="space-y-3 border-l border-border/70 pl-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={state.profileInterpolation}
                          onValueChange={(value) => {
                            if (
                              value === "linear" ||
                              value === "smooth" ||
                              value === "cubic"
                            ) {
                              setState((previous) => ({
                                ...previous,
                                profileInterpolation: value,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label="Profile interpolation"
                          >
                            <SelectValue placeholder="Interpolation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="linear">linear</SelectItem>
                            <SelectItem value="smooth">smooth</SelectItem>
                            <SelectItem value="cubic">cubic</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={state.profileWrap}
                          onValueChange={(value) => {
                            if (
                              value === "clamp" ||
                              value === "repeat" ||
                              value === "mirror"
                            ) {
                              setState((previous) => ({
                                ...previous,
                                profileWrap: value,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger size="sm" aria-label="Profile wrap">
                            <SelectValue placeholder="Wrap" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="clamp">clamp</SelectItem>
                            <SelectItem value="repeat">repeat</SelectItem>
                            <SelectItem value="mirror">mirror</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs">
                          Profile keys {state.profileKeys.length}/12
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          title="Add profile key"
                          aria-label="Add profile key"
                          disabled={state.profileKeys.length >= 12}
                          onClick={addProfileKey}
                        >
                          <Plus />
                        </Button>
                      </div>
                      {[...state.profileKeys]
                        .sort((left, right) => left.position - right.position)
                        .map((key, index) => (
                          <div
                            key={key.id}
                            className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs">Key {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                title={`Remove profile key ${index + 1}`}
                                aria-label={`Remove profile key ${index + 1}`}
                                disabled={state.profileKeys.length <= 2}
                                onClick={() =>
                                  setState((previous) => ({
                                    ...previous,
                                    profileKeys: previous.profileKeys.filter(
                                      (candidate) => candidate.id !== key.id,
                                    ),
                                  }))
                                }
                              >
                                <Trash2 />
                              </Button>
                            </div>
                            <NumberSlider
                              label="Position"
                              value={key.position}
                              min={0}
                              max={1}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, { position: value })
                              }
                            />
                            <NumberSlider
                              label="Width"
                              value={key.width}
                              min={0.01}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, { width: value })
                              }
                            />
                            <NumberSlider
                              label="Opacity"
                              value={key.opacity}
                              min={0}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, { opacity: value })
                              }
                            />
                            <NumberSlider
                              label="Intensity"
                              value={key.intensity}
                              min={0}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, { intensity: value })
                              }
                            />
                            <NumberSlider
                              label="Glow"
                              value={key.glow}
                              min={0.01}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, { glow: value })
                              }
                            />
                            <NumberSlider
                              label="Upper glow spread"
                              value={key.upperGlowSpread ?? 1}
                              min={0.05}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, {
                                  upperGlowSpread: value,
                                })
                              }
                            />
                            <NumberSlider
                              label="Lower glow spread"
                              value={key.lowerGlowSpread ?? 1}
                              min={0.05}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, {
                                  lowerGlowSpread: value,
                                })
                              }
                            />
                            <NumberSlider
                              label="Reflection"
                              value={key.reflection}
                              min={0}
                              max={4}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, {
                                  reflection: value,
                                })
                              }
                            />
                            <NumberSlider
                              label="Color offset"
                              value={key.colorPosition}
                              min={-2}
                              max={2}
                              step={0.01}
                              onChange={(value) =>
                                updateProfileKey(key.id, {
                                  colorPosition: value,
                                })
                              }
                            />
                          </div>
                        ))}
                    </div>
                  ) : null}
                  <SectionHeading detail="applied after the shape">
                    Profile multipliers
                  </SectionHeading>
                  <NumberSlider
                    label="Width scale"
                    value={state.profileWidth}
                    min={0.05}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileWidth: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Opacity scale"
                    value={state.profileOpacity}
                    min={0}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileOpacity: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Intensity scale"
                    value={state.profileIntensity}
                    min={0}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileIntensity: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Glow scale"
                    value={state.profileGlow}
                    min={0.05}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileGlow: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Upper glow spread scale"
                    value={state.profileUpperGlowSpread ?? 1}
                    min={0.05}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileUpperGlowSpread: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Lower glow spread scale"
                    value={state.profileLowerGlowSpread ?? 1}
                    min={0.05}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileLowerGlowSpread: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Reflection scale"
                    value={state.profileReflection}
                    min={0}
                    max={3}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileReflection: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Global color offset"
                    value={state.profileColorPosition}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        profileColorPosition: value,
                      }))
                    }
                  />
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.materialAdvanced}
                      onCheckedChange={(checked) =>
                        setState((previous) => {
                          const advanced = checked === true;
                          const layers =
                            LAB_MATERIAL_LAYERS[previous.materialPreset];
                          return {
                            ...previous,
                            materialAdvanced: advanced,
                            ...(advanced
                              ? {
                                  materialAtmosphere: layers.atmosphere,
                                  materialBroad: layers.broad,
                                  materialBody: layers.body,
                                  materialRidge: layers.ridge,
                                  materialCore: layers.core,
                                  materialVeil: layers.veil,
                                }
                              : {}),
                          };
                        })
                      }
                    />
                    Advanced material layers
                  </Label>
                  {state.materialAdvanced ? (
                    <div className="space-y-2.5 border-l border-border/70 pl-3">
                      <NumberSlider
                        label="Atmosphere"
                        value={state.materialAtmosphere}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialAtmosphere: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Broad"
                        value={state.materialBroad}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialBroad: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Body"
                        value={state.materialBody}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialBody: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Ridge"
                        value={state.materialRidge}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialRidge: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Core"
                        value={state.materialCore}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialCore: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Veil"
                        value={state.materialVeil}
                        min={0}
                        max={2}
                        step={0.005}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            materialVeil: value,
                          }))
                        }
                      />
                    </div>
                  ) : null}
                  <NumberSlider
                    label="Material intensity"
                    value={state.materialIntensity}
                    min={0}
                    max={2.5}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        materialIntensity: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Material glow"
                    value={state.materialGlow}
                    min={0.2}
                    max={3}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        materialGlow: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Exposure"
                    value={state.materialExposure}
                    min={0.2}
                    max={2.5}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        materialExposure: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Saturation"
                    value={state.materialSaturation}
                    min={0}
                    max={2.5}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        materialSaturation: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Upper glow spread"
                    value={state.upperGlowSpread}
                    min={0.1}
                    max={3}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        upperGlowSpread: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Lower glow spread"
                    value={state.lowerGlowSpread}
                    min={0.1}
                    max={3}
                    step={0.02}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        lowerGlowSpread: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Glow asymmetry"
                    value={state.glowAsymmetry}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glowAsymmetry: value,
                      }))
                    }
                  />
                </section>

                <Separator
                  className={panelSection === "palette" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "palette" ? "space-y-2.5" : "hidden"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading
                      detail={`${state.paletteStops.length} positioned stops`}
                    >
                      Palette
                    </SectionHeading>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      title="Add color stop"
                      aria-label="Add color stop"
                      onClick={addPaletteStop}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={state.paletteInterpolation}
                      onValueChange={(value) => {
                        if (
                          value === "srgb" ||
                          value === "linear-rgb" ||
                          value === "oklab"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            paletteInterpolation: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Palette interpolation"
                      >
                        <SelectValue placeholder="Interpolation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="srgb">sRGB</SelectItem>
                        <SelectItem value="linear-rgb">linear RGB</SelectItem>
                        <SelectItem value="oklab">OKLab</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={state.paletteWrap}
                      onValueChange={(value) => {
                        if (
                          value === "clamp" ||
                          value === "repeat" ||
                          value === "mirror"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            paletteWrap: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Palette wrap">
                        <SelectValue placeholder="Wrap" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clamp">clamp</SelectItem>
                        <SelectItem value="repeat">repeat</SelectItem>
                        <SelectItem value="mirror">mirror</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.paletteReverse}
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          paletteReverse: checked === true,
                        }))
                      }
                    />
                    Reverse palette coordinate
                  </Label>

                  <div className="space-y-2">
                    {state.paletteStops.map((stop, index) => (
                      <div
                        key={stop.id}
                        className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2"
                      >
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                          <input
                            type="color"
                            value={stop.color}
                            aria-label={`Color stop ${index + 1}`}
                            className="size-7 cursor-pointer rounded border border-input bg-transparent"
                            onChange={(event) =>
                              setState((previous) => ({
                                ...previous,
                                paletteStops: previous.paletteStops.map(
                                  (candidate, candidateIndex) =>
                                    candidateIndex === index
                                      ? {
                                          ...candidate,
                                          color: event.target.value,
                                        }
                                      : candidate,
                                ),
                              }))
                            }
                          />
                          <Select
                            value={stop.easing ?? "linear"}
                            onValueChange={(value) => {
                              if (
                                value === "linear" ||
                                value === "smooth" ||
                                value === "hold"
                              ) {
                                setState((previous) => ({
                                  ...previous,
                                  paletteStops: previous.paletteStops.map(
                                    (candidate, candidateIndex) =>
                                      candidateIndex === index
                                        ? { ...candidate, easing: value }
                                        : candidate,
                                  ),
                                }));
                              }
                            }}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`Easing ${index + 1}`}
                            >
                              <SelectValue placeholder="Easing" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="linear">linear</SelectItem>
                              <SelectItem value="smooth">smooth</SelectItem>
                              <SelectItem value="hold">hold</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={state.paletteStops.length <= 1}
                            title={`Remove color stop ${index + 1}`}
                            aria-label={`Remove color stop ${index + 1}`}
                            onClick={() =>
                              setState((previous) => ({
                                ...previous,
                                paletteStops: previous.paletteStops.filter(
                                  (_candidate, candidateIndex) =>
                                    candidateIndex !== index,
                                ),
                              }))
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <NumberSlider
                          label="Offset"
                          value={
                            stop.offset ??
                            index / Math.max(state.paletteStops.length - 1, 1)
                          }
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              paletteStops: previous.paletteStops.map(
                                (candidate, candidateIndex) =>
                                  candidateIndex === index
                                    ? { ...candidate, offset: value }
                                    : candidate,
                              ),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <NumberSlider
                    label="Palette flow"
                    value={state.paletteSpeed}
                    min={-3}
                    max={3}
                    step={0.05}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        paletteSpeed: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Hue shift"
                    value={state.hue}
                    min={-180}
                    max={180}
                    step={1}
                    suffix="°"
                    onChange={(value) =>
                      setState((previous) => ({ ...previous, hue: value }))
                    }
                  />
                  <NumberSlider
                    label="Hue drift"
                    value={state.hueDrift}
                    min={-40}
                    max={40}
                    step={0.5}
                    suffix="°/s"
                    onChange={(value) =>
                      setState((previous) => ({ ...previous, hueDrift: value }))
                    }
                  />
                </section>

                <Separator
                  className={panelSection === "scene" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "scene" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="shared accumulation and global dots">
                    Scene & dots
                  </SectionHeading>
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.sceneMode}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            sceneMode: checked === true,
                            textMode:
                              checked === true ? false : previous.textMode,
                          }))
                        }
                      />
                      Multi-filament scene
                    </Label>
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.dotsEnabled}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            dotsEnabled: checked === true,
                          }))
                        }
                      />
                      Dots
                    </Label>
                  </div>
                  <Select
                    value={state.dotMode}
                    onValueChange={(value) => {
                      if (value !== "flat" && value !== "terrain") return;
                      setState((previous) => ({
                        ...previous,
                        dotMode: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Dot renderer"
                      disabled={!state.dotsEnabled}
                    >
                      <SelectValue placeholder="Dot renderer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat screen grid</SelectItem>
                      <SelectItem value="terrain">3D terrain waves</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="space-y-2.5 border-l border-border/70 pl-3">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.dotInteractionEnabled}
                        disabled={!state.dotsEnabled}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            dotInteractionEnabled: checked === true,
                          }))
                        }
                      />
                      Pointer interaction
                    </Label>
                    <NumberSlider
                      label="Interaction radius"
                      value={state.dotInteractionRadius}
                      min={20}
                      max={480}
                      step={2}
                      suffix="px"
                      disabled={
                        !state.dotsEnabled || !state.dotInteractionEnabled
                      }
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          dotInteractionRadius: value,
                        }))
                      }
                    />
                    <NumberSlider
                      label="Edge softness"
                      value={state.dotInteractionSoftness}
                      min={0.01}
                      max={1}
                      step={0.01}
                      disabled={
                        !state.dotsEnabled || !state.dotInteractionEnabled
                      }
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          dotInteractionSoftness: value,
                        }))
                      }
                    />
                    {state.dotMode === "terrain" ? (
                      <NumberSlider
                        label="Landscape displacement"
                        value={state.terrainPointerDisplacement}
                        min={-1.5}
                        max={1.5}
                        step={0.01}
                        disabled={
                          !state.dotsEnabled || !state.dotInteractionEnabled
                        }
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainPointerDisplacement: value,
                          }))
                        }
                      />
                    ) : (
                      <>
                        <NumberSlider
                          label="Brightness"
                          value={state.dotInteractionBrightness}
                          min={-1}
                          max={4}
                          step={0.02}
                          disabled={
                            !state.dotsEnabled || !state.dotInteractionEnabled
                          }
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              dotInteractionBrightness: value,
                            }))
                          }
                        />
                        <NumberSlider
                          label="Circular magnification"
                          value={state.dotInteractionMagnification}
                          min={0.35}
                          max={3}
                          step={0.01}
                          disabled={
                            !state.dotsEnabled || !state.dotInteractionEnabled
                          }
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              dotInteractionMagnification: value,
                            }))
                          }
                        />
                        <NumberSlider
                          label="Color strength"
                          value={state.dotInteractionColorStrength}
                          min={0}
                          max={1}
                          step={0.01}
                          disabled={
                            !state.dotsEnabled || !state.dotInteractionEnabled
                          }
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              dotInteractionColorStrength: value,
                            }))
                          }
                        />
                        <Label className="space-y-1 text-xs">
                          Interaction color
                          <Input
                            type="color"
                            value={state.dotInteractionColor}
                            disabled={
                              !state.dotsEnabled || !state.dotInteractionEnabled
                            }
                            onChange={(event) =>
                              setState((previous) => ({
                                ...previous,
                                dotInteractionColor: event.target.value,
                              }))
                            }
                          />
                        </Label>
                      </>
                    )}
                  </div>
                  {state.sceneMode ? (
                    <div className="space-y-3 border-l border-border/70 pl-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs">
                          Additional filaments {state.sceneFilaments.length}/5
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          title="Add filament"
                          aria-label="Add filament"
                          disabled={state.sceneFilaments.length >= 5}
                          onClick={addSceneFilament}
                        >
                          <Plus />
                        </Button>
                      </div>
                      {state.sceneFilaments.map((filament, index) => (
                        <div
                          key={filament.id}
                          className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Label className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={filament.enabled}
                                onCheckedChange={(checked) =>
                                  updateSceneFilament(index, {
                                    enabled: checked === true,
                                  })
                                }
                              />
                              Filament {index + 2}
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              title={`Remove filament ${index + 2}`}
                              aria-label={`Remove filament ${index + 2}`}
                              onClick={() => removeSceneFilament(index)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={filament.pathMode}
                              onValueChange={(value) => {
                                if (
                                  value === "sine" ||
                                  value === "organic" ||
                                  value === "custom" ||
                                  value === "svg" ||
                                  value === "follow"
                                ) {
                                  updateSceneFilament(index, {
                                    pathMode: value,
                                    closed:
                                      value === "svg" ? true : filament.closed,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Filament ${index + 2} path`}
                              >
                                <SelectValue placeholder="Path" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sine">sine</SelectItem>
                                <SelectItem value="organic">organic</SelectItem>
                                <SelectItem value="custom">custom</SelectItem>
                                <SelectItem value="svg">svg</SelectItem>
                                <SelectItem value="follow">follow</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={filament.quality}
                              onValueChange={(value) => {
                                if (
                                  value === "auto" ||
                                  value === "ultra" ||
                                  value === "high" ||
                                  value === "balanced" ||
                                  value === "low"
                                ) {
                                  updateSceneFilament(index, {
                                    quality: value,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Filament ${index + 2} quality`}
                              >
                                <SelectValue placeholder="Quality" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">auto</SelectItem>
                                <SelectItem value="ultra">ultra</SelectItem>
                                <SelectItem value="high">high</SelectItem>
                                <SelectItem value="balanced">
                                  balanced
                                </SelectItem>
                                <SelectItem value="low">low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={filament.motionMode}
                              onValueChange={(value) => {
                                if (
                                  value === "travel" ||
                                  value === "propagate" ||
                                  value === "anchored"
                                ) {
                                  updateSceneFilament(index, {
                                    motionMode: value,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Filament ${index + 2} motion`}
                              >
                                <SelectValue placeholder="Motion" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="travel">travel</SelectItem>
                                <SelectItem value="propagate">
                                  propagate
                                </SelectItem>
                                <SelectItem value="anchored">
                                  anchored
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={filament.materialPreset}
                              onValueChange={(value) => {
                                if (
                                  value === "soft-aurora" ||
                                  value === "mist" ||
                                  value === "neon" ||
                                  value === "plasma"
                                ) {
                                  updateSceneFilament(index, {
                                    materialPreset: value,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger
                                size="sm"
                                aria-label={`Filament ${index + 2} material`}
                              >
                                <SelectValue placeholder="Material" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="soft-aurora">
                                  soft aurora
                                </SelectItem>
                                <SelectItem value="mist">mist</SelectItem>
                                <SelectItem value="neon">neon</SelectItem>
                                <SelectItem value="plasma">plasma</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-2">
                            <Label className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={filament.closed}
                                disabled={
                                  filament.pathMode === "sine" ||
                                  filament.pathMode === "follow"
                                }
                                onCheckedChange={(checked) =>
                                  updateSceneFilament(index, {
                                    closed: checked === true,
                                  })
                                }
                              />
                              Closed
                            </Label>
                            <Label className="flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={filament.propagationEnabled}
                                onCheckedChange={(checked) =>
                                  updateSceneFilament(index, {
                                    propagationEnabled: checked === true,
                                  })
                                }
                              />
                              Propagation
                            </Label>
                          </div>
                          <NumberSlider
                            label="Seed offset"
                            value={filament.seedOffset}
                            min={0}
                            max={10_000}
                            step={1}
                            onChange={(value) =>
                              updateSceneFilament(index, { seedOffset: value })
                            }
                          />
                          <NumberSlider
                            label="Band Y"
                            value={filament.waveY}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { waveY: value })
                            }
                          />
                          <NumberSlider
                            label="Shape strength"
                            value={filament.shapeStrength}
                            min={0}
                            max={4}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                shapeStrength: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Shape scale"
                            value={filament.shapeScale}
                            min={0}
                            max={4}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { shapeScale: value })
                            }
                          />
                          <NumberSlider
                            label="Shape frequency"
                            value={filament.shapeFrequency}
                            min={0.05}
                            max={32}
                            step={0.05}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                shapeFrequency: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Time offset"
                            value={filament.timeOffset}
                            min={-10}
                            max={10}
                            step={0.05}
                            suffix="s"
                            onChange={(value) =>
                              updateSceneFilament(index, { timeOffset: value })
                            }
                          />
                          <NumberSlider
                            label="Playback rate"
                            value={filament.playbackRate}
                            min={-3}
                            max={3}
                            step={0.05}
                            suffix="×"
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                playbackRate: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Offset X"
                            value={filament.offsetX}
                            min={-1}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { offsetX: value })
                            }
                          />
                          <NumberSlider
                            label="Offset Y"
                            value={filament.offsetY}
                            min={-1}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { offsetY: value })
                            }
                          />
                          <NumberSlider
                            label="Scale X"
                            value={filament.scaleX}
                            min={0.1}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { scaleX: value })
                            }
                          />
                          <NumberSlider
                            label="Scale Y"
                            value={filament.scaleY}
                            min={0.1}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { scaleY: value })
                            }
                          />
                          <NumberSlider
                            label="Rotation"
                            value={filament.rotation}
                            min={-180}
                            max={180}
                            step={1}
                            suffix="°"
                            onChange={(value) =>
                              updateSceneFilament(index, { rotation: value })
                            }
                          />
                          <NumberSlider
                            label="Envelope travel"
                            value={filament.curveTravel}
                            min={-1}
                            max={1}
                            step={0.005}
                            onChange={(value) =>
                              updateSceneFilament(index, { curveTravel: value })
                            }
                          />
                          <NumberSlider
                            label="Shape morph"
                            value={filament.curveMotion}
                            min={0}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { curveMotion: value })
                            }
                          />
                          <NumberSlider
                            label="Filament length"
                            value={filament.segmentLength}
                            min={0.05}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                segmentLength: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Tail taper"
                            value={filament.tailTaper}
                            min={0.001}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { tailTaper: value })
                            }
                          />
                          <NumberSlider
                            label="Head taper"
                            value={filament.headTaper}
                            min={0.001}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { headTaper: value })
                            }
                          />
                          <NumberSlider
                            label="Profile width"
                            value={filament.profileWidth}
                            min={0.05}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                profileWidth: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Profile opacity"
                            value={filament.profileOpacity}
                            min={0}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                profileOpacity: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Profile glow"
                            value={filament.profileGlow}
                            min={0.05}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { profileGlow: value })
                            }
                          />
                          <NumberSlider
                            label="Profile reflection"
                            value={filament.profileReflection}
                            min={0}
                            max={2}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                profileReflection: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Intensity"
                            value={filament.intensity}
                            min={0}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { intensity: value })
                            }
                          />
                          <NumberSlider
                            label="Glow"
                            value={filament.glow}
                            min={0.05}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { glow: value })
                            }
                          />
                          <NumberSlider
                            label="Exposure"
                            value={filament.exposure}
                            min={0.1}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { exposure: value })
                            }
                          />
                          <NumberSlider
                            label="Saturation"
                            value={filament.saturation}
                            min={0}
                            max={3}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, { saturation: value })
                            }
                          />
                          <NumberSlider
                            label="Upper glow spread"
                            value={filament.upperGlowSpread}
                            min={0.05}
                            max={4}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                upperGlowSpread: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Lower glow spread"
                            value={filament.lowerGlowSpread}
                            min={0.05}
                            max={4}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                lowerGlowSpread: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Glow asymmetry"
                            value={filament.glowAsymmetry}
                            min={-1}
                            max={1}
                            step={0.01}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                glowAsymmetry: value,
                              })
                            }
                          />
                          <NumberSlider
                            label="Hue"
                            value={filament.hue}
                            min={-180}
                            max={180}
                            step={1}
                            suffix="°"
                            onChange={(value) =>
                              updateSceneFilament(index, { hue: value })
                            }
                          />
                          <NumberSlider
                            label="Palette flow"
                            value={filament.paletteSpeed}
                            min={-3}
                            max={3}
                            step={0.05}
                            onChange={(value) =>
                              updateSceneFilament(index, {
                                paletteSpeed: value,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Separator />
                  {state.dotMode === "terrain" ? (
                    <div className="space-y-2.5 border-l border-border/70 pl-3">
                      <div className="grid grid-cols-2 gap-2">
                        <NumberSlider
                          label={
                            state.terrainFit === "cover"
                              ? "Columns (automatic)"
                              : "Columns"
                          }
                          value={
                            state.terrainFit === "cover"
                              ? automaticTerrainColumns
                              : state.terrainColumns
                          }
                          min={16}
                          max={320}
                          step={1}
                          disabled={
                            !state.dotsEnabled || state.terrainFit === "cover"
                          }
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              terrainColumns: value,
                            }))
                          }
                        />
                        <NumberSlider
                          label="Rows"
                          value={state.terrainRows}
                          min={12}
                          max={180}
                          step={1}
                          disabled={!state.dotsEnabled}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              terrainRows: value,
                            }))
                          }
                        />
                      </div>
                      <NumberSlider
                        label="Terrain width"
                        value={state.terrainWidth}
                        min={2}
                        max={16}
                        step={0.1}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainWidth: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Terrain depth"
                        value={state.terrainDepth}
                        min={1}
                        max={14}
                        step={0.1}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainDepth: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Wave amplitude"
                        value={state.terrainAmplitude}
                        min={0}
                        max={1.5}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainAmplitude: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Wave frequency"
                        value={state.terrainFrequency}
                        min={0.1}
                        max={5}
                        step={0.05}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainFrequency: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Wave speed"
                        value={state.terrainSpeed}
                        min={-2}
                        max={2}
                        step={0.02}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainSpeed: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="View angle"
                        value={state.terrainViewAngle}
                        min={12}
                        max={82}
                        step={1}
                        suffix="°"
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainViewAngle: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Camera distance"
                        value={state.terrainCameraDistance}
                        min={1}
                        max={12}
                        step={0.05}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainCameraDistance: value,
                          }))
                        }
                      />
                      <Select
                        value={state.terrainFit ?? "fixed"}
                        onValueChange={(value) => {
                          if (value !== "fixed" && value !== "cover") return;
                          setState((previous) => ({
                            ...previous,
                            terrainFit: value,
                          }));
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label="Terrain framing"
                          disabled={!state.dotsEnabled}
                        >
                          <SelectValue placeholder="Terrain framing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed width</SelectItem>
                          <SelectItem value="cover">
                            Cover viewport (auto density)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <NumberSlider
                        label="Point size"
                        value={state.terrainPointSize}
                        min={0.5}
                        max={6}
                        step={0.05}
                        suffix="px"
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainPointSize: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Terrain opacity"
                        value={state.terrainOpacity}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainOpacity: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Twinkle"
                        value={state.twinkle}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            twinkle: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Surface reflection"
                        value={state.reflect}
                        min={0}
                        max={2}
                        step={0.02}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            reflect: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Geometry edge fade"
                        value={state.terrainEdgeFade}
                        min={0}
                        max={0.35}
                        step={0.005}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainEdgeFade: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Content clearance"
                        value={state.terrainContentFade}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            terrainContentFade: value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Label className="space-y-1 text-xs">
                          Low color
                          <Input
                            type="color"
                            value={state.terrainColorLow}
                            disabled={!state.dotsEnabled}
                            onChange={(event) =>
                              setState((previous) => ({
                                ...previous,
                                terrainColorLow: event.target.value,
                              }))
                            }
                          />
                        </Label>
                        <Label className="space-y-1 text-xs">
                          High color
                          <Input
                            type="color"
                            value={state.terrainColorHigh}
                            disabled={!state.dotsEnabled}
                            onChange={(event) =>
                              setState((previous) => ({
                                ...previous,
                                terrainColorHigh: event.target.value,
                              }))
                            }
                          />
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <NumberSlider
                        label="Dot spacing"
                        value={state.dotSpacing}
                        min={8}
                        max={64}
                        step={1}
                        suffix="px"
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            dotSpacing: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Dot opacity"
                        value={state.dotOpacity}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            dotOpacity: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Twinkle"
                        value={state.twinkle}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            twinkle: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Reflection"
                        value={state.reflect}
                        min={0}
                        max={2}
                        step={0.02}
                        disabled={!state.dotsEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            reflect: value,
                          }))
                        }
                      />
                    </>
                  )}
                  <NumberSlider
                    label="Mask feather"
                    value={state.maskFeather}
                    min={0.02}
                    max={1}
                    step={0.01}
                    disabled={!state.dotsEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        maskFeather: value,
                      }))
                    }
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      Masks {state.dotMasks.length}/{MAX_HERO_DOT_MASKS}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      title="Add dot mask"
                      aria-label="Add dot mask"
                      disabled={state.dotMasks.length >= MAX_HERO_DOT_MASKS}
                      onClick={addMask}
                    >
                      <Plus />
                    </Button>
                  </div>
                  {state.dotMasks.map((mask, index) => (
                    <div
                      key={mask.id}
                      className="space-y-2 rounded-lg border p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Mask {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          title={`Remove mask ${index + 1}`}
                          aria-label={`Remove mask ${index + 1}`}
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              dotMasks: previous.dotMasks.filter(
                                (_candidate, candidateIndex) =>
                                  candidateIndex !== index,
                              ),
                            }))
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      {(["x", "y", "radius", "feather"] as const).map((key) => (
                        <NumberSlider
                          key={key}
                          label={
                            key === "radius"
                              ? "Radius"
                              : key === "feather"
                                ? "Feather"
                                : key.toUpperCase()
                          }
                          value={mask[key] ?? state.maskFeather}
                          min={
                            key === "radius"
                              ? 0.05
                              : key === "feather"
                                ? 0.001
                                : 0
                          }
                          max={key === "radius" ? 1.5 : 1}
                          step={0.01}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              dotMasks: previous.dotMasks.map(
                                (candidate, candidateIndex) =>
                                  candidateIndex === index
                                    ? { ...candidate, [key]: value }
                                    : candidate,
                              ),
                            }))
                          }
                        />
                      ))}
                    </div>
                  ))}
                </section>

                <Separator
                  className={panelSection === "glass" ? undefined : "hidden"}
                />

                <section
                  className={
                    panelSection === "glass" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="same-canvas refractive post-process">
                    Glass text
                  </SectionHeading>
                  <Select
                    value={glassPreset}
                    onValueChange={(value) => {
                      if (value && value in GLASS_PRESETS) {
                        applyGlassPreset(value as GlassPresetId);
                      }
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Glass preset">
                      <SelectValue placeholder="Glass preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GLASS_PRESETS).map(([id, preset]) => (
                        <SelectItem key={id} value={id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom settings</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={state.glassTextEnabled}
                      onCheckedChange={(checked) =>
                        setState((previous) => ({
                          ...previous,
                          glassTextEnabled: checked === true,
                        }))
                      }
                    />
                    Refract the rendered scene through the mask
                  </Label>
                  <Select
                    value={state.glassShape ?? "text"}
                    onValueChange={(value) => {
                      if (value !== "text" && value !== "svg") return;
                      setState((previous) => ({
                        ...previous,
                        glassShape: value,
                      }));
                    }}
                  >
                    <SelectTrigger size="sm" aria-label="Glass mask shape">
                      <SelectValue placeholder="Glass shape" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text mask</SelectItem>
                      <SelectItem value="svg">SVG path mask</SelectItem>
                    </SelectContent>
                  </Select>
                  {(state.glassShape ?? "text") === "text" ? (
                    <Textarea
                      value={state.glassText}
                      rows={3}
                      disabled={!state.glassTextEnabled}
                      aria-label="Glass text"
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          glassText: event.target.value,
                        }))
                      }
                    />
                  ) : (
                    <>
                      <Input
                        type="file"
                        accept="image/svg+xml,.svg"
                        aria-label="Import glass SVG paths"
                        disabled={!state.glassTextEnabled}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void file.text().then((source) => {
                            const document = new DOMParser().parseFromString(
                              source,
                              "image/svg+xml",
                            );
                            const paths = Array.from(
                              document.querySelectorAll("path[d]"),
                            )
                              .map((path) => path.getAttribute("d")?.trim())
                              .filter((path): path is string => Boolean(path));
                            if (paths.length === 0) return;
                            const viewBox = document
                              .querySelector("svg")
                              ?.getAttribute("viewBox")
                              ?.trim()
                              .split(/[\s,]+/)
                              .map(Number);
                            setState((previous) => ({
                              ...previous,
                              glassSvgPath: paths.join(" "),
                              glassSvgViewBox:
                                viewBox?.length === 4 &&
                                viewBox.every(Number.isFinite)
                                  ? (viewBox as [
                                      number,
                                      number,
                                      number,
                                      number,
                                    ])
                                  : previous.glassSvgViewBox,
                            }));
                          });
                          event.currentTarget.value = "";
                        }}
                      />
                      <Textarea
                        value={state.glassSvgPath}
                        rows={5}
                        disabled={!state.glassTextEnabled}
                        aria-label="Glass SVG path"
                        onChange={(event) =>
                          setState((previous) => ({
                            ...previous,
                            glassSvgPath: event.target.value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {(["Min X", "Min Y", "Width", "Height"] as const).map(
                          (label, index) => (
                            <Input
                              key={label}
                              type="number"
                              value={state.glassSvgViewBox[index]}
                              aria-label={`Glass SVG ${label}`}
                              disabled={!state.glassTextEnabled}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                setState((previous) => {
                                  const viewBox = [
                                    ...previous.glassSvgViewBox,
                                  ] as [number, number, number, number];
                                  viewBox[index] = value;
                                  return {
                                    ...previous,
                                    glassSvgViewBox: viewBox,
                                  };
                                });
                              }}
                            />
                          ),
                        )}
                      </div>
                    </>
                  )}
                  <NumberSlider
                    label="Font size"
                    value={state.glassFontSize}
                    min={16}
                    max={240}
                    step={1}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassFontSize: value,
                      }))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberSlider
                      label="Center X"
                      value={state.glassCenterX}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      disabled={!state.glassTextEnabled}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          glassCenterX: value,
                        }))
                      }
                    />
                    <NumberSlider
                      label="Center Y"
                      value={state.glassCenterY}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      disabled={!state.glassTextEnabled}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          glassCenterY: value,
                        }))
                      }
                    />
                  </div>
                  <NumberSlider
                    label="Maximum width"
                    value={state.glassMaxWidth}
                    min={0.1}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassMaxWidth: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Maximum height"
                    value={state.glassMaxHeight}
                    min={0.1}
                    max={0.9}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassMaxHeight: value,
                      }))
                    }
                  />
                  <Select
                    value={state.glassSurfaceModel ?? "volumetric"}
                    onValueChange={(value) => {
                      if (value !== "simple" && value !== "volumetric") return;
                      setState((previous) => ({
                        ...previous,
                        glassSurfaceModel: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Glass surface model"
                      disabled={!state.glassTextEnabled}
                    >
                      <SelectValue placeholder="Glass surface" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple mask edge</SelectItem>
                      <SelectItem value="volumetric">
                        Volumetric glass
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {(state.glassSurfaceModel ?? "volumetric") ===
                  "volumetric" ? (
                    <>
                      <Select
                        value={state.glassBevelMode ?? "biconvex"}
                        onValueChange={(value) => {
                          if (value !== "biconvex" && value !== "dome") return;
                          setState((previous) => ({
                            ...previous,
                            glassBevelMode: value,
                          }));
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          aria-label="Glass volume"
                          disabled={!state.glassTextEnabled}
                        >
                          <SelectValue placeholder="Glass volume" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="biconvex">
                            Biconvex volume
                          </SelectItem>
                          <SelectItem value="dome">Dome volume</SelectItem>
                        </SelectContent>
                      </Select>
                      <NumberSlider
                        label="Surface depth"
                        value={state.glassSurfaceDepth}
                        min={2}
                        max={128}
                        step={1}
                        suffix="px"
                        disabled={!state.glassTextEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            glassSurfaceDepth: value,
                          }))
                        }
                      />
                      <NumberSlider
                        label="Index of refraction"
                        value={state.glassIor}
                        min={1.01}
                        max={2.2}
                        step={0.01}
                        disabled={!state.glassTextEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            glassIor: value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <NumberSlider
                          label="Magnification X"
                          value={state.glassMagnification}
                          min={0}
                          max={3}
                          step={0.02}
                          disabled={!state.glassTextEnabled}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              glassMagnification: value,
                            }))
                          }
                        />
                        <NumberSlider
                          label="Magnification Y"
                          value={state.glassMagnificationY}
                          min={0}
                          max={3}
                          step={0.02}
                          disabled={!state.glassTextEnabled}
                          onChange={(value) =>
                            setState((previous) => ({
                              ...previous,
                              glassMagnificationY: value,
                            }))
                          }
                        />
                      </div>
                      <NumberSlider
                        label="Internal light diffusion"
                        value={state.glassDiffusion}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={!state.glassTextEnabled}
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            glassDiffusion: value,
                          }))
                        }
                      />
                    </>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <NumberSlider
                      label="Sample offset X"
                      value={state.glassDisplacementX}
                      min={-128}
                      max={128}
                      step={1}
                      suffix="px"
                      disabled={!state.glassTextEnabled}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          glassDisplacementX: value,
                        }))
                      }
                    />
                    <NumberSlider
                      label="Sample offset Y"
                      value={state.glassDisplacementY}
                      min={-128}
                      max={128}
                      step={1}
                      suffix="px"
                      disabled={!state.glassTextEnabled}
                      onChange={(value) =>
                        setState((previous) => ({
                          ...previous,
                          glassDisplacementY: value,
                        }))
                      }
                    />
                  </div>
                  <NumberSlider
                    label="Refraction"
                    value={state.glassRefraction}
                    min={0}
                    max={64}
                    step={0.5}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassRefraction: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Edge color wrap"
                    value={state.glassEdgeWrap}
                    min={0}
                    max={160}
                    step={1}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassEdgeWrap: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Optical blur"
                    value={state.glassBlur}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassBlur: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Micro distortion"
                    value={state.glassDistortion}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassDistortion: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Chromatic split"
                    value={state.glassChromaticAberration}
                    min={0}
                    max={12}
                    step={0.1}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassChromaticAberration: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Frost"
                    value={state.glassFrost}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassFrost: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Roughness"
                    value={state.glassRoughness}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassRoughness: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Bevel"
                    value={state.glassBevel}
                    min={0}
                    max={4}
                    step={0.05}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassBevel: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Rib strength"
                    value={state.glassRibStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassRibStrength: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Rib width"
                    value={state.glassRibWidth}
                    min={2}
                    max={96}
                    step={1}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassRibWidth: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Rib angle"
                    value={state.glassRibAngle}
                    min={-180}
                    max={180}
                    step={1}
                    suffix="°"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassRibAngle: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Liquid distortion"
                    value={state.glassLiquidStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassLiquidStrength: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Liquid scale"
                    value={state.glassLiquidScale}
                    min={0.1}
                    max={12}
                    step={0.1}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassLiquidScale: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Liquid speed"
                    value={state.glassLiquidSpeed}
                    min={-2}
                    max={2}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassLiquidSpeed: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Edge strength"
                    value={state.glassEdgeStrength}
                    min={0}
                    max={2}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassEdgeStrength: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Specular"
                    value={state.glassSpecular}
                    min={0}
                    max={2}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassSpecular: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Fresnel"
                    value={state.glassFresnel}
                    min={0}
                    max={2}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassFresnel: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Twinkle"
                    value={state.glassTwinkle}
                    min={0}
                    max={4}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassTwinkle: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Twinkle density"
                    value={state.glassTwinkleDensity}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassTwinkleDensity: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Twinkle speed"
                    value={state.glassTwinkleSpeed}
                    min={0}
                    max={4}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassTwinkleSpeed: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Twinkle spacing"
                    value={state.glassTwinkleSize}
                    min={4}
                    max={96}
                    step={1}
                    suffix="px"
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassTwinkleSize: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Tint strength"
                    value={state.glassTintStrength}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassTintStrength: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Saturation"
                    value={state.glassSaturation}
                    min={-1}
                    max={2}
                    step={0.02}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassSaturation: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Brightness"
                    value={state.glassBrightness}
                    min={-0.5}
                    max={0.75}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassBrightness: value,
                      }))
                    }
                  />
                  <NumberSlider
                    label="Glass opacity"
                    value={state.glassOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={!state.glassTextEnabled}
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        glassOpacity: value,
                      }))
                    }
                  />
                  <Label className="space-y-1 text-xs">
                    Tint
                    <Input
                      type="color"
                      value={state.glassTint}
                      disabled={!state.glassTextEnabled}
                      onChange={(event) =>
                        setState((previous) => ({
                          ...previous,
                          glassTint: event.target.value,
                        }))
                      }
                    />
                  </Label>
                </section>

                <Separator
                  className={
                    panelSection === "lifecycle" ? undefined : "hidden"
                  }
                />

                <section
                  className={
                    panelSection === "lifecycle" ? "space-y-2.5" : "hidden"
                  }
                >
                  <SectionHeading detail="internal or deterministic clock">
                    Time & lifecycle
                  </SectionHeading>
                  <NumberSlider
                    label="Reveal fade"
                    value={state.fadeInDuration}
                    min={0}
                    max={3000}
                    step={25}
                    suffix="ms"
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        fadeInDuration: value,
                      }))
                    }
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Select
                      value={state.fadeCurvePreset}
                      onValueChange={(value) => {
                        if (
                          value === "linear" ||
                          value === "ease" ||
                          value === "ease-in" ||
                          value === "ease-out" ||
                          value === "ease-in-out" ||
                          value === "custom"
                        ) {
                          setState((previous) => ({
                            ...previous,
                            fadeCurvePreset: value,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger size="sm" aria-label="Reveal easing">
                        <SelectValue placeholder="Reveal easing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">linear</SelectItem>
                        <SelectItem value="ease">ease</SelectItem>
                        <SelectItem value="ease-in">ease in</SelectItem>
                        <SelectItem value="ease-out">ease out</SelectItem>
                        <SelectItem value="ease-in-out">ease in out</SelectItem>
                        <SelectItem value="custom">custom cubic</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title="Replay reveal"
                      aria-label="Replay reveal"
                      onClick={() => {
                        frameStatsRef.current = {
                          count: 0,
                          startedAt: 0,
                          lastFrameAt: 0,
                        };
                        setRendererFps(0);
                        setRenderEpoch((value) => value + 1);
                      }}
                    >
                      <RefreshCw />
                    </Button>
                  </div>
                  {state.fadeCurvePreset === "custom" ? (
                    <>
                      <NumberSlider
                        label="Cubic X1"
                        value={state.fadeCurve[0]}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => updateFadeCurve(0, value)}
                      />
                      <NumberSlider
                        label="Cubic Y1"
                        value={state.fadeCurve[1]}
                        min={-1}
                        max={2}
                        step={0.01}
                        onChange={(value) => updateFadeCurve(1, value)}
                      />
                      <NumberSlider
                        label="Cubic X2"
                        value={state.fadeCurve[2]}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => updateFadeCurve(2, value)}
                      />
                      <NumberSlider
                        label="Cubic Y2"
                        value={state.fadeCurve[3]}
                        min={-1}
                        max={2}
                        step={0.01}
                        onChange={(value) => updateFadeCurve(3, value)}
                      />
                    </>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Gauge className="size-3.5" /> Renderer FPS
                    </span>
                    <span className="font-mono text-foreground">
                      {rendererFps.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.paused}
                        onCheckedChange={(checked) => {
                          const paused = checked === true;
                          setState((previous) => ({ ...previous, paused }));
                          if (paused) waveRef.current?.pause();
                          else waveRef.current?.play();
                        }}
                      />
                      Pause
                    </Label>
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.controlledTime}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            controlledTime: checked === true,
                          }))
                        }
                      />
                      Controlled time
                    </Label>
                  </div>
                  <NumberSlider
                    label="Initial time"
                    value={state.initialTime}
                    min={-20}
                    max={20}
                    step={0.05}
                    suffix="s"
                    disabled={state.controlledTime}
                    onChange={(value) => {
                      setState((previous) => ({
                        ...previous,
                        initialTime: value,
                      }));
                      waveRef.current?.seek(value);
                    }}
                  />
                  {state.controlledTime ? (
                    <>
                      <NumberSlider
                        label="Timeline"
                        value={state.timelineTime}
                        min={0}
                        max={20}
                        step={0.01}
                        suffix="s"
                        onChange={(value) =>
                          setState((previous) => ({
                            ...previous,
                            timelineTime: value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              timelineTime: Math.max(
                                0,
                                previous.timelineTime - 1 / 30,
                              ),
                            }))
                          }
                        >
                          − 1 frame
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setState((previous) => ({
                              ...previous,
                              timelineTime: previous.timelineTime + 1 / 30,
                            }))
                          }
                        >
                          + 1 frame
                        </Button>
                      </div>
                    </>
                  ) : null}
                  <NumberSlider
                    label="Playback rate"
                    value={state.playbackRate}
                    min={-3}
                    max={3}
                    step={0.05}
                    suffix="×"
                    onChange={(value) =>
                      setState((previous) => ({
                        ...previous,
                        playbackRate: value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.respectReducedMotion}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            respectReducedMotion: checked === true,
                          }))
                        }
                      />
                      Reduced motion
                    </Label>
                    <Label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={state.pauseWhenOffscreen}
                        onCheckedChange={(checked) =>
                          setState((previous) => ({
                            ...previous,
                            pauseWhenOffscreen: checked === true,
                          }))
                        }
                      />
                      Pause offscreen
                    </Label>
                  </div>
                </section>

                <Separator />

                <div className="flex flex-wrap gap-x-3 gap-y-2">
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={showContent}
                      onCheckedChange={(checked) =>
                        setShowContent(checked === true)
                      }
                    />
                    Content
                  </Label>
                  <Label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={showMaskGuides}
                      onCheckedChange={(checked) =>
                        setShowMaskGuides(checked === true)
                      }
                    />
                    Visual mask editor
                  </Label>
                </div>

                <div className="grid grid-cols-4 gap-1 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Gauge className="size-3" /> quality
                  </span>
                  <span className="flex items-center gap-1">
                    <Palette className="size-3" /> palette
                  </span>
                  <span className="flex items-center gap-1">
                    <MousePointer2 className="size-3" /> follow
                  </span>
                  <span className="flex items-center gap-1">
                    <InfinityIcon className="size-3" /> scene
                  </span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        ) : null}
      </Collapsible>
    </div>
  );
}
