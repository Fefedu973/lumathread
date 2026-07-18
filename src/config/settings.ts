import {
  HERO_DEFAULT_PROPAGATION_DEFORMERS,
  MIN_HERO_TRAJECTORY_POINTS,
  type HeroWaveBackgroundImageConfig,
  type HeroWaveDotsConfig,
  type HeroWaveFadeEasing,
  type HeroWaveFilamentConfig,
  type HeroWaveGlassTextConfig,
  type HeroWaveInteractionConfig,
  type HeroWaveLongitudinalProfiles,
  type HeroWaveMaterialConfig,
  type HeroWaveMaterialInput,
  type HeroWaveMotionConfig,
  type HeroWaveMusicVisualizerConfig,
  type HeroWaveOrganicOptions,
  type HeroWavePaletteConfig,
  type HeroWavePathConfig,
  type HeroWavePathMode,
  type HeroWavePathTransform,
  type HeroWavePropagationOptions,
  type HeroWaveQualityConfig,
  type HeroWaveQualityPreset,
  type HeroWaveShapeConfig,
  type HeroWaveTheme,
} from "../types";
import { finite, finiteClamped } from "../math";
import type { ResolvedFilamentPointerConfig } from "../interaction/filament-disturbance";
import {
  resolveFadeEasingPoints,
  resolveFadeInEasing,
} from "../animation/easing";

import {
  HERO_MAX_FILAMENTS_WARNING,
  HERO_GLASS_SDF_RANGE_CSS_PX,
  type HeroWaveBackgroundCoreProps,
  INTERNAL_DEFAULTS,
} from "./defaults";

import {
  type ResolvedFollow,
  type ResolvedTerrainDots,
  type ResolvedDotInteraction,
  type ResolvedGlassText,
  type ResolvedBackgroundImage,
  type ResolvedMusicVisualizer,
  type Settings,
  resolveQuality,
  resolveMaterial,
  resolveProfileBounds,
  normalizeSvgViewBox,
} from "./resolved-settings";

export interface StructuredWaveConfig {
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

export interface ResolveSettingsOverrides {
  enabled?: boolean | undefined;
  timeOffset?: number | undefined;
  filamentPlaybackRate?: number | undefined;
}

export function resolveOneSettings(
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
  const filamentInteractionInput = input.interaction?.filament;

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
  const inheritedFilamentInteraction =
    inherited?.filamentInteraction ?? INTERNAL_DEFAULTS.filamentInteraction;
  const filamentInteraction: ResolvedFilamentPointerConfig = {
    enabled:
      filamentInteractionInput?.enabled ?? inheritedFilamentInteraction.enabled,
    target:
      filamentInteractionInput?.target ?? inheritedFilamentInteraction.target,
    pointerTypes:
      filamentInteractionInput?.pointerTypes ??
      inheritedFilamentInteraction.pointerTypes,
    radius: finiteClamped(
      filamentInteractionInput?.radius,
      inheritedFilamentInteraction.radius,
      4,
      1200,
    ),
    strength: finiteClamped(
      filamentInteractionInput?.strength,
      inheritedFilamentInteraction.strength,
      0,
      1,
    ),
    propagationSpeed: finiteClamped(
      filamentInteractionInput?.propagationSpeed,
      inheritedFilamentInteraction.propagationSpeed,
      0.01,
      16,
    ),
    frequency: finiteClamped(
      filamentInteractionInput?.frequency,
      inheritedFilamentInteraction.frequency,
      0.05,
      64,
    ),
    damping: finiteClamped(
      filamentInteractionInput?.damping,
      inheritedFilamentInteraction.damping,
      0,
      32,
    ),
    spatialDecay: finiteClamped(
      filamentInteractionInput?.spatialDecay,
      inheritedFilamentInteraction.spatialDecay,
      0,
      32,
    ),
    duration: finiteClamped(
      filamentInteractionInput?.duration,
      inheritedFilamentInteraction.duration,
      0.05,
      30,
    ),
    cooldown: finiteClamped(
      filamentInteractionInput?.cooldown,
      inheritedFilamentInteraction.cooldown,
      0,
      5,
    ),
    maxImpulses: Math.max(
      1,
      Math.min(
        32,
        Math.trunc(
          finite(
            filamentInteractionInput?.maxImpulses,
            inheritedFilamentInteraction.maxImpulses,
          ),
        ),
      ),
    ),
    direction:
      filamentInteractionInput?.direction ??
      inheritedFilamentInteraction.direction,
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
    textWrap: glassInput?.wrap ?? inheritedGlass.textWrap,
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
    filamentInteraction,
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
    settings.filamentInteraction.enabled ||
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

export function resolveFilamentSettings(
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

export const warnedDuplicateFilamentIds = new Set<string>();
export const warnedLargeFilamentScenes = new Set<number>();

export function resolveSettings(input: HeroWaveBackgroundCoreProps): Settings {
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

export * from "./defaults";
export * from "./resolved-settings";
