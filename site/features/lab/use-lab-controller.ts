"use client";

import { useRef, useState } from "react";
import {
  MAX_HERO_DOT_MASKS,
  MIN_HERO_TRAJECTORY_POINTS,
  type HeroTrajectoryPoint,
  type HeroWaveBackgroundHandle,
} from "@/hero-wave-background";
import { useInitialUrlState } from "./hooks/use-initial-url-state";
import { useFilamentEditor } from "./hooks/use-filament-editor";
import { useLabDerivedState } from "./hooks/use-lab-derived-state";
import { useObjectUrlCleanup } from "./hooks/use-object-url-cleanup";
import { useRendererMetrics } from "./hooks/use-renderer-metrics";
import { useStageViewport } from "./hooks/use-stage-viewport";
import { createLabDeformer } from "./model/factories";
import { PRIMARY_FILAMENT_ID } from "./model/filament-state";
import { createRandomPathConfiguration } from "./model/path-editor";
import {
  GLASS_PRESETS,
  cloneInitialState,
  selectedGlassPreset,
  stateForPreset,
  type GlassPresetId,
} from "./model/presets";
import { hslToHex } from "./model/profiles";
import { randomizeLabState } from "./model/randomize";
import type {
  DeformerKind,
  HarmonicState,
  LabDeformerState,
  LabPanelSection,
  LabPresetId,
  LabState,
  ProfileKeyState,
  SelectedPreset,
} from "./model/types";

