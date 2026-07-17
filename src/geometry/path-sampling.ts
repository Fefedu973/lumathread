import { clamp, finite } from "../math";
import {
  getHeroTrajectoryVerticalScale,
  HERO_DEFAULT_TRAJECTORY,
} from "../trajectory";
import type { HeroTrajectoryPoint, HeroWavePathTransform } from "../types";
import {
  HERO_FOLLOW_SPLINE_ALPHA,
  HERO_FOLLOW_DUPLICATE_DISTANCE_PX,
  TAU,
  catmullRomValue,
  normalizeTrajectoryPoints,
  type Settings,
} from "../config/settings";

export interface CurveSample {
  x: number;
  y: number;
  speed: number;
  /** Progress weighted by trajectory speed. */
  progress: number;
  /** Pure screen-space arc-length progress. */
  arcProgress: number;
}

export interface PointerTrailSample {
  x: number;
  top: number;
  time: number;
}
export interface FollowAnchor {
  x: number;
  top: number;
}
export interface FollowScreenPoint {
  x: number;
  y: number;
}

export function trajectoryPointAt(
  points: readonly HeroTrajectoryPoint[],
  index: number,
  closed: boolean,
): HeroTrajectoryPoint {
  const count = points.length;
  const pointIndex = closed
    ? ((index % count) + count) % count
    : Math.min(count - 1, Math.max(0, index));
  return points[pointIndex] ?? points[0] ?? HERO_DEFAULT_TRAJECTORY[0]!;
}

export function applyPathTransformToPoint(
  x: number,
  y: number,
  transform: Required<HeroWavePathTransform>,
  width: number,
  height: number,
) {
  const aspect = width / Math.max(height, 1);
  const anchorX = transform.anchorX * aspect;
  const anchorY = transform.anchorY;
  const localX = (x * aspect - anchorX) * transform.scaleX;
  const localY = (y - anchorY) * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: (anchorX + localX * cosine - localY * sine) / aspect + transform.x,
    y: anchorY + localX * sine + localY * cosine + transform.y,
  };
}

export function followParameterStep(
  from: FollowScreenPoint,
  to: FollowScreenPoint,
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(distance ** HERO_FOLLOW_SPLINE_ALPHA, 0.001);
}
export function interpolateFollowPoint(
  from: FollowScreenPoint,
  to: FollowScreenPoint,
  fromTime: number,
  toTime: number,
  time: number,
): FollowScreenPoint {
  const amount = (time - fromTime) / Math.max(toTime - fromTime, 0.000001);
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}
export function centripetalPoint(
  p0: FollowScreenPoint,
  p1: FollowScreenPoint,
  p2: FollowScreenPoint,
  p3: FollowScreenPoint,
  localT: number,
) {
  const t0 = 0;
  const t1 = t0 + followParameterStep(p0, p1);
  const t2 = t1 + followParameterStep(p1, p2);
  const t3 = t2 + followParameterStep(p2, p3);
  const time = t1 + (t2 - t1) * clamp(localT, 0, 1);
  const a1 = interpolateFollowPoint(p0, p1, t0, t1, time);
  const a2 = interpolateFollowPoint(p1, p2, t1, t2, time);
  const a3 = interpolateFollowPoint(p2, p3, t2, t3, time);
  const b1 = interpolateFollowPoint(a1, a2, t0, t2, time);
  const b2 = interpolateFollowPoint(a2, a3, t1, t3, time);
  return interpolateFollowPoint(b1, b2, t1, t2, time);
}

export function cubicBezierValue(
  a: number,
  b: number,
  c: number,
  d: number,
  t: number,
) {
  const inverse = 1 - t;
  return (
    inverse ** 3 * a +
    3 * inverse * inverse * t * b +
    3 * inverse * t * t * c +
    t ** 3 * d
  );
}

