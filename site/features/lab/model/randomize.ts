import type {
  HeroWaveMaterialPreset,
  HeroWavePathMode,
} from "@/hero-wave-background";
import { LAB_MATERIAL_LAYERS } from "./constants";
import { createLabDeformer } from "./factories";
import { createRandomPathConfiguration } from "./path-editor";
import { hslToHex } from "./profiles";
import type {
  DeformerEnvelope,
  DeformerKind,
  FadeCurvePreset,
  LabDeformerState,
  LabState,
  ProfileKeyState,
  ProfilePreset,
} from "./types";

export type LabRandomSource = () => number;

function between(random: LabRandomSource, minimum: number, maximum: number) {
  return minimum + random() * (maximum - minimum);
}

function integer(random: LabRandomSource, minimum: number, maximum: number) {
  return Math.floor(between(random, minimum, maximum + 1));
}

function chance(random: LabRandomSource, probability = 0.5) {
  return random() < probability;
}

function pick<const Value>(
  random: LabRandomSource,
  values: readonly Value[],
): Value {
  return values[
    Math.min(values.length - 1, integer(random, 0, values.length - 1))
  ]!;
}

function randomColor(random: LabRandomSource, hue?: number) {
  return hslToHex(
    hue ?? between(random, 0, 360),
    between(random, 0.72, 0.98),
    between(random, 0.5, 0.68),
  );
}

function randomDeformer(
  random: LabRandomSource,
  index: number,
): LabDeformerState {
  const type = pick<DeformerKind>(random, [
    "harmonics",
    "sampled",
    "noise",
    "pulse",
  ]);
  const harmonicCount = integer(random, 1, 4);
  const sampledValues = Array.from({ length: integer(random, 5, 10) }, () =>
    between(random, -1, 1).toFixed(2),
  ).join(", ");

  return createLabDeformer(type, index, {
    id: `random-deformer-${index}-${integer(random, 1, 1_000_000)}`,
    enabled: chance(random, 0.88),
    amplitude: between(random, 0.006, 0.09),
    envelope: pick<DeformerEnvelope>(random, [
      "flat",
      "sin2",
      "smoothstep",
      "bell",
      "head",
      "tail",
    ]),
    direction: pick(random, ["normal", "tangent", "both", "x", "y"]),
    tangentAmount: between(random, -1.2, 1.2),
    harmonics: Array.from({ length: harmonicCount }, (_, harmonicIndex) => ({
      id: `random-harmonic-${index}-${harmonicIndex}`,
      amplitude: between(random, 0.08, 1),
      frequency: between(random, 0.35, 8),
      phase: between(random, -1, 1),
      phaseSpeed: between(random, -1.8, 1.8),
    })),
    sampledPattern: sampledValues,
    sampledFrequency: between(random, 0.5, 9),
    sampledPhase: between(random, -1, 1),
    sampledPhaseSpeed: between(random, -1.2, 1.2),
    sampledInterpolation: pick(random, ["linear", "smooth", "cubic"]),
    sampledWrap: pick(random, ["clamp", "repeat", "mirror"]),
    noiseSeed: integer(random, 1, 2_000_000_000),
    noiseFrequency: between(random, 0.5, 12),
    noisePhaseSpeed: between(random, -1.2, 1.2),
    noiseOctaves: integer(random, 1, 6),
    noiseLacunarity: between(random, 1.2, 3.2),
    noisePersistence: between(random, 0.2, 0.8),
    pulseWidth: between(random, 0.025, 0.3),
    pulsePhase: between(random, -1, 1),
    pulsePhaseSpeed: between(random, -1.2, 1.2),
    pulseCount: integer(random, 1, 6),
    pulseShape: pick(random, ["gaussian", "smooth", "triangle"]),
  });
}

