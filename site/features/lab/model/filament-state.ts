import {
  FILAMENT_STATE_KEYS,
  type FilamentLabState,
  type LabState,
  type SceneFilamentState,
} from "./types";

export const PRIMARY_FILAMENT_ID = "primary";

export type LabStateUpdate = LabState | ((previous: LabState) => LabState);

/** Select only fields that belong to one renderer filament. */
export function pickFilamentState(source: FilamentLabState): FilamentLabState {
  return Object.fromEntries(
    FILAMENT_STATE_KEYS.map((key) => [key, source[key]]),
  ) as FilamentLabState;
}

/** Clone every mutable branch so duplicated filaments never share editors. */
export function cloneFilamentState(source: FilamentLabState): FilamentLabState {
  return {
    ...pickFilamentState(source),
    qualityConfig: { ...source.qualityConfig },
    pathPoints: source.pathPoints.map((point) => ({ ...point })),
    svgViewBox: [...source.svgViewBox],
    organic: { ...source.organic },
    transform: { ...source.transform },
    shape: { ...source.shape },
    motion: { ...source.motion },
    propagationDeformers: source.propagationDeformers.map((deformer) => ({
      ...deformer,
      harmonics: deformer.harmonics.map((harmonic) => ({ ...harmonic })),
    })),
    profileKeys: source.profileKeys.map((key) => ({ ...key })),
    paletteStops: source.paletteStops.map((stop) => ({ ...stop })),
  };
}

export function cloneSceneFilament(
  filament: SceneFilamentState,
): SceneFilamentState {
  return {
    ...filament,
    settings: cloneFilamentState(filament.settings),
  };
}

export function selectedFilamentState(
  scene: LabState,
  selectedId: string,
): LabState {
  if (selectedId === PRIMARY_FILAMENT_ID) return scene;
  const selected = scene.sceneFilaments.find(
    (filament) => filament.id === selectedId,
  );
  return selected ? { ...scene, ...selected.settings } : scene;
}

/**
 * Apply an existing LabState updater to the selected filament. Scene-only
 * fields still update the root, while the primary filament values stay intact.
 */
export function updateFilamentScopedState(
  scene: LabState,
  selectedId: string,
  update: LabStateUpdate,
): LabState {
  if (selectedId === PRIMARY_FILAMENT_ID) {
    return typeof update === "function" ? update(scene) : update;
  }

  const selected = scene.sceneFilaments.find(
    (filament) => filament.id === selectedId,
  );
  if (!selected) return scene;

  const previousView = { ...scene, ...selected.settings };
  const nextView = typeof update === "function" ? update(previousView) : update;
  const rootFilamentState = pickFilamentState(scene);
  const selectedSettings = pickFilamentState(nextView);

  return {
    ...nextView,
    ...rootFilamentState,
    sceneFilaments: nextView.sceneFilaments.map((filament) =>
      filament.id === selectedId
        ? { ...filament, settings: selectedSettings }
        : filament,
    ),
  };
}

export function uniqueFilamentId(scene: LabState, base: string) {
  const used = new Set([
    PRIMARY_FILAMENT_ID,
    ...scene.sceneFilaments.map((filament) => filament.id),
  ]);
  const normalized = base.trim() || "filament";
  if (!used.has(normalized)) return normalized;
  let suffix = 2;
  while (used.has(`${normalized}-${suffix}`)) suffix += 1;
  return `${normalized}-${suffix}`;
}
