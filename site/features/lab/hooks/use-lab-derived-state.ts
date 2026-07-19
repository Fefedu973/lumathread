import { useMemo } from "react";
import { getHeroTrajectoryVerticalScale } from "@/hero-wave-background";
import { buildBackgroundProps, buildSceneFilaments } from "../model/adapters";
import { buildEditorPath } from "../model/path-editor";
import { buildTextFilaments } from "../model/text-filaments";
import type { LabState } from "../model/types";

export function useLabDerivedState(
  sceneState: LabState,
  viewportSize: { width: number; height: number },
  editorState: LabState = sceneState,
) {
  const backgroundProps = useMemo(
    () => buildBackgroundProps(sceneState),
    [sceneState],
  );

  const sceneFilaments = useMemo(
    () =>
      sceneState.textMode
        ? buildTextFilaments(sceneState)
        : buildSceneFilaments(sceneState),
    [sceneState],
  );

  const sceneActive = sceneState.sceneMode || sceneState.textMode;
  const activeFilamentCount = sceneState.textMode
    ? sceneFilaments.filter((filament) => filament.enabled !== false).length
    : sceneState.sceneMode
      ? sceneFilaments.filter((filament) => filament.enabled !== false).length
      : 1;

  const verticalScale = getHeroTrajectoryVerticalScale(
    editorState.shape.scale,
    editorState.shape.strength,
  );

  const automaticTerrainColumns = Math.round(
    Math.min(
      320,
      Math.max(
        8,
        sceneState.terrainRows *
          (viewportSize.width / Math.max(viewportSize.height, 1)),
      ),
    ),
  );

  const editorPath = useMemo(
    () =>
      buildEditorPath({
        points: editorState.pathPoints,
        interpolation: editorState.interpolation,
        tension: editorState.pathTension,
        closed: editorState.closed,
        waveY: editorState.shape.waveY,
        verticalScale,
        width: viewportSize.width,
        height: viewportSize.height,
      }),
    [
      editorState.pathPoints,
      editorState.interpolation,
      editorState.pathTension,
      editorState.closed,
      editorState.shape.waveY,
      verticalScale,
      viewportSize,
    ],
  );

  return {
    backgroundProps,
    sceneFilaments,
    sceneActive,
    activeFilamentCount,
    verticalScale,
    automaticTerrainColumns,
    editorPath,
  } as const;
}
