"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function PaletteSection() {
  const { state, setState, panelSection, addPaletteStop } =
    useLabControllerContext();

  const updateStop = (
    index: number,
    changes: Partial<(typeof state.paletteStops)[number]>,
  ) =>
    setState((previous) => ({
      ...previous,
      paletteStops: previous.paletteStops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, ...changes } : stop,
      ),
    }));

  const offsetOf = (index: number) =>
    state.paletteStops[index]?.offset ??
    index / Math.max(state.paletteStops.length - 1, 1);

  return (
    <section className={panelSection === "palette" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="gradient, blending and drift">
        Palette
      </SectionHeading>

      <ControlGroup
        title="Gradient"
        detail={`${state.paletteStops.length} stops`}
        action={
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            title="Add color stop"
            aria-label="Add color stop"
            onClick={addPaletteStop}
          >
            <Plus />
          </Button>
        }
      >
        <div
          aria-hidden
          className="h-6 rounded-md border border-border/70"
          style={{
            backgroundImage: `linear-gradient(to right, ${state.paletteStops
              .map((stop, index) => `${stop.color} ${offsetOf(index) * 100}%`)
              .join(", ")})`,
          }}
        />

        {state.paletteStops.map((stop, index) => (
          <div
            key={stop.id}
            className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5"
          >
            <div className="flex items-center gap-2">
              <label
                className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm"
                style={{ backgroundColor: stop.color }}
                aria-label={`Color stop ${index + 1}`}
              >
                <input
                  type="color"
                  value={stop.color}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  onChange={(event) =>
                    updateStop(index, { color: event.target.value })
                  }
                />
              </label>
              <SelectField
                ariaLabel={`Easing ${index + 1}`}
                className="min-w-0 flex-1"
                value={stop.easing ?? "linear"}
                options={[
                  { value: "linear", label: "Linear" },
                  { value: "smooth", label: "Smooth" },
                  { value: "hold", label: "Hold" },
                ]}
                onChange={(easing) => updateStop(index, { easing })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={state.paletteStops.length <= 1}
                title={`Remove color stop ${index + 1}`}
                aria-label={`Remove color stop ${index + 1}`}
                onClick={() =>
                  setState((previous) => ({
                    ...previous,
                    paletteStops: previous.paletteStops.filter(
                      (_candidate, candidateIndex) => candidateIndex !== index,
                    ),
                  }))
                }
              >
                <Trash2 />
              </Button>
            </div>
            <NumberSlider
              label="Offset"
              value={offsetOf(index)}
              min={0}
              max={1}
              step={0.01}
              onChange={(offset) => updateStop(index, { offset })}
            />
          </div>
        ))}
      </ControlGroup>

      <ControlGroup title="Blending" detail="colour space">
        <FieldRow label="Interpolation">
          <SelectField
            ariaLabel="Palette interpolation"
            className="w-32"
            value={state.paletteInterpolation}
            options={[
              { value: "srgb", label: "sRGB" },
              { value: "linear-rgb", label: "Linear RGB" },
              { value: "oklab", label: "OKLab" },
            ]}
            onChange={(paletteInterpolation) =>
              setState((previous) => ({ ...previous, paletteInterpolation }))
            }
          />
        </FieldRow>
        <FieldRow label="Wrap">
          <SelectField
            ariaLabel="Palette wrap"
            className="w-32"
            value={state.paletteWrap}
            options={[
              { value: "clamp", label: "Clamp" },
              { value: "repeat", label: "Repeat" },
              { value: "mirror", label: "Mirror" },
            ]}
            onChange={(paletteWrap) =>
              setState((previous) => ({ ...previous, paletteWrap }))
            }
          />
        </FieldRow>
        <SwitchField
          label="Reverse coordinate"
          checked={state.paletteReverse}
          onChange={(paletteReverse) =>
            setState((previous) => ({ ...previous, paletteReverse }))
          }
        />
      </ControlGroup>

      <ControlGroup title="Animation" detail="flow and hue">
        <NumberSlider
          label="Palette flow"
          value={state.paletteSpeed}
          min={-3}
          max={3}
          step={0.05}
          onChange={(paletteSpeed) =>
            setState((previous) => ({ ...previous, paletteSpeed }))
          }
        />
        <NumberSlider
          label="Hue shift"
          value={state.hue}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(hue) => setState((previous) => ({ ...previous, hue }))}
        />
        <NumberSlider
          label="Hue drift"
          value={state.hueDrift}
          min={-40}
          max={40}
          step={0.5}
          suffix="°/s"
          onChange={(hueDrift) =>
            setState((previous) => ({ ...previous, hueDrift }))
          }
        />
      </ControlGroup>
    </section>
  );
}
