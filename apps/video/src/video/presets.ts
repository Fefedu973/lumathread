import type {
  HeroTrajectoryPoint,
  HeroWaveBackgroundProps,
} from "@lumathread/hero-wave-background";
import {
  createHeroOrbitPreset,
  HERO_ORBIT_CURVE_TRAVEL,
  HERO_ORBIT_PASS_SECONDS,
  HERO_ORBIT_SEGMENT_LENGTH,
  HERO_ORBIT_SPEED,
} from "@lumathread/presets/hero-orbit";

const palette: NonNullable<HeroWaveBackgroundProps["palette"]> = {
  stops: [
    { id: "blue", color: "#315bff", offset: 0 },
    { id: "cyan", color: "#22d3ee", offset: 0.48 },
    { id: "green", color: "#22f25f", offset: 1 },
  ],
  interpolation: "oklab",
  wrap: "repeat",
  speed: 0.48,
  hueDrift: 5,
};

const shared: HeroWaveBackgroundProps = {
  theme: "dark",
  quality: "balanced",
  fadeInDuration: 0,
  palette,
  dots: {
    enabled: true,
    spacing: 27,
    opacity: 0.34,
    twinkle: 0.3,
    reflect: 0.56,
    masks: [
      { id: "left", x: 0.22, y: 0.5, radius: 0.76, feather: 0.64 },
      { id: "right", x: 0.8, y: 0.5, radius: 0.74, feather: 0.64 },
    ],
  },
};

export const hookPreset: HeroWaveBackgroundProps = {
  ...shared,
  path: {
    mode: "organic",
    organic: {
      pointCount: 15,
      turns: 1.2,
      amplitude: 0.88,
      roughness: 0.16,
      horizontalJitter: 0.08,
      speedVariation: 0.42,
      symmetry: 0.12,
      seed: 731,
    },
  },
  shape: { waveY: 0.56, strength: 1, scale: 0.68, frequency: 1.3 },
  motion: {
    mode: "travel",
    speed: 0.62,
    curveTravel: 0.07,
    curveMotion: 0.48,
    segmentLength: 0.92,
    tailTaper: 0.2,
    headTaper: 0.1,
  },
  material: {
    preset: "soft-aurora",
    intensity: 0.92,
    glow: 1.22,
    upperGlowSpread: 1.12,
    lowerGlowSpread: 1,
  },
};

/**
 * The renderer slides the lit segment over a modulo cycle of
 * `1 + segmentLength + 2 * 0.06`, advancing at `speed * curveTravel` per second
 * of visual time. Open Backtest runs one arrive → wrap → leave pass every ~50s;
 * a 4s shot has to cover the same cycle, so `curveTravel` is solved for the
 * scene length instead of being copied verbatim.
 */
/**
 * Open Backtest lights the whole path (`segmentLength: 1`) because its cycle
 * lasts ~50s. Compressed into a 4s shot that reads as "already wrapped" from
 * the first frame, so the segment is shortened into a comet whose arrival and
 * departure are both legible.
 */
export const ORBIT_SEGMENT_LENGTH = HERO_ORBIT_SEGMENT_LENGTH;
export const ORBIT_SPEED = HERO_ORBIT_SPEED;

/**
 * Calibrated against rendered stills rather than derived: the per-point `speed`
 * weights stretch the travel parameterisation, so the closed-form cycle length
 * does not predict the on-screen pass. At this rate the comet enters around
 * frame 10, wraps the headline through the middle of the shot and clears the
 * right edge just before the cut.
 */
export const ORBIT_CURVE_TRAVEL = HERO_ORBIT_CURVE_TRAVEL;

/** Seconds of wave time that carry one full pass. */
export const ORBIT_PASS_SECONDS = HERO_ORBIT_PASS_SECONDS;

export const heroOrbitPreset: HeroWaveBackgroundProps = createHeroOrbitPreset(
  "dark",
  { quality: "balanced", fadeInDuration: 0 },
);

/** Mirrors the live Open Backtest hero: same points, material and palette. */
export const openBacktestHeroPreset: HeroWaveBackgroundProps = {
  ...heroOrbitPreset,
  motion: { ...heroOrbitPreset.motion, curveMotion: 0.08 },
  material: {
    preset: "soft-aurora",
    intensity: 0.95,
    glow: 1.1,
    upperGlowSpread: 1.04,
    lowerGlowSpread: 1,
  },
  palette: {
    stops: [
      { id: "hero-blue", color: "#2438ff", offset: 0 },
      { id: "hero-cyan", color: "#1adff5", offset: 0.45 },
      { id: "hero-green", color: "#22f25f", offset: 0.8 },
    ],
    interpolation: "oklab",
    wrap: "repeat",
    speed: 0.6,
  },
};

