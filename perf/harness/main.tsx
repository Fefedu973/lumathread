import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getHeroTrajectoryVerticalScale,
  HeroWaveBackground,
  type HeroTrajectoryPoint,
  type HeroWaveBackgroundHandle,
  type HeroWaveLongitudinalProfiles,
  type HeroWavePerformanceSample,
  type HeroWaveRendererStatus,
} from "../../src/runtime/HdrHeroWaveBackground";

const HERO_WAVE_Y = 0.28;
const HERO_CURVE_SCALE = 0.55;
const HERO_CURVE_STRENGTH = 1;
const CTA_WAVE_Y = 0.35;
const CTA_CURVE_SCALE = 0.55;
const CTA_CURVE_STRENGTH = 1;

interface HeroOrbitLayout {
  readonly width: number;
  readonly height: number;
  readonly contentLeft: number;
  readonly contentTop: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
}

interface HeroScreenPathPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
}

const HERO_ORBIT_DESIGN_POINTS: readonly HeroScreenPathPoint[] = [
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

function createHeroOrbitTrajectory(
  layout: HeroOrbitLayout,
): readonly HeroTrajectoryPoint[] {
  const safeWidth = Math.max(layout.width, 1);
  const safeHeight = Math.max(layout.height, 1);
  const horizontalPadding = Math.min(120, Math.max(28, safeWidth * 0.075));
  const verticalPadding = Math.min(72, Math.max(32, safeHeight * 0.045));
  const centerX = layout.contentLeft + layout.contentWidth * 0.5;
  const centerY = layout.contentTop + layout.contentHeight * 0.5;
  const radiusX = Math.min(
    safeWidth * 0.56,
    layout.contentWidth * 0.5 + horizontalPadding,
  );
  const radiusY = Math.max(
    layout.contentHeight * 0.5 + verticalPadding,
    radiusX / 1.7,
  );
  const margin = Math.max(safeWidth * 0.12, 96);
  const orbitLeft = centerX - radiusX;
  const orbitRight = centerX + radiusX;
  const designLeft = 0.24;
  const designRight = 0.76;
  const mapX = (value: number) => {
    if (value < designLeft) {
      const progress = (value - 0.01) / (designLeft - 0.01);
      return -margin + progress * (orbitLeft + margin);
    }
    if (value > designRight) {
      const progress = (value - designRight) / (0.99 - designRight);
      return orbitRight + progress * (safeWidth + margin - orbitRight);
    }
    return centerX + ((value - 0.5) / 0.26) * radiusX;
  };
  const mapY = (value: number) => centerY - ((value - 0.02) / 0.98) * radiusY;

  const bandHeight = 1 - HERO_WAVE_Y;
  const verticalScale = getHeroTrajectoryVerticalScale(
    HERO_CURVE_SCALE,
    HERO_CURVE_STRENGTH,
  );
  return HERO_ORBIT_DESIGN_POINTS.map((point) => {
    const x = mapX(point.x) / safeWidth;
    const renderedY = 1 - mapY(point.y) / safeHeight;
    return {
      id: point.id,
      x,
      y: (renderedY - bandHeight) / verticalScale,
      speed: point.speed,
    };
  });
}

const CTA_ACCENT_PATH = {
  mode: "custom" as const,
  interpolation: "catmull-rom" as const,
  points: [
    { id: "cta-0", x: 0.08, y: -0.08, speed: 0.78 },
    { id: "cta-1", x: 0.18, y: 0.01, speed: 0.84 },
    { id: "cta-2", x: 0.32, y: -0.015, speed: 0.94 },
    { id: "cta-3", x: 0.48, y: 0.018, speed: 1.05 },
    { id: "cta-4", x: 0.64, y: -0.012, speed: 1.02 },
    { id: "cta-5", x: 0.8, y: 0.012, speed: 0.9 },
    { id: "cta-6", x: 0.92, y: -0.07, speed: 0.78 },
  ] satisfies readonly HeroTrajectoryPoint[],
};

const CTA_ACCENT_PROFILES = {
  width: {
    type: "curve",
    interpolation: "smooth",
    keys: [
      { position: 0, value: 0.42 },
      { position: 0.08, value: 0.9 },
      { position: 0.5, value: 1 },
      { position: 0.92, value: 0.9 },
      { position: 1, value: 0.42 },
    ],
  },
  opacity: {
    type: "curve",
    interpolation: "smooth",
    keys: [
      { position: 0, value: 0 },
      { position: 0.06, value: 1 },
      { position: 0.94, value: 1 },
      { position: 1, value: 0 },
    ],
  },
  intensity: 1,
  glow: 1,
} satisfies HeroWaveLongitudinalProfiles;

type HarnessScenario = "hero" | "cta";
type HarnessTheme = "dark" | "light";
type HarnessMode = "benchmark" | "snapshot";

interface HarnessRuntime {
  ready: boolean;
  rendererStatus: HeroWaveRendererStatus | null;
  rendererErrors: string[];
  samples: HeroWavePerformanceSample[];
  frameDeltasMs: number[];
  renderedFrames: number;
  firstFrameAt: number | null;
  lastFrameAt: number | null;
  scenario: HarnessScenario;
  theme: HarnessTheme;
  mode: HarnessMode;
  pause: () => void;
  play: () => void;
  seek: (time: number) => void;
  resetMeasurements: () => void;
}

declare global {
  interface Window {
    __LUMATHREAD_HARNESS__: HarnessRuntime;
    __LUMATHREAD_GL_STATS__: {
      contexts: number;
      webgl2Contexts: number;
      counters: Record<string, number>;
      errors: string[];
    };
    __LUMATHREAD_RESET_GL_STATS__: () => void;
  }
}

const params = new URLSearchParams(window.location.search);
const scenario: HarnessScenario =
  params.get("scenario") === "cta" ? "cta" : "hero";
const theme: HarnessTheme = params.get("theme") === "light" ? "light" : "dark";
const mode: HarnessMode =
  params.get("mode") === "snapshot" ? "snapshot" : "benchmark";
const snapshotTime = Number.parseFloat(params.get("time") ?? "2.25");

const runtime: HarnessRuntime = {
  ready: false,
  rendererStatus: null,
  rendererErrors: [],
  samples: [],
  frameDeltasMs: [],
  renderedFrames: 0,
  firstFrameAt: null,
  lastFrameAt: null,
  scenario,
  theme,
  mode,
  pause: () => undefined,
  play: () => undefined,
  seek: () => undefined,
  resetMeasurements: () => undefined,
};
window.__LUMATHREAD_HARNESS__ = runtime;

function useHarnessCallbacks(
  waveRef: React.RefObject<HeroWaveBackgroundHandle | null>,
) {
  const [rendererAvailable, setRendererAvailable] = useState(false);

  useEffect(() => {
    runtime.pause = () => waveRef.current?.pause();
    runtime.play = () => waveRef.current?.play();
    runtime.seek = (time: number) => waveRef.current?.seek(time);
    runtime.resetMeasurements = () => {
      runtime.samples.length = 0;
      runtime.frameDeltasMs.length = 0;
      runtime.renderedFrames = 0;
      runtime.firstFrameAt = null;
      runtime.lastFrameAt = null;
      window.__LUMATHREAD_RESET_GL_STATS__?.();
    };
  }, [waveRef]);

  return {
    rendererAvailable,
    onReady: () => {
      window.setTimeout(
        () => {
          runtime.ready = true;
          document.documentElement.dataset.harnessReady = "true";
        },
        mode === "snapshot" ? 350 : 100,
      );
    },
    onRendererStatus: (status: HeroWaveRendererStatus) => {
      runtime.rendererStatus = status;
      setRendererAvailable(
        status.renderer === "hdr" && status.supported && !status.approximate,
      );
    },
    onRendererError: (error: Error) => {
      runtime.rendererErrors.push(error.message);
    },
    onFrame: (_time: number, delta: number) => {
      const now = performance.now();
      runtime.renderedFrames += 1;
      runtime.firstFrameAt ??= now;
      runtime.lastFrameAt = now;
      runtime.frameDeltasMs.push(delta * 1000);
      if (runtime.frameDeltasMs.length > 10_000) runtime.frameDeltasMs.shift();
    },
    onPerformance: (sample: HeroWavePerformanceSample) => {
      runtime.samples.push(sample);
      if (runtime.samples.length > 2_000) runtime.samples.shift();
    },
  };
}

function sharedGlass(themeValue: HarnessTheme) {
  return {
    surfaceModel: "volumetric" as const,
    bevelMode: "dome" as const,
    ior: 1.25,
    refraction: themeValue === "light" ? 54 : 64,
    diffusion: themeValue === "light" ? 0.68 : 0.82,
    blur: themeValue === "light" ? 0.72 : 1,
    distortion: 0,
    chromaticAberration: themeValue === "light" ? 7 : 12,
    frost: themeValue === "light" ? 0.72 : 1,
    roughness: 0,
    bevel: 0,
    ribStrength: 0,
    ribWidth: 18,
    ribAngle: -18,
    liquidStrength: 0,
    liquidScale: 3.2,
    liquidSpeed: 0.22,
    edgeStrength: themeValue === "light" ? 0.62 : 0.2,
    specular: themeValue === "light" ? 0.2 : 0.4,
    fresnel: themeValue === "light" ? 1.05 : 0.76,
    twinkle: themeValue === "light" ? 0.56 : 0.82,
    twinkleDensity: 0.24,
    twinkleSpeed: 0.72,
    tint: themeValue === "light" ? "#063b49" : "#dffcff",
    tintStrength: themeValue === "light" ? 0.52 : 0.04,
    saturation: themeValue === "light" ? 0.82 : 1.44,
    brightness: themeValue === "light" ? -0.18 : 0.6,
    opacity: themeValue === "light" ? 0.98 : 0.96,
  };
}

function HeroScenario() {
  const waveRef = useRef<HeroWaveBackgroundHandle | null>(null);
  const callbacks = useHarnessCallbacks(waveRef);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const contentWidth = Math.min(800, width * 0.56);
  const contentHeight = Math.min(390, height * 0.44);
  const layout = useMemo<HeroOrbitLayout>(
    () => ({
      width,
      height,
      contentLeft: (width - contentWidth) * 0.5,
      contentTop: Math.max(72, height * 0.13),
      contentWidth,
      contentHeight,
    }),
    [contentHeight, contentWidth, height, width],
  );
  const trajectory = useMemo(() => createHeroOrbitTrajectory(layout), [layout]);
  const compact = width < 700;
  const finalGlass = sharedGlass(theme);

  return (
    <HeroWaveBackground
      ref={waveRef}
      theme={theme}
      path={{
        mode: "custom",
        points: trajectory,
        interpolation: "catmull-rom",
      }}
      shape={{
        waveY: HERO_WAVE_Y,
        strength: HERO_CURVE_STRENGTH,
        scale: HERO_CURVE_SCALE,
        frequency: 1.4,
      }}
      motion={{
        mode: "travel",
        speed: 0.6,
        curveTravel: 0.07,
        segmentLength: 1,
      }}
      material={{ preset: "soft-aurora", intensity: 0.95, glow: 1.1 }}
      palette={{
        stops: [
          { id: "hero-blue", color: "#2438ff", offset: 0 },
          { id: "hero-cyan", color: "#1adff5", offset: 0.45 },
          { id: "hero-green", color: "#22f25f", offset: 0.8 },
        ],
        interpolation: "oklab",
        wrap: "repeat",
        speed: 0.6,
      }}
      dots={{
        enabled: true,
        spacing: 28,
        opacity: 0.4,
        interaction: {
          enabled: true,
          radius: 300,
          softness: 1,
          brightness: 0.5,
          magnification: 1.05,
        },
      }}
      glassText={{
        enabled: callbacks.rendererAvailable,
        shape: "text",
        text: "Prove the strategy.",
        fontFamily: "Arial, Liberation Sans, sans-serif",
        fontWeight: "600",
        fontSize: compact ? 46 : 60,
        lineHeight: 1.05,
        letterSpacing: compact ? -1 : -1.5,
        center: { x: 0.5, y: compact ? 0.28 : 0.3 },
        maxWidth: compact ? 0.9 : 0.8,
        maxHeight: compact ? 0.18 : 0.2,
        surfaceDepth: 15,
        ...finalGlass,
        twinkleSize: 36,
        intro:
          mode === "snapshot"
            ? { delay: 0, duration: 0, blur: 0, offsetY: 0 }
            : {
                delay: 80,
                duration: 900,
                blur: 12,
                offsetY: 12,
                easing: [0.22, 1, 0.36, 1] as const,
              },
      }}
      quality="auto"
      fadeInDuration={mode === "snapshot" ? 0 : 1200}
      paused={mode === "snapshot"}
      time={mode === "snapshot" ? snapshotTime : undefined}
      respectReducedMotion={false}
      pauseWhenOffscreen={false}
      onReady={callbacks.onReady}
      onRendererStatus={callbacks.onRendererStatus}
      onRendererError={callbacks.onRendererError}
      onFrame={callbacks.onFrame}
      onPerformance={callbacks.onPerformance}
    />
  );
}

function CtaScenario() {
  const waveRef = useRef<HeroWaveBackgroundHandle | null>(null);
  const callbacks = useHarnessCallbacks(waveRef);
  const width = window.innerWidth;
  const compact = width < 700;
  const finalGlass = sharedGlass(theme);

  return (
    <HeroWaveBackground
      ref={waveRef}
      theme={theme}
      path={CTA_ACCENT_PATH}
      shape={{
        waveY: CTA_WAVE_Y,
        scale: CTA_CURVE_SCALE,
        strength: CTA_CURVE_STRENGTH,
      }}
      motion={{
        mode: "anchored",
        segmentLength: 1,
        tailTaper: 0.06,
        headTaper: 0,
      }}
      profiles={CTA_ACCENT_PROFILES}
      material={{
        preset: "neon",
        intensity: 0.4,
        glow: 1,
        upperGlowSpread: 1,
        lowerGlowSpread: 1,
      }}
      palette={{
        stops: [
          { id: "cta-blue", color: "#315bff", offset: 0 },
          { id: "cta-cyan", color: "#22d3ee", offset: 0.38 },
          { id: "cta-green", color: "#22f25f", offset: 0.76 },
        ],
        interpolation: "oklab",
        wrap: "repeat",
        speed: 1,
        hueDrift: 8,
      }}
      interaction={{
        follow: {
          activation: "canvas",
          transitionDuration: 0.55,
          mode: "cascade",
          leaveBehavior: "freeze",
          velocityInfluence: {
            intensity: 0.18,
            width: 0.12,
            glow: 0.18,
            hue: 14,
            reflection: 0.18,
          },
        },
      }}
      glassText={{
        enabled: true,
        shape: "text",
        text: "Your next strategy\ndeserves evidence.",
        fontFamily: "Arial, Liberation Sans, sans-serif",
        fontWeight: "600",
        fontSize: compact ? 38 : 48,
        lineHeight: 1,
        letterSpacing: compact ? -0.9 : -1.2,
        wrap: "explicit",
        center: { x: 0.5, y: compact ? 0.34 : 0.35 },
        maxWidth: compact ? 0.9 : 0.82,
        maxHeight: compact ? 0.34 : 0.42,
        surfaceDepth: 13,
        ...finalGlass,
        twinkleSize: 32,
        intro:
          mode === "snapshot"
            ? { delay: 0, duration: 0, blur: 0, offsetY: 0 }
            : undefined,
      }}
      dots={{
        enabled: true,
        mode: "flat",
        spacing: 30,
        opacity: 0.3,
        reflect: 1,
        interaction: {
          enabled: true,
          radius: 155,
          softness: 0.8,
          brightness: 0.24,
          color: "#22d3ee",
          colorStrength: 0.12,
          magnification: 1.08,
        },
      }}
      quality="high"
      fadeInDuration={mode === "snapshot" ? 0 : 900}
      paused={mode === "snapshot"}
      time={mode === "snapshot" ? snapshotTime : undefined}
      respectReducedMotion={false}
      pauseWhenOffscreen={false}
      onReady={callbacks.onReady}
      onRendererStatus={callbacks.onRendererStatus}
      onRendererError={callbacks.onRendererError}
      onFrame={callbacks.onFrame}
      onPerformance={callbacks.onPerformance}
    />
  );
}

function App() {
  return (
    <main
      id="harness-stage"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: theme === "light" ? "#ffffff" : "#020304",
      }}
    >
      {scenario === "cta" ? <CtaScenario /> : <HeroScenario />}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Harness root is missing.");
createRoot(root).render(<App />);
