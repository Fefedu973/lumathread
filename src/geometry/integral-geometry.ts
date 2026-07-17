import { clamp } from "../math";
import { HERO_PATH_SEGMENT_STRIDE } from "../config/settings";
import {
  pointToSegmentDistancePixels,
  type CurveSample,
} from "./path-sampling";

export function pointToChordDistancePixels(
  point: CurveSample,
  start: CurveSample,
  end: CurveSample,
  width: number,
  height: number,
) {
  return pointToSegmentDistancePixels(point, start, end, width, height);
}

/**
 * Greedy error-bounded simplification of the already adaptively tessellated
 * spline. Far glow layers can use longer integration spans without changing
 * the path topology or imposing a fixed segment count.
 */
export function simplifyPathSamplesForPass(
  source: readonly CurveSample[],
  width: number,
  height: number,
  maximumChordPx: number,
  maximumFlatnessPx: number,
  target: CurveSample[],
) {
  target.length = 0;
  const count = source.length;
  if (count === 0) return target;
  target.push(source[0]!);
  if (count === 1) return target;

  let anchorIndex = 0;
  let candidateIndex = 2;
  while (candidateIndex < count) {
    const anchor = source[anchorIndex]!;
    const candidate = source[candidateIndex]!;
    const chordLength = Math.hypot(
      (candidate.x - anchor.x) * width,
      (candidate.y - anchor.y) * height,
    );
    let maximumDeviation = 0;
    for (let index = anchorIndex + 1; index < candidateIndex; index++) {
      const point = source[index];
      if (!point) continue;
      maximumDeviation = Math.max(
        maximumDeviation,
        pointToChordDistancePixels(point, anchor, candidate, width, height),
      );
    }

    if (chordLength > maximumChordPx || maximumDeviation > maximumFlatnessPx) {
      const emittedIndex = Math.max(anchorIndex + 1, candidateIndex - 1);
      target.push(source[emittedIndex]!);
      anchorIndex = emittedIndex;
      candidateIndex = anchorIndex + 2;
      continue;
    }
    candidateIndex += 1;
  }

  const last = source[count - 1]!;
  if (target[target.length - 1] !== last) target.push(last);
  return target;
}

export function smoothEndpointWeight(distance: number, featherPx: number) {
  const normalized = clamp(distance / Math.max(featherPx, 0.001), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * One instance represents one finite line integral span. Subdivision does not
 * change its total emitted energy because every span carries its screen-space
 * arc length and the fragment shader performs Gaussian quadrature along it.
 */
export function buildIntegralSegmentData(
  samples: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  endpointFeatherPx: number,
  target: Float32Array,
) {
  if (samples.length < 2) return 0;

  let totalLength = 0;
  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1];
    const after = samples[index];
    if (!before || !after) continue;
    totalLength += Math.hypot(
      (after.x - before.x) * width,
      (after.y - before.y) * height,
    );
  }

  let cursor = 0;
  let segmentCount = 0;
  let traversed = 0;
  for (let index = 1; index < samples.length; index++) {
    const start = samples[index - 1];
    const end = samples[index];
    if (!start || !end) continue;
    const segmentLength = Math.hypot(
      (end.x - start.x) * width,
      (end.y - start.y) * height,
    );
    if (segmentLength <= 0.0001) continue;

    const startWeight = closed
      ? 1
      : smoothEndpointWeight(traversed, endpointFeatherPx) *
        smoothEndpointWeight(totalLength - traversed, endpointFeatherPx);
    traversed += segmentLength;
    const endWeight = closed
      ? 1
      : smoothEndpointWeight(traversed, endpointFeatherPx) *
        smoothEndpointWeight(totalLength - traversed, endpointFeatherPx);

    if (cursor + HERO_PATH_SEGMENT_STRIDE > target.length) break;
    target[cursor++] = start.x;
    target[cursor++] = start.y;
    target[cursor++] = end.x;
    target[cursor++] = end.y;
    target[cursor++] = start.progress;
    target[cursor++] = end.progress;
    target[cursor++] = startWeight;
    target[cursor++] = endWeight;
    segmentCount += 1;
  }

  return segmentCount;
}
