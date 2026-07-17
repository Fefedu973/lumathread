import { clamp, finiteClamped } from "../math";
import type { HeroWaveFadeEasing, HeroWaveFadeEasingPreset } from "../types";

const FADE_EASING_POINTS: Record<
  HeroWaveFadeEasingPreset,
  readonly [number, number, number, number]
> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

export function resolveFadeInEasing(
  input: HeroWaveFadeEasing | undefined,
  fallback: string,
) {
  if (input && typeof input !== "string") {
    const x1 = finiteClamped(input[0], 0, 0, 1);
    const y1 = finiteClamped(input[1], 0, -4, 4);
    const x2 = finiteClamped(input[2], 1, 0, 1);
    const y2 = finiteClamped(input[3], 1, -4, 4);
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  }
  return typeof input === "string" ? input : fallback;
}

export function resolveFadeEasingPoints(
  input: HeroWaveFadeEasing | undefined,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] {
  if (typeof input === "string") return FADE_EASING_POINTS[input];
  if (!input) return fallback;
  return [
    finiteClamped(input[0], fallback[0], 0, 1),
    finiteClamped(input[1], fallback[1], -4, 4),
    finiteClamped(input[2], fallback[2], 0, 1),
    finiteClamped(input[3], fallback[3], -4, 4),
  ];
}

function cubicBezierCoordinate(first: number, second: number, amount: number) {
  const inverse = 1 - amount;
  return (
    3 * inverse * inverse * amount * first +
    3 * inverse * amount * amount * second +
    amount * amount * amount
  );
}

export function evaluateFadeEasing(
  progress: number,
  easing: readonly [number, number, number, number],
) {
  const target = clamp(progress, 0, 1);
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 12; iteration++) {
    const amount = (lower + upper) * 0.5;
    if (cubicBezierCoordinate(easing[0], easing[2], amount) < target) {
      lower = amount;
    } else {
      upper = amount;
    }
  }
  return cubicBezierCoordinate(easing[1], easing[3], (lower + upper) * 0.5);
}
