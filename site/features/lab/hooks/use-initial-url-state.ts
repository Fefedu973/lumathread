import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { LabState } from "../model/types";

/**
 * Reads the deterministic-playback query parameters. `Number(null)` and
 * `Number("")` both evaluate to 0, which is finite, so the parameter has to be
 * checked for presence before it is parsed — otherwise every plain `/lab`
 * visit would start paused on a controlled timeline.
 */
export function readUrlPlaybackState(search: string): Partial<LabState> | null {
  const parameters = new URLSearchParams(search);
  const rawTime = parameters.get("time");

  if (rawTime !== null && rawTime.trim() !== "") {
    const time = Number(rawTime);
    if (Number.isFinite(time)) {
      return { controlledTime: true, timelineTime: time, paused: true };
    }
  }

  if (parameters.has("paused")) {
    return { paused: true };
  }

  return null;
}

export function useInitialUrlState(
  setState: Dispatch<SetStateAction<LabState>>,
) {
  useEffect(() => {
    const changes = readUrlPlaybackState(window.location.search);
    if (!changes) return;
    setState((previous) => ({ ...previous, ...changes }));
  }, [setState]);
}
