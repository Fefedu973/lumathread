import { clamp, finite } from "../math";
import type {
  HeroWaveCustomDeformer,
  HeroWaveCustomDeformerCallback,
  HeroWaveDeformationCombine,
  HeroWaveDeformationContext,
  HeroWaveDeformationOutput,
  HeroWaveDeformer,
  HeroWavePulseDeformer,
  HeroWaveSampledDeformer,
} from "../types";
import {
  evaluateScalarProfile,
  sampleProfileArray,
  smoothProfileAmount,
  TAU,
  type Settings,
} from "../config/settings";
import { recomputePathProgress, type CurveSample } from "./path-sampling";

export function noiseHash(seed: number, index: number) {
  const value =
    Math.sin((seed * 0.1031 + index * 17.127) * 12.9898) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}
export function valueNoise1D(seed: number, value: number) {
  const left = Math.floor(value);
  const amount = smoothProfileAmount(value - left);
  return (
    noiseHash(seed, left) +
    (noiseHash(seed, left + 1) - noiseHash(seed, left)) * amount
  );
}
export function fractalNoise1D(
  seed: number,
  value: number,
  octaves: number,
  lacunarity: number,
  persistence: number,
) {
  let result = 0,
    amplitude = 1,
    frequency = 1,
    sum = 0;
  for (let octave = 0; octave < octaves; octave++) {
    result += valueNoise1D(seed + octave * 101, value * frequency) * amplitude;
    sum += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return result / Math.max(sum, 0.000001);
}
export function sampledDeformerValue(
  deformer: HeroWaveSampledDeformer,
  domain: number,
  timePhase: number,
) {
  return sampleProfileArray(
    deformer.values,
    domain * finite(deformer.frequency, 1) +
      finite(deformer.phase, 0) +
      timePhase * finite(deformer.phaseSpeed, 1),
    deformer.interpolation ?? "cubic",
    deformer.wrap ?? "repeat",
  );
}
export function pulseDeformerValue(
  deformer: HeroWavePulseDeformer,
  domain: number,
  timePhase: number,
) {
  const count = Math.max(finite(deformer.count, 1), 0.001);
  const center =
    finite(deformer.phase, 0) + timePhase * finite(deformer.phaseSpeed, 1);
  const wrapped = ((((domain * count - center) % 1) + 1.5) % 1) - 0.5;
  const normalized =
    Math.abs(wrapped) / Math.max(finite(deformer.width, 0.12), 0.0001);
  if (deformer.shape === "triangle") return Math.max(0, 1 - normalized);
  if (deformer.shape === "smooth")
    return 1 - smoothProfileAmount(clamp(normalized, 0, 1));
  return Math.exp(-0.5 * normalized * normalized);
}
export const customDeformerErrorCallbacks =
  new WeakSet<HeroWaveCustomDeformerCallback>();

export function reportCustomDeformerFailure(
  error: unknown,
  deformer: HeroWaveCustomDeformer,
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
) {
  if (customDeformerErrorCallbacks.has(deformer.callback)) return;
  customDeformerErrorCallbacks.add(deformer.callback);
  const resolvedError =
    error instanceof Error ? error : new Error(String(error));
  if (onError) onError(resolvedError, deformer);
  else console.error("HeroWaveBackground custom deformer:", resolvedError);
}

export function evaluateDeformer(
  deformer: HeroWaveDeformer,
  context: HeroWaveDeformationContext,
  domain: number,
  timePhase: number,
  output: HeroWaveDeformationOutput,
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
) {
  output.normal = 0;
  output.tangent = 0;
  output.x = 0;
  output.y = 0;

  let value = 0;
  if (deformer.type === "harmonics") {
    for (const wave of deformer.waves) {
      value +=
        finite(wave.amplitude, 1) *
        Math.sin(
          TAU *
            (domain * finite(wave.frequency, 1) +
              finite(wave.phase, 0) +
              timePhase * finite(wave.phaseSpeed, 1)),
        );
    }
  } else if (deformer.type === "sampled") {
    value = sampledDeformerValue(deformer, domain, timePhase);
  } else if (deformer.type === "noise") {
    value = fractalNoise1D(
      Math.trunc(finite(deformer.seed, 0)),
      domain * Math.max(finite(deformer.frequency, 1), 0.0001) +
        timePhase * finite(deformer.phaseSpeed, 1),
      Math.trunc(clamp(finite(deformer.octaves, 3), 1, 8)),
      clamp(finite(deformer.lacunarity, 2), 1, 8),
      clamp(finite(deformer.persistence, 0.5), 0, 1),
    );
  } else if (deformer.type === "pulse") {
    value = pulseDeformerValue(deformer, domain, timePhase);
  } else {
    try {
      deformer.callback(context, output);
    } catch (error) {
      reportCustomDeformerFailure(error, deformer, onError);
      output.normal = 0;
      output.tangent = 0;
      output.x = 0;
      output.y = 0;
    }
    output.normal = finite(output.normal, 0);
    output.tangent = finite(output.tangent, 0);
    output.x = finite(output.x, 0);
    output.y = finite(output.y, 0);
  }

  const amplitude =
    finite(deformer.amplitude, 1) *
    evaluateScalarProfile(deformer.envelope, domain, 1);
  const direction =
    deformer.direction ?? (deformer.type === "custom" ? "both" : "normal");

  if (deformer.type === "custom") {
    const normalValue = output.normal;
    const tangentValue = output.tangent;
    const directX = output.x;
    const directY = output.y;
    output.normal =
      direction === "normal" || direction === "both"
        ? normalValue * amplitude
        : 0;
    output.tangent =
      direction === "tangent" || direction === "both"
        ? tangentValue * finite(deformer.tangentAmount, 1) * amplitude
        : 0;
    output.x = (directX + (direction === "x" ? normalValue : 0)) * amplitude;
    output.y = (directY + (direction === "y" ? normalValue : 0)) * amplitude;
    return;
  }

  const displacement = value * amplitude;
  if (direction === "normal" || direction === "both") {
    output.normal = displacement;
  }
  if (direction === "tangent" || direction === "both") {
    output.tangent =
      displacement *
      finite(deformer.tangentAmount, direction === "tangent" ? 1 : 0.35);
  }
  if (direction === "x") output.x = displacement;
  if (direction === "y") output.y = displacement;
}

export function combineDeformationValue(
  current: number,
  value: number,
  combine: HeroWaveDeformationCombine,
  first: boolean,
) {
  if (first) return value;
  if (combine === "max")
    return Math.abs(value) > Math.abs(current) ? value : current;
  if (combine === "multiply") return (1 + current) * (1 + value) - 1;
  return current + value;
}

export function propagationIsDynamic(propagation: Settings["propagation"]) {
  if (!propagation.enabled) return false;
  for (const deformer of propagation.deformers) {
    if (deformer.enabled === false) continue;
    if (deformer.type === "custom") return true;
    if (Math.abs(propagation.phaseSpeed) <= 0.000001) continue;
    if (deformer.type === "harmonics") {
      if (
        deformer.waves.some(
          (wave) => Math.abs(finite(wave.phaseSpeed, 1)) > 0.000001,
        )
      ) {
        return true;
      }
      continue;
    }
    if (Math.abs(finite(deformer.phaseSpeed, 1)) > 0.000001) return true;
  }
  return false;
}

export interface PropagationScratch {
  tangent: { x: number; y: number };
  normal: { x: number; y: number };
  point: { x: number; y: number };
  context: HeroWaveDeformationContext;
  output: HeroWaveDeformationOutput;
}

export function createPropagationScratch(): PropagationScratch {
  const tangent = { x: 0, y: 0 };
  const normal = { x: 0, y: 0 };
  const point = { x: 0, y: 0 };
  return {
    tangent,
    normal,
    point,
    context: {
      index: 0,
      count: 0,
      time: 0,
      progress: 0,
      arcProgress: 0,
      point,
      tangent,
      normal,
    },
    output: {
      normal: 0,
      tangent: 0,
      x: 0,
      y: 0,
    },
  };
}

export function buildPropagatedPathSamples(
  source: readonly CurveSample[],
  closed: boolean,
  width: number,
  height: number,
  time: number,
  settings: Settings,
  target: CurveSample[],
  onError?: (error: Error, deformer: HeroWaveCustomDeformer) => void,
  audioDeformation = 0,
  audioFrequency = 1,
  scratch = createPropagationScratch(),
) {
  const propagation = settings.propagation;
  let hasActiveDeformer = false;
  for (const deformer of propagation.deformers) {
    if (deformer.enabled !== false) {
      hasActiveDeformer = true;
      break;
    }
  }
  const hasPropagation = propagation.enabled && hasActiveDeformer;
  const hasAudioDeformation = Math.abs(audioDeformation) > 0.000001;
  if (!hasPropagation && !hasAudioDeformation) {
    target.length = source.length;
    for (let index = 0; index < source.length; index++) {
      const sample = source[index]!;
      const output = target[index] ?? {
        x: 0,
        y: 0,
        speed: 1,
        progress: 0,
        arcProgress: 0,
      };
      output.x = sample.x;
      output.y = sample.y;
      output.speed = sample.speed;
      output.progress = sample.progress;
      output.arcProgress = sample.arcProgress;
      target[index] = output;
    }
    return target;
  }

  const uniqueCount =
    closed && source.length > 2 ? source.length - 1 : source.length;
  const timePhase = propagation.phaseOffset + time * propagation.phaseSpeed;
  const { tangent, normal, point, context, output: deformerOutput } = scratch;
  context.count = source.length;
  context.time = timePhase;

  target.length = source.length;
  for (let index = 0; index < source.length; index++) {
    const sample = source[index];
    if (!sample) continue;
    const canonicalIndex = closed && index === source.length - 1 ? 0 : index;
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
    tangent.x = tangentX / tangentLength;
    tangent.y = tangentY / tangentLength;
    normal.x = -tangent.y;
    normal.y = tangent.x;
    point.x = sample.x;
    point.y = sample.y;
    context.index = index;
    context.count = source.length;
    context.time = timePhase;
    context.progress = sample.progress;
    context.arcProgress = sample.arcProgress;

    const domain =
      propagation.domain === "travelTime"
        ? sample.progress
        : sample.arcProgress;
    let normalDisplacement = 0;
    let tangentDisplacement = 0;
    let xDisplacement = 0;
    let yDisplacement = 0;
    let firstNormal = true;
    let firstTangent = true;
    let firstX = true;
    let firstY = true;

    if (hasPropagation) {
      for (const deformer of propagation.deformers) {
        if (deformer.enabled === false) continue;
        evaluateDeformer(
          deformer,
          context,
          domain,
          timePhase,
          deformerOutput,
          onError,
        );
        const direction =
          deformer.direction ??
          (deformer.type === "custom" ? "both" : "normal");
        if (direction === "normal" || direction === "both") {
          normalDisplacement = combineDeformationValue(
            normalDisplacement,
            deformerOutput.normal,
            propagation.combine,
            firstNormal,
          );
          firstNormal = false;
        }
        if (direction === "tangent" || direction === "both") {
          tangentDisplacement = combineDeformationValue(
            tangentDisplacement,
            deformerOutput.tangent,
            propagation.combine,
            firstTangent,
          );
          firstTangent = false;
        }
        if (direction === "x" || deformerOutput.x !== 0) {
          xDisplacement = combineDeformationValue(
            xDisplacement,
            deformerOutput.x,
            propagation.combine,
            firstX,
          );
          firstX = false;
        }
        if (direction === "y" || deformerOutput.y !== 0) {
          yDisplacement = combineDeformationValue(
            yDisplacement,
            deformerOutput.y,
            propagation.combine,
            firstY,
          );
          firstY = false;
        }
      }
    }

    if (hasAudioDeformation) {
      const endpointEnvelope = closed
        ? 1
        : Math.sin(clamp(sample.arcProgress, 0, 1) * Math.PI) ** 2;
      normalDisplacement +=
        Math.sin((domain * Math.max(audioFrequency, 0.1) - time * 0.35) * TAU) *
        audioDeformation *
        endpointEnvelope;
    }

    const output = target[index] ?? {
      x: 0,
      y: 0,
      speed: 1,
      progress: 0,
      arcProgress: 0,
    };
    const normalPx = normalDisplacement * height;
    const tangentPx = tangentDisplacement * height;
    output.x =
      sample.x +
      (normal.x * normalPx + tangent.x * tangentPx + xDisplacement * height) /
        Math.max(width, 1);
    output.y =
      sample.y +
      (normal.y * normalPx + tangent.y * tangentPx + yDisplacement * height) /
        Math.max(height, 1);
    output.speed = sample.speed;
    output.progress = sample.progress;
    output.arcProgress = sample.arcProgress;
    target[index] = output;
  }
  if (propagation.recomputeArcLength) {
    recomputePathProgress(target, width, height, closed, true);
  }
  return target;
}
