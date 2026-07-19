import { getHeroTrajectoryVerticalScale } from "../trajectory";
import type {
  HeroTrajectoryPoint,
  HeroWaveBackgroundProps,
  HeroWaveTheme,
} from "../types";

export const HERO_ORBIT_WAVE_Y = 0.28;
export const HERO_ORBIT_SCALE = 0.55;
export const HERO_ORBIT_STRENGTH = 1;
export const HERO_ORBIT_SEGMENT_LENGTH = 0.42;
export const HERO_ORBIT_SPEED = 0.6;
export const HERO_ORBIT_CURVE_TRAVEL = 0.135;
export const HERO_ORBIT_PASS_SECONDS = 4;

const HERO_ORBIT_SCREEN_POINTS = [
  { id: "entry-0", x: -0.1, y: 0.6, speed: 0.3 },
  { id: "entry-1", x: 0.08, y: 0.64, speed: 0.34 },
  { id: "entry-2", x: 0.18, y: 0.5, speed: 0.52 },
  { id: "orbit-0", x: 0.26, y: 0.7, speed: 0.9 },
  { id: "orbit-1", x: 0.5, y: 0.79, speed: 2.35 },
  { id: "orbit-2", x: 0.75, y: 0.69, speed: 2.45 },
  { id: "orbit-3", x: 0.87, y: 0.48, speed: 2.55 },
  { id: "orbit-4", x: 0.76, y: 0.22, speed: 2.5 },
  { id: "orbit-5", x: 0.5, y: 0.16, speed: 2.4 },
  { id: "orbit-6", x: 0.24, y: 0.22, speed: 2.3 },
  { id: "orbit-7", x: 0.13, y: 0.48, speed: 2.2 },
  { id: "orbit-8", x: 0.25, y: 0.69, speed: 2.15 },
  { id: "orbit-9", x: 0.5, y: 0.79, speed: 1.55 },
  { id: "exit-0", x: 0.74, y: 0.65, speed: 0.78 },
  { id: "exit-1", x: 0.9, y: 0.53, speed: 0.44 },
  { id: "exit-2", x: 1.1, y: 0.61, speed: 0.3 },
] as const;

const HERO_ORBIT_DESIGN_POINTS = [
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
] as const;

const verticalScale = getHeroTrajectoryVerticalScale(
  HERO_ORBIT_SCALE,
  HERO_ORBIT_STRENGTH,
);
const bandHeight = 1 - HERO_ORBIT_WAVE_Y;

export const HERO_ORBIT_POINTS: readonly HeroTrajectoryPoint[] =
  HERO_ORBIT_SCREEN_POINTS.map((point) => ({
    ...point,
    y: (1 - point.y - bandHeight) / verticalScale,
  }));

export interface HeroOrbitLayout {
  width: number;
  height: number;
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
}

/**
 * Project the orbit in CSS-pixel space around real content. Its 1.7:1 shape
 * remains stable instead of stretching with the canvas aspect ratio.
 */
export function createResponsiveHeroOrbitPoints(
  layout: HeroOrbitLayout,
): readonly HeroTrajectoryPoint[] {
  const width = Math.max(layout.width, 1);
  const height = Math.max(layout.height, 1);
  const horizontalPadding = Math.min(120, Math.max(28, width * 0.075));
  const verticalPadding = Math.min(72, Math.max(32, height * 0.045));
  const centerX = layout.contentLeft + layout.contentWidth * 0.5;
  const centerY = layout.contentTop + layout.contentHeight * 0.5;
  const radiusX = Math.min(
    width * 0.56,
    layout.contentWidth * 0.5 + horizontalPadding,
  );
  const radiusY = Math.max(
    layout.contentHeight * 0.5 + verticalPadding,
    radiusX / 1.7,
  );
  const margin = Math.max(width * 0.12, 96);
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
      return orbitRight + progress * (width + margin - orbitRight);
    }
    return centerX + ((value - 0.5) / 0.26) * radiusX;
  };
  const mapY = (value: number) => centerY - ((value - 0.02) / 0.98) * radiusY;

  return HERO_ORBIT_DESIGN_POINTS.map((point) => ({
    id: point.id,
    x: mapX(point.x) / width,
    y:
      (1 - mapY(point.y) / height - bandHeight) /
      Math.max(verticalScale, 0.0001),
    speed: point.speed,
  }));
}

export interface HeroOrbitPresetOptions {
  curveTravel?: number;
  fadeInDuration?: number;
  quality?: HeroWaveBackgroundProps["quality"];
  layout?: HeroOrbitLayout;
}

/** Shared by the website hero and the opening Remotion shot. */
export function createHeroOrbitPreset(
  theme: HeroWaveTheme,
  options: HeroOrbitPresetOptions = {},
): HeroWaveBackgroundProps {
  return {
    theme,
    quality: options.quality ?? "balanced",
    fadeInDuration: options.fadeInDuration ?? 700,
    path: {
      mode: "custom",
      points: options.layout
        ? createResponsiveHeroOrbitPoints(options.layout)
        : HERO_ORBIT_POINTS,
      interpolation: "catmull-rom",
    },
    shape: {
      waveY: HERO_ORBIT_WAVE_Y,
      strength: HERO_ORBIT_STRENGTH,
      scale: HERO_ORBIT_SCALE,
      frequency: 1.4,
    },
    motion: {
      mode: "travel",
      speed: HERO_ORBIT_SPEED,
      curveTravel: options.curveTravel ?? HERO_ORBIT_CURVE_TRAVEL,
      curveMotion: 0.12,
      segmentLength: HERO_ORBIT_SEGMENT_LENGTH,
      tailTaper: 0.24,
      headTaper: 0.14,
    },
    material: {
      preset: "soft-aurora",
      intensity: theme === "light" ? 0.82 : 0.95,
      glow: 1.1,
      upperGlowSpread: 1.04,
      lowerGlowSpread: 1,
    },
    palette: {
      stops:
        theme === "light"
          ? [
              { id: "hero-blue", color: "#2447db", offset: 0 },
              { id: "hero-cyan", color: "#0891b2", offset: 0.48 },
              { id: "hero-green", color: "#16a34a", offset: 1 },
            ]
          : [
              { id: "hero-blue", color: "#315bff", offset: 0 },
              { id: "hero-cyan", color: "#22d3ee", offset: 0.48 },
              { id: "hero-green", color: "#22f25f", offset: 1 },
            ],
      interpolation: "oklab",
      wrap: "repeat",
      speed: 0.48,
      hueDrift: 5,
    },
    dots: {
      enabled: true,
      spacing: 27,
      opacity: theme === "light" ? 0.2 : 0.34,
      twinkle: 0.3,
      reflect: theme === "light" ? 0.4 : 0.56,
      masks: [
        { id: "left", x: 0.22, y: 0.5, radius: 0.76, feather: 0.64 },
        { id: "right", x: 0.8, y: 0.5, radius: 0.74, feather: 0.64 },
      ],
      interaction: {
        enabled: true,
        radius: 250,
        softness: 0.8,
        brightness: 0.26,
        magnification: 1.03,
      },
    },
  };
}
