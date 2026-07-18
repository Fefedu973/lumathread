import { useMemo } from "react";
import { getHeroTrajectoryVerticalScale } from "@/hero-wave-background";
import { buildBackgroundProps, buildSceneFilaments } from "../model/adapters";
import { buildEditorPath } from "../model/path-editor";
import { buildTextFilaments } from "../model/text-filaments";
import type { LabState } from "../model/types";

export function useLabDerivedState(
  state: LabState,
  viewportSize: { width: number; height: number },
) {
  const backgroundProps = useMemo(() => buildBackgroundProps(state), [state]);

  const sceneFilaments = useMemo(
    () =>
      state.textMode ? buildTextFilaments(state) : buildSceneFilaments(state),
    [state],
  );

  const sceneActive = state.sceneMode || state.textMode;
  const activeFilamentCount = state.textMode
    ? sceneFilaments.filter((filament) => filament.enabled !== false).length
    : state.sceneMode
      ? 1 + state.sceneFilaments.filter((filament) => filament.enabled).length
      : 1;

  const verticalScale = getHeroTrajectoryVerticalScale(
    state.shape.scale,
    state.shape.strength,
  );

  const automaticTerrainColumns = Math.round(
    Math.min(
      320,
      Math.max(
        8,
        state.terrainRows *
          (viewportSize.width / Math.max(viewportSize.height, 1)),
      ),
    ),
  );

  const editorPath = useMemo(
    () =>
      buildEditorPath({
        points: state.pathPoints,
        interpolation: state.interpolation,
        tension: state.pathTension,
        closed: state.closed,
        waveY: state.shape.waveY,
        verticalScale,
        width: viewportSize.width,
        height: viewportSize.height,
      }),
    [
      state.pathPoints,
      state.interpolation,
      state.pathTension,
      state.closed,
      state.shape.waveY,
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
