import { Pause, Play } from "lucide-react";
import { useMemo, useState } from "react";
import {
  HeroWaveBackground,
  HeroWaveScene,
  type HeroWaveRendererStatus,
} from "@/hero-wave-background";
import { Button } from "@site/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@site/components/ui/toggle-group";
import { cn } from "@site/lib/utils";
import { useTheme } from "../theme";
import { DemoStage } from "./demo-stage";
import {
  auroraPreset,
  cursorPreset,
  glassPreset,
  scenePreset,
  signalPreset,
  terrainPreset,
} from "./presets";

const PRESETS = [
  {
    id: "aurora",
    label: "Aurora",
    blurb: "Organic trajectory, soft-aurora material, interactive dot field.",
  },
  {
    id: "signal",
    label: "Signal",
    blurb:
      "Analytic sine path with a propagating deformer stack and neon material.",
  },
  {
    id: "cursor",
    label: "Cursor",
    blurb:
      "The filament chases your pointer in cascade mode — move over the stage.",
  },
  {
    id: "glass",
    label: "Glass",
    blurb:
      "A refractive volumetric glass mask bends the filament passing behind it.",
  },
  {
    id: "terrain",
    label: "Terrain",
    blurb:
      "The dot field becomes a 3D landscape that ripples under the pointer.",
  },
  {
    id: "scene",
    label: "Scene",
    blurb:
      "Three filaments share one HDR scene, each with its own path and hue.",
  },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

export function Showcase() {
  const { resolvedTheme } = useTheme();
  const [preset, setPreset] = useState<PresetId>("aurora");
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<HeroWaveRendererStatus | null>(null);

  const scene = useMemo(
    () => (preset === "scene" ? scenePreset(resolvedTheme) : null),
    [preset, resolvedTheme],
  );

  const props = useMemo(() => {
    const builder =
      preset === "signal"
        ? signalPreset
        : preset === "cursor"
          ? cursorPreset
          : preset === "glass"
            ? glassPreset
            : preset === "terrain"
              ? terrainPreset
              : auroraPreset;
    return {
      ...(scene ? scene.background : builder(resolvedTheme)),
      paused,
      onRendererStatus: setStatus,
    };
  }, [preset, resolvedTheme, paused, scene]);

  const active = PRESETS.find((entry) => entry.id === preset) ?? PRESETS[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[preset]}
          onValueChange={(selection) => {
            const next = selection[0] as PresetId | undefined;
            if (next) setPreset(next);
          }}
          className="flex-wrap"
        >
          {PRESETS.map((entry) => (
            <ToggleGroupItem
              key={entry.id}
              value={entry.id}
              aria-label={`${entry.label} preset`}
            >
              {entry.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={paused ? "Play" : "Pause"}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
      </div>

      <DemoStage
        key={preset}
        renderer={
          scene ? (
            <HeroWaveScene {...props} filaments={scene.filaments} />
          ) : (
            <HeroWaveBackground {...props} />
          )
        }
        className="h-[24rem] md:h-[30rem]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="max-w-xl">{active.blurb}</p>
        <p className="inline-flex items-center gap-1.5 font-mono">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status?.supported ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          {status
            ? `${status.renderer}${status.approximate ? " · approx." : ""} · webgl${status.webglVersion ?? ""}`
            : "initializing"}
        </p>
      </div>
    </div>
  );
}
