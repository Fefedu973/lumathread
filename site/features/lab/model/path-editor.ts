import {
  HERO_DEFAULT_TRAJECTORY,
  createHeroOrganicTrajectory,
  getHeroTrajectoryVerticalScale,
  type HeroTrajectoryPoint,
  type HeroWavePathInterpolation,
} from "@/hero-wave-background";
import type { LabState } from "./types";

interface PreviewPoint {
  x: number;
  y: number;
}

function previewPointAt(
  points: readonly HeroTrajectoryPoint[],
  index: number,
  closed: boolean,
) {
  const count = points.length;
  if (count === 0) return HERO_DEFAULT_TRAJECTORY[0]!;
  const pointIndex = closed
    ? ((index % count) + count) % count
    : Math.min(count - 1, Math.max(0, index));
  return points[pointIndex] ?? points[0] ?? HERO_DEFAULT_TRAJECTORY[0]!;
}

function previewCubicBezier(
  a: number,
  b: number,
  c: number,
  d: number,
  time: number,
) {
  const inverse = 1 - time;
  return (
    inverse ** 3 * a +
    3 * inverse * inverse * time * b +
    3 * inverse * time * time * c +
    time ** 3 * d
  );
}

function previewCatmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  time: number,
  tension: number,
) {
  const tangentScale = 1 - Math.min(1, Math.max(-1, tension));
  const m1 = ((p2 - p0) * tangentScale) / 2;
  const m2 = ((p3 - p1) * tangentScale) / 2;
  const time2 = time * time;
  const time3 = time2 * time;
  return (
    (2 * time3 - 3 * time2 + 1) * p1 +
    (time3 - 2 * time2 + time) * m1 +
    (-2 * time3 + 3 * time2) * p2 +
    (time3 - time2) * m2
  );
}

function previewParameterStep(from: PreviewPoint, to: PreviewPoint) {
  return Math.max(Math.hypot(to.x - from.x, to.y - from.y) ** 0.5, 0.001);
}

