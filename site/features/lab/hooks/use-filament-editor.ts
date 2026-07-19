import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createSceneFilament } from "../model/factories";
import {
  cloneFilamentState,
  PRIMARY_FILAMENT_ID,
  selectedFilamentState,
  uniqueFilamentId,
  updateFilamentScopedState,
} from "../model/filament-state";
import type { LabState, SceneFilamentState } from "../model/types";

const MAX_ADDITIONAL_FILAMENTS = 15;

export function useFilamentEditor(
  sceneState: LabState,
  setSceneState: Dispatch<SetStateAction<LabState>>,
  setSelectedPoint: Dispatch<SetStateAction<number>>,
  setShowPathEditor: Dispatch<SetStateAction<boolean>>,
) {
  const [selectedFilamentId, setSelectedFilamentId] =
    useState(PRIMARY_FILAMENT_ID);

  const state = useMemo(
    () => selectedFilamentState(sceneState, selectedFilamentId),
    [sceneState, selectedFilamentId],
  );

  const setState = useCallback<Dispatch<SetStateAction<LabState>>>(
    (update) => {
      setSceneState((previous) =>
        updateFilamentScopedState(previous, selectedFilamentId, update),
      );
    },
    [selectedFilamentId, setSceneState],
  );

  const selectedSceneFilament = sceneState.sceneFilaments.find(
    (filament) => filament.id === selectedFilamentId,
  );
  const editingPrimaryFilament = !selectedSceneFilament;
  const selectedFilamentMeta = editingPrimaryFilament
    ? {
        id: PRIMARY_FILAMENT_ID,
        enabled: sceneState.primaryFilamentEnabled,
        timeOffset: sceneState.primaryFilamentTimeOffset,
        playbackRate: sceneState.primaryFilamentPlaybackRate,
        primary: true as const,
      }
    : { ...selectedSceneFilament, primary: false as const };

  const selectFilament = (id: string) => {
    if (
      id !== PRIMARY_FILAMENT_ID &&
      !sceneState.sceneFilaments.some((filament) => filament.id === id)
    ) {
      return;
    }
    setSelectedFilamentId(id);
    setSelectedPoint(0);
    setShowPathEditor(
      selectedFilamentState(sceneState, id).pathMode === "custom",
    );
  };

  const setSceneMode = (sceneMode: boolean) => {
    if (!sceneMode) setSelectedFilamentId(PRIMARY_FILAMENT_ID);
    setSceneState((previous) => ({
      ...previous,
      sceneMode,
      textMode: sceneMode ? false : previous.textMode,
    }));
  };

  const addSceneFilament = () => {
    if (sceneState.sceneFilaments.length >= MAX_ADDITIONAL_FILAMENTS) return;
    const id = uniqueFilamentId(
      sceneState,
      `filament-${sceneState.sceneFilaments.length + 2}`,
    );
    setSceneState((previous) => ({
      ...previous,
      sceneMode: true,
      textMode: false,
      sceneFilaments: [
        ...previous.sceneFilaments,
        createSceneFilament(previous.sceneFilaments.length, previous, { id }),
      ],
    }));
    setSelectedFilamentId(id);
    setSelectedPoint(0);
  };

  const duplicateSelectedFilament = () => {
    if (sceneState.sceneFilaments.length >= MAX_ADDITIONAL_FILAMENTS) return;
    const source = selectedSceneFilament?.settings ?? state;
    const id = uniqueFilamentId(
      sceneState,
      editingPrimaryFilament
        ? "primary-copy"
        : `${selectedFilamentMeta.id}-copy`,
    );
    const index = sceneState.sceneFilaments.length;
    setSceneState((previous) => ({
      ...previous,
      sceneMode: true,
      textMode: false,
      sceneFilaments: [
        ...previous.sceneFilaments,
        createSceneFilament(index, source, {
          id,
          timeOffset: selectedFilamentMeta.timeOffset + 0.25,
          playbackRate: selectedFilamentMeta.playbackRate,
          settings: cloneFilamentState(source),
        }),
      ],
    }));
    setSelectedFilamentId(id);
    setSelectedPoint(0);
  };

  const updateSelectedFilamentMeta = (
    changes: Partial<
      Pick<SceneFilamentState, "enabled" | "timeOffset" | "playbackRate">
    >,
  ) => {
    setSceneState((previous) => {
      if (editingPrimaryFilament) {
        return {
          ...previous,
          primaryFilamentEnabled:
            changes.enabled ?? previous.primaryFilamentEnabled,
          primaryFilamentTimeOffset:
            changes.timeOffset ?? previous.primaryFilamentTimeOffset,
          primaryFilamentPlaybackRate:
            changes.playbackRate ?? previous.primaryFilamentPlaybackRate,
        };
      }
      return {
        ...previous,
        sceneFilaments: previous.sceneFilaments.map((filament) =>
          filament.id === selectedFilamentId
            ? { ...filament, ...changes }
            : filament,
        ),
      };
    });
  };

  const renameSelectedFilament = (requestedId: string) => {
    if (editingPrimaryFilament) return PRIMARY_FILAMENT_ID;
    const trimmed = requestedId.trim();
    if (!trimmed || trimmed === selectedFilamentId) return selectedFilamentId;
    const withoutSelected = {
      ...sceneState,
      sceneFilaments: sceneState.sceneFilaments.filter(
        (filament) => filament.id !== selectedFilamentId,
      ),
    };
    const id = uniqueFilamentId(withoutSelected, trimmed);
    setSceneState((previous) => ({
      ...previous,
      sceneFilaments: previous.sceneFilaments.map((filament) =>
        filament.id === selectedFilamentId ? { ...filament, id } : filament,
      ),
    }));
    setSelectedFilamentId(id);
    return id;
  };

  const removeSelectedFilament = () => {
    if (editingPrimaryFilament) return;
    setSceneState((previous) => ({
      ...previous,
      sceneFilaments: previous.sceneFilaments.filter(
        (filament) => filament.id !== selectedFilamentId,
      ),
    }));
    setSelectedFilamentId(PRIMARY_FILAMENT_ID);
    setSelectedPoint(0);
  };

  return {
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
  } as const;
}
