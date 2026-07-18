import { createLabDeformer } from "./factories";
import { INITIAL_STATE } from "./initial-state";
import type { LabPresetId, LabState } from "./types";

export const PRESET_LABELS: Record<LabPresetId, string> = {
  reference: "Reference structured",
  sampled: "Drawn sampled wave",
  noise: "Organic noise plasma",
  pulse: "Closed pulse loop",
  follow: "Cursor trail + ripple",
  svg: "Imported SVG neon",
  scene: "Shared HDR scene",
};

export const GLASS_PRESETS = {
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

export type GlassPresetId = keyof typeof GLASS_PRESETS;

export type GlassPresetSelection = GlassPresetId | "custom";

export function selectedGlassPreset(state: LabState): GlassPresetSelection {
  const stateRecord = state as unknown as Record<string, unknown>;
  for (const [id, preset] of Object.entries(GLASS_PRESETS)) {
    const matches = Object.entries(preset.values).every(
      ([key, value]) => stateRecord[key] === value,
    );
    if (matches) return id as GlassPresetId;
  }
  return "custom";
}

export function cloneInitialState(): LabState {
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
    glassIntroCurve: [...INITIAL_STATE.glassIntroCurve],
  };
}

export function stateForPreset(preset: LabPresetId): LabState {
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
