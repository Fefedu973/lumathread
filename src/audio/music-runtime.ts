import type { Settings } from "../config/settings";
import { clamp } from "../math";
import type { FollowRuntimeModifiers } from "../runtime/state";

export interface SharedMediaAudioConnection {
  context: AudioContext;
  analyser: AnalyserNode;
}

export interface MusicVisualizerRuntime {
  analyser: AnalyserNode | null;
  data: Uint8Array<ArrayBuffer>;
  sourceActive: boolean;
  energy: number;
  bass: number;
  mid: number;
  treble: number;
}

export const sharedMediaAudioConnections = new WeakMap<
  HTMLMediaElement,
  SharedMediaAudioConnection
>();

export function getSharedMediaAudioConnection(element: HTMLMediaElement) {
  const existing = sharedMediaAudioConnections.get(element);
  if (existing) return existing;
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  const source = context.createMediaElementSource(element);
  source.connect(analyser);
  analyser.connect(context.destination);
  const connection = { context, analyser };
  sharedMediaAudioConnections.set(element, connection);
  return connection;
}

export function createMusicVisualizerRuntime(): MusicVisualizerRuntime {
  return {
    analyser: null,
    data: new Uint8Array(new ArrayBuffer(0)),
    sourceActive: false,
    energy: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };
}

export function createMusicFrameController(
  getRuntime: () => MusicVisualizerRuntime,
) {
  const updateMusicRuntime = () => {
    const runtime = getRuntime();
    const analyser = runtime.analyser;
    if (analyser && runtime.sourceActive) {
      if (runtime.data.length !== analyser.frequencyBinCount) {
        runtime.data = new Uint8Array(
          new ArrayBuffer(analyser.frequencyBinCount),
        );
      }
      analyser.getByteFrequencyData(runtime.data);
    }
    const sampleRate = analyser?.context.sampleRate ?? 48_000;
    const fftSize = analyser?.fftSize ?? 1024;
    const bandRms = (minimumHz: number, maximumHz: number) => {
      if (!analyser || !runtime.sourceActive || runtime.data.length === 0) {
        return 0;
      }
      const hzPerBin = sampleRate / fftSize;
      const start = clamp(
        Math.floor(minimumHz / hzPerBin),
        0,
        runtime.data.length - 1,
      );
      const end = clamp(
        Math.ceil(maximumHz / hzPerBin),
        start + 1,
        runtime.data.length,
      );
      let squareSum = 0;
      for (let index = start; index < end; index++) {
        const normalized = (runtime.data[index] ?? 0) / 255;
        squareSum += normalized * normalized;
      }
      return Math.sqrt(squareSum / Math.max(end - start, 1));
    };
    const approach = (current: number, target: number) =>
      current + (target - current) * (target > current ? 0.42 : 0.16);
    runtime.energy = approach(runtime.energy, bandRms(30, 14_000));
    runtime.bass = approach(runtime.bass, bandRms(30, 250));
    runtime.mid = approach(runtime.mid, bandRms(250, 2_000));
    runtime.treble = approach(runtime.treble, bandRms(2_000, 14_000));
  };

  const musicLevel = (settings: Settings) => {
    const config = settings.musicVisualizer;
    if (!config.enabled) return 0;
    const runtime = getRuntime();
    const value =
      config.band === "bass"
        ? runtime.bass
        : config.band === "mid"
          ? runtime.mid
          : config.band === "treble"
            ? runtime.treble
            : runtime.energy;
    return clamp(value * config.sensitivity, 0, 2);
  };

  const musicModifiers = (
    settings: Settings,
    target: FollowRuntimeModifiers,
  ): FollowRuntimeModifiers => {
    const level = musicLevel(settings);
    const config = settings.musicVisualizer;
    target.width = Math.max(0.05, 1 + config.width * level);
    target.glow = Math.max(0.05, 1 + config.glow * level);
    target.reflection = Math.max(0, 1 + config.reflection * level);
    target.intensity = Math.max(0, 1 + config.intensity * level);
    target.hueDegrees = config.hue * level;
    target.visibility = 1;
    return target;
  };

  const combineRuntimeModifiers = (
    first: FollowRuntimeModifiers,
    second: FollowRuntimeModifiers,
    target: FollowRuntimeModifiers,
  ): FollowRuntimeModifiers => {
    target.width = first.width * second.width;
    target.glow = first.glow * second.glow;
    target.reflection = first.reflection * second.reflection;
    target.intensity = first.intensity * second.intensity;
    target.hueDegrees = first.hueDegrees + second.hueDegrees;
    target.visibility = first.visibility * second.visibility;
    return target;
  };

  const musicDeformation = (settings: Settings) =>
    settings.musicVisualizer.enabled
      ? settings.musicVisualizer.deformation * musicLevel(settings)
      : 0;

  return {
    updateMusicRuntime,
    musicLevel,
    musicModifiers,
    combineRuntimeModifiers,
    musicDeformation,
  };
}
