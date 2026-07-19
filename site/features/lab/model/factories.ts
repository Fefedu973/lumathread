import type {
  DeformerKind,
  FilamentLabState,
  LabDeformerState,
  SceneFilamentState,
} from "./types";
import { cloneFilamentState } from "./filament-state";

export function createSceneFilament(
  index: number,
  source: FilamentLabState,
  overrides: Partial<Omit<SceneFilamentState, "settings">> & {
    settings?: Partial<FilamentLabState>;
  } = {},
): SceneFilamentState {
  const { settings: settingsOverrides, ...metadataOverrides } = overrides;
  const base = cloneFilamentState(source);
  const settings: FilamentLabState = {
    ...base,
    pathMode: "organic",
    closed: false,
    organic: {
      ...base.organic,
      seed: base.organic.seed + 819 + index * 977,
      pointCount: Math.max(8, base.organic.pointCount + index * 2),
    },
    transform: {
      ...base.transform,
      x: 0,
      y: 0.08 + index * 0.04,
      scaleX: 1.02,
      scaleY: Math.max(0.42, 0.66 - index * 0.08),
      rotation: -3 + index * 4,
    },
    shape: {
      ...base.shape,
      waveY: 0.68,
      strength: 1,
      scale: 0.62,
      frequency: 1.4,
    },
    motion: {
      ...base.motion,
      mode: "anchored",
      curveTravel: 0.025,
      curveMotion: 0.28,
      segmentLength: 1.08,
      tailTaper: 0.4,
      headTaper: 0.3,
    },
    propagationEnabled: true,
    profileWidth: 0.78,
    profileOpacity: 0.72,
    profileIntensity: 0.72,
    profileGlow: 1.35,
    profileReflection: 0.55,
    materialPreset: "mist",
    materialIntensity: 0.44,
    materialGlow: 1.45,
    materialExposure: 0.94,
    materialSaturation: 0.82,
    upperGlowSpread: 1,
    lowerGlowSpread: 1,
    glowAsymmetry: 1,
    hue: index * 18,
    paletteSpeed: 0.32,
    quality: "high",
    ...settingsOverrides,
  };

  return {
    id: `scene-filament-${index + 1}`,
    enabled: true,
    timeOffset: 1.3 + index * 0.8,
    playbackRate: 0.72 - index * 0.08,
    settings,
    ...metadataOverrides,
  };
}

export function createLabDeformer(
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
