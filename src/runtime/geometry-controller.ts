import type { HeroWaveCustomDeformer } from "../types";

import { createHeroOrganicTrajectory } from "../trajectory";
import { clamp } from "../math";
import {
  applyFilamentDisturbances,
  pruneFilamentDisturbanceImpulses,
} from "../interaction/filament-disturbance";

import {
  HERO_PATH_ENDPOINT_FEATHER_CSS_PX,
  HERO_PATH_SEGMENT_STRIDE,
  HERO_PATH_PASS_FAR,
  HERO_PATH_PASS_MID,
  HERO_PATH_PASS_COUNT,
  normalizeTrajectoryPoints,
  type Settings,
} from "../config/settings";

import {
  hashMix,
  hashFloat,
  hashString,
  hashTrajectory,
  hashUnknown,
} from "../runtime/cache-keys";

import {
  type CurveSample,
  type FollowAnchor,
  recomputePathProgress,
  blendCurveSamplePaths,
  buildAdaptivePathSamples,
  buildAdaptiveSinePathSamples,
  buildSvgPathSamples,
  buildAdaptiveFollowPathSamples,
} from "../geometry/path-sampling";

import {
  propagationIsDynamic,
  buildPropagatedPathSamples,
} from "../geometry/propagation";

import {
  simplifyPathSamplesForPass,
  buildIntegralSegmentData,
} from "../geometry/integral-geometry";

import {
  type FilamentGeometryState,
  type FilamentDisturbanceRuntime,
  type FollowRuntimeState,
  ensureFloatCapacity,
} from "../runtime/state";

export interface GeometryControllerOptions {
  getCanvasWidth: () => number;
  getCanvasHeight: () => number;
  getSizeRevision: () => number;
  getDpr: () => number;
  getInteractionTime: () => number;
  reportDeformerError: (error: Error, deformer: HeroWaveCustomDeformer) => void;
  updateFollowRuntime: (
    settings: Settings,
    frameDelta: number,
    currentTime: number,
  ) => { state: FollowRuntimeState; anchors: readonly FollowAnchor[] };
  nowSeconds: () => number;
  hasConditionalFollow: (settings: Settings) => boolean;
  getFollowState: (id: string) => FollowRuntimeState;
  followSourceIsActive: (settings: Settings) => boolean;
  getGeometryState: (id: string) => FilamentGeometryState;
  disturbanceStates: Map<string, FilamentDisturbanceRuntime>;
  musicDeformation: (settings: Settings) => number;
}

