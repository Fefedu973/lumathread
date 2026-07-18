"use client";

import { Plus, Trash2 } from "lucide-react";
import { MAX_HERO_DOT_MASKS } from "@/hero-wave-background";
import { Button } from "@site/components/ui/button";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function DotMaskControls() {
  const { state, setState, addMask } = useLabControllerContext();

  return (
    <>
      <NumberSlider
        label="Mask feather"
        value={state.maskFeather}
        min={0.02}
        max={1}
        step={0.01}
        disabled={!state.dotsEnabled}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            maskFeather: value,
          }))
        }
      />

      <div className="flex items-center justify-between">
        <span className="text-xs">
          Masks {state.dotMasks.length}/{MAX_HERO_DOT_MASKS}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          title="Add dot mask"
          aria-label="Add dot mask"
          disabled={state.dotMasks.length >= MAX_HERO_DOT_MASKS}
          onClick={addMask}
        >
          <Plus />
        </Button>
      </div>
      {state.dotMasks.map((mask, index) => (
        <div key={mask.id} className="space-y-2 rounded-lg border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">Mask {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={`Remove mask ${index + 1}`}
              aria-label={`Remove mask ${index + 1}`}
              onClick={() =>
                setState((previous) => ({
                  ...previous,
                  dotMasks: previous.dotMasks.filter(
                    (_candidate, candidateIndex) => candidateIndex !== index,
                  ),
                }))
              }
            >
              <Trash2 />
            </Button>
          </div>
          {(["x", "y", "radius", "feather"] as const).map((key) => (
            <NumberSlider
              key={key}
              label={
                key === "radius"
                  ? "Radius"
                  : key === "feather"
                    ? "Feather"
                    : key.toUpperCase()
              }
              value={mask[key] ?? state.maskFeather}
              min={key === "radius" ? 0.05 : key === "feather" ? 0.001 : 0}
              max={key === "radius" ? 1.5 : 1}
              step={0.01}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  dotMasks: previous.dotMasks.map(
                    (candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, [key]: value }
                        : candidate,
                  ),
                }))
              }
            />
          ))}
        </div>
      ))}
    </>
  );
}
