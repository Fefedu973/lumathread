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
    { id: "cyan", color: "#22d3ee", offset: 0.48 },
    { id: "green", color: "#22f25f", offset: 1 },
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
    material: { preset: "soft-aurora", intensity: 0.8, glow: 1.05 },
    dots: {
      enabled: true,
      mode: "terrain",
      opacity: theme === "light" ? 0.5 : 0.75,
      twinkle: 0.2,
      terrain: {
        rows: 34,
        amplitude: 0.9,
        speed: 0.6,
        viewAngle: 0.62,
        pointSize: 2.4,
        edgeFade: 0.24,
      },
      interaction: {
        enabled: true,
        radius: 220,
        softness: 0.75,
        brightness: 0.4,
        magnification: 1.05,
        terrainDisplacement: 0.5,
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

export function svgPreset(theme: HeroWaveTheme): HeroWaveBackgroundProps {
  return {
    ...shared(theme),
    path: {
      mode: "svg",
      svgPath:
        "M 8 50 C 22 12, 40 12, 50 38 C 58 58, 70 62, 80 48 C 88 36, 94 40, 96 50",
      svgViewBox: [0, 0, 100, 100],
    },
    shape: { waveY: 0.5, strength: 1, scale: 0.66, frequency: 1.3 },
    motion: {
      mode: "travel",
      speed: 0.55,
      segmentLength: 0.8,
      tailTaper: 0.25,
      headTaper: 0.1,
    },
    material: { preset: "mist", intensity: 0.85, glow: 1.1 },
  };
}
