import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { HERO_PALETTE_TEXTURE_WIDTH } from "../rendering/constants";
import {
  FULLSCREEN_VERTEX_SHADER,
  SINE_FRAGMENT_SHADER,
} from "../rendering/shaders";
import type {
  HeroWaveBackgroundProps,
  HeroWaveCustomDeformer,
  HeroWavePerformanceSample,
  HeroWaveRendererStatus,
} from "../types";
import { finite } from "../math";
import { buildHeroPaletteTextureData } from "../rendering/color";

import {
  HERO_PROFILE_TEXTURE_WIDTH,
  HERO_PROFILE_TEXTURE_HEIGHT,
  HERO_GLOW_TEXTURE_WIDTH,
  INTERNAL_DEFAULTS,
  type Settings,
  buildLongitudinalProfileTextureData,
} from "../config/settings";

import { getGlowProfileTextureData } from "../rendering/profile-textures";

import { hashColors, hashProfiles } from "../runtime/cache-keys";

import {
  type ProgramBundle,
  SINE_UNIFORMS,
  createProgramBundle,
  createTexture,
} from "../rendering/webgl-resources";

import {
  type FilamentStyleTextures,
  type FilamentGeometryState,
  type FilamentDisturbanceRuntime,
  type FollowRuntimeState,
  type PreparedFilamentFrame,
  createRuntimeModifiers,
  createFilamentGeometryState,
  createFollowRuntimeState,
  activeFilaments,
} from "../runtime/state";

import {
  type MusicVisualizerRuntime,
  createMusicFrameController,
} from "../audio/music-runtime";

import { createDrawController } from "./draw-controller";
import {
  createResourceManager,
  type HeroWaveResourceState,
} from "./resource-manager";
import { createFollowController } from "./follow-controller";
import { createGeometryController } from "./geometry-controller";

export interface HeroWaveRendererCallbacks {
  onCycle: HeroWaveBackgroundProps["onCycle"];
  onReady: HeroWaveBackgroundProps["onReady"];
  onRendererStatus: HeroWaveBackgroundProps["onRendererStatus"];
  onRendererError: HeroWaveBackgroundProps["onRendererError"];
  onFrame: HeroWaveBackgroundProps["onFrame"];
  onPerformance: HeroWaveBackgroundProps["onPerformance"];
}

export interface HeroWaveRendererHookOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  invalidateRef: MutableRefObject<() => void>;
  currentTimeRef: MutableRefObject<number>;
  seekRequestRef: MutableRefObject<number | null>;
  manualPausedRef: MutableRefObject<boolean>;
  settingsRevisionRef: MutableRefObject<number>;
  musicRuntimeRef: MutableRefObject<MusicVisualizerRuntime>;
  callbacksRef: MutableRefObject<HeroWaveRendererCallbacks>;
  settingsRef: MutableRefObject<Settings>;
  resolvedSettings: Settings;
  contextEpoch: number;
  setContextEpoch: Dispatch<SetStateAction<number>>;
}

