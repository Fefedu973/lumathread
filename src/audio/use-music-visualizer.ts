import { useEffect, type MutableRefObject } from "react";
import {
  getSharedMediaAudioConnection,
  type MusicVisualizerRuntime,
} from "./music-runtime";
import type { Settings } from "../config/settings";
import type { HeroWaveRendererCallbacks } from "../runtime/use-hero-wave-renderer";

export interface UseMusicVisualizerOptions {
  musicRuntimeRef: MutableRefObject<MusicVisualizerRuntime>;
  settingsRef: MutableRefObject<Settings>;
  invalidateRef: MutableRefObject<() => void>;
  callbacksRef: MutableRefObject<HeroWaveRendererCallbacks>;
  connectionKey: string;
  analyserKey: string;
}

export function useMusicVisualizer({
  musicRuntimeRef,
  settingsRef,
  invalidateRef,
  callbacksRef,
  connectionKey: musicVisualizerConnectionKey,
  analyserKey: musicVisualizerAnalyserKey,
}: UseMusicVisualizerOptions) {
  useEffect(() => {
    const runtime = musicRuntimeRef.current;
    runtime.analyser = null;
    runtime.data = new Uint8Array(new ArrayBuffer(0));
    runtime.sourceActive = false;
    runtime.energy = 0;
    runtime.bass = 0;
    runtime.mid = 0;
    runtime.treble = 0;

    const config = settingsRef.current.musicVisualizer;
    if (!config.enabled) return;
    let disposed = false;
    let microphoneContext: AudioContext | null = null;
    let microphoneStream: MediaStream | null = null;
    let mediaElement: HTMLMediaElement | null = null;
    let onPlay: (() => void) | null = null;
    let onPause: (() => void) | null = null;

    const configureAnalyser = (analyser: AnalyserNode) => {
      analyser.fftSize = config.fftSize;
      analyser.smoothingTimeConstant = config.smoothing;
      runtime.analyser = analyser;
      runtime.data = new Uint8Array(
        new ArrayBuffer(analyser.frequencyBinCount),
      );
      invalidateRef.current();
    };

    if (config.source === "element") {
      const candidate = document.getElementById(config.elementId);
      if (!(candidate instanceof HTMLMediaElement)) {
        if (config.elementId) {
          console.warn(
            `HeroWaveBackground: audio element #${config.elementId} was not found.`,
          );
        }
        return;
      }
      mediaElement = candidate;
      try {
        const connection = getSharedMediaAudioConnection(candidate);
        configureAnalyser(connection.analyser);
        runtime.sourceActive = !candidate.paused && !candidate.ended;
        onPlay = () => {
          runtime.sourceActive = true;
          void connection.context.resume().catch(() => undefined);
          invalidateRef.current();
        };
        onPause = () => {
          runtime.sourceActive = false;
          invalidateRef.current();
        };
        candidate.addEventListener("play", onPlay);
        candidate.addEventListener("pause", onPause);
        candidate.addEventListener("ended", onPause);
      } catch (error) {
        callbacksRef.current.onRendererError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    } else {
      const connectMicrophone = async () => {
        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          if (disposed) {
            for (const track of microphoneStream.getTracks()) track.stop();
            return;
          }
          microphoneContext = new AudioContext();
          const analyser = microphoneContext.createAnalyser();
          microphoneContext
            .createMediaStreamSource(microphoneStream)
            .connect(analyser);
          configureAnalyser(analyser);
          runtime.sourceActive = true;
          await microphoneContext.resume();
        } catch (error) {
          callbacksRef.current.onRendererError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      };
      void connectMicrophone();
    }

    return () => {
      disposed = true;
      if (mediaElement && onPlay && onPause) {
        mediaElement.removeEventListener("play", onPlay);
        mediaElement.removeEventListener("pause", onPause);
        mediaElement.removeEventListener("ended", onPause);
      }
      for (const track of microphoneStream?.getTracks() ?? []) track.stop();
      if (microphoneContext) void microphoneContext.close();
      runtime.analyser = null;
      runtime.sourceActive = false;
    };
  }, [musicVisualizerConnectionKey]);

  useEffect(() => {
    const runtime = musicRuntimeRef.current;
    const analyser = runtime.analyser;
    if (!analyser) return;
    const config = settingsRef.current.musicVisualizer;
    analyser.fftSize = config.fftSize;
    analyser.smoothingTimeConstant = config.smoothing;
    runtime.data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    invalidateRef.current();
  }, [musicVisualizerAnalyserKey]);
}
