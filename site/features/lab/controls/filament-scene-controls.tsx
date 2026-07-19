"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@site/components/ui/button";
import { Input } from "@site/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";
import { FieldRow, NumberSlider, SwitchField } from "./common-controls";

const MAX_LAB_FILAMENTS = 16;

export function FilamentSelector() {
  const { sceneState, selectedFilamentId, selectFilament, addSceneFilament } =
    useLabControllerContext();

  if (!sceneState.sceneMode) return null;
  const count = sceneState.sceneFilaments.length + 1;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedFilamentId}
        onValueChange={(value) => {
          if (value) selectFilament(value);
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Filament to edit"
          className="min-w-0 flex-1"
        >
          <SelectValue placeholder="Select a filament" />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="primary">
            Primary · {sceneState.pathMode}
          </SelectItem>
          {sceneState.sceneFilaments.map((filament) => (
            <SelectItem key={filament.id} value={filament.id}>
              {filament.id} · {filament.settings.pathMode}
              {filament.enabled ? "" : " · disabled"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        title="Add filament"
        aria-label="Add filament"
        disabled={count >= MAX_LAB_FILAMENTS}
        onClick={addSceneFilament}
      >
        <Plus />
      </Button>
    </div>
  );
}

export function FilamentSceneControls() {
  const {
    sceneState,
    selectedFilamentMeta,
    editingPrimaryFilament,
    duplicateSelectedFilament,
    updateSelectedFilamentMeta,
    renameSelectedFilament,
    removeSelectedFilament,
  } = useLabControllerContext();
  if (!sceneState.sceneMode) return null;
  const count = sceneState.sceneFilaments.length + 1;

  return (
    <div className="space-y-3 border-l border-border/70 pl-3">
      <FieldRow label="Identifier">
        <Input
          key={selectedFilamentMeta.id}
          defaultValue={selectedFilamentMeta.id}
          readOnly={editingPrimaryFilament}
          aria-label="Selected filament identifier"
          className="h-8 w-44 font-mono text-xs"
          onBlur={(event) => {
            event.currentTarget.value = renameSelectedFilament(
              event.currentTarget.value,
            );
          }}
        />
      </FieldRow>

      <SwitchField
        label="Enabled"
        hint="Disable this filament without deleting its configuration."
        checked={selectedFilamentMeta.enabled}
        onChange={(enabled) => updateSelectedFilamentMeta({ enabled })}
      />

      <NumberSlider
        label="Time offset"
        value={selectedFilamentMeta.timeOffset}
        min={-20}
        max={20}
        step={0.05}
        suffix="s"
        onChange={(timeOffset) => updateSelectedFilamentMeta({ timeOffset })}
      />
      <NumberSlider
        label="Playback rate"
        value={selectedFilamentMeta.playbackRate}
        min={-3}
        max={3}
        step={0.05}
        suffix="×"
        onChange={(playbackRate) =>
          updateSelectedFilamentMeta({ playbackRate })
        }
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-w-0 flex-1"
          disabled={count >= MAX_LAB_FILAMENTS}
          onClick={duplicateSelectedFilament}
        >
          <Copy />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          title="Delete selected filament"
          aria-label="Delete selected filament"
          disabled={editingPrimaryFilament}
          onClick={removeSelectedFilament}
        >
          <Trash2 />
        </Button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Path, motion, follow, propagation, profiles, material, palette,
        interaction and quality now apply only to this filament.
      </p>
    </div>
  );
}