function randomProfileKeys(random: LabRandomSource): ProfileKeyState[] {
  const count = integer(random, 3, 6);
  return Array.from({ length: count }, (_, index) => {
    const edge = index === 0 || index === count - 1;
    const position = index / (count - 1);
    return {
      id: `random-profile-${index}-${integer(random, 1, 1_000_000)}`,
      position,
      width: edge ? between(random, 0.05, 0.55) : between(random, 0.45, 1.6),
      opacity: edge ? between(random, 0, 0.5) : between(random, 0.55, 1.35),
      intensity: edge
        ? between(random, 0.05, 0.7)
        : between(random, 0.55, 1.75),
      glow: edge ? between(random, 0.15, 0.8) : between(random, 0.65, 1.9),
      upperGlowSpread: between(random, 0.45, 1.8),
      lowerGlowSpread: between(random, 0.45, 1.8),
      reflection: between(random, 0, 1.5),
      colorPosition: between(random, -0.2, 0.2),
    };
  });
}

/**
 * Randomize every visual domain while preserving environment-dependent inputs
 * (theme, GPU quality and uploaded media). Keeping those stable prevents the
 * toolbar action from unexpectedly changing performance or losing user data.
 */
export function randomizeLabState(
  previous: LabState,
  random: LabRandomSource = Math.random,
): LabState {
  const randomPath = createRandomPathConfiguration(random);
  const pathMode = pick<HeroWavePathMode>(random, [
    "sine",
    "organic",
    "custom",
    "svg",
    "follow",
  ]);
  const textMode = pathMode === "custom" && chance(random, 0.12);
  const materialPreset = pick<HeroWaveMaterialPreset>(random, [
    "soft-aurora",
    "mist",
    "neon",
    "plasma",
  ]);
  const layers = LAB_MATERIAL_LAYERS[materialPreset];
  const profilePreset = pick<ProfilePreset>(random, [
    "flat",
    "comet",
    "center-glow",
    "segmented",
  ]);
  const paletteCount = integer(random, 3, 6);
  const paletteHue = between(random, 0, 360);
  const dotMode = pick(random, ["flat", "terrain"]);
  const glassEnabled = chance(random, 0.24);
  const closed =
    (pathMode === "custom" || pathMode === "svg") &&
    !textMode &&
    chance(random, 0.28);
  const tailTaper = between(random, 0, 0.38);
  const headTaper = between(random, 0, Math.max(0.08, 0.72 - tailTaper));
  const deformerCount = integer(random, 1, 3);
  const profileSource = chance(random, 0.42) ? "custom" : "preset";
  const fadeCurvePreset = pick<FadeCurvePreset>(random, [
    "linear",
    "ease",
    "ease-in",
    "ease-out",
    "ease-in-out",
    "custom",
  ]);
  const glassCurvePreset = pick<FadeCurvePreset>(random, [
    "linear",
    "ease",
    "ease-in",
    "ease-out",
    "ease-in-out",
    "custom",
  ]);

  return {
    ...previous,
    textMode,
    textHeight: between(random, 0.18, 0.48),
    textLetterSpacing: between(random, 0.02, 0.42),
    textY: between(random, 0.3, 0.7),
    textHueSpread: between(random, -45, 45),
    textStagger: between(random, 0, 0.22),
    pathMode,
    interpolation: pick(random, [
      "linear",
      "catmull-rom",
      "centripetal-catmull-rom",
      "bezier",
    ]),
    pathTension: between(random, -0.75, 0.75),
    closed,
    closedLoopTaper: closed ? chance(random) : previous.closedLoopTaper,
    ...randomPath,
    transform: {
      x: between(random, -0.12, 0.12),
      y: between(random, -0.12, 0.12),
      scaleX: between(random, 0.72, 1.28),
      scaleY: between(random, 0.72, 1.28),
      rotation: between(random, -18, 18),
      anchorX: between(random, 0.35, 0.65),
      anchorY: between(random, 0.35, 0.65),
    },
    shape: {
      ...randomPath.shape,
      strength: between(random, 0.65, 1.35),
    },
    motion: {
      mode: pick(random, ["travel", "propagate", "anchored"]),
      curveTravel: between(random, -0.18, 0.18),
      pathDrift: between(random, -0.5, 0.5),
      curveMotion: between(random, 0, 1.4),
      segmentLength: between(random, 0.35, 1.3),
      tailTaper,
      headTaper,
      speed: between(random, 0.25, 1.8),
    },
    propagationEnabled: chance(random, 0.78),
    propagationPhaseOffset: between(random, -1, 1),
    propagationPhaseSpeed: between(random, -1.4, 1.4),
    propagationDeformers: Array.from({ length: deformerCount }, (_, index) =>
      randomDeformer(random, index),
    ),
    propagationDomain: pick(random, ["arcLength", "travelTime"]),
    propagationCombine: pick(random, ["add", "max", "multiply"]),
    propagationStage: pick(random, ["before-follow", "after-follow"]),
    recomputeArcLength: chance(random, 0.35),
    profilePreset,
    profileSource,
    profileKeys: randomProfileKeys(random),
    profileInterpolation: pick(random, ["linear", "smooth", "cubic"]),
    profileWrap: pick(random, ["clamp", "repeat", "mirror"]),
    profileStrength: between(random, 0.5, 1.65),
    profileWidth: between(random, 0.45, 1.55),
    profileOpacity: between(random, 0.5, 1.2),
    profileIntensity: between(random, 0.45, 1.65),
    profileGlow: between(random, 0.45, 1.8),
    profileUpperGlowSpread: between(random, 0.45, 1.8),
    profileLowerGlowSpread: between(random, 0.45, 1.8),
    profileReflection: between(random, 0, 1.6),
    profileColorPosition: between(random, -0.25, 0.25),
    materialPreset,
    materialAdvanced: chance(random, 0.42),
    materialAtmosphere: layers.atmosphere * between(random, 0.45, 1.8),
    materialBroad: layers.broad * between(random, 0.45, 1.8),
    materialBody: layers.body * between(random, 0.45, 1.8),
    materialRidge: layers.ridge * between(random, 0.45, 1.8),
    materialCore: layers.core * between(random, 0.45, 1.8),
    materialVeil: layers.veil * between(random, 0.45, 1.8),
    materialIntensity: between(random, 0.52, 1.35),
    materialGlow: between(random, 0.55, 1.75),
    materialExposure: between(random, 0.7, 1.3),
    materialSaturation: between(random, 0.55, 1.45),
    upperGlowSpread: between(random, 0.55, 1.65),
    lowerGlowSpread: between(random, 0.55, 1.65),
    glowAsymmetry: between(random, 0.35, 1.8),
    paletteStops: Array.from({ length: paletteCount }, (_, index) => ({
      id: `random-palette-${index}-${integer(random, 1, 1_000_000)}`,
      color: randomColor(random, paletteHue + index * between(random, 28, 84)),
      offset: index / (paletteCount - 1),
      easing:
        index === paletteCount - 1
          ? "linear"
          : pick(random, ["linear", "smooth", "hold"]),
    })),
    paletteInterpolation: pick(random, ["srgb", "linear-rgb", "oklab"]),
    paletteWrap: pick(random, ["clamp", "repeat", "mirror"]),
    paletteReverse: chance(random),
    paletteSpeed: between(random, -1.8, 1.8),
    hue: between(random, -180, 180),
    hueDrift: between(random, -45, 45),
    followMode: pick(random, ["hybrid", "cascade", "echo"]),
    followActivation:
      pathMode === "follow"
        ? "path-mode"
        : pick(random, ["path-mode", "canvas", "viewport"]),
    followTransitionDuration: between(random, 0.1, 1.4),
    followTarget: pick(random, ["window", "canvas"]),
    followPointerMouse: true,
    followPointerPen: chance(random, 0.72),
    followPointerTouch: chance(random, 0.72),
    followExternalEnabled: false,
    followExternalX: between(random, 0.1, 0.9),
    followExternalY: between(random, 0.1, 0.9),
    followLeaveBehavior: pick(random, ["freeze", "collapse", "idle", "fade"]),
    followHeadResponse: between(random, 0.2, 1),
    followMemorySeconds: between(random, 0.2, 3.2),
    followStationaryBehavior: pick(random, ["freeze", "collapse"]),
    followStationaryCollapseDuration: between(random, 0.25, 5),
    followLengthCssPx: between(random, 420, 3200),
    followViscosity: between(random, 0, 1),
    followCascadeLag: between(random, 0, 1),
    followFadeDuration: between(random, 0.1, 2.5),
    followIdleDelay: between(random, 0, 1.8),
    followIdleRadiusX: between(random, 30, 360),
    followIdleRadiusY: between(random, 20, 260),
    followIdleSpeedX: between(random, -2.2, 2.2),
    followIdleSpeedY: between(random, -2.2, 2.2),
    followVelocityIntensity: between(random, -0.3, 0.45),
    followVelocityWidth: between(random, -0.25, 0.4),
    followVelocityGlow: between(random, -0.3, 0.5),
    followVelocityHue: between(random, -80, 80),
    followVelocityReflection: between(random, -0.3, 0.5),
    followVelocityResponse: between(random, 2, 28),
    followMaxVelocityCssPx: between(random, 600, 3200),
    filamentInteractionEnabled: chance(random, 0.58),
    filamentInteractionTarget: pick(random, ["canvas", "viewport"]),
    filamentInteractionMouse: true,
    filamentInteractionPen: chance(random, 0.72),
    filamentInteractionTouch: chance(random, 0.72),
    filamentInteractionRadius: between(random, 30, 220),
    filamentInteractionStrength: between(random, -0.12, 0.12),
    filamentInteractionPropagationSpeed: between(random, 0.15, 2),
    filamentInteractionFrequency: between(random, 0.5, 8),
    filamentInteractionDamping: between(random, 0.4, 5),
    filamentInteractionSpatialDecay: between(random, 0.2, 2),
    filamentInteractionDuration: between(random, 0.4, 5),
    filamentInteractionCooldown: between(random, 0.02, 0.4),
    filamentInteractionMaxImpulses: integer(random, 2, 16),
    filamentInteractionDirection: pick(random, ["push", "pull", "alternate"]),
    dotsEnabled: chance(random, 0.88),
    dotMode,
    dotSpacing: between(random, 14, 48),
    dotOpacity: between(random, 0.12, 0.72),
    twinkle: between(random, 0, 1),
    reflect: between(random, 0, 1.4),
    dotInteractionEnabled: chance(random, 0.62),
    dotInteractionRadius: between(random, 50, 360),
    dotInteractionSoftness: between(random, 0.08, 1),
    dotInteractionBrightness: between(random, -0.3, 2.4),
    dotInteractionColor: randomColor(random),
    dotInteractionColorStrength: between(random, 0, 1),
    dotInteractionMagnification: between(random, 0.65, 2.2),
    terrainPointerDisplacement: between(random, -1.1, 1.1),
    maskFeather: between(random, 0.15, 0.9),
    dotMasks: Array.from({ length: integer(random, 1, 4) }, (_, index) => ({
      id: `random-mask-${index}-${integer(random, 1, 1_000_000)}`,
      x: between(random, 0.08, 0.92),
      y: between(random, 0.08, 0.92),
      radius: between(random, 0.18, 0.9),
      feather: between(random, 0.15, 0.95),
    })),
    terrainColumns: integer(random, 56, 180),
    terrainRows: integer(random, 36, 120),
    terrainWidth: between(random, 4, 11),
    terrainDepth: between(random, 3.5, 10),
    terrainAmplitude: between(random, 0.08, 1.15),
    terrainPointSize: between(random, 1, 4.2),
    terrainSpeed: between(random, -0.8, 1.1),
    terrainViewAngle: between(random, 20, 75),
    terrainCameraDistance: between(random, 1.7, 6.5),
    terrainFrequency: between(random, 0.45, 4.5),
    terrainOpacity: between(random, 0.18, 0.9),
    terrainEdgeFade: between(random, 0.05, 0.55),
    terrainFit: pick(random, ["fixed", "cover"]),
    terrainContentFade: between(random, 0.08, 0.85),
    terrainColorLow: randomColor(random),
    terrainColorHigh: randomColor(random),
    backgroundImageFit: pick(random, ["cover", "contain", "stretch"]),
    backgroundImageOpacity: between(random, 0.25, 1),
    musicVisualizerEnabled:
      previous.musicAudioSrc.length > 0 && chance(random, 0.5),
    musicFftSize: pick(random, [256, 512, 1024, 2048]),
    musicSmoothing: between(random, 0.2, 0.95),
    musicSensitivity: between(random, 0.45, 2.2),
    musicBand: pick(random, ["energy", "bass", "mid", "treble"]),
    musicDeformation: between(random, 0, 0.12),
    musicDeformationFrequency: between(random, 0.5, 9),
    musicWidth: between(random, -0.35, 0.55),
    musicIntensity: between(random, -0.4, 0.8),
    musicGlow: between(random, -0.4, 0.9),
    musicHue: between(random, -90, 90),
    musicReflection: between(random, -0.4, 0.9),
    glassTextEnabled: glassEnabled,
    glassShape: pick(random, ["text", "svg"]),
    glassDomTargetEnabled: false,
    glassFontSize: between(random, 48, 240),
    glassCenterX: between(random, 22, 78),
    glassCenterY: between(random, 22, 78),
    glassMaxWidth: between(random, 0.35, 0.9),
    glassMaxHeight: between(random, 0.2, 0.72),
    glassRefraction: between(random, 4, 72),
    glassEdgeWrap: between(random, 0, 64),
    glassSurfaceModel: pick(random, ["simple", "volumetric"]),
    glassBevelMode: pick(random, ["biconvex", "dome"]),
    glassSurfaceDepth: between(random, 4, 52),
    glassIor: between(random, 1.05, 1.75),
    glassMagnification: between(random, 0.65, 1.8),
    glassMagnificationY: between(random, 0.65, 1.8),
    glassDisplacementX: between(random, -30, 30),
    glassDisplacementY: between(random, -30, 30),
    glassDiffusion: between(random, 0, 1),
    glassBlur: between(random, 0, 1),
    glassDistortion: between(random, 0, 0.35),
    glassChromaticAberration: between(random, 0, 14),
    glassFrost: between(random, 0, 1),
    glassRoughness: between(random, 0, 1),
    glassBevel: between(random, 0, 5),
    glassRibStrength: between(random, 0, 1),
    glassRibWidth: between(random, 4, 96),
    glassRibAngle: between(random, -180, 180),
    glassLiquidStrength: between(random, 0, 0.55),
    glassLiquidScale: between(random, 0.8, 14),
    glassLiquidSpeed: between(random, -1.2, 1.2),
    glassEdgeStrength: between(random, 0, 1.6),
    glassSpecular: between(random, 0, 1.6),
    glassFresnel: between(random, 0, 1.4),
    glassTwinkle: between(random, 0, 1),
    glassTwinkleDensity: between(random, 0.05, 0.8),
    glassTwinkleSpeed: between(random, 0.1, 2.5),
    glassTwinkleSize: between(random, 6, 64),
    glassTint: randomColor(random),
    glassTintStrength: between(random, 0, 0.45),
    glassSaturation: between(random, 0.35, 1.8),
    glassBrightness: between(random, -0.25, 0.4),
    glassOpacity: between(random, 0.45, 1),
    glassIntroDelay: integer(random, 0, 450),
    glassIntroDuration: integer(random, 250, 1600),
    glassIntroBlur: between(random, 0, 32),
    glassIntroOffsetY: between(random, -36, 36),
    glassIntroCurvePreset: glassCurvePreset,
    glassIntroCurve: [
      between(random, 0, 0.4),
      between(random, 0, 1),
      between(random, 0.6, 1),
      between(random, 0, 1),
    ],
    fadeInDuration: integer(random, 180, 1800),
    fadeCurvePreset,
    fadeCurve: [
      between(random, 0, 0.4),
      between(random, 0, 1),
      between(random, 0.6, 1),
      between(random, 0, 1),
    ],
    fadeInAffectsGlassText: chance(random, 0.5),
    paused: false,
    controlledTime: false,
    initialTime: between(random, 0, 8),
    timelineTime: between(random, 0, 12),
    playbackRate: between(random, 0.35, 1.8),
  };
}