export function evaluateTrajectorySegment(
  points: readonly HeroTrajectoryPoint[],
  segment: number,
  localT: number,
  closed: boolean,
  bandHeight: number,
  verticalScale: number,
  width: number,
  height: number,
  settings: Settings,
): CurveSample {
  const p0 = trajectoryPointAt(points, segment - 1, closed);
  const p1 = trajectoryPointAt(points, segment, closed);
  const p2 = trajectoryPointAt(points, segment + 1, closed);
  const p3 = trajectoryPointAt(points, segment + 2, closed);
  const pointY = (point: HeroTrajectoryPoint) =>
    bandHeight + point.y * verticalScale;
  let x = 0;
  let y = 0;
  if (settings.trajectoryInterpolation === "linear") {
    x = p1.x + (p2.x - p1.x) * localT;
    y = pointY(p1) + (pointY(p2) - pointY(p1)) * localT;
  } else if (settings.trajectoryInterpolation === "centripetal-catmull-rom") {
    const result = centripetalPoint(
      { x: p0.x * width, y: pointY(p0) * height },
      { x: p1.x * width, y: pointY(p1) * height },
      { x: p2.x * width, y: pointY(p2) * height },
      { x: p3.x * width, y: pointY(p3) * height },
      localT,
    );
    x = result.x / Math.max(width, 1);
    y = result.y / Math.max(height, 1);
  } else if (settings.trajectoryInterpolation === "bezier") {
    const tangentScale = (1 - settings.trajectoryTension) / 6;
    const outX = p1.x + finite(p1.outX, (p2.x - p0.x) * tangentScale);
    const outY =
      pointY(p1) + finite(p1.outY, (pointY(p2) - pointY(p0)) * tangentScale);
    const inX = p2.x + finite(p2.inX, -(p3.x - p1.x) * tangentScale);
    const inY =
      pointY(p2) + finite(p2.inY, -(pointY(p3) - pointY(p1)) * tangentScale);
    x = cubicBezierValue(p1.x, outX, inX, p2.x, localT);
    y = cubicBezierValue(pointY(p1), outY, inY, pointY(p2), localT);
  } else {
    x = catmullRomValue(
      p0.x,
      p1.x,
      p2.x,
      p3.x,
      localT,
      settings.trajectoryTension,
    );
    y = catmullRomValue(
      pointY(p0),
      pointY(p1),
      pointY(p2),
      pointY(p3),
      localT,
      settings.trajectoryTension,
    );
  }
  const transformed = applyPathTransformToPoint(
    x,
    y,
    settings.pathTransform,
    width,
    height,
  );
  return {
    x: clamp(transformed.x, -4, 5),
    y: clamp(transformed.y, -4, 5),
    speed: Math.max(p1.speed + (p2.speed - p1.speed) * localT, 0.05),
    progress: 0,
    arcProgress: 0,
  };
}

export function pointToSegmentDistancePixels(
  point: CurveSample,
  start: CurveSample,
  end: CurveSample,
  width: number,
  height: number,
) {
  const ax = start.x * width;
  const ay = start.y * height;
  const bx = end.x * width;
  const by = end.y * height;
  const px = point.x * width;
  const py = point.y * height;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return Math.hypot(px - ax, py - ay);
  const projection = clamp(
    ((px - ax) * dx + (py - ay) * dy) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(px - (ax + dx * projection), py - (ay + dy * projection));
}

export function recomputePathProgress(
  samples: CurveSample[],
  width: number,
  height: number,
  closed: boolean,
  preserveSpeed = false,
) {
  if (samples.length === 0) return samples;
  let arcElapsed = 0;
  let travelElapsed = 0;
  samples[0]!.arcProgress = 0;
  samples[0]!.progress = 0;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const distance = Math.hypot(
      (current.x - previous.x) * width,
      (current.y - previous.y) * height,
    );
    arcElapsed += distance;
    const localSpeed = preserveSpeed
      ? Math.max((previous.speed + current.speed) * 0.5, 0.05)
      : 1;
    travelElapsed += distance / localSpeed;
    current.arcProgress = arcElapsed;
    current.progress = travelElapsed;
  }
  const safeArc = Math.max(arcElapsed, 0.000001);
  const safeTravel = Math.max(travelElapsed, 0.000001);
  for (const sample of samples) {
    sample.arcProgress /= safeArc;
    sample.progress /= safeTravel;
  }
  if (closed && samples.length > 1) {
    samples[samples.length - 1]!.arcProgress = 1;
    samples[samples.length - 1]!.progress = 1;
  }
  return samples;
}

