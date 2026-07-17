import {
  MIN_HERO_TRAJECTORY_POINTS,
  type HeroTrajectoryPoint,
  type HeroWaveOrganicOptions,
} from "./types";

const TAU = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function finiteClamped(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return clamp(finite(value, fallback), minimum, maximum);
}

export function getHeroTrajectoryVerticalScale(
  curveScale: number,
  curveStrength: number,
) {
  return Math.max(0.38 * curveScale * curveStrength, 0.02);
}

export const HERO_DEFAULT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "trajectory-0", x: 0.04, y: 0.52, speed: 1 },
  { id: "trajectory-1", x: 0.18, y: 0.9, speed: 1 },
  { id: "trajectory-2", x: 0.36, y: 0.28, speed: 1 },
  { id: "trajectory-3", x: 0.52, y: -0.72, speed: 1 },
  { id: "trajectory-4", x: 0.64, y: -0.88, speed: 1 },
  { id: "trajectory-5", x: 0.76, y: -0.18, speed: 1 },
  { id: "trajectory-6", x: 0.86, y: 0.74, speed: 1 },
  { id: "trajectory-7", x: 0.96, y: 0.92, speed: 1 },
];

function seededTrajectoryValue(seed: number, index: number) {
  const value = Math.sin((seed + index * 137.17) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function createHeroOrganicTrajectory(
  seed: number,
  pointCount = 12,
  options: HeroWaveOrganicOptions = {},
): HeroTrajectoryPoint[] {
  const resolvedSeed = Math.trunc(finite(options.seed, seed));
  const count = Math.max(
    MIN_HERO_TRAJECTORY_POINTS,
    Math.trunc(finite(options.pointCount, pointCount)),
  );
  const horizontalPhase = seededTrajectoryValue(resolvedSeed, 31) * Math.PI;
  const verticalPhase = seededTrajectoryValue(resolvedSeed, 47) * Math.PI;
  const turns = finite(
    options.turns,
    0.9 + Math.abs(seededTrajectoryValue(resolvedSeed, 53)) * 1.3,
  );
  const amplitude = finiteClamped(options.amplitude, 0.92, 0, 4);
  const roughness = finiteClamped(options.roughness, 0.28, 0, 1);
  const horizontalJitter = finiteClamped(
    options.horizontalJitter,
    0.08 + Math.abs(seededTrajectoryValue(resolvedSeed, 61)) * 0.12,
    0,
    0.45,
  );
  const speedVariation = finiteClamped(options.speedVariation, 0.7, 0, 3);
  const symmetry = finiteClamped(options.symmetry, 0, 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const progress = index / Math.max(count - 1, 1);
    const primary = Math.sin(progress * TAU * turns + verticalPhase);
    const secondary = Math.sin(
      progress * Math.PI * (3.2 + turns) - verticalPhase * 0.7,
    );
    const tertiary = seededTrajectoryValue(resolvedSeed, index + 191);
    const mirroredProgress = 1 - progress;
    const symmetricPrimary = Math.sin(
      mirroredProgress * TAU * turns + verticalPhase,
    );
    const shape =
      (primary * (1 - roughness * 0.35) +
        secondary * roughness * 0.55 +
        tertiary * roughness * 0.18) *
        (1 - symmetry) +
      (primary + symmetricPrimary) * 0.5 * symmetry;
    const x =
      0.04 +
      progress * 0.92 +
      Math.sin(progress * TAU * turns + horizontalPhase) * horizontalJitter;
    return {
      id: `organic-${resolvedSeed}-${index}`,
      x: clamp(x, -0.25, 1.25),
      y: clamp(shape * amplitude, -4, 4),
      speed: clamp(
        1 +
          seededTrajectoryValue(resolvedSeed, index + 73) *
            speedVariation *
            0.5,
        0.05,
        16,
      ),
    };
  });
}
