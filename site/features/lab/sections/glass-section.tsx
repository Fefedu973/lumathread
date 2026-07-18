"use client";
import {
  ControlGroup,
  SectionHeading,
} from "@site/features/lab/controls/common-controls";
import { GlassMaskControls } from "@site/features/lab/controls/glass-mask-controls";
import { GlassMaterialControls } from "@site/features/lab/controls/glass-material-controls";
import { GlassIntroControls } from "@site/features/lab/controls/glass-intro-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function GlassSection() {
  const { panelSection } = useLabControllerContext();

  return (
    <section className={panelSection === "glass" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="same-canvas refractive post-process">
        Glass text
      </SectionHeading>

      <ControlGroup title="Mask" detail="shape & placement">
        <GlassMaskControls />
      </ControlGroup>

      <ControlGroup title="Optics" detail="refraction & surface">
        <GlassMaterialControls />
      </ControlGroup>

      <ControlGroup title="Entrance" detail="glass-only blur fade">
        <GlassIntroControls />
      </ControlGroup>
    </section>
  );
}
