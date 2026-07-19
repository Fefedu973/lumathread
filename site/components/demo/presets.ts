import type {
  HeroWaveBackgroundProps,
  HeroWaveFilamentConfig,
  HeroWaveTheme,
} from "@/hero-wave-background";

/**
 * Shared scene definitions for the documentation demos. Each builder returns
 * complete renderer props for one capability, themed for the current site
 * appearance.
 */

export const DEMO_PALETTE: NonNullable<HeroWaveBackgroundProps["palette"]> = {
  stops: [
    { id: "blue", color: "#315bff", offset: 0 },
    { id: "cyan-in", color: "#22d3ee", offset: 0.25 },
    { id: "green", color: "#22f25f", offset: 0.5 },
    { id: "cyan-out", color: "#22d3ee", offset: 0.75 },
    { id: "blue-loop", color: "#315bff", offset: 1 },
  ],
  interpolation: "oklab",
  wrap: "repeat",
  speed: 0.42,
  hueDrift: 4,
};

function shared(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    theme,
    quality: "high",
    fadeInDuration: 700,
    palette: DEMO_PALETTE,
  };
}

export function auroraPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: {
      mode: "organic",
      organic: {
        pointCount: 14,
        turns: 1.35,
        amplitude: 0.84,
        roughness: 0.2,
        horizontalJitter: 0.1,
        speedVariation: 0.45,
        symmetry: 0.12,
        seed: 731,
      },
    },
    shape: { waveY: 0.55, strength: 1, scale: 0.62, frequency: 1.35 },
    motion: {
      mode: "travel",
      speed: 0.6,
      curveTravel: 0.07,
      curveMotion: 0.55,
      segmentLength: 0.9,
      tailTaper: 0.2,
      headTaper: 0.12,
    },
    material: {
      preset: "soft-aurora",
      intensity: 0.86,
      glow: 1.12,
      upperGlowSpread: 1.08,
      lowerGlowSpread: 0.95,
    },
    dots: {
      enabled: true,
      spacing: 27,
      opacity: theme === "light" ? 0.22 : 0.34,
      twinkle: 0.22,
      reflect: 0.5,
      interaction: {
        enabled: true,
        radius: 250,
        softness: 0.8,
        brightness: 0.32,
        magnification: 1.03,
      },
    },
  };
}

export function signalPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "sine" },
    shape: { waveY: 0.55, strength: 1, scale: 0.5, frequency: 1.7 },
    motion: {
      mode: "propagate",
      speed: 0.62,
      curveTravel: 0.08,
      segmentLength: 0.86,
      tailTaper: 0.22,
      headTaper: 0.12,
    },
    propagation: { enabled: true, phaseSpeed: 0.82 },
    material: { preset: "neon", intensity: 0.72, glow: 1.18 },
  };
}

export function cursorPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "follow" },
    motion: { mode: "anchored", segmentLength: 0.82, speed: 0.72 },
    interaction: {
      follow: {
        mode: "cascade",
        memorySeconds: 0.9,
        headResponse: 1,
        leaveBehavior: "idle",
        pointerTypes: ["mouse", "pen", "touch"],
        velocityInfluence: {
          intensity: 0.14,
          width: 0.08,
          glow: 0.12,
          hue: 10,
          reflection: 0.12,
        },
      },
    },
    material: { preset: "plasma", intensity: 0.8, glow: 1.05 },
  };
}

export function ripplePreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "sine" },
    shape: { waveY: 0.5, strength: 0.9, scale: 0.55, frequency: 1.2 },
    motion: {
      mode: "anchored",
      segmentLength: 1,
      tailTaper: 0,
      headTaper: 0,
      speed: 0.5,
    },
    material: { preset: "neon", intensity: 0.78, glow: 1.1 },
    interaction: {
      filament: {
        enabled: true,
        target: "canvas",
        radius: 80,
        strength: 0.045,
        propagationSpeed: 0.72,
        frequency: 2.8,
        damping: 2.2,
        spatialDecay: 0.8,
        duration: 2.4,
        direction: "push",
      },
    },
  };
}

