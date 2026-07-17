import type {
  HeroWaveFilamentPointerDirection,
  HeroWavePointerType,
} from "../types";
import { clamp } from "../math";

const TAU = Math.PI * 2;

export interface FilamentPathSample {
  x: number;
  y: number;
  speed: number;
  progress: number;
  arcProgress: number;
}

export interface ResolvedFilamentPointerConfig {
  enabled: boolean;
  target: "canvas" | "viewport";
  pointerTypes: readonly HeroWavePointerType[];
  radius: number;
  strength: number;
  propagationSpeed: number;
  frequency: number;
  damping: number;
  spatialDecay: number;
  duration: number;
  cooldown: number;
  maxImpulses: number;
  direction: HeroWaveFilamentPointerDirection;
}

export interface FilamentDisturbanceImpulse {
  progress: number;
  startedAt: number;
  strength: number;
  normalSign: number;
}

export interface ClosestFilamentLocation {
  distanceCssPx: number;
  progress: number;
  normalSign: number;
}

function copySample(
  source: FilamentPathSample,
  target: FilamentPathSample | undefined,
) {
  const output = target ?? {
    x: 0,
    y: 0,
    speed: 1,
    progress: 0,
    arcProgress: 0,
  };
  output.x = source.x;
  output.y = source.y;
  output.speed = source.speed;
  output.progress = source.progress;
  output.arcProgress = source.arcProgress;
  return output;
}

function pathDistance(first: number, second: number, closed: boolean) {
  const direct = Math.abs(first - second);
  return closed ? Math.min(direct, 1 - direct) : direct;
}

export function findClosestFilamentLocation(
  samples: readonly FilamentPathSample[],
  closed: boolean,
  pointerX: number,
  pointerY: number,
  widthCssPx: number,
  heightCssPx: number,
): ClosestFilamentLocation | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const duplicateClosure = Boolean(
    closed &&
      first &&
      last &&
      Math.abs(first.x - last.x) < 0.000001 &&
      Math.abs(first.y - last.y) < 0.000001,
  );
  const segmentCount = closed
    ? duplicateClosure
      ? samples.length - 1
      : samples.length
    : samples.length - 1;
  const px = pointerX * widthCssPx;
  const py = pointerY * heightCssPx;
  let closest: ClosestFilamentLocation | null = null;

  for (let index = 0; index < segmentCount; index++) {
    const start = samples[index];
    const end = samples[(index + 1) % samples.length];
    if (!start || !end) continue;
    const ax = start.x * widthCssPx;
    const ay = start.y * heightCssPx;
    const bx = end.x * widthCssPx;
    const by = end.y * heightCssPx;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const projection =
      lengthSquared > 0.000001
        ? clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
        : 0;
    const closestX = ax + dx * projection;
    const closestY = ay + dy * projection;
    const offsetX = px - closestX;
    const offsetY = py - closestY;
    const distanceCssPx = Math.hypot(offsetX, offsetY);
    if (closest && distanceCssPx >= closest.distanceCssPx) continue;
    const length = Math.max(Math.hypot(dx, dy), 0.000001);
    const normalX = -dy / length;
    const normalY = dx / length;
    const side = Math.sign(offsetX * normalX + offsetY * normalY) || 1;
    const startProgress = start.arcProgress;
    let endProgress = end.arcProgress;
    if (closed && index === segmentCount - 1 && endProgress <= startProgress) {
      endProgress += 1;
    }
    closest = {
      distanceCssPx,
      progress:
        (startProgress + (endProgress - startProgress) * projection) % 1,
      normalSign: side,
    };
  }

  return closest;
}

export function pruneFilamentDisturbanceImpulses(
  impulses: FilamentDisturbanceImpulse[],
  time: number,
  duration: number,
) {
  let writeIndex = 0;
  for (const impulse of impulses) {
    if (time - impulse.startedAt <= duration) {
      impulses[writeIndex] = impulse;
      writeIndex += 1;
    }
  }
  impulses.length = writeIndex;
  return impulses;
}

export function applyFilamentDisturbances(
  source: readonly FilamentPathSample[],
  closed: boolean,
  width: number,
  height: number,
  time: number,
  config: ResolvedFilamentPointerConfig,
  impulses: readonly FilamentDisturbanceImpulse[],
  target: FilamentPathSample[],
) {
  target.length = source.length;
  const first = source[0];
  const last = source[source.length - 1];
  const duplicateClosure = Boolean(
    closed &&
      source.length > 2 &&
      first &&
      last &&
      Math.abs(first.x - last.x) < 0.000001 &&
      Math.abs(first.y - last.y) < 0.000001,
  );
  const uniqueCount = duplicateClosure ? source.length - 1 : source.length;

  for (let index = 0; index < source.length; index++) {
    const sample = source[index];
    if (!sample) continue;
    const output = copySample(sample, target[index]);
    target[index] = output;
    if (impulses.length === 0 || uniqueCount < 2) continue;

    const canonicalIndex =
      duplicateClosure && index === source.length - 1 ? 0 : index;
    const previous =
      source[
        closed
          ? (canonicalIndex - 1 + uniqueCount) % uniqueCount
          : Math.max(0, canonicalIndex - 1)
      ] ?? sample;
    const next =
      source[
        closed
          ? (canonicalIndex + 1) % uniqueCount
          : Math.min(source.length - 1, canonicalIndex + 1)
      ] ?? sample;
    const tangentX = (next.x - previous.x) * width;
    const tangentY = (next.y - previous.y) * height;
    const tangentLength = Math.max(Math.hypot(tangentX, tangentY), 0.000001);
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    let displacement = 0;

    for (const impulse of impulses) {
      const distance = pathDistance(
        sample.arcProgress,
        impulse.progress,
        closed,
      );
      const arrivalTime =
        distance / Math.max(config.propagationSpeed, 0.000001);
      const localAge = time - impulse.startedAt - arrivalTime;
      if (localAge < 0 || localAge > config.duration) continue;
      const temporalEnvelope = Math.exp(-config.damping * localAge);
      const spatialEnvelope = Math.exp(-config.spatialDecay * distance);
      const oscillation = Math.cos(localAge * config.frequency * TAU);
      displacement +=
        impulse.strength *
        impulse.normalSign *
        oscillation *
        temporalEnvelope *
        spatialEnvelope;
    }

    const displacementPx = displacement * height;
    output.x += (normalX * displacementPx) / Math.max(width, 1);
    output.y += (normalY * displacementPx) / Math.max(height, 1);
  }

  return target;
}