// Each demo drifts the shared palette a little and swaps the material so the
// backgrounds read as different scenes instead of one look repeated.
export const sinePreset: HeroWaveBackgroundProps = {
  ...shared,
  path: { mode: "sine" },
  shape: { waveY: 0.5, strength: 1, scale: 0.55, frequency: 1.55 },
  motion: {
    mode: "propagate",
    speed: 0.62,
    curveTravel: 0.08,
    segmentLength: 0.92,
    tailTaper: 0.18,
    headTaper: 0.08,
  },
  propagation: { enabled: true, phaseSpeed: 0.82 },
  material: { preset: "neon", intensity: 0.78, glow: 1.16 },
  palette: { ...palette, hue: -18 },
};

export const organicPreset: HeroWaveBackgroundProps = {
  ...shared,
  path: {
    mode: "organic",
    organic: {
      pointCount: 13,
      turns: 1.55,
      amplitude: 1.05,
      roughness: 0.24,
      horizontalJitter: 0.1,
      speedVariation: 0.5,
      symmetry: 0,
      seed: 973,
    },
  },
  shape: { waveY: 0.52, strength: 1, scale: 0.72, frequency: 1.3 },
  motion: {
    mode: "travel",
    speed: 0.66,
    curveTravel: 0.08,
    curveMotion: 0.6,
    segmentLength: 0.88,
    tailTaper: 0.22,
    headTaper: 0.1,
  },
  material: { preset: "mist", intensity: 1, glow: 1.3 },
  palette: { ...palette, hue: 14 },
  dots: { ...shared.dots, spacing: 23, opacity: 0.42 },
};

export const svgPreset: HeroWaveBackgroundProps = {
  ...shared,
  path: {
    mode: "svg",
    svgPath:
      "M 4 56 C 18 12, 38 14, 50 42 C 60 68, 72 70, 82 48 C 89 34, 95 38, 98 52",
    svgViewBox: [0, 0, 100, 100],
  },
  shape: { waveY: 0.5, strength: 1, scale: 0.7, frequency: 1.3 },
  motion: {
    mode: "travel",
    speed: 0.58,
    segmentLength: 0.86,
    tailTaper: 0.2,
    headTaper: 0.08,
  },
  material: { preset: "mist", intensity: 0.86, glow: 1.14 },
};

/**
 * PlayStation-style glyphs. `svgPath` takes a single continuous subpath, so the
 * four marks are four filaments sharing one viewBox and one material.
 *
 * The viewBox is mapped onto the canvas axis-by-axis (x → width, y → band
 * height), so its aspect must match the on-screen mapping or circles render as
 * ellipses. 400:131 was calibrated against stills of the 1420×560 stage: it
 * yields equal horizontal and vertical pixels per viewBox unit.
 */
const GLYPH_VIEW_BOX: readonly [number, number, number, number] = [
  0, 0, 400, 131,
];
const GLYPH_RADIUS = 34;
const GLYPH_CENTER_Y = 65.5;
const GLYPH_CENTERS = [60, 160, 260, 360];

function point(x: number, y: number) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function trianglePath(cx: number, cy: number, r: number) {
  return `M ${point(cx, cy - r)} L ${point(cx + r * 0.9, cy + r * 0.72)} L ${point(cx - r * 0.9, cy + r * 0.72)} Z`;
}

function circlePath(cx: number, cy: number, r: number) {
  return `M ${point(cx - r, cy)} A ${r} ${r} 0 1 0 ${point(cx + r, cy)} A ${r} ${r} 0 1 0 ${point(cx - r, cy)}`;
}

function squarePath(cx: number, cy: number, r: number) {
  const s = r * 0.84;
  return `M ${point(cx - s, cy - s)} L ${point(cx + s, cy - s)} L ${point(cx + s, cy + s)} L ${point(cx - s, cy + s)} Z`;
}

/** The outline of an upright cross, rotated 45° into an ✕. */
function crossPath(cx: number, cy: number, r: number) {
  const arm = r;
  const half = r * 0.19;
  const upright: readonly (readonly [number, number])[] = [
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
  ];
  const k = Math.SQRT1_2;
  const rotated = upright.map(([x, y]) =>
    point(cx + (x - y) * k, cy + (x + y) * k),
  );
  return `M ${rotated.join(" L ")} Z`;
}

const GLYPH_PATHS = [
  trianglePath(GLYPH_CENTERS[0], GLYPH_CENTER_Y, GLYPH_RADIUS),
  circlePath(GLYPH_CENTERS[1], GLYPH_CENTER_Y, GLYPH_RADIUS),
  crossPath(GLYPH_CENTERS[2], GLYPH_CENTER_Y, GLYPH_RADIUS),
  squarePath(GLYPH_CENTERS[3], GLYPH_CENTER_Y, GLYPH_RADIUS),
];

export const glyphPreset: HeroWaveBackgroundProps = {
  ...shared,
  shape: { waveY: 0.5, strength: 1, scale: 0.86, frequency: 1.3 },
  // Anchored with a full-length segment: each glyph outline stays lit end to
  // end so the marks stay readable. A travelling segment only ever lights part
  // of the outline, which reads as a broken shape.
  motion: {
    mode: "anchored",
    speed: 0.5,
    segmentLength: 1,
    tailTaper: 0.02,
    headTaper: 0.02,
  },
  material: { preset: "neon", intensity: 0.92, glow: 1.2 },
  filaments: GLYPH_PATHS.map((svgPath, index) => ({
    id: `glyph-${index}`,
    path: {
      mode: "svg" as const,
      svgPath,
      svgViewBox: GLYPH_VIEW_BOX,
      closed: true,
    },
    timeOffset: index * 0.42,
    palette: { hue: index * 34 - 51 },
  })),
};

