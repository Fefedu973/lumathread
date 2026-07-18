"use client";

/**
 * Hero background inspired by react-bits SoftAurora.
 *
 * The analytic sine path stays a single-pass WebGL renderer. Free 2D paths use
 * a true multi-contribution line-integral renderer: every adaptive path span
 * emits independently into floating-point accumulation targets, so crossings
 * preserve all branches instead of selecting or averaging a fixed number of
 * nearest candidates.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundProps,
  HeroWaveSceneProps,
} from "../types";

export * from "../types";
export * from "../trajectory";
export { HERO_WAVE_DEFAULT_CONFIG } from "../config/settings";

import {
  type HeroWaveBackgroundCoreProps,
  type Settings,
  resolveSettings,
} from "../config/settings";

import { shallowSettingsInputEqual } from "../runtime/state";

import {
  type MusicVisualizerRuntime,
  createMusicVisualizerRuntime,
} from "../audio/music-runtime";

import { useHeroWaveRenderer } from "./use-hero-wave-renderer";

import { useMusicVisualizer } from "../audio/use-music-visualizer";
import { useGlassTextDomTarget } from "./use-glass-text-dom-target";

const HdrHeroWaveBackground = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundCoreProps
>(function HdrHeroWaveBackground(
  {
    className,
    style,
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
    onPerformance,
    ...inputSettings
  },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const invalidateRef = useRef<() => void>(() => undefined);
  const currentTimeRef = useRef(0);
  const seekRequestRef = useRef<number | null>(null);
  const manualPausedRef = useRef(false);
  const settingsRevisionRef = useRef(0);
  const musicRuntimeRef = useRef<MusicVisualizerRuntime>(
    createMusicVisualizerRuntime(),
  );
  const callbacksRef = useRef({
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
    onPerformance,
  });
  callbacksRef.current = {
    onCycle,
    onReady,
    onRendererStatus,
    onRendererError,
    onFrame,
    onPerformance,
  };
  const settingsRef = useRef<Settings>(null as unknown as Settings);
  const settingsInputRef = useRef<Record<string, unknown> | null>(null);
  const [contextEpoch, setContextEpoch] = useState(0);
  const trackedGlassText = useGlassTextDomTarget(
    canvasRef,
    inputSettings.glassText,
  );
  const effectiveInputSettings =
    trackedGlassText === inputSettings.glassText
      ? inputSettings
      : { ...inputSettings, glassText: trackedGlassText };
  const settingsInput = effectiveInputSettings as Record<string, unknown>;
  if (!shallowSettingsInputEqual(settingsInputRef.current, settingsInput)) {
    settingsInputRef.current = settingsInput;
    settingsRef.current = resolveSettings(effectiveInputSettings);
    settingsRevisionRef.current += 1;
  }
  const resolvedSettings = settingsRef.current;
  const fadeInDuration = resolvedSettings.fadeInDuration;
  const fadeInEasing = resolvedSettings.fadeInEasing;
  const musicVisualizerConnectionKey = JSON.stringify({
    enabled: resolvedSettings.musicVisualizer.enabled,
    source: resolvedSettings.musicVisualizer.source,
    elementId: resolvedSettings.musicVisualizer.elementId,
  });
  const musicVisualizerAnalyserKey = JSON.stringify({
    fftSize: resolvedSettings.musicVisualizer.fftSize,
    smoothing: resolvedSettings.musicVisualizer.smoothing,
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      play() {
        manualPausedRef.current = false;
        invalidateRef.current();
      },
      pause() {
        manualPausedRef.current = true;
      },
      seek(time: number) {
        if (!Number.isFinite(time)) return;
        seekRequestRef.current = time;
        currentTimeRef.current = time;
        invalidateRef.current();
      },
      step(seconds: number) {
        if (!Number.isFinite(seconds)) return;
        const nextTime = currentTimeRef.current + seconds;
        seekRequestRef.current = nextTime;
        currentTimeRef.current = nextTime;
        invalidateRef.current();
      },
      getTime() {
        return currentTimeRef.current;
      },
      invalidate() {
        invalidateRef.current();
      },
    }),
    [],
  );

  useMusicVisualizer({
    musicRuntimeRef,
    settingsRef,
    invalidateRef,
    callbacksRef,
    connectionKey: musicVisualizerConnectionKey,
    analyserKey: musicVisualizerAnalyserKey,
  });

  useEffect(() => {
    invalidateRef.current();
  });

  useHeroWaveRenderer({
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
  });

  const previousFadeDuration = useRef(fadeInDuration);
  useEffect(() => {
    if (previousFadeDuration.current === fadeInDuration) return;
    previousFadeDuration.current = fadeInDuration;
    const canvas = canvasRef.current;
    if (!canvas) return;
    delete canvas.dataset.ready;
    canvas.style.opacity = "0";
    let revealRaf = 0;
    const revealTimer = window.setTimeout(() => {
      canvas.dataset.ready = "true";
      canvas.style.opacity = "1";
    }, 100);
    revealRaf = requestAnimationFrame(() => {
      revealRaf = requestAnimationFrame(() => {
        canvas.dataset.ready = "true";
        canvas.style.opacity = "1";
      });
    });
    return () => {
      cancelAnimationFrame(revealRaf);
      window.clearTimeout(revealTimer);
    };
  }, [fadeInDuration]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-theme={resolvedSettings.theme}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0,
        transitionProperty: "opacity",
        willChange: "opacity",
        backgroundColor:
          resolvedSettings.theme === "light" ? "#ffffff" : "#020304",
        ...style,
        transitionDuration: `${fadeInDuration}ms`,
        transitionTimingFunction: fadeInEasing,
      }}
      className={className}
    />
  );
});

export const HeroWaveBackground = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveBackgroundProps
>(function HeroWaveBackground(props, ref) {
  return <HdrHeroWaveBackground ref={ref} {...props} />;
});

/** Explicit scene alias with a required `filaments` configuration. */
export const HeroWaveScene = forwardRef<
  HeroWaveBackgroundHandle,
  HeroWaveSceneProps
>(function HeroWaveScene(props, ref) {
  return <HeroWaveBackground {...props} ref={ref} />;
});
