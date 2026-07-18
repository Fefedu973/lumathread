"use client";

import { LabControllerProvider } from "@site/features/lab/lab-controller-context";
import { LabShell } from "@site/features/lab/lab-shell";
import { useLabController } from "@site/features/lab/use-lab-controller";

export default function HeroBackgroundLab() {
  const controller = useLabController();
  return (
    <LabControllerProvider value={controller}>
      <LabShell />
    </LabControllerProvider>
  );
}
