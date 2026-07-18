import type {
  HeroTrajectoryPoint,
  HeroWaveMaterialPreset,
} from "@/hero-wave-background";
import type { LabPanelSection, LabQualityConfig } from "./types";

export const LAB_PANEL_SECTIONS: readonly {
  id: LabPanelSection;
  label: string;
  detail: string;
}[] = [
  { id: "renderer", label: "Renderer", detail: "Quality" },
  { id: "inputs", label: "Inputs", detail: "Media" },
  { id: "path", label: "Path", detail: "Geometry" },
  { id: "motion", label: "Motion", detail: "Deformers" },
  { id: "material", label: "Material", detail: "Profiles" },
  { id: "palette", label: "Palette", detail: "Color" },
  { id: "scene", label: "Scene", detail: "Dots" },
  { id: "glass", label: "Glass", detail: "Mask" },
  { id: "lifecycle", label: "Lifecycle", detail: "Time" },
];

export const LAB_MATERIAL_LAYERS: Record<
  HeroWaveMaterialPreset,
  {
    atmosphere: number;
    broad: number;
    body: number;
    ridge: number;
    core: number;
    veil: number;
  }
> = {
  "soft-aurora": {
    atmosphere: 0.06,
    broad: 0.24,
    body: 0.3,
    ridge: 0.46,
    core: 0.28,
    veil: 0.04,
  },
  mist: {
    atmosphere: 0.11,
    broad: 0.32,
    body: 0.34,
    ridge: 0.27,
    core: 0.12,
    veil: 0.09,
  },
  neon: {
    atmosphere: 0.015,
    broad: 0.08,
    body: 0.17,
    ridge: 0.68,
    core: 0.72,
    veil: 0.025,
  },
  plasma: {
    atmosphere: 0.05,
    broad: 0.2,
    body: 0.36,
    ridge: 0.52,
    core: 0.38,
    veil: 0.08,
  },
};

export const QUALITY_CONTROLS = [
  { key: "maxDpr", label: "Max DPR", min: 0.5, max: 2, step: 0.05 },
  { key: "maxFps", label: "Max FPS", min: 0, max: 240, step: 1 },
  {
    key: "flatnessPx",
    label: "Base flatness",
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  {
    key: "maxChordPx",
    label: "Base max chord",
    min: 0.25,
    max: 32,
    step: 0.25,
  },
  {
    key: "maxSamples",
    label: "Max samples",
    min: 1024,
    max: 32768,
    step: 1024,
  },
  {
    key: "maxSubdivisionDepth",
    label: "Subdivision depth",
    min: 4,
    max: 20,
    step: 1,
  },
  { key: "farScale", label: "Far scale", min: 0.01, max: 1, step: 0.005 },
  { key: "midScale", label: "Mid scale", min: 0.01, max: 1, step: 0.005 },
  { key: "coreScale", label: "Core scale", min: 0.1, max: 1, step: 0.01 },
  {
    key: "farMaxDimension",
    label: "Far max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "midMaxDimension",
    label: "Mid max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "coreMaxDimension",
    label: "Core max dimension",
    min: 128,
    max: 6144,
    step: 128,
  },
  {
    key: "farMaxChordPx",
    label: "Far max chord",
    min: 1,
    max: 256,
    step: 1,
  },
  {
    key: "midMaxChordPx",
    label: "Mid max chord",
    min: 1,
    max: 128,
    step: 1,
  },
  {
    key: "coreMaxChordPx",
    label: "Core max chord",
    min: 1,
    max: 64,
    step: 1,
  },
  {
    key: "farFlatnessPx",
    label: "Far flatness",
    min: 0.05,
    max: 16,
    step: 0.05,
  },
  {
    key: "midFlatnessPx",
    label: "Mid flatness",
    min: 0.01,
    max: 8,
    step: 0.01,
  },
  {
    key: "coreFlatnessPx",
    label: "Core flatness",
    min: 0.01,
    max: 2,
    step: 0.01,
  },
] as const satisfies readonly {
  key: Exclude<keyof LabQualityConfig, "quadrature">;
  label: string;
  min: number;
  max: number;
  step: number;
}[];

export const SVG_LOOP =
  "M 10 55 C 65 0, 135 0, 190 55 C 135 110, 65 110, 10 55 Z";

export const LOOP_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "loop-0", x: 0.5, y: 0.92, speed: 1 },
  { id: "loop-1", x: 0.72, y: 0.66, speed: 1 },
  { id: "loop-2", x: 0.8, y: 0, speed: 1 },
  { id: "loop-3", x: 0.72, y: -0.66, speed: 1 },
  { id: "loop-4", x: 0.5, y: -0.92, speed: 1 },
  { id: "loop-5", x: 0.28, y: -0.66, speed: 1 },
  { id: "loop-6", x: 0.2, y: 0, speed: 1 },
  { id: "loop-7", x: 0.28, y: 0.66, speed: 1 },
];

export const FIGURE_EIGHT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "figure-eight-0", x: 0.5, y: 0, speed: 1 },
  { id: "figure-eight-1", x: 0.28, y: 0.88, speed: 1 },
  { id: "figure-eight-2", x: 0.1, y: 0, speed: 1 },
  { id: "figure-eight-3", x: 0.28, y: -0.88, speed: 1 },
  { id: "figure-eight-4", x: 0.5, y: 0, speed: 1 },
  { id: "figure-eight-5", x: 0.72, y: 0.88, speed: 1 },
  { id: "figure-eight-6", x: 0.9, y: 0, speed: 1 },
  { id: "figure-eight-7", x: 0.72, y: -0.88, speed: 1 },
];

export const WAVE_ORBIT_TRAJECTORY: readonly HeroTrajectoryPoint[] = [
  { id: "wave-orbit-0", x: 0.01, y: 0.12, speed: 0.5 },
  { id: "wave-orbit-1", x: 0.1, y: 0.46, speed: 0.5 },
  { id: "wave-orbit-2", x: 0.2, y: 0.14, speed: 0.55 },
  { id: "wave-orbit-3", x: 0.31, y: 0.74, speed: 0.7 },
  { id: "wave-orbit-4", x: 0.5, y: 1, speed: 2.2 },
  { id: "wave-orbit-5", x: 0.68, y: 0.75, speed: 2.2 },
  { id: "wave-orbit-6", x: 0.76, y: 0.12, speed: 2.2 },
  { id: "wave-orbit-7", x: 0.68, y: -0.66, speed: 2.2 },
  { id: "wave-orbit-8", x: 0.5, y: -0.96, speed: 2.2 },
  { id: "wave-orbit-9", x: 0.32, y: -0.66, speed: 2.2 },
  { id: "wave-orbit-10", x: 0.24, y: 0.12, speed: 2.2 },
  { id: "wave-orbit-11", x: 0.32, y: 0.75, speed: 2.2 },
  { id: "wave-orbit-12", x: 0.5, y: 1, speed: 1.4 },
  { id: "wave-orbit-13", x: 0.7, y: 0.54, speed: 0.8 },
  { id: "wave-orbit-14", x: 0.84, y: 0.06, speed: 0.65 },
  { id: "wave-orbit-15", x: 0.99, y: 0.42, speed: 0.65 },
];