export function createGeometryController({
  getCanvasWidth,
  getCanvasHeight,
  getSizeRevision,
  getDpr,
  getInteractionTime,
  reportDeformerError,
  updateFollowRuntime,
  nowSeconds,
  hasConditionalFollow,
  getFollowState,
  followSourceIsActive,
  getGeometryState,
  disturbanceStates,
  musicDeformation,
}: GeometryControllerOptions) {
  const sourceGeometryKey = (settings: Settings) => {
    let hash = hashString(2_166_136_261, settings.pathMode);
    hash = hashMix(hash, getCanvasWidth());
    hash = hashMix(hash, getCanvasHeight());
    hash = hashTrajectory(settings.trajectoryPoints) ^ hash;
    hash = hashUnknown(settings.organic, hash);
    hash = hashString(hash, settings.svgPath);
    hash = hashUnknown(settings.svgViewBox, hash);
    hash = hashUnknown(settings.pathTransform, hash);
    hash = hashString(hash, settings.trajectoryInterpolation);
    hash = hashFloat(hash, settings.trajectoryTension);
    hash = hashMix(hash, settings.trajectoryClosed ? 1 : 0);
    hash = hashFloat(hash, settings.waveY);
    hash = hashFloat(hash, settings.curveStrength);
    hash = hashFloat(hash, settings.curveScale);
    hash = hashFloat(hash, settings.curveFrequency);
    hash = hashFloat(hash, settings.curveMotion);
    hash = hashUnknown(settings.quality, hash);
    return hash >>> 0;
  };

  const buildBeforeFollowDeformation = (
    settings: Settings,
    anchors: readonly FollowAnchor[],
    localTime: number,
    state: FilamentGeometryState,
  ) => {
    state.temporarySamples.length = anchors.length;
    for (let index = 0; index < anchors.length; index++) {
      const anchor = anchors[index]!;
      const sample = state.temporarySamples[index] ?? {
        x: 0,
        y: 0,
        speed: 1,
        progress: 0,
        arcProgress: 0,
      };
      sample.x = anchor.x;
      sample.y = 1 - anchor.top;
      sample.speed = 1;
      sample.progress = 0;
      sample.arcProgress = 0;
      state.temporarySamples[index] = sample;
    }
    recomputePathProgress(
      state.temporarySamples,
      getCanvasWidth(),
      getCanvasHeight(),
      false,
    );
    buildPropagatedPathSamples(
      state.temporarySamples,
      false,
      getCanvasWidth(),
      getCanvasHeight(),
      localTime,
      settings,
      state.propagatedSamples,
      reportDeformerError,
    );
    state.temporaryAnchors.length = state.propagatedSamples.length;
    for (let index = 0; index < state.propagatedSamples.length; index++) {
      const sample = state.propagatedSamples[index]!;
      const anchor = state.temporaryAnchors[index] ?? { x: 0, top: 0 };
      anchor.x = sample.x;
      anchor.top = 1 - sample.y;
      state.temporaryAnchors[index] = anchor;
    }
    return state.temporaryAnchors;
  };

  const buildConfiguredPath = (settings: Settings, localTime: number) => {
    let closed = settings.trajectoryClosed;
    let samples: CurveSample[] = [];
    if (settings.pathMode === "sine") {
      closed = false;
      samples = buildAdaptiveSinePathSamples(
        settings,
        getCanvasWidth(),
        getCanvasHeight(),
        localTime,
      );
    } else if (settings.pathMode === "svg") {
      samples =
        buildSvgPathSamples(settings, getCanvasWidth(), getCanvasHeight()) ??
        [];
    } else {
      const trajectory =
        settings.pathMode === "organic"
          ? createHeroOrganicTrajectory(
              settings.trajectorySeed,
              settings.organic.pointCount,
              settings.organic,
            )
          : normalizeTrajectoryPoints(settings.trajectoryPoints);
      samples = buildAdaptivePathSamples(
        trajectory,
        closed,
        getCanvasWidth(),
        getCanvasHeight(),
        settings,
      );
    }
    return { samples, closed };
  };

  const buildFollowPath = (
    settings: Settings,
    localTime: number,
    frameDelta: number,
    state: FilamentGeometryState,
  ) => {
    const updated = updateFollowRuntime(settings, frameDelta, nowSeconds());
    const anchors =
      settings.propagation.enabled &&
      settings.propagation.stage === "before-follow"
        ? buildBeforeFollowDeformation(
            settings,
            updated.anchors,
            localTime,
            state,
          )
        : updated.anchors;
    return buildAdaptiveFollowPathSamples(
      anchors,
      getCanvasWidth(),
      getCanvasHeight(),
      state.followSamples,
      settings,
    );
  };

  const buildBasePath = (
    settings: Settings,
    localTime: number,
    frameDelta: number,
    state: FilamentGeometryState,
  ) => {
    const conditional = hasConditionalFollow(settings);
    const followState = conditional ? getFollowState(settings.id) : null;
    if (conditional && settings.follow.transitionDuration > 0 && followState) {
      const targetBlend = followState.active ? 1 : 0;
      const blendStep =
        Math.max(frameDelta, 1 / 240) / settings.follow.transitionDuration;
      followState.sourceBlend += clamp(
        targetBlend - followState.sourceBlend,
        -blendStep,
        blendStep,
      );
      followState.sourceBlend = clamp(followState.sourceBlend, 0, 1);

      const configured = buildConfiguredPath(settings, localTime);
      if (followState.sourceBlend <= 0.0001) return configured;

      const followSamples = buildFollowPath(
        settings,
        localTime,
        frameDelta,
        state,
      );
      if (followState.sourceBlend >= 0.9999) {
        return { samples: followSamples, closed: false };
      }

      const blend =
        followState.sourceBlend *
        followState.sourceBlend *
        (3 - 2 * followState.sourceBlend);
      return {
        samples: blendCurveSamplePaths(
          configured.samples,
          followSamples,
          blend,
          getCanvasWidth(),
          getCanvasHeight(),
          state.morphSamples,
        ),
        closed: false,
      };
    }

    if (followSourceIsActive(settings)) {
      return {
        samples: buildFollowPath(settings, localTime, frameDelta, state),
        closed: false,
      };
    }
    return buildConfiguredPath(settings, localTime);
  };

  const updateGeometryState = (
    settings: Settings,
    localTime: number,
    frameDelta: number,
  ) => {
    const state = getGeometryState(settings.id);
    const conditionalFollow = hasConditionalFollow(settings);
    const followActive = followSourceIsActive(settings);
    const conditionalFollowState = conditionalFollow
      ? getFollowState(settings.id)
      : null;
    const followTransitioning = Boolean(
      conditionalFollowState &&
        settings.follow.transitionDuration > 0 &&
        Math.abs(
          conditionalFollowState.sourceBlend -
            (conditionalFollowState.active ? 1 : 0),
        ) > 0.0001,
    );
    const sineMoves =
      !followActive &&
      settings.pathMode === "sine" &&
      settings.motionMode === "travel" &&
      Math.abs(settings.pathDrift) > 0.000001;
    const sourceDynamic = followActive || followTransitioning || sineMoves;
    if (
      state.settingsReference !== settings ||
      state.settingsSizeRevision !== getSizeRevision()
    ) {
      state.settingsReference = settings;
      state.settingsSizeRevision = getSizeRevision();
      state.sourceSettingsKey = sourceGeometryKey(settings);
      state.propagationSettingsKey = hashUnknown({
        propagation: settings.propagation,
        musicVisualizer: settings.musicVisualizer,
      });
      state.materialSettingsKey = hashUnknown({
        glow: settings.glow,
        upper: settings.upperGlowSpread,
        lower: settings.lowerGlowSpread,
        bounds: settings.profileBounds,
        quality: settings.quality,
      });
    }
    const sourceKey = conditionalFollow
      ? hashMix(state.sourceSettingsKey, followActive ? 1 : 0)
      : state.sourceSettingsKey;
    let sourceChanged = false;
    if (sourceDynamic || state.baseKey !== sourceKey) {
      const built = buildBasePath(settings, localTime, frameDelta, state);
      state.baseSamples = built.samples;
      state.closed = built.closed;
      state.baseKey = sourceKey;
      state.deformationKey = -1;
      state.meshKey = -1;
      sourceChanged = true;
    }

    const audioDeformation = musicDeformation(settings);
    const audioDeformationEnabled =
      settings.musicVisualizer.enabled &&
      settings.musicVisualizer.deformation > 0.000001;
    const propagationAfter =
      settings.propagation.enabled &&
      !(followActive && settings.propagation.stage === "before-follow");
    const applyAfter = propagationAfter || audioDeformationEnabled;
    const propagationDynamic =
      (propagationAfter && propagationIsDynamic(settings.propagation)) ||
      audioDeformationEnabled;
    const deformationKey = applyAfter
      ? hashMix(sourceKey, state.propagationSettingsKey)
      : sourceKey;
    let renderSamples = state.baseSamples;
    if (applyAfter) {
      if (
        sourceChanged ||
        propagationDynamic ||
        state.deformationKey !== deformationKey
      ) {
        buildPropagatedPathSamples(
          state.baseSamples,
          state.closed,
          getCanvasWidth(),
          getCanvasHeight(),
          localTime,
          settings,
          state.propagatedSamples,
          reportDeformerError,
          audioDeformation,
          settings.musicVisualizer.deformationFrequency,
          state.propagationScratch,
        );
        state.deformationKey = deformationKey;
        state.meshKey = -1;
      }
      renderSamples = state.propagatedSamples;
    } else {
      state.deformationKey = deformationKey;
    }
    const disturbanceState = disturbanceStates.get(settings.id);
    if (disturbanceState) {
      pruneFilamentDisturbanceImpulses(
        disturbanceState.impulses,
        getInteractionTime(),
        settings.filamentInteraction.duration,
      );
      if (!settings.filamentInteraction.enabled) {
        disturbanceState.impulses.length = 0;
      }
    }
    const disturbanceActive = Boolean(
      settings.filamentInteraction.enabled &&
        disturbanceState &&
        disturbanceState.impulses.length > 0,
    );
    if (disturbanceActive) {
      renderSamples = applyFilamentDisturbances(
        renderSamples,
        state.closed,
        getCanvasWidth(),
        getCanvasHeight(),
        getInteractionTime(),
        settings.filamentInteraction,
        disturbanceState?.impulses ?? [],
        state.disturbedSamples,
      ) as CurveSample[];
    }
    if (state.disturbanceActive !== disturbanceActive) {
      state.meshKey = -1;
      state.disturbanceActive = disturbanceActive;
    }
    state.renderSamples = renderSamples;
    const dynamic = sourceDynamic || propagationDynamic || disturbanceActive;
    const materialKey = hashMix(deformationKey, state.materialSettingsKey);
    if (!dynamic && state.meshKey === materialKey) {
      return {
        state,
        followState:
          followActive || (conditionalFollowState?.sourceBlend ?? 0) > 0.0001
            ? getFollowState(settings.id)
            : null,
      };
    }
    const minimumSpread = Math.min(
      Math.max(
        settings.upperGlowSpread *
          settings.profileBounds.maximumUpperGlowSpread,
        0.02,
      ),
      Math.max(
        settings.lowerGlowSpread *
          settings.profileBounds.maximumLowerGlowSpread,
        0.02,
      ),
    );
    const narrowness = Math.sqrt(
      clamp(
        settings.glow *
          minimumSpread *
          settings.profileBounds.maximumGlow *
          settings.profileBounds.maximumWidth,
        0.025,
        1,
      ),
    );
    for (let pass = 0; pass < HERO_PATH_PASS_COUNT; pass++) {
      const maximumChord =
        pass === HERO_PATH_PASS_FAR
          ? Math.max(16, settings.quality.farMaxChordPx * narrowness)
          : pass === HERO_PATH_PASS_MID
            ? Math.max(6, settings.quality.midMaxChordPx * narrowness)
            : Math.max(2, settings.quality.coreMaxChordPx * narrowness);
      const flatness =
        pass === HERO_PATH_PASS_FAR
          ? Math.max(0.5, settings.quality.farFlatnessPx * narrowness)
          : pass === HERO_PATH_PASS_MID
            ? Math.max(0.12, settings.quality.midFlatnessPx * narrowness)
            : Math.max(0.04, settings.quality.coreFlatnessPx * narrowness);
      const passSamples = state.passSamples[pass]!;
      simplifyPathSamplesForPass(
        renderSamples,
        getCanvasWidth(),
        getCanvasHeight(),
        maximumChord,
        flatness,
        passSamples,
      );
      const required =
        Math.max(0, passSamples.length - 1) * HERO_PATH_SEGMENT_STRIDE;
      state.segmentData[pass] = ensureFloatCapacity(
        state.segmentData[pass]!,
        required,
      );
      state.segmentCounts[pass] = buildIntegralSegmentData(
        passSamples,
        state.closed,
        getCanvasWidth(),
        getCanvasHeight(),
        HERO_PATH_ENDPOINT_FEATHER_CSS_PX * getDpr(),
        state.segmentData[pass]!,
      );
    }
    state.meshRevision += 1;
    state.meshKey = materialKey;
    return {
      state,
      followState:
        followActive || (conditionalFollowState?.sourceBlend ?? 0) > 0.0001
          ? getFollowState(settings.id)
          : null,
    };
  };

  return { updateGeometryState };
}
