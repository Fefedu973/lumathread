import type {
  HeroWaveBackgroundProps,
  HeroWaveDeformer,
  HeroWaveFadeEasing,
  HeroWaveFilamentConfig,
} from "@/hero-wave-background";
import { INITIAL_STATE } from "./initial-state";
import { buildProfiles, parseSampledPattern } from "./profiles";
import type { FilamentLabState, LabDeformerState, LabState } from "./types";

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

type FilamentProps = Omit<
  HeroWaveFilamentConfig,
  "id" | "enabled" | "timeOffset" | "playbackRate"
>;

export function buildFilamentProps(state: FilamentLabState): FilamentProps {
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
  return {
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
    quality: state.qualityAdvanced
      ? { preset: state.quality, ...state.qualityConfig }
      : state.quality,
  };
}

export function buildBackgroundProps(state: LabState): HeroWaveBackgroundProps {
  const fadeInEasing: HeroWaveFadeEasing =
    state.fadeCurvePreset === "custom"
      ? state.fadeCurve
      : state.fadeCurvePreset;
  const glassIntroEasing: HeroWaveFadeEasing =
    state.glassIntroCurvePreset === "custom"
      ? state.glassIntroCurve
      : state.glassIntroCurvePreset;

  const props: HeroWaveBackgroundProps = {
    theme: state.theme,
    ...buildFilamentProps(state),
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
      dom: state.glassDomTargetEnabled
        ? {
            target: "#lumathread-lab-glass-target",
            syncContent: state.glassDomSyncContent,
            syncTypography: state.glassDomSyncTypography,
            padding: {
              x: state.glassDomPaddingX,
              y: state.glassDomPaddingY,
            },
          }
        : undefined,
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
      intro: {
        delay: state.glassIntroDelay,
        duration: state.glassIntroDuration,
        blur: state.glassIntroBlur,
        offsetY: state.glassIntroOffsetY,
        easing: glassIntroEasing,
      },
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
    fadeInDuration: state.fadeInDuration,
    fadeInEasing,
    fadeInAffectsGlassText: state.fadeInAffectsGlassText,
    paused: state.paused,
    initialTime: state.initialTime,
    playbackRate: state.playbackRate,
    respectReducedMotion: state.respectReducedMotion,
    pauseWhenOffscreen: state.pauseWhenOffscreen,
    ...(state.controlledTime ? { time: state.timelineTime } : {}),
  };
  return props;
}

export function buildSceneFilaments(state: LabState): HeroWaveFilamentConfig[] {
  return [
    {
      id: "primary",
      enabled: state.primaryFilamentEnabled,
      timeOffset: state.primaryFilamentTimeOffset,
      playbackRate: state.primaryFilamentPlaybackRate,
      ...buildFilamentProps(state),
    },
    ...state.sceneFilaments.map((filament) => ({
      id: filament.id,
      enabled: filament.enabled,
      timeOffset: filament.timeOffset,
      playbackRate: filament.playbackRate,
      ...buildFilamentProps(filament.settings),
    })),
  ];
}
