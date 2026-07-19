"use client";

import { RefreshCw, Type as TypeIcon } from "lucide-react";
import type { HeroWavePathMode } from "@/hero-wave-background";
import { FollowControls } from "../controls/follow-controls";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  Segmented,
  SelectField,
} from "../controls/common-controls";
import { PathGeometryControls } from "../controls/path-geometry-controls";
import { PathInterpolationControls } from "../controls/path-interpolation-controls";
import { PathPresetControls } from "../controls/path-preset-controls";
import { PathSourceParameters } from "../controls/path-source-parameters";
import { useLabControllerContext } from "../lab-controller-context";

type PathSourceValue = HeroWavePathMode | "text" | "auto";

const SOURCE_DETAIL: Record<PathSourceValue, string> = {
  sine: "analytic wave",
  organic: "seeded generator",
  custom: "editable points",
  svg: "imported path",
  follow: "pointer trail",
  text: "letters as filaments",
  auto: "regenerates each cycle",
};

export function PathSection() {
  const {
    state,
    setState,
    panelSection,
    setShowPathEditor,
    autoRandomPath,
    setAutoRandomPath,
    setAutoCycle,
    markCustom,
    startAutoPath,
    startTextMode,
    editingPrimaryFilament,
  } = useLabControllerContext();

  const source: PathSourceValue =
    editingPrimaryFilament && autoRandomPath
      ? "auto"
      : editingPrimaryFilament && state.textMode
        ? "text"
        : state.pathMode;

  const selectSource = (mode: PathSourceValue) => {
    if (mode === "auto") {
      if (editingPrimaryFilament) startAutoPath();
      return;
    }
    if (mode === "text") {
      if (editingPrimaryFilament) startTextMode();
      return;
    }
    setAutoRandomPath(false);
    setAutoCycle(0);
    setState((previous) => ({
      ...previous,
      textMode: false,
      pathMode: mode,
      followActivation:
        mode === "follow" ? "path-mode" : previous.followActivation,
      closed: mode === "svg" ? true : previous.closed,
    }));
    setShowPathEditor(mode === "custom");
    markCustom();
  };

  const followVisible =
    state.pathMode === "follow" || state.followActivation !== "path-mode";

  return (
    <section className={panelSection === "path" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="source → interpolation → transform">
        Path
      </SectionHeading>

      <ControlGroup title="Source" detail={SOURCE_DETAIL[source]}>
        <Segmented
          ariaLabel="Path source"
          value={source}
          columns={4}
          options={[
            { value: "sine", label: "Sine" },
            { value: "organic", label: "Organic" },
            { value: "custom", label: "Custom" },
            { value: "svg", label: "SVG" },
            { value: "follow", label: "Follow" },
            ...(editingPrimaryFilament
              ? [
                  {
                    value: "text" as const,
                    label: (
                      <>
                        <TypeIcon className="size-3" aria-hidden /> Text
                      </>
                    ),
                  },
                  {
                    value: "auto" as const,
                    label: (
                      <>
                        <RefreshCw className="size-3" aria-hidden /> Auto
                      </>
                    ),
                  },
                ]
              : []),
          ]}
          onChange={selectSource}
        />

        <PathPresetControls />
        <PathInterpolationControls />
        {state.pathMode === "custom" &&
        !state.textMode &&
        state.interpolation !== "linear" ? (
          <NumberSlider
            label="Path tension"
            value={state.pathTension}
            min={-1}
            max={1}
            step={0.01}
            onChange={(pathTension) =>
              setState((previous) => ({ ...previous, pathTension }))
            }
          />
        ) : null}
        <PathSourceParameters />
      </ControlGroup>

      <ControlGroup title="Follow" detail="pointer takeover">
        <FieldRow label="Activation">
          <SelectField
            ariaLabel="Follow activation"
            className="w-44"
            value={state.followActivation}
            disabled={state.pathMode === "follow"}
            options={[
              { value: "path-mode", label: "Only as path mode" },
              { value: "canvas", label: "While inside canvas" },
              { value: "viewport", label: "While inside viewport" },
            ]}
            onChange={(followActivation) =>
              setState((previous) => ({ ...previous, followActivation }))
            }
          />
        </FieldRow>
        {state.followActivation !== "path-mode" ? (
          <NumberSlider
            label="Source transition"
            value={state.followTransitionDuration}
            min={0}
            max={2}
            step={0.02}
            suffix="s"
            onChange={(followTransitionDuration) =>
              setState((previous) => ({
                ...previous,
                followTransitionDuration,
              }))
            }
          />
        ) : null}
        {followVisible ? <FollowControls /> : null}
      </ControlGroup>

      <PathGeometryControls />
    </section>
  );
}