export function useLabController() {
  const [sceneState, setSceneState] = useState<LabState>(() =>
    cloneInitialState(),
  );

  const [preset, setPreset] = useState<SelectedPreset>("reference");

  const [panelOpen, setPanelOpen] = useState(true);

  const [panelDocked, setPanelDocked] = useState(false);

  const [panelSection, setPanelSection] = useState<LabPanelSection>("path");

  const [copied, setCopied] = useState(false);

  const [showContent, setShowContent] = useState(true);

  const [showPathEditor, setShowPathEditor] = useState(false);

  const [showMaskGuides, setShowMaskGuides] = useState(false);

  const [selectedPoint, setSelectedPoint] = useState(0);

  const [cycleCount, setCycleCount] = useState(0);

  const [autoRandomPath, setAutoRandomPath] = useState(false);

  const [autoCycle, setAutoCycle] = useState(0);

  const [renderEpoch, setRenderEpoch] = useState(0);

  const filamentEditor = useFilamentEditor(
    sceneState,
    setSceneState,
    setSelectedPoint,
    setShowPathEditor,
  );
  const {
    state,
    setState,
    selectedFilamentId,
    setSelectedFilamentId,
    selectedFilamentMeta,
    editingPrimaryFilament,
    selectFilament,
    setSceneMode,
    addSceneFilament,
    duplicateSelectedFilament,
    updateSelectedFilamentMeta,
    renameSelectedFilament,
    removeSelectedFilament,
  } = filamentEditor;

  const waveRef = useRef<HeroWaveBackgroundHandle>(null);
  const { stageRef, viewportSize } = useStageViewport();
  const {
    rendererStatus,
    setRendererStatus,
    rendererFps,
    setRendererFps,
    frameStatsRef,
    handleRendererFrame,
    statusLabel,
  } = useRendererMetrics();

  useObjectUrlCleanup(sceneState.backgroundImageSrc);
  useObjectUrlCleanup(sceneState.musicAudioSrc);
  useInitialUrlState(setSceneState);

  const {
    backgroundProps,
    sceneFilaments,
    sceneActive,
    activeFilamentCount,
    verticalScale,
    automaticTerrainColumns,
    editorPath,
  } = useLabDerivedState(sceneState, viewportSize, state);

  const markCustom = () => setPreset("custom");

  const glassPreset = selectedGlassPreset(state);

  const applyGlassPreset = (id: GlassPresetId) => {
    setState((previous) => ({
      ...previous,
      ...GLASS_PRESETS[id].values,
      glassTextEnabled: true,
    }));
  };

  const applyPreset = (id: LabPresetId) => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setSceneState({ ...stateForPreset(id), textMode: false });
    setSelectedFilamentId(PRIMARY_FILAMENT_ID);
    setPreset(id);
    setShowPathEditor(id === "sampled" || id === "scene");
    setSelectedPoint(0);
  };

  const randomize = () => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    const randomized = randomizeLabState(state);
    setState(randomized);
    updateSelectedFilamentMeta({
      timeOffset: Math.random() * 4,
      playbackRate: 0.35 + Math.random() * 1.45,
    });
    setShowPathEditor(randomized.pathMode === "custom" && !randomized.textMode);
    setShowMaskGuides(false);
    setSelectedPoint(0);
    setRenderEpoch((value) => value + 1);
    setPreset("custom");
  };

  const regenerateAutoPath = () => {
    const randomPath = createRandomPathConfiguration();
    setSceneState((previous) => ({
      ...previous,
      textMode: false,
      ...randomPath,
      pathMode: "organic",
      closed: false,
      sceneMode: false,
      paused: false,
      controlledTime: false,
      motion: {
        ...previous.motion,
        mode: "travel",
        curveTravel: Math.max(Math.abs(previous.motion.curveTravel), 0.08),
        speed: Math.max(Math.abs(previous.motion.speed), 0.35),
      },
    }));
  };

  const startAutoPath = () => {
    setSelectedFilamentId(PRIMARY_FILAMENT_ID);
    regenerateAutoPath();
    setAutoRandomPath(true);
    setAutoCycle(1);
    setPreset("custom");
    setShowPathEditor(false);
    setSelectedPoint(0);
  };

  const startTextMode = () => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setSceneState((previous) => ({
      ...previous,
      textMode: true,
      sceneMode: false,
      pathMode: "custom",
      paused: false,
      controlledTime: false,
    }));
    setSelectedFilamentId(PRIMARY_FILAMENT_ID);
    setPreset("custom");
    setShowPathEditor(false);
    setShowMaskGuides(false);
  };

  const applyTrajectoryPreset = (
    points: readonly HeroTrajectoryPoint[],
    closed: boolean,
    options: {
      shape?: Partial<LabState["shape"]>;
      motion?: Partial<LabState["motion"]>;
    } = {},
  ) => {
    setAutoRandomPath(false);
    setAutoCycle(0);
    setState((previous) => ({
      ...previous,
      textMode: false,
      pathMode: "custom",
      interpolation: "centripetal-catmull-rom",
      pathPoints: points.map((point, index) => ({
        ...point,
        id: `preset-${point.id}-${index}`,
      })),
      closed,
      closedLoopTaper: closed ? false : previous.closedLoopTaper,
      shape: { ...previous.shape, ...options.shape },
      motion: {
        ...previous.motion,
        mode: "travel",
        ...options.motion,
      },
      sceneMode:
        selectedFilamentId === PRIMARY_FILAMENT_ID ? false : previous.sceneMode,
      paused: false,
      controlledTime: false,
    }));
    setPreset("custom");
    setShowPathEditor(true);
    setSelectedPoint(0);
  };

  const copyConfiguration = async () => {
    const serializable = sceneActive
      ? { ...backgroundProps, filaments: sceneFilaments }
      : backgroundProps;
    const componentName = sceneActive ? "HeroWaveScene" : "HeroWaveBackground";
    const text = `const heroWaveConfig = ${JSON.stringify(
      serializable,
      null,
      2,
    )} satisfies HeroWaveBackgroundProps;\n\n<${componentName} {...heroWaveConfig} />;`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const updatePointPosition = (
    index: number,
    clientX: number,
    clientY: number,
  ) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - rect.left) / Math.max(rect.width, 1);
    const top = (clientY - rect.top) / Math.max(rect.height, 1);
    setState((previous) => ({
      ...previous,
      pathMode: "custom",
      pathPoints: previous.pathPoints.map((point, pointIndex) =>
        pointIndex === index
          ? {
              ...point,
              x: Math.min(1, Math.max(0, x)),
              y: Math.min(
                4,
                Math.max(-4, (previous.shape.waveY - top) / verticalScale),
              ),
            }
          : point,
      ),
    }));
  };

  const addPoint = () => {
    const index = Math.min(selectedPoint, state.pathPoints.length - 1);
    const current = state.pathPoints[index];
    if (!current) return;
    const next = state.pathPoints[index + 1];
    const inserted: HeroTrajectoryPoint = next
      ? {
          id: `point-${Date.now()}`,
          x: (current.x + next.x) / 2,
          y: (current.y + next.y) / 2,
          speed: (current.speed + next.speed) / 2,
        }
      : {
          id: `point-${Date.now()}`,
          x: Math.min(1, current.x + 0.08),
          y: current.y,
          speed: current.speed,
        };
    setState((previous) => {
      const points = [...previous.pathPoints];
      points.splice(index + 1, 0, inserted);
      return { ...previous, pathMode: "custom", pathPoints: points };
    });
    setSelectedPoint(index + 1);
  };

  const removePoint = () => {
    if (state.pathPoints.length <= MIN_HERO_TRAJECTORY_POINTS) return;
    setState((previous) => ({
      ...previous,
      pathPoints: previous.pathPoints.filter(
        (_point, index) => index !== selectedPoint,
      ),
    }));
    setSelectedPoint((index) => Math.max(0, index - 1));
  };

  const addPaletteStop = () => {
    setState((previous) => {
      const count = previous.paletteStops.length;
      return {
        ...previous,
        paletteStops: [
          ...previous.paletteStops,
          {
            id: `palette-${Date.now()}`,
            color: hslToHex(Math.random() * 360, 0.9, 0.58),
            offset: count === 0 ? 0 : 1,
            easing: "smooth",
          },
        ],
      };
    });
  };

  const addMask = () => {
    setState((previous) => {
      if (previous.dotMasks.length >= MAX_HERO_DOT_MASKS) return previous;
      const offset = previous.dotMasks.length * 0.07;
      return {
        ...previous,
        dotMasks: [
          ...previous.dotMasks,
          {
            id: `mask-${Date.now()}`,
            x: Math.min(0.85, 0.42 + offset),
            y: Math.max(0.2, 0.58 - offset),
            radius: 0.42,
            feather: previous.maskFeather,
          },
        ],
      };
    });
  };

  const updateMaskFromPointer = (
    index: number,
    mode: "center" | "radius",
    clientX: number,
    clientY: number,
  ) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setState((previous) => ({
      ...previous,
      dotMasks: previous.dotMasks.map((mask, maskIndex) => {
        if (maskIndex !== index) return mask;
        if (mode === "center") {
          return {
            ...mask,
            x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
            y: Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height)),
          };
        }
        const centerX = rect.left + mask.x * rect.width;
        const centerY = rect.top + (1 - mask.y) * rect.height;
        return {
          ...mask,
          radius: Math.min(
            1.5,
            Math.max(
              0.05,
              Math.hypot(clientX - centerX, clientY - centerY) /
                Math.max(rect.height, 1),
            ),
          ),
        };
      }),
    }));
  };

  const updateFadeCurve = (index: number, value: number) => {
    setState((previous) => {
      const fadeCurve: [number, number, number, number] = [
        ...previous.fadeCurve,
      ];
      fadeCurve[index] = value;
      return { ...previous, fadeCurve };
    });
  };

  const updateGlassIntroCurve = (index: number, value: number) => {
    setState((previous) => {
      const glassIntroCurve: [number, number, number, number] = [
        ...previous.glassIntroCurve,
      ];
      glassIntroCurve[index] = value;
      return { ...previous, glassIntroCurve };
    });
  };

  const addProfileKey = () => {
    setState((previous) => {
      if (previous.profileKeys.length >= 12) return previous;
      const keys = [...previous.profileKeys].sort(
        (left, right) => left.position - right.position,
      );
      let left = keys[0]!;
      let right = keys[keys.length - 1]!;
      let largestGap = -1;
      for (let index = 1; index < keys.length; index++) {
        const candidateLeft = keys[index - 1]!;
        const candidateRight = keys[index]!;
        const gap = candidateRight.position - candidateLeft.position;
        if (gap > largestGap) {
          largestGap = gap;
          left = candidateLeft;
          right = candidateRight;
        }
      }
      const average = (key: keyof Omit<ProfileKeyState, "id" | "position">) => {
        const fallback = key === "colorPosition" ? 0 : 1;
        const leftValue = Number.isFinite(left[key]) ? left[key] : fallback;
        const rightValue = Number.isFinite(right[key]) ? right[key] : fallback;
        return (leftValue + rightValue) / 2;
      };
      return {
        ...previous,
        profileSource: "custom",
        profileKeys: [
          ...previous.profileKeys,
          {
            id: `profile-${Date.now()}`,
            position: (left.position + right.position) / 2,
            width: average("width"),
            opacity: average("opacity"),
            intensity: average("intensity"),
            glow: average("glow"),
            upperGlowSpread: average("upperGlowSpread"),
            lowerGlowSpread: average("lowerGlowSpread"),
            reflection: average("reflection"),
            colorPosition: average("colorPosition"),
          },
        ],
      };
    });
  };

  const updateProfileKey = (
    id: string,
    changes: Partial<Omit<ProfileKeyState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      profileKeys: previous.profileKeys.map((key) =>
        key.id === id ? { ...key, ...changes } : key,
      ),
    }));
  };

  const updateDeformer = (
    id: string,
    changes: Partial<Omit<LabDeformerState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      propagationDeformers: previous.propagationDeformers.map((deformer) =>
        deformer.id === id ? { ...deformer, ...changes } : deformer,
      ),
    }));
  };

  const addDeformer = (type: DeformerKind) => {
    setState((previous) => {
      if (previous.propagationDeformers.length >= 8) return previous;
      return {
        ...previous,
        propagationEnabled: true,
        propagationDeformers: [
          ...previous.propagationDeformers,
          createLabDeformer(type, previous.propagationDeformers.length),
        ],
      };
    });
  };

  const updateHarmonic = (
    deformerId: string,
    harmonicId: string,
    changes: Partial<Omit<HarmonicState, "id">>,
  ) => {
    setState((previous) => ({
      ...previous,
      propagationDeformers: previous.propagationDeformers.map((deformer) =>
        deformer.id === deformerId
          ? {
              ...deformer,
              harmonics: deformer.harmonics.map((harmonic) =>
                harmonic.id === harmonicId
                  ? { ...harmonic, ...changes }
                  : harmonic,
              ),
            }
          : deformer,
      ),
    }));
  };

  const commonCallbacks = {
    onRendererStatus: setRendererStatus,
    onRendererError: (error: Error) => console.error(error),
    onFrame: handleRendererFrame,
    onCycle: () => {
      setCycleCount((value) => value + 1);
      if (autoRandomPath) {
        setAutoCycle((value) => value + 1);
        regenerateAutoPath();
      }
    },
  };

  const lightTheme = sceneState.theme === "light";

  return {
    state,
    setState,
    sceneState,
    selectedFilamentId,
    selectedFilamentMeta,
    editingPrimaryFilament,
    selectFilament,
    setSceneMode,
    preset,
    panelOpen,
    setPanelOpen,
    panelDocked,
    setPanelDocked,
    panelSection,
    setPanelSection,
    copied,
    showContent,
    setShowContent,
    showPathEditor,
    setShowPathEditor,
    showMaskGuides,
    setShowMaskGuides,
    selectedPoint,
    setSelectedPoint,
    rendererStatus,
    cycleCount,
    autoRandomPath,
    setAutoRandomPath,
    autoCycle,
    setAutoCycle,
    viewportSize,
    renderEpoch,
    setRenderEpoch,
    rendererFps,
    setRendererFps,
    stageRef,
    waveRef,
    frameStatsRef,
    backgroundProps,
    sceneFilaments,
    sceneActive,
    activeFilamentCount,
    verticalScale,
    automaticTerrainColumns,
    editorPath,
    markCustom,
    glassPreset,
    applyGlassPreset,
    applyPreset,
    randomize,
    startAutoPath,
    startTextMode,
    applyTrajectoryPreset,
    copyConfiguration,
    updatePointPosition,
    addPoint,
    removePoint,
    addPaletteStop,
    addMask,
    updateMaskFromPointer,
    addSceneFilament,
    duplicateSelectedFilament,
    updateSelectedFilamentMeta,
    renameSelectedFilament,
    removeSelectedFilament,
    updateFadeCurve,
    updateGlassIntroCurve,
    addProfileKey,
    updateProfileKey,
    updateDeformer,
    addDeformer,
    updateHarmonic,
    statusLabel,
    commonCallbacks,
    lightTheme,
  } as const;
}

export type LabController = ReturnType<typeof useLabController>;
