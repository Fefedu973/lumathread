"use client";
import {
  ControlGroup,
  SectionHeading,
} from "@site/features/lab/controls/common-controls";
import { ProfileCurveControls } from "@site/features/lab/controls/profile-curve-controls";
import { MaterialAppearanceControls } from "@site/features/lab/controls/material-appearance-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function MaterialSection() {
  const { panelSection } = useLabControllerContext();

  return (
    <section className={panelSection === "material" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="LUT profiles + shared material">
        Profiles & material
      </SectionHeading>

      <ControlGroup title="Longitudinal profile" detail="along the filament">
        <ProfileCurveControls />
      </ControlGroup>

      <ControlGroup title="Material" detail="scattering & tone">
        <MaterialAppearanceControls />
      </ControlGroup>
    </section>
  );
}
