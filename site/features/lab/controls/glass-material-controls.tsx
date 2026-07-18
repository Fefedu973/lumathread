"use client";

import {
  ColorField,
  ControlGroup,
  FieldRow,
  NumberSlider,
  Segmented,
  SelectField,
} from "@site/features/lab/controls/common-controls";
import type { LabState } from "@site/features/lab/model/types";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

type GlassNumberKey = {
  [Key in keyof LabState]: LabState[Key] extends number ? Key : never;
}[keyof LabState];

export function GlassMaterialControls() {
  const { state, setState } = useLabControllerContext();
  const off = !state.glassTextEnabled;
  const volumetric = (state.glassSurfaceModel ?? "volumetric") === "volumetric";

  const slider = (
    key: GlassNumberKey,
    label: string,
    min: number,
    max: number,
    step: number,
    suffix?: string,
  ) => (
    <NumberSlider
      label={label}
      value={state[key]}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      disabled={off}
      onChange={(value) =>
        setState((previous) => ({ ...previous, [key]: value }))
      }
    />
  );

  return (
    <>
      <FieldRow label="Surface model">
        <SelectField
          ariaLabel="Glass surface model"
          className="w-40"
          value={state.glassSurfaceModel ?? "volumetric"}
          disabled={off}
          options={[
            { value: "simple", label: "Simple mask edge" },
            { value: "volumetric", label: "Volumetric glass" },
          ]}
          onChange={(glassSurfaceModel) =>
            setState((previous) => ({ ...previous, glassSurfaceModel }))
          }
        />
      </FieldRow>

      {volumetric ? (
        <ControlGroup title="Volume" detail="lens body" muted disabled={off}>
          <FieldRow label="Profile">
            <Segmented
              ariaLabel="Glass volume"
              value={state.glassBevelMode ?? "biconvex"}
              disabled={off}
              options={[
                { value: "biconvex", label: "Biconvex" },
                { value: "dome", label: "Dome" },
              ]}
              onChange={(glassBevelMode) =>
                setState((previous) => ({ ...previous, glassBevelMode }))
              }
            />
          </FieldRow>
          {slider("glassSurfaceDepth", "Surface depth", 2, 128, 1, "px")}
          {slider("glassIor", "Index of refraction", 1.01, 2.2, 0.01)}
          {slider("glassMagnification", "Magnification X", 0, 3, 0.02)}
          {slider("glassMagnificationY", "Magnification Y", 0, 3, 0.02)}
          {slider("glassDiffusion", "Internal diffusion", 0, 1, 0.01)}
        </ControlGroup>
      ) : null}

      <ControlGroup
        title="Refraction"
        detail="how light bends"
        muted
        disabled={off}
      >
        {slider("glassRefraction", "Refraction", 0, 64, 0.5, "px")}
        {slider("glassEdgeWrap", "Edge color wrap", 0, 160, 1, "px")}
        {slider(
          "glassChromaticAberration",
          "Chromatic split",
          0,
          12,
          0.1,
          "px",
        )}
        {slider("glassBlur", "Optical blur", 0, 1, 0.01)}
        {slider("glassDistortion", "Micro distortion", 0, 1, 0.01)}
        {slider("glassDisplacementX", "Sample offset X", -128, 128, 1, "px")}
        {slider("glassDisplacementY", "Sample offset Y", -128, 128, 1, "px")}
      </ControlGroup>

      <ControlGroup title="Surface" detail="finish" muted disabled={off}>
        {slider("glassFrost", "Frost", 0, 1, 0.01)}
        {slider("glassRoughness", "Roughness", 0, 1, 0.01)}
        {slider("glassBevel", "Bevel", 0, 4, 0.05)}
      </ControlGroup>

      <ControlGroup
        title="Lighting"
        detail="rim & highlights"
        muted
        disabled={off}
      >
        {slider("glassEdgeStrength", "Edge strength", 0, 2, 0.02)}
        {slider("glassSpecular", "Specular", 0, 2, 0.02)}
        {slider("glassFresnel", "Fresnel", 0, 2, 0.02)}
      </ControlGroup>

      <ControlGroup title="Colour" detail="tint & tone" muted disabled={off}>
        <ColorField
          label="Tint"
          value={state.glassTint}
          disabled={off}
          onChange={(glassTint) =>
            setState((previous) => ({ ...previous, glassTint }))
          }
        />
        {slider("glassTintStrength", "Tint strength", 0, 1, 0.01)}
        {slider("glassSaturation", "Saturation", -1, 2, 0.02)}
        {slider("glassBrightness", "Brightness", -0.5, 0.75, 0.01)}
        {slider("glassOpacity", "Opacity", 0, 1, 0.01)}
      </ControlGroup>

      <ControlGroup
        title="Ribs"
        detail="ribbed relief"
        muted
        collapsible
        defaultOpen={false}
        disabled={off}
      >
        {slider("glassRibStrength", "Strength", 0, 1, 0.01)}
        {slider("glassRibWidth", "Width", 2, 96, 1, "px")}
        {slider("glassRibAngle", "Angle", -180, 180, 1, "°")}
      </ControlGroup>

      <ControlGroup
        title="Liquid"
        detail="animated distortion"
        muted
        collapsible
        defaultOpen={false}
        disabled={off}
      >
        {slider("glassLiquidStrength", "Distortion", 0, 1, 0.01)}
        {slider("glassLiquidScale", "Scale", 0.1, 12, 0.1)}
        {slider("glassLiquidSpeed", "Speed", -2, 2, 0.02)}
      </ControlGroup>

      <ControlGroup
        title="Sparkle"
        detail="inner reflections"
        muted
        collapsible
        defaultOpen={false}
        disabled={off}
      >
        {slider("glassTwinkle", "Twinkle", 0, 4, 0.02)}
        {slider("glassTwinkleDensity", "Density", 0, 1, 0.01)}
        {slider("glassTwinkleSpeed", "Speed", 0, 4, 0.02)}
        {slider("glassTwinkleSize", "Spacing", 4, 96, 1, "px")}
      </ControlGroup>
    </>
  );
}
