"use client";

import { Checkbox } from "@site/components/ui/checkbox";
import { Input } from "@site/components/ui/input";
import { Label } from "@site/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { Textarea } from "@site/components/ui/textarea";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import {
  GLASS_PRESETS,
  type GlassPresetId,
} from "@site/features/lab/model/presets";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function GlassMaskControls() {
  const { state, setState, glassPreset, applyGlassPreset } =
    useLabControllerContext();
  const domTracking =
    state.glassTextEnabled &&
    state.glassShape === "text" &&
    state.glassDomTargetEnabled;

  return (
    <>
      <Select
        value={glassPreset}
        onValueChange={(value) => {
          if (value && value in GLASS_PRESETS) {
            applyGlassPreset(value as GlassPresetId);
          }
        }}
      >
        <SelectTrigger size="sm" aria-label="Glass preset">
          <SelectValue placeholder="Glass preset" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(GLASS_PRESETS).map(([id, preset]) => (
            <SelectItem key={id} value={id}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom settings</SelectItem>
        </SelectContent>
      </Select>
      <Label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={state.glassTextEnabled}
          onCheckedChange={(checked) =>
            setState((previous) => ({
              ...previous,
              glassTextEnabled: checked === true,
            }))
          }
        />
        Refract the rendered scene through the mask
      </Label>
      <Select
        value={state.glassShape ?? "text"}
        onValueChange={(value) => {
          if (value !== "text" && value !== "svg") return;
          setState((previous) => ({
            ...previous,
            glassShape: value,
          }));
        }}
      >
        <SelectTrigger size="sm" aria-label="Glass mask shape">
          <SelectValue placeholder="Glass shape" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="text">Text mask</SelectItem>
          <SelectItem value="svg">SVG path mask</SelectItem>
        </SelectContent>
      </Select>
      {(state.glassShape ?? "text") === "text" ? (
        <>
          <Label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={state.glassDomTargetEnabled}
              disabled={!state.glassTextEnabled}
              onCheckedChange={(checked) =>
                setState((previous) => ({
                  ...previous,
                  glassShape: "text",
                  glassDomTargetEnabled: checked === true,
                }))
              }
            />
            Track the live DOM heading
          </Label>
          {domTracking ? (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2.5">
              <Label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={state.glassDomSyncContent}
                  onCheckedChange={(checked) =>
                    setState((previous) => ({
                      ...previous,
                      glassDomSyncContent: checked === true,
                    }))
                  }
                />
                Sync DOM content
              </Label>
              <Label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={state.glassDomSyncTypography}
                  onCheckedChange={(checked) =>
                    setState((previous) => ({
                      ...previous,
                      glassDomSyncTypography: checked === true,
                    }))
                  }
                />
                Sync DOM typography
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <NumberSlider
                  label="Padding X"
                  value={state.glassDomPaddingX}
                  min={0}
                  max={64}
                  step={1}
                  suffix="px"
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      glassDomPaddingX: value,
                    }))
                  }
                />
                <NumberSlider
                  label="Padding Y"
                  value={state.glassDomPaddingY}
                  min={0}
                  max={64}
                  step={1}
                  suffix="px"
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      glassDomPaddingY: value,
                    }))
                  }
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {(state.glassShape ?? "text") === "text" ? (
        <Textarea
          value={state.glassText}
          rows={3}
          disabled={
            !state.glassTextEnabled ||
            (domTracking && state.glassDomSyncContent)
          }
          aria-label="Glass text"
          onChange={(event) =>
            setState((previous) => ({
              ...previous,
              glassText: event.target.value,
            }))
          }
        />
      ) : (
        <>
          <Input
            type="file"
            accept="image/svg+xml,.svg"
            aria-label="Import glass SVG paths"
            disabled={!state.glassTextEnabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((source) => {
                const document = new DOMParser().parseFromString(
                  source,
                  "image/svg+xml",
                );
                const paths = Array.from(document.querySelectorAll("path[d]"))
                  .map((path) => path.getAttribute("d")?.trim())
                  .filter((path): path is string => Boolean(path));
                if (paths.length === 0) return;
                const viewBox = document
                  .querySelector("svg")
                  ?.getAttribute("viewBox")
                  ?.trim()
                  .split(/[\s,]+/)
                  .map(Number);
                setState((previous) => ({
                  ...previous,
                  glassSvgPath: paths.join(" "),
                  glassSvgViewBox:
                    viewBox?.length === 4 && viewBox.every(Number.isFinite)
                      ? (viewBox as [number, number, number, number])
                      : previous.glassSvgViewBox,
                }));
              });
              event.currentTarget.value = "";
            }}
          />
          <Textarea
            value={state.glassSvgPath}
            rows={5}
            disabled={!state.glassTextEnabled}
            aria-label="Glass SVG path"
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                glassSvgPath: event.target.value,
              }))
            }
          />
          <div className="grid grid-cols-2 gap-2">
            {(["Min X", "Min Y", "Width", "Height"] as const).map(
              (label, index) => (
                <Input
                  key={label}
                  type="number"
                  value={state.glassSvgViewBox[index]}
                  aria-label={`Glass SVG ${label}`}
                  disabled={!state.glassTextEnabled}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    setState((previous) => {
                      const viewBox = [...previous.glassSvgViewBox] as [
                        number,
                        number,
                        number,
                        number,
                      ];
                      viewBox[index] = value;
                      return {
                        ...previous,
                        glassSvgViewBox: viewBox,
                      };
                    });
                  }}
                />
              ),
            )}
          </div>
        </>
      )}
      <NumberSlider
        label="Font size"
        value={state.glassFontSize}
        min={16}
        max={240}
        step={1}
        suffix="px"
        disabled={
          !state.glassTextEnabled ||
          (domTracking && state.glassDomSyncTypography)
        }
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            glassFontSize: value,
          }))
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberSlider
          label="Center X"
          value={state.glassCenterX}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={!state.glassTextEnabled || domTracking}
          onChange={(value) =>
            setState((previous) => ({
              ...previous,
              glassCenterX: value,
            }))
          }
        />
        <NumberSlider
          label="Center Y"
          value={state.glassCenterY}
          min={0}
          max={100}
          step={1}
          suffix="%"
          disabled={!state.glassTextEnabled || domTracking}
          onChange={(value) =>
            setState((previous) => ({
              ...previous,
              glassCenterY: value,
            }))
          }
        />
      </div>
      <NumberSlider
        label="Maximum width"
        value={state.glassMaxWidth}
        min={0.1}
        max={1}
        step={0.01}
        disabled={!state.glassTextEnabled || domTracking}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            glassMaxWidth: value,
          }))
        }
      />
      <NumberSlider
        label="Maximum height"
        value={state.glassMaxHeight}
        min={0.1}
        max={0.9}
        step={0.01}
        disabled={!state.glassTextEnabled || domTracking}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            glassMaxHeight: value,
          }))
        }
      />
    </>
  );
}
