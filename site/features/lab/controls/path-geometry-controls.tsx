"use client";

import { Plus, Trash2 } from "lucide-react";
import { MIN_HERO_TRAJECTORY_POINTS } from "@/hero-wave-background";
import { Button } from "@site/components/ui/button";
import { ControlGroup, NumberSlider, SwitchField } from "./common-controls";
import { useLabControllerContext } from "../lab-controller-context";

export function PathGeometryControls() {
  const {
    state,
    setState,
    showPathEditor,
    selectedPoint,
    addPoint,
    removePoint,
  } = useLabControllerContext();

  const shape = (
    key: keyof typeof state.shape,
    label: string,
    min: number,
    max: number,
    step: number,
    disabled?: boolean,
  ) => (
    <NumberSlider
      label={label}
      value={state.shape[key]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(value) =>
        setState((previous) => ({
          ...previous,
          shape: { ...previous.shape, [key]: value },
        }))
      }
    />
  );

  const transform = (
    key: keyof typeof state.transform,
    label: string,
    min: number,
    max: number,
    step: number,
    suffix?: string,
  ) => (
    <NumberSlider
      label={label}
      value={state.transform[key]}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      onChange={(value) =>
        setState((previous) => ({
          ...previous,
          transform: { ...previous.transform, [key]: value },
        }))
      }
    />
  );

  return (
    <>
      <ControlGroup title="Shape" detail="band placement">
        {shape("waveY", "Band Y", 0.05, 0.95, 0.01)}
        {shape("strength", "Snake curve", 0, 1.5, 0.01)}
        {shape("scale", "Vertical scale", 0.05, 1.6, 0.01)}
        {shape(
          "frequency",
          "Sine frequency",
          0.2,
          6,
          0.05,
          state.pathMode !== "sine",
        )}
      </ControlGroup>

      <ControlGroup
        title="Transform"
        detail="place the path"
        collapsible
        defaultOpen={false}
      >
        {transform("rotation", "Rotation", -45, 45, 1, "°")}
        {transform("x", "Offset X", -0.5, 0.5, 0.01)}
        {transform("y", "Offset Y", -0.5, 0.5, 0.01)}
        {transform("scaleX", "Scale X", 0.1, 2, 0.01)}
        {transform("scaleY", "Scale Y", 0.1, 2, 0.01)}
        {transform("anchorX", "Anchor X", 0, 1, 0.01)}
        {transform("anchorY", "Anchor Y", 0, 1, 0.01)}
      </ControlGroup>

      <ControlGroup title="Geometry" detail="endpoints">
        <SwitchField
          label="Closed path"
          checked={state.closed}
          disabled={
            state.textMode ||
            state.pathMode === "sine" ||
            state.pathMode === "follow"
          }
          onChange={(closed) =>
            setState((previous) => ({ ...previous, closed }))
          }
        />
        <SwitchField
          label="Loop taper"
          hint="Keep head and tail tapering on closed loops."
          checked={state.closedLoopTaper}
          disabled={!state.closed}
          onChange={(closedLoopTaper) =>
            setState((previous) => ({ ...previous, closedLoopTaper }))
          }
        />
      </ControlGroup>

      {showPathEditor && state.pathMode === "custom" && !state.textMode ? (
        <ControlGroup
          title="Selected point"
          detail={`${selectedPoint + 1} / ${state.pathPoints.length}`}
          muted
          action={
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                title="Add point"
                aria-label="Add point"
                onClick={addPoint}
              >
                <Plus />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                title="Remove point"
                aria-label="Remove point"
                disabled={state.pathPoints.length <= MIN_HERO_TRAJECTORY_POINTS}
                onClick={removePoint}
              >
                <Trash2 />
              </Button>
            </div>
          }
        >
          <NumberSlider
            label="Local speed"
            value={state.pathPoints[selectedPoint]?.speed ?? 1}
            min={0.05}
            max={4}
            step={0.05}
            suffix="×"
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                pathPoints: previous.pathPoints.map((point, index) =>
                  index === selectedPoint ? { ...point, speed: value } : point,
                ),
              }))
            }
          />
          {state.interpolation === "bezier"
            ? (
                [
                  ["Incoming X", "inX"],
                  ["Incoming Y", "inY"],
                  ["Outgoing X", "outX"],
                  ["Outgoing Y", "outY"],
                ] as const
              ).map(([label, key]) => (
                <NumberSlider
                  key={key}
                  label={label}
                  value={state.pathPoints[selectedPoint]?.[key] ?? 0}
                  min={-1}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      pathPoints: previous.pathPoints.map((point, index) =>
                        index === selectedPoint
                          ? { ...point, [key]: value }
                          : point,
                      ),
                    }))
                  }
                />
              ))
            : null}
        </ControlGroup>
      ) : null}
    </>
  );
}