export function useHeroWaveRenderer({
  canvasRef,
  invalidateRef,
  currentTimeRef,
  seekRequestRef,
  manualPausedRef,
  settingsRevisionRef,
  musicRuntimeRef,
  callbacksRef,
  settingsRef,
  resolvedSettings,
  contextEpoch,
  setContextEpoch,
}: HeroWaveRendererHookOptions) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    delete canvas.dataset.ready;
    canvas.style.opacity = "0";

    let lastReportedStatus: HeroWaveRendererStatus | null = null;
    const reportStatus = (status: HeroWaveRendererStatus) => {
      if (
        lastReportedStatus?.renderer === status.renderer &&
        lastReportedStatus.supported === status.supported &&
        lastReportedStatus.reason === status.reason &&
        lastReportedStatus.webglVersion === status.webglVersion
      ) {
        return;
      }
      lastReportedStatus = status;
      canvas.dataset.pathRenderer = status.renderer;
      callbacksRef.current.onRendererStatus?.(status);
    };
    const reportError = (error: unknown, prefix: string) => {
      const resolved =
        error instanceof Error
          ? error
          : new Error(`${prefix}: ${String(error)}`);
      console.error(prefix, resolved);
      callbacksRef.current.onRendererError?.(resolved);
    };
    const reportDeformerError = (
      error: Error,
      deformer: HeroWaveCustomDeformer,
    ) => {
      const suffix = deformer.id ? ` (${deformer.id})` : "";
      reportError(error, `HeroWaveBackground custom deformer${suffix}`);
    };

    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    };
    const exactGl = canvas.getContext("webgl2", contextAttributes);
    const gl: WebGLRenderingContext | null =
      exactGl ?? canvas.getContext("webgl", contextAttributes);
    if (!gl) {
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "WebGL is unavailable.",
      });
      reportError(new Error("WebGL is unavailable."), "HeroWaveBackground");
      return;
    }
    const activateProgram = gl.useProgram.bind(gl);
    const precisionInfo = gl.getShaderPrecisionFormat(
      gl.FRAGMENT_SHADER,
      gl.HIGH_FLOAT,
    );
    const precision =
      precisionInfo && precisionInfo.precision > 0 ? "highp" : "mediump";
    const withPrecision = (source: string) =>
      source.split("__PRECISION__").join(precision);

    let sineProgram: ProgramBundle;
    try {
      sineProgram = createProgramBundle(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        withPrecision(SINE_FRAGMENT_SHADER),
        ["aPos"],
        SINE_UNIFORMS,
      );
    } catch (error) {
      reportError(error, "HeroWaveBackground sine shader");
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "The sine shader failed to compile.",
        webglVersion: exactGl ? 2 : 1,
      });
      return;
    }

    const fullscreenBuffer = gl.createBuffer();
    if (!fullscreenBuffer) {
      gl.deleteProgram(sineProgram.program);
      reportError(
        new Error("Unable to allocate the fullscreen buffer."),
        "HeroWaveBackground",
      );
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    let glowTexture0: WebGLTexture;
    let glowTexture1: WebGLTexture;
    let maskTexture: WebGLTexture;
    let backgroundTexture: WebGLTexture;
    try {
      glowTexture0 = createTexture(gl, 1, gl.LINEAR, gl.LINEAR);
      glowTexture1 = createTexture(gl, 2, gl.LINEAR, gl.LINEAR);
      maskTexture = createTexture(gl, 5, gl.LINEAR, gl.LINEAR);
      backgroundTexture = createTexture(gl, 6, gl.LINEAR, gl.LINEAR);
    } catch (error) {
      reportError(error, "HeroWaveBackground shared textures");
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      return;
    }
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const glowProfiles = getGlowProfileTextureData();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      HERO_GLOW_TEXTURE_WIDTH,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      glowProfiles.profile0,
    );
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, glowTexture1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      HERO_GLOW_TEXTURE_WIDTH,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      glowProfiles.profile1,
    );

    const styleTextures = new Map<string, FilamentStyleTextures>();
    const geometryStates = new Map<string, FilamentGeometryState>();
    const followStates = new Map<string, FollowRuntimeState>();
    const disturbanceStates = new Map<string, FilamentDisturbanceRuntime>();
    const hueMatrix = new Float32Array(9);
    const zeroFloat4 = new Float32Array(4);
    const followModifierScratch = createRuntimeModifiers();
    const musicModifierScratch = createRuntimeModifiers();
    const musicController = createMusicFrameController(
      () => musicRuntimeRef.current,
    );
    const { updateMusicRuntime, musicDeformation } = musicController;
    const preparedSceneFrames: PreparedFilamentFrame[] = [];
    const cycleStates = new Map<
      string,
      { key: string; index: number | null }
    >();
    let lastPrunedSettingsRevision = -1;
    let activeSceneRoot: Settings | null = null;
    let activeSceneCache: Settings[] = [];

    const getActiveScene = (root: Settings) => {
      if (activeSceneRoot !== root) {
        activeSceneRoot = root;
        activeSceneCache = activeFilaments(root);
      }
      return activeSceneCache;
    };

    const getGeometryState = (id: string) => {
      let state = geometryStates.get(id);
      if (!state) {
        state = createFilamentGeometryState(id);
        geometryStates.set(id, state);
      }
      return state;
    };
    const getFollowState = (id: string) => {
      let state = followStates.get(id);
      if (!state) {
        state = createFollowRuntimeState();
        followStates.set(id, state);
      }
      return state;
    };
    const getDisturbanceState = (id: string) => {
      let state = disturbanceStates.get(id);
      if (!state) {
        state = {
          impulses: [],
          lastTriggerTime: Number.NEGATIVE_INFINITY,
          alternateSign: 1,
        };
        disturbanceStates.set(id, state);
      }
      return state;
    };
    const hasConditionalFollow = (settings: Settings) =>
      settings.pathMode !== "follow" &&
      settings.follow.activation !== "path-mode";
    const acceptsFollowInput = (settings: Settings) =>
      settings.pathMode === "follow" || hasConditionalFollow(settings);
    const followSourceIsActive = (settings: Settings) =>
      settings.pathMode === "follow" ||
      (hasConditionalFollow(settings) && getFollowState(settings.id).active);

    const getStyleTextures = (settings: Settings) => {
      let entry = styleTextures.get(settings.id);
      if (!entry) {
        entry = {
          palette: createTexture(gl, 0, gl.LINEAR, gl.LINEAR),
          profiles: createTexture(gl, 4, gl.LINEAR, gl.LINEAR),
          paletteHash: -1,
          profileHash: -1,
          settingsReference: null,
        };
        styleTextures.set(settings.id, entry);
      }
      if (entry.settingsReference === settings) return entry;
      const nextPaletteHash = hashColors(
        settings.colors,
        settings.paletteInterpolation,
        settings.paletteReverse,
      );
      if (nextPaletteHash !== entry.paletteHash) {
        gl.bindTexture(gl.TEXTURE_2D, entry.palette);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          HERO_PALETTE_TEXTURE_WIDTH,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          buildHeroPaletteTextureData(
            settings.colors,
            settings.paletteInterpolation,
            settings.paletteReverse,
            INTERNAL_DEFAULTS.colors,
          ),
        );
        entry.paletteHash = nextPaletteHash;
      }
      const nextProfileHash = hashProfiles(settings.profiles);
      if (nextProfileHash !== entry.profileHash) {
        gl.bindTexture(gl.TEXTURE_2D, entry.profiles);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          HERO_PROFILE_TEXTURE_WIDTH,
          HERO_PROFILE_TEXTURE_HEIGHT,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          buildLongitudinalProfileTextureData(settings.profiles),
        );
        entry.profileHash = nextProfileHash;
      }
      entry.settingsReference = settings;
      return entry;
    };

    const resourceState: HeroWaveResourceState = {
      pathResources: undefined,
      terrainResources: undefined,
      glassResources: undefined,
      glassIntroStartedAt: null,
      pathRendererErrorLogged: false,
      canvasWidth: 1,
      canvasHeight: 1,
      dpr: 1,
      sizeRevision: 0,
      maskHash: -1,
      maskSizeRevision: -1,
      maskSettingsReference: null,
      backgroundCanvas: document.createElement("canvas"),
      backgroundImageElement: null,
      backgroundImageSource: "",
      backgroundImageFit: "",
      backgroundImageSizeRevision: -1,
      backgroundImageRequest: 0,
    };

    const resourceManager = createResourceManager({
      gl,
      exactGl,
      resourceState,
      withPrecision,
      reportError,
      reportStatus,
    });
    const {
      destroyTerrainResources,
      destroyGlassResources,
      allocateGlassTargets,
      allocatePathTargets,
      destroyPathResources,
    } = resourceManager;

    const resizeCanvas = () => {
      const quality = settingsRef.current.quality;
      resourceState.dpr = Math.min(
        window.devicePixelRatio || 1,
        quality.maxDpr,
      );
      const width = Math.max(
        1,
        Math.round(canvas.clientWidth * resourceState.dpr),
      );
      const height = Math.max(
        1,
        Math.round(canvas.clientHeight * resourceState.dpr),
      );
      if (
        width === resourceState.canvasWidth &&
        height === resourceState.canvasHeight
      )
        return false;
      resourceState.canvasWidth = width;
      resourceState.canvasHeight = height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      resourceState.sizeRevision += 1;
      for (const state of geometryStates.values()) {
        state.baseKey = -1;
        state.meshKey = -1;
      }
      if (resourceState.pathResources)
        allocatePathTargets(resourceState.pathResources, settingsRef.current);
      if (resourceState.glassResources)
        allocateGlassTargets(resourceState.glassResources);
      return true;
    };
    resizeCanvas();

    let raf = 0;
    let revealRaf = 0;
    let revealTimer = 0;
    let frameScheduled = false;
    let running = true;
    let previousDrawTimestamp: number | null = null;
    let clockTime = resolvedSettings.initialTime;
    let interactionTime = 0;
    currentTimeRef.current = clockTime;
    let inViewport = true;
    let reducedMotion = false;
    let readyReported = false;
    let renderedFrameIndex = 0;
    let lastRenderer: HeroWavePerformanceSample["renderer"] = "unavailable";
    const gpuTimerExtension = exactGl?.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    );
    interface PendingGpuTimer {
      query: WebGLQuery;
      sample: HeroWavePerformanceSample;
    }
    const pendingGpuTimers: PendingGpuTimer[] = [];

    const emitPerformanceSample = (sample: HeroWavePerformanceSample) => {
      callbacksRef.current.onPerformance?.(sample);
    };

    const pollGpuTimers = () => {
      if (!exactGl || !gpuTimerExtension || pendingGpuTimers.length === 0) {
        return;
      }
      const disjoint = Boolean(
        exactGl.getParameter(gpuTimerExtension.GPU_DISJOINT_EXT),
      );
      if (disjoint) {
        for (const pending of pendingGpuTimers) {
          exactGl.deleteQuery(pending.query);
          emitPerformanceSample({
            ...pending.sample,
            gpuDisjoint: true,
          });
        }
        pendingGpuTimers.length = 0;
        return;
      }
      while (pendingGpuTimers.length > 0) {
        const pending = pendingGpuTimers[0]!;
        const available = exactGl.getQueryParameter(
          pending.query,
          exactGl.QUERY_RESULT_AVAILABLE,
        );
        if (!available) break;
        const elapsedNanoseconds = Number(
          exactGl.getQueryParameter(pending.query, exactGl.QUERY_RESULT),
        );
        exactGl.deleteQuery(pending.query);
        pendingGpuTimers.shift();
        emitPerformanceSample({
          ...pending.sample,
          gpuMs: elapsedNanoseconds / 1_000_000,
        });
      }
    };

    const requestFrame = () => {
      const settings = settingsRef.current;
      if (
        !running ||
        frameScheduled ||
        document.visibilityState === "hidden" ||
        (settings.pauseWhenOffscreen && !inViewport)
      ) {
        return;
      }
      frameScheduled = true;
      raf = requestAnimationFrame(loop);
    };
    invalidateRef.current = requestFrame;

    const uploadTransparentBackground = () => {
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0]),
      );
      resourceState.backgroundImageFit = "";
      resourceState.backgroundImageSizeRevision = -1;
    };

    const rasterizeBackgroundImage = (settings: Settings) => {
      const image = resourceState.backgroundImageElement;
      if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
      if (
        resourceState.backgroundImageFit === settings.backgroundImage.fit &&
        resourceState.backgroundImageSizeRevision === resourceState.sizeRevision
      ) {
        return;
      }
      const scale = Math.min(
        1,
        2048 /
          Math.max(resourceState.canvasWidth, resourceState.canvasHeight, 1),
      );
      const width = Math.max(1, Math.round(resourceState.canvasWidth * scale));
      const height = Math.max(
        1,
        Math.round(resourceState.canvasHeight * scale),
      );
      resourceState.backgroundCanvas.width = width;
      resourceState.backgroundCanvas.height = height;
      const context = resourceState.backgroundCanvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (settings.backgroundImage.fit === "stretch") {
        context.drawImage(image, 0, 0, width, height);
      } else {
        const fitScale =
          settings.backgroundImage.fit === "cover"
            ? Math.max(width / image.naturalWidth, height / image.naturalHeight)
            : Math.min(
                width / image.naturalWidth,
                height / image.naturalHeight,
              );
        const drawWidth = image.naturalWidth * fitScale;
        const drawHeight = image.naturalHeight * fitScale;
        context.drawImage(
          image,
          (width - drawWidth) * 0.5,
          (height - drawHeight) * 0.5,
          drawWidth,
          drawHeight,
        );
      }
      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        resourceState.backgroundCanvas,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      resourceState.backgroundImageFit = settings.backgroundImage.fit;
      resourceState.backgroundImageSizeRevision = resourceState.sizeRevision;
    };

    const updateBackgroundImage = (settings: Settings) => {
      const source = settings.backgroundImage.src.trim();
      if (source !== resourceState.backgroundImageSource) {
        resourceState.backgroundImageSource = source;
        resourceState.backgroundImageElement = null;
        resourceState.backgroundImageRequest += 1;
        const request = resourceState.backgroundImageRequest;
        uploadTransparentBackground();
        if (source) {
          const image = new Image();
          if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
          image.onload = () => {
            if (!running || request !== resourceState.backgroundImageRequest)
              return;
            resourceState.backgroundImageElement = image;
            resourceState.backgroundImageFit = "";
            rasterizeBackgroundImage(settingsRef.current);
            requestFrame();
          };
          image.onerror = () => {
            if (!running || request !== resourceState.backgroundImageRequest)
              return;
            reportError(
              new Error(`Unable to load background image: ${source}`),
              "HeroWaveBackground background image",
            );
          };
          image.src = source;
        }
      }
      rasterizeBackgroundImage(settings);
    };

    const pointerState = {
      canvasRect: canvas.getBoundingClientRect(),
      rectDirty: false,
      dotPointerX: 0.5,
      dotPointerY: 0.5,
      dotPointerActive: false,
    };
    let resizePending = false;
    const resizeObserver = new ResizeObserver(() => {
      pointerState.rectDirty = true;
      resizePending = true;
      requestFrame();
    });
    resizeObserver.observe(canvas);
    const markRectDirty = () => {
      pointerState.rectDirty = true;
    };
    window.addEventListener("scroll", markRectDirty, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            inViewport = entries[0]?.isIntersecting ?? true;
            if (inViewport) {
              previousDrawTimestamp = null;
              requestFrame();
            }
          })
        : null;
    intersectionObserver?.observe(canvas);

    const reducedMotionQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    const updateReducedMotion = () => {
      reducedMotion = Boolean(reducedMotionQuery?.matches);
      requestFrame();
    };
    updateReducedMotion();
    reducedMotionQuery?.addEventListener?.("change", updateReducedMotion);

    const followController = createFollowController({
      canvas,
      pointerState,
      getInteractionTime: () => interactionTime,
      requestFrame,
      acceptsFollowInput,
      hasConditionalFollow,
      getFollowState,
      geometryStates,
      getDisturbanceState,
      getRootSettings: () => settingsRef.current,
      getActiveScene,
      followStates,
    });
    const {
      nowSeconds,
      onPointerMove,
      deactivatePointers,
      updateFollowRuntime,
      followAnchorsForMode,
      followPolylineLengthCssPx,
    } = followController;

    const geometryController = createGeometryController({
      getCanvasWidth: () => resourceState.canvasWidth,
      getCanvasHeight: () => resourceState.canvasHeight,
      getSizeRevision: () => resourceState.sizeRevision,
      getDpr: () => resourceState.dpr,
      getInteractionTime: () => interactionTime,
      reportDeformerError,
      updateFollowRuntime,
      nowSeconds,
      hasConditionalFollow,
      getFollowState,
      followSourceIsActive,
      getGeometryState,
      disturbanceStates,
      musicDeformation,
    });
    const drawController = createDrawController({
      gl,
      exactGl,
      resourceState,
      sineProgram,
      fullscreenBuffer,
      glowTexture0,
      glowTexture1,
      maskTexture,
      backgroundTexture,
      hueMatrix,
      zeroFloat4,
      preparedSceneFrames,
      followModifierScratch,
      musicModifierScratch,
      pointerState,
      getClockTime: () => clockTime,
      isRunning: () => running,
      requestFrame,
      activateProgram,
      getStyleTextures,
      updateBackgroundImage,
      hasConditionalFollow,
      reportStatus,
      resourceManager,
      geometryController,
      musicController,
      followController,
    });
    const {
      drawSine,
      drawPathScene,
      drawTerrainDots,
      compositeGlassText,
      localVisualTime,
    } = drawController;

    const pruneSceneCaches = (scene: readonly Settings[]) => {
      if (lastPrunedSettingsRevision === settingsRevisionRef.current) return;
      lastPrunedSettingsRevision = settingsRevisionRef.current;
      const activeIds = new Set(scene.map((settings) => settings.id));
      for (const [id, entry] of styleTextures) {
        if (activeIds.has(id)) continue;
        gl.deleteTexture(entry.palette);
        gl.deleteTexture(entry.profiles);
        styleTextures.delete(id);
      }
      for (const id of geometryStates.keys()) {
        if (!activeIds.has(id)) geometryStates.delete(id);
      }
      for (const id of followStates.keys()) {
        if (!activeIds.has(id)) followStates.delete(id);
      }
      for (const id of disturbanceStates.keys()) {
        if (!activeIds.has(id)) disturbanceStates.delete(id);
      }
      for (const id of cycleStates.keys()) {
        if (!activeIds.has(id)) cycleStates.delete(id);
      }
    };

    const completedCycleIndex = (settings: Settings, visualTime: number) => {
      if (
        settings.motionMode !== "travel" ||
        followSourceIsActive(settings) ||
        Math.abs(settings.curveTravel) <= 0.000001
      ) {
        return null;
      }
      const phase = visualTime * settings.curveTravel;
      if (settings.pathMode !== "sine" && settings.trajectoryClosed) {
        return Math.floor(phase + (phase >= 0 ? 0.5 : -0.5));
      }
      const length = Math.max(settings.segmentLength, 0.05);
      const outsidePadding = 0.06;
      const firstCenter = -0.5 * length - outsidePadding;
      const centeredOffset = 0.5 - firstCenter;
      const cycleLength = 1 + length + 2 * outsidePadding;
      return Math.floor((phase + centeredOffset) / cycleLength);
    };

    const notifyCycles = (scene: readonly Settings[]) => {
      for (const settings of scene) {
        const visualTime = localVisualTime(settings);
        const key = `${settings.motionMode}:${settings.pathMode}:${settings.trajectoryClosed}:${settings.segmentLength}:${settings.curveTravel}`;
        const index = completedCycleIndex(settings, visualTime);
        const previous = cycleStates.get(settings.id);
        if (!previous || previous.key !== key) {
          cycleStates.set(settings.id, { key, index });
          continue;
        }
        if (
          index !== null &&
          previous.index !== null &&
          index !== previous.index
        ) {
          const direction: 1 | -1 =
            settings.curveTravel *
              settings.speed *
              settings.filamentPlaybackRate >=
            0
              ? 1
              : -1;
          previous.index = index;
          callbacksRef.current.onCycle?.({
            index,
            direction,
            time: clockTime,
            filamentId: settings.id,
          });
        } else previous.index = index;
      }
    };

    const draw = (frameDelta: number) => {
      updateMusicRuntime();
      if (resizePending) {
        resizePending = false;
        resizeCanvas();
      }
      const root = settingsRef.current;
      const scene = getActiveScene(root);
      pruneSceneCaches(scene);
      const directSine =
        root.filaments.length === 0 &&
        scene.length === 1 &&
        scene[0] === root &&
        root.pathMode === "sine" &&
        !root.requiresPathPipeline;
      if (directSine) {
        lastRenderer = "sine";
        drawSine(root);
      } else {
        drawPathScene(root, scene, frameDelta);
        lastRenderer = resourceState.pathResources ? "hdr" : "unavailable";
      }
      drawTerrainDots(root);
      compositeGlassText(root);
      notifyCycles(scene);
      callbacksRef.current.onFrame?.(clockTime, frameDelta);
    };

    const followNeedsAnimation = (scene: readonly Settings[]) =>
      scene.some((settings) => {
        if (!acceptsFollowInput(settings)) return false;
        const state = followStates.get(settings.id);
        if (!state) return true;
        if (hasConditionalFollow(settings) && !state.active) {
          return (
            settings.follow.transitionDuration > 0 && state.sourceBlend > 0.0001
          );
        }
        if (
          settings.follow.position?.active !== false &&
          settings.follow.position
        )
          return true;
        if (state.active) return true;
        if (settings.follow.leaveBehavior === "idle") return true;
        if (settings.follow.leaveBehavior === "collapse") {
          return (
            followPolylineLengthCssPx(
              followAnchorsForMode(state, settings.follow.mode),
            ) > 0.5
          );
        }
        if (settings.follow.leaveBehavior === "fade")
          return state.visibility > 0.001;
        return false;
      });

    const disturbanceNeedsAnimation = (scene: readonly Settings[]) =>
      scene.some(
        (settings) =>
          settings.filamentInteraction.enabled &&
          (disturbanceStates.get(settings.id)?.impulses.length ?? 0) > 0,
      );

    function loop(timestamp: number) {
      frameScheduled = false;
      if (!running) return;
      pollGpuTimers();
      const root = settingsRef.current;
      const scene = getActiveScene(root);
      const minimumFrameInterval =
        root.quality.maxFps > 0 ? 1000 / root.quality.maxFps : 0;
      if (
        previousDrawTimestamp !== null &&
        minimumFrameInterval > 0 &&
        timestamp - previousDrawTimestamp < minimumFrameInterval
      ) {
        requestFrame();
        return;
      }
      const frameDelta =
        previousDrawTimestamp === null
          ? 0
          : Math.min((timestamp - previousDrawTimestamp) / 1000, 0.1);
      previousDrawTimestamp = timestamp;
      const requestedSeek = seekRequestRef.current;
      if (requestedSeek !== null) {
        clockTime = requestedSeek;
        seekRequestRef.current = null;
      }
      const autonomousPaused =
        root.paused ||
        manualPausedRef.current ||
        (root.respectReducedMotion && reducedMotion);
      if (root.controlledTime !== undefined) {
        clockTime = root.controlledTime;
      } else {
        if (!autonomousPaused) {
          clockTime += frameDelta * root.playbackRate;
          if (Math.abs(clockTime) > 32768) clockTime %= 4096;
        }
      }
      if (!autonomousPaused) interactionTime += frameDelta;
      currentTimeRef.current = clockTime;
      renderedFrameIndex += 1;
      const shouldSamplePerformance =
        Boolean(callbacksRef.current.onPerformance) &&
        renderedFrameIndex % 15 === 0;
      const cpuStartedAt = shouldSamplePerformance ? performance.now() : 0;
      let gpuQuery: WebGLQuery | null = null;
      if (
        shouldSamplePerformance &&
        exactGl &&
        gpuTimerExtension &&
        pendingGpuTimers.length < 8
      ) {
        gpuQuery = exactGl.createQuery();
        if (gpuQuery) {
          exactGl.beginQuery(gpuTimerExtension.TIME_ELAPSED_EXT, gpuQuery);
        }
      }
      let drawCompleted = false;
      try {
        draw(frameDelta);
        drawCompleted = true;
      } finally {
        if (gpuQuery && exactGl && gpuTimerExtension) {
          exactGl.endQuery(gpuTimerExtension.TIME_ELAPSED_EXT);
          if (!drawCompleted) exactGl.deleteQuery(gpuQuery);
        }
      }
      if (shouldSamplePerformance) {
        const sample: HeroWavePerformanceSample = {
          frame: renderedFrameIndex,
          time: clockTime,
          frameMs: frameDelta * 1000,
          cpuMs: performance.now() - cpuStartedAt,
          renderer: lastRenderer,
        };
        if (gpuQuery) pendingGpuTimers.push({ query: gpuQuery, sample });
        else emitPerformanceSample(sample);
      }
      const clockRuns =
        root.controlledTime === undefined &&
        !root.paused &&
        !manualPausedRef.current &&
        !(root.respectReducedMotion && reducedMotion);
      const interactionRuns =
        !root.paused &&
        !manualPausedRef.current &&
        (followNeedsAnimation(scene) || disturbanceNeedsAnimation(scene));
      if (clockRuns || interactionRuns) requestFrame();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        previousDrawTimestamp = null;
        requestFrame();
      } else if (frameScheduled) {
        cancelAnimationFrame(raf);
        frameScheduled = false;
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      running = false;
      if (frameScheduled) cancelAnimationFrame(raf);
      frameScheduled = false;
      reportStatus({
        renderer: "unavailable",
        supported: false,
        reason: "WebGL context lost.",
        webglVersion: exactGl ? 2 : 1,
      });
    };
    const onContextRestored = () => {
      setContextEpoch((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    draw(1 / 60);
    const reveal = () => {
      canvas.dataset.ready = "true";
      canvas.style.opacity = "1";
      if (!readyReported) {
        readyReported = true;
        callbacksRef.current.onReady?.();
      }
    };
    revealRaf = requestAnimationFrame(() => {
      revealRaf = requestAnimationFrame(reveal);
    });
    revealTimer = window.setTimeout(reveal, 120);
    requestFrame();

    (
      canvas as HTMLCanvasElement & {
        __waveDebug?: { time: () => number; step: (seconds: number) => void };
      }
    ).__waveDebug = {
      time: () => clockTime,
      step: (seconds: number) => {
        const safeSeconds = finite(seconds, 0);
        clockTime += safeSeconds;
        currentTimeRef.current = clockTime;
        draw(Math.min(Math.abs(safeSeconds), 0.1));
      },
    };

    return () => {
      running = false;
      invalidateRef.current = () => undefined;
      if (frameScheduled) cancelAnimationFrame(raf);
      cancelAnimationFrame(revealRaf);
      window.clearTimeout(revealTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", deactivatePointers);
      document.removeEventListener("pointerleave", deactivatePointers);
      window.removeEventListener("scroll", markRectDirty, true);
      window.removeEventListener("resize", markRectDirty);
      reducedMotionQuery?.removeEventListener?.("change", updateReducedMotion);
      intersectionObserver?.disconnect();
      resizeObserver.disconnect();
      delete (
        canvas as HTMLCanvasElement & {
          __waveDebug?: { time: () => number; step: (seconds: number) => void };
        }
      ).__waveDebug;
      destroyPathResources(resourceState.pathResources ?? null);
      destroyTerrainResources(resourceState.terrainResources ?? null);
      destroyGlassResources(resourceState.glassResources ?? null);
      if (exactGl) {
        for (const pending of pendingGpuTimers) {
          exactGl.deleteQuery(pending.query);
        }
      }
      pendingGpuTimers.length = 0;
      for (const entry of styleTextures.values()) {
        gl.deleteTexture(entry.palette);
        gl.deleteTexture(entry.profiles);
      }
      gl.deleteProgram(sineProgram.program);
      gl.deleteBuffer(fullscreenBuffer);
      gl.deleteTexture(glowTexture0);
      gl.deleteTexture(glowTexture1);
      gl.deleteTexture(maskTexture);
      gl.deleteTexture(backgroundTexture);
    };
  }, [contextEpoch]);
}
