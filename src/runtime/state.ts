import type { FilamentDisturbanceImpulse } from "../interaction/filament-disturbance";
import type {
  CurveSample,
  FollowAnchor,
  PointerTrailSample,
} from "../geometry/path-sampling";
import {
  createPropagationScratch,
  type PropagationScratch,
} from "../geometry/propagation";
import type { HeroWaveFollowMode, HeroWavePaletteWrap } from "../types";
import {
  HERO_CASCADE_FOLLOW_POINT_COUNT,
  HERO_ECHO_FOLLOW_POINT_COUNT,
  HERO_FOLLOW_POINT_COUNT,
  HERO_POINTER_HISTORY_LIMIT,
  type Settings,
} from "../config/settings";

export function createFollowAnchors(count: number): FollowAnchor[] {
  return Array.from({ length: count }, () => ({ x: 0.5, top: 0.5 }));
}

export interface FilamentStyleTextures {
  palette: WebGLTexture;
  profiles: WebGLTexture;
  paletteHash: number;
  profileHash: number;
  settingsReference: Settings | null;
}

export interface FilamentGeometryState {
  id: string;
  baseKey: number;
  deformationKey: number;
  meshKey: number;
  meshRevision: number;
  disturbanceActive: boolean;
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
  disturbedSamples: CurveSample[];
  renderSamples: readonly CurveSample[];
  temporaryAnchors: FollowAnchor[];
  passSamples: [CurveSample[], CurveSample[], CurveSample[]];
  segmentData: [Float32Array, Float32Array, Float32Array];
  segmentCounts: [number, number, number];
  propagationScratch: PropagationScratch;
  closed: boolean;
}

export interface FilamentDisturbanceRuntime {
  impulses: FilamentDisturbanceImpulse[];
  lastTriggerTime: number;
  alternateSign: number;
}

export interface FollowRuntimeState {
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

export interface FollowRuntimeModifiers {
  width: number;
  glow: number;
  reflection: number;
  intensity: number;
  hueDegrees: number;
  visibility: number;
}

export interface PreparedFilamentFrame {
  settings: Settings;
  visualTime: number;
  geometry: FilamentGeometryState;
  followBlend: number;
  style: FilamentStyleTextures;
  modifiers: FollowRuntimeModifiers;
  segmentOffsets: [number, number, number];
}

export function createRuntimeModifiers(): FollowRuntimeModifiers {
  return {
    width: 1,
    glow: 1,
    reflection: 1,
    intensity: 1,
    hueDegrees: 0,
    visibility: 1,
  };
}

export function createFilamentGeometryState(id: string): FilamentGeometryState {
  return {
    id,
    baseKey: -1,
    deformationKey: -1,
    meshKey: -1,
    meshRevision: 0,
    disturbanceActive: false,
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
    disturbedSamples: [],
    renderSamples: [],
    temporaryAnchors: [],
    passSamples: [[], [], []],
    segmentData: [
      new Float32Array(0),
      new Float32Array(0),
      new Float32Array(0),
    ],
    segmentCounts: [0, 0, 0],
    propagationScratch: createPropagationScratch(),
    closed: false,
  };
}

export function createFollowRuntimeState(): FollowRuntimeState {
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

export function activeFilaments(settings: Settings) {
  return settings.filaments.length > 0
    ? settings.filaments.filter((filament) => filament.enabled)
    : settings.enabled
      ? [settings]
      : [];
}

export function shallowSettingsInputEqual(
  left: Record<string, unknown> | null,
  right: Record<string, unknown>,
) {
  if (!left) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of rightKeys) {
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
}

export function paletteWrapUniform(wrap: HeroWavePaletteWrap) {
  return wrap === "repeat" ? 1 : wrap === "mirror" ? 2 : 0;
}

export function ensureFloatCapacity(current: Float32Array, required: number) {
  if (current.length >= required) return current;
  let capacity = Math.max(256, current.length || 256);
  while (capacity < required) capacity *= 2;
  return new Float32Array(capacity);
}
