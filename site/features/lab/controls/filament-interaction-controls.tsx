"use client";

import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function FilamentInteractionControls() {
  const { state, setState, panelSection } = useLabControllerContext();
  const off = !state.filamentInteractionEnabled;

  const set = <Key extends keyof typeof state>(
    key: Key,
    value: (typeof state)[Key],
  ) => setState((previous) => ({ ...previous, [key]: value }));

  const slider = (
    key: keyof typeof state,
    label: string,
    min: number,
    max: number,
    step: number,
    suffix?: string,
  ) => (
    <NumberSlider
      label={label}
      value={state[key] as number}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      disabled={off}
      onChange={(value) => set(key, value as (typeof state)[typeof key])}
    />
  );

  return (
    <section className={panelSection === "motion" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="pointer-triggered travelling deformation">
        Pointer ripples
      </SectionHeading>

      <ControlGroup title="Trigger" detail={off ? "disabled" : "active"}>
        <SwitchField
          label="Enable pointer ripples"
          checked={state.filamentInteractionEnabled}
          onChange={(checked) => set("filamentInteractionEnabled", checked)}
        />
        <FieldRow label="Pointer area">
          <SelectField
            ariaLabel="Pointer target"
            className="w-32"
            value={state.filamentInteractionTarget}
            disabled={off}
            options={[
              { value: "canvas", label: "Canvas" },
              { value: "viewport", label: "Viewport" },
            ]}
            onChange={(value) => set("filamentInteractionTarget", value)}
          />
        </FieldRow>
        <FieldRow label="Direction">
          <SelectField
            ariaLabel="Impulse direction"
            className="w-32"
            value={state.filamentInteractionDirection}
            disabled={off}
            options={[
              { value: "push", label: "Push away" },
              { value: "pull", label: "Pull inward" },
              { value: "alternate", label: "Alternate" },
            ]}
            onChange={(value) => set("filamentInteractionDirection", value)}
          />
        </FieldRow>
        {(
          [
            ["Mouse", "filamentInteractionMouse"],
            ["Pen", "filamentInteractionPen"],
            ["Touch", "filamentInteractionTouch"],
          ] as const
        ).map(([label, key]) => (
          <SwitchField
            key={key}
            label={label}
            checked={state[key]}
            disabled={off}
            onChange={(checked) => set(key, checked)}
          />
        ))}
        {slider("filamentInteractionRadius", "Trigger radius", 4, 320, 2, "px")}
        {slider(
          "filamentInteractionCooldown",
          "Retrigger cooldown",
          0,
          1,
          0.01,
          "s",
        )}
      </ControlGroup>

      <ControlGroup title="Wave" detail="impulse shape" muted disabled={off}>
        {slider("filamentInteractionStrength", "Strength", 0, 0.25, 0.0025)}
        {slider(
          "filamentInteractionPropagationSpeed",
          "Propagation speed",
          0.05,
          4,
          0.01,
        )}
        {slider(
          "filamentInteractionFrequency",
          "Frequency",
          0.05,
          16,
          0.05,
          "Hz",
        )}
      </ControlGroup>

      <ControlGroup
        title="Decay"
        detail="how impulses die out"
        muted
        collapsible
        defaultOpen={false}
        disabled={off}
      >
        {slider("filamentInteractionDamping", "Temporal damping", 0, 10, 0.05)}
        {slider(
          "filamentInteractionSpatialDecay",
          "Spatial decay",
          0,
          10,
          0.05,
        )}
        {slider("filamentInteractionDuration", "Lifetime", 0.1, 8, 0.05, "s")}
        {slider(
          "filamentInteractionMaxImpulses",
          "Concurrent impulses",
          1,
          24,
          1,
        )}
      </ControlGroup>
    </section>
  );
}
