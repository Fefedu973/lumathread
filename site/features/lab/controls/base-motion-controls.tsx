"use client";

import { MoveRight, Orbit, Waves } from "lucide-react";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  Segmented,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

const MODE_DETAIL = {
  travel: "segment travels the path",
  propagate: "wave crosses a static path",
  anchored: "path and segment held still",
} as const;

export function BaseMotionControls() {
  const { state, setState, panelSection } = useLabControllerContext();

  const motion = (
    key: keyof typeof state.motion,
    label: string,
    min: number,
    max: number,
    step: number,
    disabled?: boolean,
  ) => (
    <NumberSlider
      label={label}
      value={state.motion[key] as number}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(value) =>
        setState((previous) => ({
          ...previous,
          motion: { ...previous.motion, [key]: value },
        }))
      }
    />
  );

  return (
    <section className={panelSection === "motion" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="envelope, taper and deformers">
        Motion
      </SectionHeading>

      <ControlGroup title="Envelope" detail={MODE_DETAIL[state.motion.mode]}>
        <FieldRow label="Mode">
          <Segmented
            ariaLabel="Motion mode"
            value={state.motion.mode}
            options={[
              {
                value: "travel",
                label: (
                  <>
                    <MoveRight className="size-3" aria-hidden /> Travel
                  </>
                ),
              },
              {
                value: "propagate",
                label: (
                  <>
                    <Waves className="size-3" aria-hidden /> Propagate
                  </>
                ),
              },
              {
                value: "anchored",
                label: (
                  <>
                    <Orbit className="size-3" aria-hidden /> Anchored
                  </>
                ),
              },
            ]}
            onChange={(mode) =>
              setState((previous) => ({
                ...previous,
                motion: { ...previous.motion, mode },
                propagationEnabled:
                  mode === "propagate" ? true : previous.propagationEnabled,
              }))
            }
          />
        </FieldRow>
        {motion("speed", "Motion speed", -2, 2, 0.05)}
        {motion("curveTravel", "Envelope travel", -0.3, 0.3, 0.005)}
        {motion(
          "pathDrift",
          "Travel path drift",
          0,
          1,
          0.01,
          state.motion.mode !== "travel",
        )}
        {motion(
          "curveMotion",
          "Shape morph",
          0,
          1.5,
          0.01,
          state.motion.mode === "anchored",
        )}
      </ControlGroup>

      <ControlGroup title="Filament" detail="visible segment">
        {motion("segmentLength", "Length", 0.1, 1.5, 0.01)}
        {motion("tailTaper", "Tail taper", 0.01, 0.6, 0.01)}
        {motion("headTaper", "Head taper", 0.01, 0.6, 0.01)}
      </ControlGroup>
    </section>
  );
}