export function writeCurveSampleAtArcProgress(
  samples: readonly CurveSample[],
  progress: number,
  output: CurveSample,
) {
  const first = samples[0];
  if (!first) {
    output.x = 0.5;
    output.y = 0.5;
    output.speed = 1;
    output.progress = progress;
    output.arcProgress = progress;
    return;
  }
  const last = samples[samples.length - 1] ?? first;
  if (progress <= first.arcProgress || samples.length === 1) {
    Object.assign(output, first);
    return;
  }
  if (progress >= last.arcProgress) {
    Object.assign(output, last);
    return;
  }

  let low = 1;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) * 0.5);
    if ((samples[middle]?.arcProgress ?? 1) < progress) low = middle + 1;
    else high = middle;
  }
  const after = samples[low] ?? last;
  const before = samples[Math.max(0, low - 1)] ?? first;
  const amount = clamp(
    (progress - before.arcProgress) /
      Math.max(after.arcProgress - before.arcProgress, 0.000001),
    0,
    1,
  );
  output.x = before.x + (after.x - before.x) * amount;
  output.y = before.y + (after.y - before.y) * amount;
  output.speed = before.speed + (after.speed - before.speed) * amount;
  output.progress =
    before.progress + (after.progress - before.progress) * amount;
  output.arcProgress = progress;
}

export function blendCurveSamplePaths(
  from: readonly CurveSample[],
  to: readonly CurveSample[],
  amount: number,
  width: number,
  height: number,
  output: CurveSample[],
) {
  if (from.length === 0 || to.length === 0) {
    const source = to.length > 0 ? to : from;
    output.length = source.length;
    for (let index = 0; index < source.length; index++) {
      const sourceSample = source[index]!;
      const target = output[index] ?? {
        x: 0,
        y: 0,
        speed: 1,
        progress: 0,
        arcProgress: 0,
      };
      Object.assign(target, sourceSample);
      output[index] = target;
    }
    return output;
  }

  const count = clamp(Math.max(from.length, to.length), 2, 1024);
  const fromSample: CurveSample = {
    x: 0,
    y: 0,
    speed: 1,
    progress: 0,
    arcProgress: 0,
  };
  const toSample: CurveSample = { ...fromSample };
  output.length = count;
  for (let index = 0; index < count; index++) {
    const progress = index / Math.max(count - 1, 1);
    writeCurveSampleAtArcProgress(from, progress, fromSample);
    writeCurveSampleAtArcProgress(to, progress, toSample);
    const target = output[index] ?? { ...fromSample };
    target.x = fromSample.x + (toSample.x - fromSample.x) * amount;
    target.y = fromSample.y + (toSample.y - fromSample.y) * amount;
    target.speed =
      fromSample.speed + (toSample.speed - fromSample.speed) * amount;
    target.progress = progress;
    target.arcProgress = progress;
    output[index] = target;
  }
  return recomputePathProgress(output, width, height, false);
}

export function appendAdaptiveSegment(
  points: readonly HeroTrajectoryPoint[],
  segment: number,
  t0: number,
  start: CurveSample,
  t1: number,
  end: CurveSample,
  closed: boolean,
  bandHeight: number,
  verticalScale: number,
  width: number,
  height: number,
  depth: number,
  output: CurveSample[],
  settings: Settings,
) {
  if (output.length >= settings.quality.maxSamples) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarterT = (t0 * 3 + t1) * 0.25;
  const threeQuarterT = (t0 + t1 * 3) * 0.25;
  const evaluate = (time: number) =>
    evaluateTrajectorySegment(
      points,
      segment,
      time,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      settings,
    );
  const quarter = evaluate(quarterT);
  const midpoint = evaluate(midpointT);
  const threeQuarter = evaluate(threeQuarterT);
  const flatness = Math.max(
    pointToSegmentDistancePixels(quarter, start, end, width, height),
    pointToSegmentDistancePixels(midpoint, start, end, width, height),
    pointToSegmentDistancePixels(threeQuarter, start, end, width, height),
  );
  const chord = Math.hypot(
    (end.x - start.x) * width,
    (end.y - start.y) * height,
  );
  const split =
    (flatness > settings.quality.flatnessPx ||
      chord > settings.quality.maxChordPx) &&
    depth < settings.quality.maxSubdivisionDepth &&
    output.length < settings.quality.maxSamples - 1;
  if (split) {
    appendAdaptiveSegment(
      points,
      segment,
      t0,
      start,
      midpointT,
      midpoint,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      depth + 1,
      output,
      settings,
    );
    appendAdaptiveSegment(
      points,
      segment,
      midpointT,
      midpoint,
      t1,
      end,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      depth + 1,
      output,
      settings,
    );
  } else output.push(end);
}