export function glassPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...auroraPreset(theme),
    shape: { waveY: 0.52, strength: 1, scale: 0.58, frequency: 1.35 },
    glassText: {
      enabled: true,
      shape: "text",
      text: "LUMA",
      fontWeight: 800,
      surfaceModel: "volumetric",
      bevelMode: "biconvex",
      surfaceDepth: 40,
      ior: 1.52,
      magnification: 0.85,
      refraction: 32,
      edgeWrap: 38,
      blur: 0.08,
      chromaticAberration: 1.6,
      frost: 0.04,
      roughness: 0.14,
      bevel: 1.7,
      specular: 1.15,
      fresnel: 0.9,
      tint: "#e8fdff",
      tintStrength: 0.04,
      opacity: 0.96,
    },
  };
}

export function terrainPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "sine" },
    shape: { waveY: 0.42, strength: 0.9, scale: 0.55, frequency: 1.4 },
    motion: {
      mode: "travel",
      speed: 0.55,
      segmentLength: 0.85,
      tailTaper: 0.2,
      headTaper: 0.12,
    },
    material: { preset: "soft-aurora", intensity: 0.72, glow: 0.98 },
    palette: {
      stops: [
        { id: "terrain-white-start", color: "#ffffff", offset: 0 },
        { id: "terrain-white-end", color: "#ffffff", offset: 1 },
      ],
      interpolation: "oklab",
      wrap: "mirror",
      speed: 0.2,
    },
    dots: {
      enabled: true,
      mode: "terrain",
      opacity: theme === "light" ? 0.36 : 0.58,
      twinkle: 0.24,
      reflect: 0.42,
      terrain: {
        columns: 94,
        rows: 48,
        width: 7.4,
        depth: 5.8,
        amplitude: 0.45,
        speed: 0.48,
        viewAngle: 18,
        cameraDistance: 2.1,
        frequency: 1.35,
        pointSize: 2,
        edgeFade: 0.34,
        fit: "cover",
        contentFade: 0.24,
        colorLow: "#ffffff",
        colorHigh: "#ffffff",
      },
      interaction: {
        enabled: true,
        radius: 220,
        softness: 0.75,
        brightness: 0.24,
        color: "#ffffff",
        colorStrength: 0,
        magnification: 1.03,
        terrainDisplacement: 0.42,
      },
    },
  };
}

export function profilesPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "sine" },
    shape: { waveY: 0.5, strength: 1, scale: 0.55, frequency: 1.5 },
    motion: {
      mode: "travel",
      speed: 0.75,
      segmentLength: 0.62,
      tailTaper: 0.4,
      headTaper: 0.05,
    },
    profiles: {
      width: "head",
      intensity: "head",
      opacity: "smoothstep",
      glow: "head",
    },
    material: { preset: "plasma", intensity: 0.85, glow: 1.15 },
  };
}

export function scenePreset(theme: HeroWaveTheme): {
  background: HeroWaveBackgroundProps;
  filaments: readonly HeroWaveFilamentConfig[];
} {
  const base = shared(theme);
  return {
    background: {
      ...base,
      shape: { waveY: 0.5, strength: 1, scale: 0.6, frequency: 1.3 },
      material: { preset: "soft-aurora", intensity: 0.8, glow: 1.05 },
    },
    filaments: [
      {
        id: "back",
        path: {
          mode: "organic",
          organic: { seed: 101, pointCount: 12, amplitude: 0.7 },
        },
        motion: { mode: "travel", speed: 0.45, segmentLength: 0.95 },
        material: { intensity: 0.5, glow: 0.9 },
        timeOffset: 2.2,
      },
      {
        id: "mid",
        path: {
          mode: "organic",
          organic: { seed: 412, pointCount: 14, amplitude: 0.85 },
        },
        motion: { mode: "travel", speed: 0.6, segmentLength: 0.85 },
        material: { intensity: 0.75, glow: 1.05 },
        palette: { hue: 40 },
        timeOffset: 0.9,
      },
      {
        id: "front",
        path: {
          mode: "organic",
          organic: { seed: 977, pointCount: 15, amplitude: 0.95 },
        },
        motion: { mode: "travel", speed: 0.72, segmentLength: 0.75 },
        material: { intensity: 0.95, glow: 1.2 },
        palette: { hue: -35 },
      },
    ],
  };
}

