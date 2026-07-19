"use client";

import {
  Activity,
  AudioLines,
  Boxes,
  Clock,
  Gauge,
  Gem,
  Layers,
  Palette,
  PanelRight,
  Spline,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { cn } from "@site/lib/utils";
import { LAB_PANEL_SECTIONS } from "../model/constants";
import { PRESET_LABELS } from "../model/presets";
import type { LabPanelSection, LabPresetId } from "../model/types";
import { useLabControllerContext } from "../lab-controller-context";
import { GlassSection } from "../sections/glass-section";
import { InputsSection } from "../sections/inputs-section";
import { LifecycleSection } from "../sections/lifecycle-section";
import { MaterialSection } from "../sections/material-section";
import { MotionSection } from "../sections/motion-section";
import { PaletteSection } from "../sections/palette-section";
import { PathSection } from "../sections/path-section";
import { RendererSection } from "../sections/renderer-section";
import { SceneSection } from "../sections/scene-section";
import { SwitchField } from "./common-controls";
import { FilamentSelector } from "./filament-scene-controls";

const SECTION_ICONS: Record<LabPanelSection, LucideIcon> = {
  renderer: Gauge,
  inputs: AudioLines,
  path: Spline,
  motion: Waves,
  material: Layers,
  palette: Palette,
  scene: Boxes,
  glass: Gem,
  lifecycle: Clock,
};

export function LabControlPanel() {
  const {
    preset,
    panelDocked,
    setPanelDocked,
    panelSection,
    setPanelSection,
    showContent,
    setShowContent,
    showMaskGuides,
    setShowMaskGuides,
    rendererStatus,
    applyPreset,
    statusLabel,
  } = useLabControllerContext();

  return (
    <div className="flex h-full w-full flex-col text-[12px]">
      <div className="shrink-0 space-y-3 border-b border-border/70 p-3">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight">
                Inspector
              </span>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {preset === "custom"
                  ? "custom / edited"
                  : PRESET_LABELS[preset]}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant={panelDocked ? "secondary" : "ghost"}
            size="icon-xs"
            className="ml-auto"
            title={panelDocked ? "Float panel" : "Dock panel"}
            aria-label={panelDocked ? "Float panel" : "Dock panel"}
            aria-pressed={panelDocked}
            onClick={() => setPanelDocked((value) => !value)}
          >
            <PanelRight />
          </Button>
        </div>

        <Select
          value={preset}
          onValueChange={(value) => {
            if (value && value in PRESET_LABELS) {
              applyPreset(value as LabPresetId);
            }
          }}
        >
          <SelectTrigger size="sm" aria-label="Preset" className="w-full">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent align="start">
            {Object.entries(PRESET_LABELS).map(([id, label]) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value="custom" disabled>
              Custom / edited
            </SelectItem>
          </SelectContent>
        </Select>

        <FilamentSelector />

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Activity className="size-3" aria-hidden /> Renderer
          </span>
          <span
            className="truncate font-mono text-foreground"
            title={rendererStatus?.reason}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* The domain picker scrolls away with the controls: it would otherwise
          cost a third of the panel height permanently. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          <nav
            className="grid grid-cols-3 gap-1"
            aria-label="Configuration domains"
          >
            {LAB_PANEL_SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.id];
              const active = panelSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setPanelSection(section.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-border bg-secondary text-secondary-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="text-[10px] font-medium">
                    {section.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {panelSection === "renderer" ? <RendererSection /> : null}
          {panelSection === "inputs" ? <InputsSection /> : null}
          {panelSection === "path" ? <PathSection /> : null}
          {panelSection === "motion" ? <MotionSection /> : null}
          {panelSection === "material" ? <MaterialSection /> : null}
          {panelSection === "palette" ? <PaletteSection /> : null}
          {panelSection === "scene" ? <SceneSection /> : null}
          {panelSection === "glass" ? <GlassSection /> : null}
          {panelSection === "lifecycle" ? <LifecycleSection /> : null}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/70 p-3">
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          Stage overlays
        </span>
        <SwitchField
          label="Hero content"
          checked={showContent}
          onChange={setShowContent}
        />
        <SwitchField
          label="Dot mask editor"
          checked={showMaskGuides}
          onChange={setShowMaskGuides}
        />
      </div>
    </div>
  );
}