export function buildAdaptivePathSamples(
  sourcePoints: readonly HeroTrajectoryPoint[],
  closed: boolean,
  width: number,
  height: number,
  settings: Settings,
) {
  const points = normalizeTrajectoryPoints(sourcePoints);
  const segmentCount = closed ? points.length : points.length - 1;
  const bandHeight = 1 - settings.waveY;
  const verticalScale = getHeroTrajectoryVerticalScale(
    settings.curveScale,
    settings.curveStrength,
  );
  const output: CurveSample[] = [];
  if (segmentCount <= 0) return output;
  const evaluate = (segment: number, t: number) =>
    evaluateTrajectorySegment(
      points,
      segment,
      t,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      settings,
    );
  output.push(evaluate(0, 0));
  for (
    let segment = 0;
    segment < segmentCount && output.length < settings.quality.maxSamples;
    segment++
  ) {
    const start = output[output.length - 1]!;
    const end = evaluate(segment, 1);
    appendAdaptiveSegment(
      points,
      segment,
      0,
      start,
      1,
      end,
      closed,
      bandHeight,
      verticalScale,
      width,
      height,
      0,
      output,
      settings,
    );
  }
  return recomputePathProgress(output, width, height, closed, true);
}

export function movingSineCurveAndSlope(
  x: number,
  time: number,
  settings: Settings,
) {
  const frequency = Math.max(settings.curveFrequency, 0.05);
  const morphAmount = clamp(settings.curveMotion, 0, 1);
  const geometryAdvanceRatio =
    settings.motionMode === "travel" ? settings.pathDrift : 0;
  const advance = time * settings.curveTravel * geometryAdvanceRatio;
  const pathX = x - advance * (0.12 + 0.1 * morphAmount);
  const bendArgument =
    TAU * (frequency * 0.42 * pathX + 0.27) + advance * 0.875;
  const bendSin = Math.sin(bendArgument);
  const bendCos = Math.cos(bendArgument);
  const phase = frequency * pathX - 0.03 + bendSin * 0.065 * morphAmount;
  const phaseDerivative =
    frequency + bendCos * TAU * frequency * 0.42 * 0.065 * morphAmount;
  const phaseArgument = TAU * phase;
  const phaseSin = Math.sin(phaseArgument);
  const phaseCos = Math.cos(phaseArgument);
  const swellArgument =
    TAU * (frequency * 0.28 * pathX - 0.12) - advance * 1.125;
  const swellSin = Math.sin(swellArgument);
  const swellCos = Math.cos(swellArgument);
  const swell = 1 + 0.08 * morphAmount * swellSin;
  const swellDerivative =
    0.08 * morphAmount * swellCos * TAU * frequency * 0.28;
  const sineShape = phaseSin * swell;
  const shapeDerivative =
    phaseCos * TAU * phaseDerivative * swell + phaseSin * swellDerivative;
  const verticalDrift =
    Math.sin(advance * 1.125) * 0.025 * settings.curveMotion;
  const scaledAmplitude = 0.38 * settings.curveScale;
  const center =
    1 -
    settings.waveY +
    settings.curveStrength * (sineShape * scaledAmplitude + verticalDrift);
  const slope = settings.curveStrength * shapeDerivative * scaledAmplitude;
  return { center, slope };
}

export function buildAdaptiveSinePathSamples(
  settings: Settings,
  width: number,
  height: number,
  time: number,
) {
  const output: CurveSample[] = [];
  const startX = -0.2;
  const endX = 1.2;
  const evaluate = (x: number): CurveSample => {
    const curve = movingSineCurveAndSlope(x, time, settings);
    const transformed = applyPathTransformToPoint(
      x,
      curve.center,
      settings.pathTransform,
      width,
      height,
    );
    return {
      x: transformed.x,
      y: transformed.y,
      speed: 1,
      progress: 0,
      arcProgress: 0,
    };
  };
  const append = (
    x0: number,
    start: CurveSample,
    x1: number,
    end: CurveSample,
    depth: number,
  ) => {
    if (output.length >= settings.quality.maxSamples) return;
    const midpointX = (x0 + x1) * 0.5;
    const quarterX = x0 * 0.75 + x1 * 0.25;
    const threeQuarterX = x0 * 0.25 + x1 * 0.75;
    const midpoint = evaluate(midpointX);
    const flatness = Math.max(
      pointToSegmentDistancePixels(
        evaluate(quarterX),
        start,
        end,
        width,
        height,
      ),
      pointToSegmentDistancePixels(midpoint, start, end, width, height),
      pointToSegmentDistancePixels(
        evaluate(threeQuarterX),
        start,
        end,
        width,
        height,
      ),
    );
    const chord = Math.hypot(
      (end.x - start.x) * width,
      (end.y - start.y) * height,
    );
    if (
      (flatness > settings.quality.flatnessPx ||
        chord > settings.quality.maxChordPx) &&
      depth < settings.quality.maxSubdivisionDepth
    ) {
      append(x0, start, midpointX, midpoint, depth + 1);
      append(midpointX, midpoint, x1, end, depth + 1);
    } else output.push(end);
  };
  const first = evaluate(startX);
  output.push(first);
  append(startX, first, endX, evaluate(endX), 0);
  return recomputePathProgress(output, width, height, false, true);
}