export function palettePreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: { mode: "sine" },
    shape: { waveY: 0.5, strength: 0.95, scale: 0.55, frequency: 1.6 },
    motion: { mode: "travel", speed: 0.6, segmentLength: 0.9 },
    material: { preset: "neon", intensity: 0.8, glow: 1.1 },
    palette: {
      stops: [
        { id: "magenta", color: "#f02df2", offset: 0 },
        { id: "amber", color: "#ffb545", offset: 0.35 },
        { id: "cyan", color: "#22d3ee", offset: 0.7 },
        { id: "violet", color: "#8b5cf6", offset: 1 },
      ],
      interpolation: "oklab",
      wrap: "mirror",
      speed: 1.4,
      hueDrift: 30,
    },
  };
}

const GLYPH_VIEW_BOX = [0, 0, 400, 205] as const;
const GLYPH_CENTER_Y = 102.5;
const GLYPH_RADIUS = 38;
const GLYPH_CENTERS = [55, 150, 250, 345] as const;

function svgPoint(x: number, y: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function trianglePath(cx: number, cy: number, radius: number) {
  return `M ${svgPoint(cx, cy - radius)} L ${svgPoint(cx + radius * 0.9, cy + radius * 0.72)} L ${svgPoint(cx - radius * 0.9, cy + radius * 0.72)} Z`;
}

function circlePath(cx: number, cy: number, radius: number) {
  return `M ${svgPoint(cx - radius, cy)} A ${radius} ${radius} 0 1 0 ${svgPoint(cx + radius, cy)} A ${radius} ${radius} 0 1 0 ${svgPoint(cx - radius, cy)}`;
}

function crossPath(cx: number, cy: number, radius: number) {
  const arm = radius;
  const half = radius * 0.19;
  const upright = [
    [-half, -arm],
    [half, -arm],
    [half, -half],
    [arm, -half],
    [arm, half],
    [half, half],
    [half, arm],
    [-half, arm],
    [-half, half],
    [-arm, half],
    [-arm, -half],
    [-half, -half],
  ] as const;
  const rotation = Math.SQRT1_2;
  const points = upright.map(([x, y]) =>
    svgPoint(cx + (x - y) * rotation, cy + (x + y) * rotation),
  );
  return `M ${points.join(" L ")} Z`;
}

function squarePath(cx: number, cy: number, radius: number) {
  const half = radius * 0.84;
  return `M ${svgPoint(cx - half, cy - half)} L ${svgPoint(cx + half, cy - half)} L ${svgPoint(cx + half, cy + half)} L ${svgPoint(cx - half, cy + half)} Z`;
}

const GLYPH_PATHS = [
  trianglePath(GLYPH_CENTERS[0], GLYPH_CENTER_Y, GLYPH_RADIUS),
  circlePath(GLYPH_CENTERS[1], GLYPH_CENTER_Y, GLYPH_RADIUS),
  crossPath(GLYPH_CENTERS[2], GLYPH_CENTER_Y, GLYPH_RADIUS),
  squarePath(GLYPH_CENTERS[3], GLYPH_CENTER_Y, GLYPH_RADIUS),
] as const;

export function svgPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    shape: { waveY: 0.5, strength: 1, scale: 0.92, frequency: 1.3 },
    motion: {
      mode: "anchored",
      speed: 0.5,
      segmentLength: 1,
      tailTaper: 0,
      headTaper: 0,
    },
    material: { preset: "neon", intensity: 0.84, glow: 1.08 },
    filaments: GLYPH_PATHS.map((svgPath, index) => ({
      id: `playstation-glyph-${index}`,
      path: {
        mode: "svg",
        svgPath,
        svgViewBox: GLYPH_VIEW_BOX,
        closed: true,
        closedLoopTaper: false,
      },
      timeOffset: index * 0.42,
      palette: { hue: index * 18 - 27 },
    })),
  };
}
