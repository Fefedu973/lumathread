import { describe, expect, test } from "bun:test";
import {
  buildBackgroundProps,
  buildSceneFilaments,
} from "../features/lab/model/adapters";
import { readUrlPlaybackState } from "../features/lab/hooks/use-initial-url-state";
import { INITIAL_STATE } from "../features/lab/model/initial-state";
import {
  GLASS_PRESETS,
  cloneInitialState,
  selectedGlassPreset,
  stateForPreset,
} from "../features/lab/model/presets";
import type { LabPresetId } from "../features/lab/model/types";

describe("lab model", () => {
  test("clones all mutable initial-state branches", () => {
    const clone = cloneInitialState();
    clone.pathPoints[0]!.x = 99;
    clone.qualityConfig.maxDpr = 99;
    clone.propagationDeformers[0]!.harmonics[0]!.frequency = 99;
    clone.profileKeys[0]!.width = 99;
    clone.paletteStops[0]!.color = "#ffffff";
    clone.dotMasks[0]!.radius = 99;
    clone.sceneFilaments[0]!.offsetX = 99;
    clone.fadeCurve[0] = 99;
    clone.glassIntroCurve[0] = 99;

    expect(INITIAL_STATE.pathPoints[0]!.x).not.toBe(99);
    expect(INITIAL_STATE.qualityConfig.maxDpr).not.toBe(99);
    expect(
      INITIAL_STATE.propagationDeformers[0]!.harmonics[0]!.frequency,
    ).not.toBe(99);
    expect(INITIAL_STATE.profileKeys[0]!.width).not.toBe(99);
    expect(INITIAL_STATE.paletteStops[0]!.color).not.toBe("#ffffff");
    expect(INITIAL_STATE.dotMasks[0]!.radius).not.toBe(99);
    expect(INITIAL_STATE.sceneFilaments[0]!.offsetX).not.toBe(99);
    expect(INITIAL_STATE.fadeCurve[0]).not.toBe(99);
    expect(INITIAL_STATE.glassIntroCurve[0]).not.toBe(99);
  });

  test("preserves the behavior of every built-in preset", () => {
    const expected = {
      reference: {
        pathMode: "organic",
        motionMode: "travel",
        materialPreset: "soft-aurora",
        profilePreset: "flat",
        propagationEnabled: false,
      },
      sampled: {
        pathMode: "custom",
        motionMode: "propagate",
        materialPreset: "soft-aurora",
        profilePreset: "comet",
        propagationEnabled: true,
      },
      noise: {
        pathMode: "organic",
        motionMode: "propagate",
        materialPreset: "plasma",
        profilePreset: "center-glow",
        propagationEnabled: true,
      },
      pulse: {
        pathMode: "svg",
        motionMode: "anchored",
        materialPreset: "neon",
        profilePreset: "segmented",
        propagationEnabled: true,
      },
      follow: {
        pathMode: "follow",
        motionMode: "anchored",
        materialPreset: "neon",
        profilePreset: "comet",
        propagationEnabled: true,
      },
      svg: {
        pathMode: "svg",
        motionMode: "travel",
        materialPreset: "neon",
        profilePreset: "flat",
        propagationEnabled: true,
      },
      scene: {
        pathMode: "custom",
        motionMode: "travel",
        materialPreset: "soft-aurora",
        profilePreset: "comet",
        propagationEnabled: true,
      },
    } as const;

    for (const id of Object.keys(expected) as LabPresetId[]) {
      const state = stateForPreset(id);
      const values = expected[id];
      expect(state.pathMode).toBe(values.pathMode);
      expect(state.motion.mode).toBe(values.motionMode);
      expect(state.materialPreset).toBe(values.materialPreset);
      expect(state.profilePreset).toBe(values.profilePreset);
      expect(state.propagationEnabled).toBe(values.propagationEnabled);
    }
  });

  test("maps lab state to the public component contract", () => {
    const state = stateForPreset("follow");
    state.controlledTime = true;
    state.timelineTime = 12.5;
    state.followExternalEnabled = true;
    state.followExternalX = 0.25;
    state.followExternalY = 0.75;
    state.fadeCurvePreset = "custom";
    state.fadeCurve = [0.1, 0.2, 0.8, 0.9];
    state.glassTextEnabled = true;
    state.glassDomTargetEnabled = true;
    state.glassIntroDelay = 180;
    state.glassIntroDuration = 720;
    state.glassIntroCurvePreset = "custom";
    state.glassIntroCurve = [0.2, 0.4, 0.7, 1];

    const props = buildBackgroundProps(state);

    expect(props.path).toMatchObject({
      mode: "follow",
      interpolation: state.interpolation,
      closed: state.closed,
    });
    expect(props.motion?.mode).toBe("anchored");
    expect(props.propagation).toMatchObject({
      enabled: true,
      stage: "after-follow",
    });
    expect(props.interaction?.follow).toMatchObject({
      mode: "cascade",
      position: { x: 0.25, y: 0.75, space: state.followExternalSpace },
    });
    expect(props.material).toMatchObject({ preset: "neon", intensity: 1.08 });
    expect(props.fadeInEasing).toEqual([0.1, 0.2, 0.8, 0.9]);
    expect(props.glassText).toMatchObject({
      dom: {
        target: "#lumathread-lab-glass-target",
        syncContent: true,
        syncTypography: true,
      },
      intro: {
        delay: 180,
        duration: 720,
        easing: [0.2, 0.4, 0.7, 1],
      },
    });
    expect(props.time).toBe(12.5);
  });

  test("only forces controlled playback when the url asks for it", () => {
    // Number(null) and Number("") are both 0, so a bare /lab visit must not
    // be mistaken for ?time=0.
    expect(readUrlPlaybackState("")).toBeNull();
    expect(readUrlPlaybackState("?preset=scene")).toBeNull();
    expect(readUrlPlaybackState("?time=")).toBeNull();
    expect(readUrlPlaybackState("?time=abc")).toBeNull();

    expect(readUrlPlaybackState("?paused")).toEqual({ paused: true });
    expect(readUrlPlaybackState("?time=12.5")).toEqual({
      controlledTime: true,
      timelineTime: 12.5,
      paused: true,
    });
    expect(readUrlPlaybackState("?time=0")).toEqual({
      controlledTime: true,
      timelineTime: 0,
      paused: true,
    });
  });

  test("keeps glass preset recognition and scene composition deterministic", () => {
    const state = cloneInitialState();
    expect(selectedGlassPreset(state)).toBe("custom");
    Object.assign(state, GLASS_PRESETS["clear-crystal"].values);
    expect(selectedGlassPreset(state)).toBe("clear-crystal");

    const filaments = buildSceneFilaments(state);
    expect(filaments[0]).toEqual({ id: "primary" });
    expect(filaments).toHaveLength(state.sceneFilaments.length + 1);
    expect(filaments.slice(1).map((filament) => filament.id)).toEqual(
      state.sceneFilaments.map((filament) => filament.id),
    );
  });
});
