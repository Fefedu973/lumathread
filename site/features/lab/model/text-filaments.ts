import {
  MIN_HERO_TRAJECTORY_POINTS,
  getHeroTrajectoryVerticalScale,
  type HeroTrajectoryPoint,
  type HeroWaveFilamentConfig,
} from "@/hero-wave-background";
import type { LabState } from "./types";

type GlyphPoint = readonly [number, number];

type GlyphStroke = readonly GlyphPoint[];

const STROKE_GLYPHS: Record<string, readonly GlyphStroke[]> = {
  A: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
    [
      [0.2, 0.62],
      [0.8, 0.62],
    ],
  ],
  B: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
      [0.65, 0.5],
      [1, 0.76],
      [0.62, 1],
      [0, 1],
    ],
  ],
  C: [
    [
      [1, 0.08],
      [0.72, 0],
      [0.18, 0.08],
      [0, 0.5],
      [0.18, 0.92],
      [0.72, 1],
      [1, 0.92],
    ],
  ],
  D: [
    [
      [0, 1],
      [0, 0],
      [0.55, 0],
      [1, 0.22],
      [1, 0.78],
      [0.55, 1],
      [0, 1],
    ],
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
      [0, 1],
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  F: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  G: [
    [
      [1, 0.1],
      [0.68, 0],
      [0.16, 0.1],
      [0, 0.5],
      [0.16, 0.9],
      [0.7, 1],
      [1, 0.82],
      [1, 0.56],
      [0.58, 0.56],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
      [0, 0.5],
      [1, 0.5],
      [1, 0],
      [1, 1],
    ],
  ],
  I: [
    [
      [0, 0],
      [1, 0],
      [0.5, 0],
      [0.5, 1],
      [0, 1],
      [1, 1],
    ],
  ],
  J: [
    [
      [0, 0],
      [1, 0],
      [0.72, 0],
      [0.72, 0.78],
      [0.52, 1],
      [0.16, 0.94],
      [0, 0.76],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
      [0, 0.5],
      [1, 0],
      [0, 0.5],
      [1, 1],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  M: [
    [
      [0, 1],
      [0, 0],
      [0.5, 0.48],
      [1, 0],
      [1, 1],
    ],
  ],
  N: [
    [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0],
    ],
  ],
  O: [
    [
      [0.5, 0],
      [0.16, 0.08],
      [0, 0.5],
      [0.16, 0.92],
      [0.5, 1],
      [0.84, 0.92],
      [1, 0.5],
      [0.84, 0.08],
      [0.5, 0],
    ],
  ],
  P: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
    ],
  ],
  Q: [
    [
      [0.5, 0],
      [0.16, 0.08],
      [0, 0.5],
      [0.16, 0.92],
      [0.5, 1],
      [0.84, 0.92],
      [1, 0.5],
      [0.84, 0.08],
      [0.5, 0],
    ],
    [
      [0.58, 0.65],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 1],
      [0, 0],
      [0.62, 0],
      [1, 0.22],
      [0.62, 0.5],
      [0, 0.5],
      [0.55, 0.5],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 0.08],
      [0.7, 0],
      [0.18, 0.08],
      [0, 0.35],
      [0.22, 0.5],
      [0.78, 0.5],
      [1, 0.68],
      [0.82, 0.94],
      [0.28, 1],
      [0, 0.9],
    ],
  ],
  T: [
    [
      [0, 0],
      [1, 0],
      [0.5, 0],
      [0.5, 1],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 0.75],
      [0.2, 1],
      [0.8, 1],
      [1, 0.75],
      [1, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [0.2, 1],
      [0.5, 0.58],
      [0.8, 1],
      [1, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  ],
  Y: [
    [
      [0, 0],
      [0.5, 0.5],
      [1, 0],
      [0.5, 0.5],
      [0.5, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  "0": [
    [
      [0.5, 0],
      [0.12, 0.1],
      [0, 0.5],
      [0.12, 0.9],
      [0.5, 1],
      [0.88, 0.9],
      [1, 0.5],
      [0.88, 0.1],
      [0.5, 0],
    ],
  ],
  "1": [
    [
      [0.2, 0.2],
      [0.5, 0],
      [0.5, 1],
      [0.2, 1],
      [0.8, 1],
    ],
  ],
  "2": [
    [
      [0, 0.2],
      [0.25, 0],
      [0.8, 0],
      [1, 0.25],
      [0, 1],
      [1, 1],
    ],
  ],
  "3": [
    [
      [0, 0.08],
      [0.75, 0],
      [1, 0.25],
      [0.55, 0.5],
      [1, 0.75],
      [0.75, 1],
      [0, 0.92],
    ],
  ],
  "4": [
    [
      [0.8, 1],
      [0.8, 0],
      [0, 0.68],
      [1, 0.68],
    ],
  ],
  "5": [
    [
      [1, 0],
      [0, 0],
      [0, 0.5],
      [0.78, 0.5],
      [1, 0.72],
      [0.78, 1],
      [0, 0.92],
    ],
  ],
  "6": [
    [
      [0.9, 0.08],
      [0.25, 0],
      [0, 0.55],
      [0.18, 0.95],
      [0.75, 1],
      [1, 0.72],
      [0.75, 0.5],
      [0, 0.55],
    ],
  ],
  "7": [
    [
      [0, 0],
      [1, 0],
      [0.25, 1],
    ],
  ],
  "8": [
    [
      [0.5, 0.5],
      [0.08, 0.25],
      [0.5, 0],
      [0.92, 0.25],
      [0.5, 0.5],
      [0.08, 0.75],
      [0.5, 1],
      [0.92, 0.75],
      [0.5, 0.5],
    ],
  ],
  "9": [
    [
      [1, 0.45],
      [0.82, 0.05],
      [0.25, 0],
      [0, 0.28],
      [0.25, 0.5],
      [1, 0.45],
      [0.75, 1],
      [0.1, 0.92],
    ],
  ],
  "-": [
    [
      [0.1, 0.5],
      [0.9, 0.5],
    ],
  ],
};

function textStrokeIsClosed(stroke: GlyphStroke) {
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  return Boolean(
    first &&
      last &&
      Math.abs(first[0] - last[0]) < 0.0001 &&
      Math.abs(first[1] - last[1]) < 0.0001,
  );
}

function densifyTextStroke(stroke: GlyphStroke, closed: boolean) {
  const source = closed ? stroke.slice(0, -1) : [...stroke];
  if (source.length >= MIN_HERO_TRAJECTORY_POINTS) return source;
  const points = [...source];
  while (points.length < MIN_HERO_TRAJECTORY_POINTS) {
    let longestIndex = 0;
    let longestLength = -1;
    const segmentCount = closed ? points.length : points.length - 1;
    for (let index = 0; index < segmentCount; index++) {
      const from = points[index]!;
      const to = points[(index + 1) % points.length]!;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (length > longestLength) {
        longestLength = length;
        longestIndex = index;
      }
    }
    const from = points[longestIndex]!;
    const to = points[(longestIndex + 1) % points.length]!;
    points.splice(longestIndex + 1, 0, [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
    ]);
  }
  return points;
}

export function buildTextFilaments(state: LabState): HeroWaveFilamentConfig[] {
  const text = state.text.toUpperCase().slice(0, 12);
  const glyphWidth = state.textHeight * 0.62;
  const gap = glyphWidth * state.textLetterSpacing;
  const advances = Array.from(text, (character) =>
    character === " " ? glyphWidth * 0.7 : glyphWidth + gap,
  );
  const totalWidth = Math.max(
    0,
    advances.reduce((sum, value) => sum + value, 0) - gap,
  );
  const verticalScale = getHeroTrajectoryVerticalScale(
    state.shape.scale,
    state.shape.strength,
  );
  let cursor = 0.5 - totalWidth / 2;
  let filamentIndex = 0;
  const filaments: HeroWaveFilamentConfig[] = [];
  Array.from(text).forEach((character, characterIndex) => {
    if (character === " ") {
      cursor += advances[characterIndex] ?? glyphWidth;
      return;
    }
    const strokes = STROKE_GLYPHS[character] ?? STROKE_GLYPHS.X!;
    strokes.forEach((stroke, strokeIndex) => {
      const closed = textStrokeIsClosed(stroke);
      const points = densifyTextStroke(stroke, closed).map(
        ([localX, localTop], pointIndex) => {
          const top = state.textY + (localTop - 0.5) * state.textHeight;
          return {
            id: `text-${characterIndex}-${strokeIndex}-${pointIndex}`,
            x: cursor + localX * glyphWidth,
            y: (state.shape.waveY - top) / verticalScale,
            speed: 1,
          } satisfies HeroTrajectoryPoint;
        },
      );
      filaments.push({
        id: `text-${characterIndex}-${strokeIndex}`,
        timeOffset: characterIndex * state.textStagger,
        path: {
          mode: "custom",
          points,
          closed,
          closedLoopTaper: false,
          interpolation: "linear",
        },
        motion: {
          mode: "anchored",
          curveTravel: 0,
          pathDrift: 0,
          curveMotion: 0,
          segmentLength: 1.5,
          tailTaper: closed ? 0.001 : 0.025,
          headTaper: closed ? 0.001 : 0.025,
          speed: state.motion.speed,
        },
        palette: {
          hue: state.hue + filamentIndex * state.textHueSpread,
          speed: state.paletteSpeed,
          hueDrift: state.hueDrift,
        },
      });
      filamentIndex += 1;
    });
    cursor += advances[characterIndex] ?? glyphWidth;
  });
  return filaments;
}
