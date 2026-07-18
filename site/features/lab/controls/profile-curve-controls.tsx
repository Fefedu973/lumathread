"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { ToggleGroup, ToggleGroupItem } from "@site/components/ui/toggle-group";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import { LAB_MATERIAL_LAYERS } from "@site/features/lab/model/constants";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function ProfileCurveControls() {
  const { state, setState, addProfileKey, updateProfileKey } =
    useLabControllerContext();

  return (
    <>
      <ToggleGroup
        className="grid w-full grid-cols-2"
        value={[state.profileSource]}
        onValueChange={(selection) => {
          const value = selection[0];
          if (value === "preset" || value === "custom") {
            setState((previous) => ({
              ...previous,
              profileSource: value,
            }));
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
      >
        <ToggleGroupItem value="preset">Preset</ToggleGroupItem>
        <ToggleGroupItem value="custom">Curve</ToggleGroupItem>
      </ToggleGroup>
      <div className="grid grid-cols-2 gap-2">
        <Select
          disabled={state.profileSource === "custom"}
          value={state.profilePreset}
          onValueChange={(value) => {
            if (
              value === "flat" ||
              value === "comet" ||
              value === "center-glow" ||
              value === "segmented"
            ) {
              setState((previous) => ({
                ...previous,
                profilePreset: value,
              }));
            }
          }}
        >
          <SelectTrigger size="sm" aria-label="Profile preset">
            <SelectValue placeholder="Profiles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">flat</SelectItem>
            <SelectItem value="comet">comet</SelectItem>
            <SelectItem value="center-glow">center glow</SelectItem>
            <SelectItem value="segmented">segmented</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={state.materialPreset}
          onValueChange={(value) => {
            if (
              value === "soft-aurora" ||
              value === "mist" ||
              value === "neon" ||
              value === "plasma"
            ) {
              setState((previous) => ({
                ...previous,
                materialPreset: value,
                ...(previous.materialAdvanced
                  ? {
                      materialAtmosphere: LAB_MATERIAL_LAYERS[value].atmosphere,
                      materialBroad: LAB_MATERIAL_LAYERS[value].broad,
                      materialBody: LAB_MATERIAL_LAYERS[value].body,
                      materialRidge: LAB_MATERIAL_LAYERS[value].ridge,
                      materialCore: LAB_MATERIAL_LAYERS[value].core,
                      materialVeil: LAB_MATERIAL_LAYERS[value].veil,
                    }
                  : {}),
              }));
            }
          }}
        >
          <SelectTrigger size="sm" aria-label="Material preset">
            <SelectValue placeholder="Material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soft-aurora">soft aurora</SelectItem>
            <SelectItem value="mist">mist</SelectItem>
            <SelectItem value="neon">neon</SelectItem>
            <SelectItem value="plasma">plasma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.profileSource === "preset" && state.profilePreset !== "flat" ? (
        <NumberSlider
          label="Preset shape strength"
          value={state.profileStrength}
          min={0.2}
          max={2}
          step={0.02}
          onChange={(value) =>
            setState((previous) => ({
              ...previous,
              profileStrength: value,
            }))
          }
        />
      ) : null}
      {state.profileSource === "custom" ? (
        <div className="space-y-3 border-l border-border/70 pl-3">
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={state.profileInterpolation}
              onValueChange={(value) => {
                if (
                  value === "linear" ||
                  value === "smooth" ||
                  value === "cubic"
                ) {
                  setState((previous) => ({
                    ...previous,
                    profileInterpolation: value,
                  }));
                }
              }}
            >
              <SelectTrigger size="sm" aria-label="Profile interpolation">
                <SelectValue placeholder="Interpolation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">linear</SelectItem>
                <SelectItem value="smooth">smooth</SelectItem>
                <SelectItem value="cubic">cubic</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={state.profileWrap}
              onValueChange={(value) => {
                if (
                  value === "clamp" ||
                  value === "repeat" ||
                  value === "mirror"
                ) {
                  setState((previous) => ({
                    ...previous,
                    profileWrap: value,
                  }));
                }
              }}
            >
              <SelectTrigger size="sm" aria-label="Profile wrap">
                <SelectValue placeholder="Wrap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clamp">clamp</SelectItem>
                <SelectItem value="repeat">repeat</SelectItem>
                <SelectItem value="mirror">mirror</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              Profile keys {state.profileKeys.length}/12
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              title="Add profile key"
              aria-label="Add profile key"
              disabled={state.profileKeys.length >= 12}
              onClick={addProfileKey}
            >
              <Plus />
            </Button>
          </div>
          {[...state.profileKeys]
            .sort((left, right) => left.position - right.position)
            .map((key, index) => (
              <div
                key={key.id}
                className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs">Key {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={`Remove profile key ${index + 1}`}
                    aria-label={`Remove profile key ${index + 1}`}
                    disabled={state.profileKeys.length <= 2}
                    onClick={() =>
                      setState((previous) => ({
                        ...previous,
                        profileKeys: previous.profileKeys.filter(
                          (candidate) => candidate.id !== key.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <NumberSlider
                  label="Position"
                  value={key.position}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, { position: value })
                  }
                />
                <NumberSlider
                  label="Width"
                  value={key.width}
                  min={0.01}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, { width: value })
                  }
                />
                <NumberSlider
                  label="Opacity"
                  value={key.opacity}
                  min={0}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, { opacity: value })
                  }
                />
                <NumberSlider
                  label="Intensity"
                  value={key.intensity}
                  min={0}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, { intensity: value })
                  }
                />
                <NumberSlider
                  label="Glow"
                  value={key.glow}
                  min={0.01}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, { glow: value })
                  }
                />
                <NumberSlider
                  label="Upper glow spread"
                  value={key.upperGlowSpread ?? 1}
                  min={0.05}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, {
                      upperGlowSpread: value,
                    })
                  }
                />
                <NumberSlider
                  label="Lower glow spread"
                  value={key.lowerGlowSpread ?? 1}
                  min={0.05}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, {
                      lowerGlowSpread: value,
                    })
                  }
                />
                <NumberSlider
                  label="Reflection"
                  value={key.reflection}
                  min={0}
                  max={4}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, {
                      reflection: value,
                    })
                  }
                />
                <NumberSlider
                  label="Color offset"
                  value={key.colorPosition}
                  min={-2}
                  max={2}
                  step={0.01}
                  onChange={(value) =>
                    updateProfileKey(key.id, {
                      colorPosition: value,
                    })
                  }
                />
              </div>
            ))}
        </div>
      ) : null}
    </>
  );
}
