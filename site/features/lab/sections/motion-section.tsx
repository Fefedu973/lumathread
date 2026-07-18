"use client";

import { BaseMotionControls } from "../controls/base-motion-controls";
import { FilamentInteractionControls } from "../controls/filament-interaction-controls";
import { PropagationControls } from "../controls/propagation-controls";

export function MotionSection() {
  return (
    <>
      <BaseMotionControls />
      <FilamentInteractionControls />
      <PropagationControls />
    </>
  );
}