export function buildSvgPathSamples(
  settings: Settings,
  width: number,
  height: number,
) {
  if (!settings.svgPath || typeof document === "undefined") return null;
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const path = document.createElementNS(namespace, "path");
  svg.setAttribute("width", "1");
  svg.setAttribute("height", "1");
  svg.setAttribute(
    "style",
    "position:fixed;left:-10000px;top:-10000px;visibility:hidden;overflow:visible",
  );
  path.setAttribute("d", settings.svgPath);
  svg.appendChild(path);
  document.body.appendChild(svg);
  try {
    const totalLength = Math.max(path.getTotalLength(), 0.000001);
    const bounds = settings.svgViewBox
      ? {
          x: settings.svgViewBox[0],
          y: settings.svgViewBox[1],
          width: Math.max(settings.svgViewBox[2], 0.000001),
          height: Math.max(settings.svgViewBox[3], 0.000001),
        }
      : (() => {
          const box = path.getBBox();
          return {
            x: box.x,
            y: box.y,
            width: Math.max(box.width, 0.000001),
            height: Math.max(box.height, 0.000001),
          };
        })();
    const sampleAtLength = (length: number): CurveSample => {
      const point = path.getPointAtLength(clamp(length, 0, totalLength));
      const transformed = applyPathTransformToPoint(
        (point.x - bounds.x) / bounds.width,
        1 - (point.y - bounds.y) / bounds.height,
        settings.pathTransform,
        width,
        height,
      );
      const progress = clamp(length / totalLength, 0, 1);
      return {
        x: transformed.x,
        y: transformed.y,
        speed: 1,
        progress,
        arcProgress: progress,
      };
    };
    const samples: CurveSample[] = [sampleAtLength(0)];
    const append = (
      length0: number,
      start: CurveSample,
      length1: number,
      end: CurveSample,
      depth: number,
    ) => {
      if (samples.length >= settings.quality.maxSamples) return;
      const q1 = sampleAtLength(length0 * 0.75 + length1 * 0.25);
      const midLength = (length0 + length1) * 0.5;
      const mid = sampleAtLength(midLength);
      const q3 = sampleAtLength(length0 * 0.25 + length1 * 0.75);
      const flatness = Math.max(
        pointToSegmentDistancePixels(q1, start, end, width, height),
        pointToSegmentDistancePixels(mid, start, end, width, height),
        pointToSegmentDistancePixels(q3, start, end, width, height),
      );
      const chord = Math.hypot(
        (end.x - start.x) * width,
        (end.y - start.y) * height,
      );
      if (
        (flatness > settings.quality.flatnessPx ||
          chord > settings.quality.maxChordPx) &&
        depth < settings.quality.maxSubdivisionDepth &&
        samples.length < settings.quality.maxSamples - 1
      ) {
        append(length0, start, midLength, mid, depth + 1);
        append(midLength, mid, length1, end, depth + 1);
      } else samples.push(end);
    };
    append(0, samples[0]!, totalLength, sampleAtLength(totalLength), 0);
    if (settings.trajectoryClosed && samples.length > 1) {
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      if (
        Math.hypot((first.x - last.x) * width, (first.y - last.y) * height) >
        0.0001
      ) {
        samples.push({ ...first, progress: 1, arcProgress: 1 });
      }
    }
    return recomputePathProgress(
      samples,
      width,
      height,
      settings.trajectoryClosed,
    );
  } catch (error) {
    console.error("HeroWaveBackground SVG path:", error);
    return null;
  } finally {
    svg.remove();
  }
}

