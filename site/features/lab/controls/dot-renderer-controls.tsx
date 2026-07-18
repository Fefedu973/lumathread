"use client";

import { Input } from "@site/components/ui/input";
import { Label } from "@site/components/ui/label";
import { Separator } from "@site/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function DotRendererControls() {
  const { state, setState, automaticTerrainColumns } =
    useLabControllerContext();

  return (
    <>
      <Separator />
      {state.dotMode === "terrain" ? (
        <div className="space-y-2.5 border-l border-border/70 pl-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberSlider
              label={
                state.terrainFit === "cover" ? "Columns (automatic)" : "Columns"
              }
              value={
                state.terrainFit === "cover"
                  ? automaticTerrainColumns
                  : state.terrainColumns
              }
              min={16}
              max={320}
              step={1}
              disabled={!state.dotsEnabled || state.terrainFit === "cover"}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  terrainColumns: value,
                }))
              }
            />
            <NumberSlider
              label="Rows"
              value={state.terrainRows}
              min={12}
              max={180}
              step={1}
              disabled={!state.dotsEnabled}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  terrainRows: value,
                }))
              }
            />
          </div>
          <NumberSlider
            label="Terrain width"
            value={state.terrainWidth}
            min={2}
            max={16}
            step={0.1}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainWidth: value,
              }))
            }
          />
          <NumberSlider
            label="Terrain depth"
            value={state.terrainDepth}
            min={1}
            max={14}
            step={0.1}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainDepth: value,
              }))
            }
          />
          <NumberSlider
            label="Wave amplitude"
            value={state.terrainAmplitude}
            min={0}
            max={1.5}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainAmplitude: value,
              }))
            }
          />
          <NumberSlider
            label="Wave frequency"
            value={state.terrainFrequency}
            min={0.1}
            max={5}
            step={0.05}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainFrequency: value,
              }))
            }
          />
          <NumberSlider
            label="Wave speed"
            value={state.terrainSpeed}
            min={-2}
            max={2}
            step={0.02}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainSpeed: value,
              }))
            }
          />
          <NumberSlider
            label="View angle"
            value={state.terrainViewAngle}
            min={12}
            max={82}
            step={1}
            suffix="°"
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainViewAngle: value,
              }))
            }
          />
          <NumberSlider
            label="Camera distance"
            value={state.terrainCameraDistance}
            min={1}
            max={12}
            step={0.05}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainCameraDistance: value,
              }))
            }
          />
          <Select
            value={state.terrainFit ?? "fixed"}
            onValueChange={(value) => {
              if (value !== "fixed" && value !== "cover") return;
              setState((previous) => ({
                ...previous,
                terrainFit: value,
              }));
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label="Terrain framing"
              disabled={!state.dotsEnabled}
            >
              <SelectValue placeholder="Terrain framing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed width</SelectItem>
              <SelectItem value="cover">
                Cover viewport (auto density)
              </SelectItem>
            </SelectContent>
          </Select>
          <NumberSlider
            label="Point size"
            value={state.terrainPointSize}
            min={0.5}
            max={6}
            step={0.05}
            suffix="px"
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainPointSize: value,
              }))
            }
          />
          <NumberSlider
            label="Terrain opacity"
            value={state.terrainOpacity}
            min={0}
            max={1}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainOpacity: value,
              }))
            }
          />
          <NumberSlider
            label="Twinkle"
            value={state.twinkle}
            min={0}
            max={1}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                twinkle: value,
              }))
            }
          />
          <NumberSlider
            label="Surface reflection"
            value={state.reflect}
            min={0}
            max={2}
            step={0.02}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                reflect: value,
              }))
            }
          />
          <NumberSlider
            label="Geometry edge fade"
            value={state.terrainEdgeFade}
            min={0}
            max={0.35}
            step={0.005}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainEdgeFade: value,
              }))
            }
          />
          <NumberSlider
            label="Content clearance"
            value={state.terrainContentFade}
            min={0}
            max={1}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                terrainContentFade: value,
              }))
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Label className="space-y-1 text-xs">
              Low color
              <Input
                type="color"
                value={state.terrainColorLow}
                disabled={!state.dotsEnabled}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    terrainColorLow: event.target.value,
                  }))
                }
              />
            </Label>
            <Label className="space-y-1 text-xs">
              High color
              <Input
                type="color"
                value={state.terrainColorHigh}
                disabled={!state.dotsEnabled}
                onChange={(event) =>
                  setState((previous) => ({
                    ...previous,
                    terrainColorHigh: event.target.value,
                  }))
                }
              />
            </Label>
          </div>
        </div>
      ) : (
        <>
          <NumberSlider
            label="Dot spacing"
            value={state.dotSpacing}
            min={8}
            max={64}
            step={1}
            suffix="px"
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                dotSpacing: value,
              }))
            }
          />
          <NumberSlider
            label="Dot opacity"
            value={state.dotOpacity}
            min={0}
            max={1}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                dotOpacity: value,
              }))
            }
          />
          <NumberSlider
            label="Twinkle"
            value={state.twinkle}
            min={0}
            max={1}
            step={0.01}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                twinkle: value,
              }))
            }
          />
          <NumberSlider
            label="Reflection"
            value={state.reflect}
            min={0}
            max={2}
            step={0.02}
            disabled={!state.dotsEnabled}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                reflect: value,
              }))
            }
          />
        </>
      )}
    </>
  );
}
