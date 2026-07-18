"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SelectField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function GlassIntroControls() {
  const { state, setState, setRenderEpoch, updateGlassIntroCurve } =
    useLabControllerContext();
  const disabled = !state.glassTextEnabled;

  return (
    <>
      <FieldRow label="Replay">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          title="Replay glass entrance"
          aria-label="Replay glass entrance"
          disabled={disabled}
          onClick={() => setRenderEpoch((value) => value + 1)}
        >
          <RefreshCw />
        </Button>
      </FieldRow>
      <NumberSlider
        label="Delay"
        value={state.glassIntroDelay}
        min={0}
        max={3000}
        step={25}
        suffix="ms"
        disabled={disabled}
        onChange={(glassIntroDelay) =>
          setState((previous) => ({ ...previous, glassIntroDelay }))
        }
      />
      <NumberSlider
        label="Duration"
        value={state.glassIntroDuration}
        min={0}
        max={3000}
        step={25}
        suffix="ms"
        disabled={disabled}
        onChange={(glassIntroDuration) =>
          setState((previous) => ({ ...previous, glassIntroDuration }))
        }
      />
      <NumberSlider
        label="Initial blur"
        value={state.glassIntroBlur}
        min={0}
        max={64}
        step={1}
        suffix="px"
        disabled={disabled}
        onChange={(glassIntroBlur) =>
          setState((previous) => ({ ...previous, glassIntroBlur }))
        }
      />
      <NumberSlider
        label="Initial offset Y"
        value={state.glassIntroOffsetY}
        min={-128}
        max={128}
        step={1}
        suffix="px"
        disabled={disabled}
        onChange={(glassIntroOffsetY) =>
          setState((previous) => ({ ...previous, glassIntroOffsetY }))
        }
      />
      <FieldRow label="Easing">
        <SelectField
          ariaLabel="Glass entrance easing"
          className="w-40"
          value={state.glassIntroCurvePreset}
          options={[
            { value: "linear", label: "Linear" },
            { value: "ease", label: "Ease" },
            { value: "ease-in", label: "Ease in" },
            { value: "ease-out", label: "Ease out" },
            { value: "ease-in-out", label: "Ease in out" },
            { value: "custom", label: "Custom cubic" },
          ]}
          onChange={(glassIntroCurvePreset) =>
            setState((previous) => ({
              ...previous,
              glassIntroCurvePreset,
            }))
          }
        />
      </FieldRow>
      {state.glassIntroCurvePreset === "custom" ? (
        <ControlGroup title="Cubic bezier" muted>
          {(
            [
              ["X1", 0, 0, 1],
              ["Y1", 1, -1, 2],
              ["X2", 2, 0, 1],
              ["Y2", 3, -1, 2],
            ] as const
          ).map(([label, index, min, max]) => (
            <NumberSlider
              key={label}
              label={label}
              value={state.glassIntroCurve[index]}
              min={min}
              max={max}
              step={0.01}
              disabled={disabled}
              onChange={(value) => updateGlassIntroCurve(index, value)}
            />
          ))}
        </ControlGroup>
      ) : null}
    </>
  );
}