export function followScreenControlPoint(
  points: readonly FollowScreenPoint[],
  index: number,
): FollowScreenPoint {
  const count = points.length;
  if (count === 0) return { x: 0, y: 0 };
  if (count === 1) return points[0]!;
  if (index < 0) {
    const first = points[0]!;
    const second = points[1]!;
    return { x: first.x * 2 - second.x, y: first.y * 2 - second.y };
  }
  if (index >= count) {
    const last = points[count - 1]!;
    const previous = points[count - 2]!;
    return { x: last.x * 2 - previous.x, y: last.y * 2 - previous.y };
  }
  return points[index]!;
}
export function evaluateFollowSegment(
  points: readonly FollowScreenPoint[],
  segment: number,
  localT: number,
  width: number,
  height: number,
): CurveSample {
  const point = centripetalPoint(
    followScreenControlPoint(points, segment - 1),
    followScreenControlPoint(points, segment),
    followScreenControlPoint(points, segment + 1),
    followScreenControlPoint(points, segment + 2),
    localT,
  );
  return {
    x: point.x / Math.max(width, 1),
    y: point.y / Math.max(height, 1),
    speed: 1,
    progress: 0,
    arcProgress: 0,
  };
}
export function appendAdaptiveFollowSegment(
  points: readonly FollowScreenPoint[],
  segment: number,
  t0: number,
  start: CurveSample,
  t1: number,
  end: CurveSample,
  width: number,
  height: number,
  depth: number,
  output: CurveSample[],
  settings: Settings,
) {
  if (output.length >= settings.quality.maxSamples) return;
  const midpointT = (t0 + t1) * 0.5;
  const quarter = evaluateFollowSegment(
    points,
    segment,
    (t0 * 3 + t1) * 0.25,
    width,
    height,
  );
  const midpoint = evaluateFollowSegment(
    points,
    segment,
    midpointT,
    width,
    height,
  );
  const threeQuarter = evaluateFollowSegment(
    points,
    segment,
    (t0 + t1 * 3) * 0.25,
    width,
    height,
  );
  const flatness = Math.max(
    pointToSegmentDistancePixels(quarter, start, end, width, height),
    pointToSegmentDistancePixels(midpoint, start, end, width, height),
    pointToSegmentDistancePixels(threeQuarter, start, end, width, height),
  );
  const chord = Math.hypot(
    (end.x - start.x) * width,
    (end.y - start.y) * height,
  );
  if (
    (flatness > settings.quality.flatnessPx ||
      chord > settings.quality.maxChordPx) &&
    depth < settings.quality.maxSubdivisionDepth &&
    output.length < settings.quality.maxSamples - 1
  ) {
    appendAdaptiveFollowSegment(
      points,
      segment,
      t0,
      start,
      midpointT,
      midpoint,
      width,
      height,
      depth + 1,
      output,
      settings,
    );
    appendAdaptiveFollowSegment(
      points,
      segment,
      midpointT,
      midpoint,
      t1,
      end,
      width,
      height,
      depth + 1,
      output,
      settings,
    );
  } else output.push(end);
}
export function buildAdaptiveFollowPathSamples(
  anchors: readonly FollowAnchor[],
  width: number,
  height: number,
  output: CurveSample[],
  settings: Settings,
) {
  output.length = 0;
  const points: FollowScreenPoint[] = [];
  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    if (!anchor) continue;
    const point = { x: anchor.x * width, y: (1 - anchor.top) * height };
    const previous = points[points.length - 1];
    const isLast = index === anchors.length - 1;
    if (!previous) points.push(point);
    else {
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (distance >= HERO_FOLLOW_DUPLICATE_DISTANCE_PX) points.push(point);
      else if (isLast) points[points.length - 1] = point;
    }
  }
  if (points.length === 0) return output;
  if (points.length === 1) {
    output.push({
      x: points[0]!.x / Math.max(width, 1),
      y: points[0]!.y / Math.max(height, 1),
      speed: 1,
      progress: 0,
      arcProgress: 0,
    });
    return output;
  }
  output.push(evaluateFollowSegment(points, 0, 0, width, height));
  for (
    let segment = 0;
    segment < points.length - 1 && output.length < settings.quality.maxSamples;
    segment++
  ) {
    const start = output[output.length - 1]!;
    const end = evaluateFollowSegment(points, segment, 1, width, height);
    appendAdaptiveFollowSegment(
      points,
      segment,
      0,
      start,
      1,
      end,
      width,
      height,
      0,
      output,
      settings,
    );
  }
  return recomputePathProgress(output, width, height, false);
}