function previewInterpolatePoint(
  from: PreviewPoint,
  to: PreviewPoint,
  fromTime: number,
  toTime: number,
  time: number,
) {
  const amount = (time - fromTime) / Math.max(toTime - fromTime, 0.000001);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function previewCentripetalPoint(
  p0: PreviewPoint,
  p1: PreviewPoint,
  p2: PreviewPoint,
  p3: PreviewPoint,
  localTime: number,
) {
  const t0 = 0;
  const t1 = t0 + previewParameterStep(p0, p1);
  const t2 = t1 + previewParameterStep(p1, p2);
  const t3 = t2 + previewParameterStep(p2, p3);
  const time = t1 + (t2 - t1) * localTime;
  const a1 = previewInterpolatePoint(p0, p1, t0, t1, time);
  const a2 = previewInterpolatePoint(p1, p2, t1, t2, time);
  const a3 = previewInterpolatePoint(p2, p3, t2, t3, time);
  const b1 = previewInterpolatePoint(a1, a2, t0, t2, time);
  const b2 = previewInterpolatePoint(a2, a3, t1, t3, time);
  return previewInterpolatePoint(b1, b2, t1, t2, time);
}

export function buildEditorPath({
  points,
  interpolation,
  tension,
  closed,
  waveY,
  verticalScale,
  width,
  height,
}: {
  points: readonly HeroTrajectoryPoint[];
  interpolation: HeroWavePathInterpolation;
  tension: number;
  closed: boolean;
  waveY: number;
  verticalScale: number;
  width: number;
  height: number;
}) {
  const segmentCount = closed ? points.length : points.length - 1;
  if (segmentCount <= 0) return "";
  const bandHeight = 1 - waveY;
  const pointY = (point: HeroTrajectoryPoint) =>
    bandHeight + point.y * verticalScale;
  const samples: PreviewPoint[] = [];
  const samplesPerSegment = 24;
  const finiteValue = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? (value as number) : fallback;

  for (let segment = 0; segment < segmentCount; segment++) {
    const p0 = previewPointAt(points, segment - 1, closed);
    const p1 = previewPointAt(points, segment, closed);
    const p2 = previewPointAt(points, segment + 1, closed);
    const p3 = previewPointAt(points, segment + 2, closed);
    for (
      let sampleIndex = segment === 0 ? 0 : 1;
      sampleIndex <= samplesPerSegment;
      sampleIndex++
    ) {
      const time = sampleIndex / samplesPerSegment;
      let x = 0;
      let y = 0;
      if (interpolation === "linear") {
        x = p1.x + (p2.x - p1.x) * time;
        y = pointY(p1) + (pointY(p2) - pointY(p1)) * time;
      } else if (interpolation === "centripetal-catmull-rom") {
        const point = previewCentripetalPoint(
          { x: p0.x * width, y: pointY(p0) * height },
          { x: p1.x * width, y: pointY(p1) * height },
          { x: p2.x * width, y: pointY(p2) * height },
          { x: p3.x * width, y: pointY(p3) * height },
          time,
        );
        x = point.x / Math.max(width, 1);
        y = point.y / Math.max(height, 1);
      } else if (interpolation === "bezier") {
        const tangentScale = (1 - tension) / 6;
        const outX = p1.x + finiteValue(p1.outX, (p2.x - p0.x) * tangentScale);
        const outY =
          pointY(p1) +
          finiteValue(p1.outY, (pointY(p2) - pointY(p0)) * tangentScale);
        const inX = p2.x + finiteValue(p2.inX, -(p3.x - p1.x) * tangentScale);
        const inY =
          pointY(p2) +
          finiteValue(p2.inY, -(pointY(p3) - pointY(p1)) * tangentScale);
        x = previewCubicBezier(p1.x, outX, inX, p2.x, time);
        y = previewCubicBezier(pointY(p1), outY, inY, pointY(p2), time);
      } else {
        x = previewCatmullRom(p0.x, p1.x, p2.x, p3.x, time, tension);
        y = previewCatmullRom(
          pointY(p0),
          pointY(p1),
          pointY(p2),
          pointY(p3),
          time,
          tension,
        );
      }
      samples.push({ x, y: 1 - y });
    }
  }

  return samples
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${(point.x * 100).toFixed(3)} ${(point.y * 100).toFixed(3)}`,
    )
    .join(" ");
}

export function createRandomPathConfiguration(): Pick<
  LabState,
  "organic" | "pathPoints" | "shape"
> {
  const seed = Math.floor(Math.random() * 2_000_000_000) + 1;
  const organicBase = {
    seed,
    pointCount: 12 + Math.floor(Math.random() * 17),
    turns: 0.8 + Math.random() * 3,
    amplitude: 1,
    roughness: 0.15 + Math.random() * 0.65,
    horizontalJitter: 0.04 + Math.random() * 0.2,
    speedVariation: 0.35 + Math.random() * 1.15,
    symmetry: Math.random() * 0.65,
  };
  const sourcePoints = createHeroOrganicTrajectory(
    seed,
    organicBase.pointCount,
    organicBase,
  );
  const minimumY = Math.min(...sourcePoints.map((point) => point.y));
  const maximumY = Math.max(...sourcePoints.map((point) => point.y));
  const sourceSpan = Math.max(maximumY - minimumY, 0.001);
  const topEdge = 0.06 + Math.random() * 0.08;
  const bottomEdge = 0.86 + Math.random() * 0.08;
  const shapeScale = 0.85 + Math.random() * 0.45;
  const verticalScale = getHeroTrajectoryVerticalScale(shapeScale, 1);
  const amplitude = Math.min(
    4,
    Math.max(0.1, (bottomEdge - topEdge) / (sourceSpan * verticalScale)),
  );
  const organic = { ...organicBase, amplitude };
  return {
    organic,
    pathPoints: createHeroOrganicTrajectory(seed, organic.pointCount, organic),
    shape: {
      waveY: topEdge + maximumY * amplitude * verticalScale,
      strength: 1,
      scale: shapeScale,
      frequency: 0.7 + Math.random() * 2.5,
    },
  };
}
