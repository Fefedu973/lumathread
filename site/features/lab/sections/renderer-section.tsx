"use client";

import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  Segmented,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { QUALITY_CONTROLS } from "@site/features/lab/model/constants";
import type { LabQualityConfig } from "@site/features/lab/model/types";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

type QualityKey = Exclude<keyof LabQualityConfig, "quadrature">;

const QUALITY_META = Object.fromEntries(
  QUALITY_CONTROLS.map((control) => [control.key, control]),
) as Record<QualityKey, (typeof QUALITY_CONTROLS)[number]>;

/** Each render pass is tuned as a unit, so the controls read better per pass. */
const PASS_GROUPS: readonly {
  title: string;
  detail: string;
  keys: readonly QualityKey[];
}[] = [
  {
    title: "Far pass",
    detail: "atmosphere",
    keys: ["farScale", "farMaxDimension", "farMaxChordPx", "farFlatnessPx"],
  },
  {
    title: "Mid pass",
    detail: "body",
    keys: ["midScale", "midMaxDimension", "midMaxChordPx", "midFlatnessPx"],
  },
  {
    title: "Core pass",
    detail: "ridge & core",
    keys: ["coreScale", "coreMaxDimension", "coreMaxChordPx", "coreFlatnessPx"],
  },
];

export function RendererSection() {
  const { state, setState, panelSection, markCustom } =
    useLabControllerContext();

  const qualitySlider = (key: QualityKey) => {
    const meta = QUALITY_META[key];
    return (
      <NumberSlider
        key={key}
        label={meta.label}
        value={state.qualityConfig[key]}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            qualityConfig: { ...previous.qualityConfig, [key]: value },
          }))
        }
      />
    );
  };

  return (
    <section className={panelSection === "renderer" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="HDR renderer + adaptive quality">
        Renderer & quality
      </SectionHeading>

      <ControlGroup title="Output">
        <FieldRow label="Theme">
          <Segmented
            ariaLabel="Theme"
            value={state.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(theme) => {
              setState((previous) => ({ ...previous, theme }));
              markCustom();
            }}
          />
        </FieldRow>
        <FieldRow label="Quality preset">
          <SelectField
            ariaLabel="Quality"
            className="w-36"
            value={state.quality}
            options={[
              { value: "auto", label: "Auto (device)" },
              { value: "ultra", label: "Ultra" },
              { value: "high", label: "High" },
              { value: "balanced", label: "Balanced" },
              { value: "low", label: "Low" },
            ]}
            onChange={(quality) => {
              setState((previous) => ({ ...previous, quality }));
              markCustom();
            }}
          />
        </FieldRow>
      </ControlGroup>

      <ControlGroup
        title="Adaptive quality"
        detail={state.qualityAdvanced ? "overriding preset" : "preset values"}
      >
        <SwitchField
          label="Override preset values"
          hint="Tune the sampler and every render pass by hand."
          checked={state.qualityAdvanced}
          onChange={(qualityAdvanced) =>
            setState((previous) => ({ ...previous, qualityAdvanced }))
          }
        />

        {state.qualityAdvanced ? (
          <>
            <ControlGroup title="Frame budget" muted>
              {qualitySlider("maxDpr")}
              {qualitySlider("maxFps")}
            </ControlGroup>

            <ControlGroup title="Base sampling" muted collapsible>
              {qualitySlider("flatnessPx")}
              {qualitySlider("maxChordPx")}
              {qualitySlider("maxSamples")}
              {qualitySlider("maxSubdivisionDepth")}
              <FieldRow label="Quadrature">
                <Segmented
                  ariaLabel="Quadrature"
                  value={String(state.qualityConfig.quadrature) as "2" | "4"}
                  options={[
                    { value: "2", label: "2 taps" },
                    { value: "4", label: "4 taps" },
                  ]}
                  onChange={(value) =>
                    setState((previous) => ({
                      ...previous,
                      qualityConfig: {
                        ...previous.qualityConfig,
                        quadrature: Number(value) as 2 | 4,
                      },
                    }))
                  }
                />
              </FieldRow>
            </ControlGroup>

            {PASS_GROUPS.map((group) => (
              <ControlGroup
                key={group.title}
                title={group.title}
                detail={group.detail}
                muted
                collapsible
                defaultOpen={false}
              >
                {group.keys.map((key) => qualitySlider(key))}
              </ControlGroup>
            ))}
          </>
        ) : null}
      </ControlGroup>
    </section>
  );
}