/**
 * The Open Backtest hero optics: dome volume, strong refraction, no
 * magnification — the mask bends the wave instead of zooming it. The wave
 * behind is bigger and livelier than the hook's so the refraction has real
 * amplitude to chew on. No intro block: the glass entrance is wall-clock
 * driven, which a deterministic render cannot use.
 */
export const glassPreset: HeroWaveBackgroundProps = {
  ...hookPreset,
  path: {
    mode: "organic",
    organic: {
      pointCount: 15,
      turns: 1.35,
      amplitude: 1.15,
      roughness: 0.2,
      horizontalJitter: 0.08,
      speedVariation: 0.45,
      symmetry: 0.1,
      seed: 731,
    },
  },
  shape: { waveY: 0.54, strength: 1, scale: 0.85, frequency: 1.28 },
  motion: {
    mode: "travel",
    speed: 0.78,
    curveTravel: 0.08,
    curveMotion: 0.85,
    segmentLength: 0.95,
    tailTaper: 0.2,
    headTaper: 0.1,
  },
  material: { preset: "soft-aurora", intensity: 1.05, glow: 1.35 },
  palette: { ...palette, hue: 32 },
  glassText: {
    enabled: true,
    shape: "text",
    text: "LUMA",
    fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 800,
    fontSize: 250,
    lineHeight: 0.94,
    center: { x: 0.5, y: 0.51 },
    maxWidth: 0.72,
    maxHeight: 0.5,
    surfaceModel: "volumetric",
    bevelMode: "dome",
    surfaceDepth: 15,
    ior: 1.25,
    refraction: 64,
    diffusion: 0.82,
    blur: 1,
    distortion: 0,
    chromaticAberration: 12,
    frost: 1,
    roughness: 0,
    bevel: 0,
    edgeStrength: 0.2,
    specular: 0.4,
    fresnel: 0.76,
    twinkle: 0.82,
    twinkleDensity: 0.24,
    twinkleSpeed: 0.72,
    twinkleSize: 36,
    tint: "#dffcff",
    tintStrength: 0.04,
    saturation: 1.44,
    brightness: 0.6,
    opacity: 0.96,
  },
};

/** Shared so the scene can map screen space to path space with the same numbers. */
export const INTERACTION_SHAPE = {
  waveY: 0.5,
  strength: 1,
  scale: 1.15,
  frequency: 1,
} as const;

export function interactionPreset(
  points: readonly HeroTrajectoryPoint[],
): HeroWaveBackgroundProps {
  return {
    ...shared,
    path: { mode: "custom", points },
    shape: { ...INTERACTION_SHAPE },
    motion: {
      mode: "anchored",
      speed: 0.55,
      segmentLength: 1,
      tailTaper: 0.24,
      headTaper: 0.04,
    },
    material: {
      preset: "plasma",
      intensity: 0.88,
      glow: 1.14,
      upperGlowSpread: 1.08,
      lowerGlowSpread: 1.02,
    },
    palette: { ...palette, hue: -45 },
  };
}

/**
 * Hook preset: the orbit plus the second headline line rendered as the
 * engine's refractive glass text — the same trick as the Open Backtest hero.
 * `fadeInDuration`/`fadeInEasing` are the library's built-in reveal; index.css
 * freezes CSS transitions for determinism, so the Hook mirrors the same
 * 900ms ease-out on its wrapper opacity.
 */
export const HOOK_FADE_MS = 900;

export const heroTitleGlassPreset: HeroWaveBackgroundProps = {
  ...heroOrbitPreset,
  fadeInDuration: HOOK_FADE_MS,
  fadeInEasing: "ease-out",
  glassText: {
    enabled: true,
    shape: "text",
    text: "THE PATH YOU DEFINE.",
    fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 820,
    fontSize: 110,
    lineHeight: 0.94,
    letterSpacing: -7,
    center: { x: 0.5, y: 0.495 },
    maxWidth: 0.62,
    maxHeight: 0.13,
    surfaceModel: "volumetric",
    bevelMode: "dome",
    surfaceDepth: 15,
    ior: 1.25,
    refraction: 64,
    diffusion: 0.82,
    blur: 1,
    distortion: 0,
    chromaticAberration: 12,
    frost: 1,
    roughness: 0,
    bevel: 0,
    edgeStrength: 0.2,
    specular: 0.4,
    fresnel: 0.76,
    twinkle: 0.82,
    twinkleDensity: 0.24,
    twinkleSpeed: 0.72,
    twinkleSize: 36,
    tint: "#dffcff",
    tintStrength: 0.04,
    saturation: 1.44,
    brightness: 0.6,
    opacity: 0.96,
  },
};
