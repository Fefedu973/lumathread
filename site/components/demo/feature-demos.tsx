import { Minus, Pause, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  HeroWaveBackground,
  HeroWaveScene,
  type HeroWaveBackgroundProps,
} from "@/hero-wave-background";
import { Button } from "@site/components/ui/button";
import { Slider } from "@site/components/ui/slider";
import { useTheme } from "../theme";
import { FeatureCard } from "../demo-section";
import { DemoStage } from "./demo-stage";
import {
  auroraPreset,
  cursorPreset,
  glassPreset,
  palettePreset,
  profilesPreset,
  ripplePreset,
  scenePreset,
  signalPreset,
  svgPreset,
  terrainPreset,
} from "./presets";

function PresetDemo({
  build,
  overrides,
}: {
  build: (theme: "dark" | "light") => HeroWaveBackgroundProps;
  overrides?: Partial<HeroWaveBackgroundProps>;
}) {
  const { resolvedTheme } = useTheme();
  const props = useMemo(
    () => ({ ...build(resolvedTheme), ...overrides }),
    [build, resolvedTheme, overrides],
  );
  return <DemoStage renderer={<HeroWaveBackground {...props} />} />;
}

function SeededOrganicDemo() {
  const { resolvedTheme } = useTheme();
  const [seed, setSeed] = useState(731);
  const props = useMemo(() => {
    const preset = auroraPreset(resolvedTheme);
    return {
      ...preset,
      path: {
        ...preset.path,
        organic: { ...preset.path?.organic, seed },
      },
    };
  }, [resolvedTheme, seed]);

  return (
    <div className="space-y-3">
      <DemoStage renderer={<HeroWaveBackground {...props} />} />
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          seed {seed}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSeed(Math.floor(Math.random() * 10_000))}
        >
          Reroll seed
        </Button>
      </div>
    </div>
  );
}

function SceneDemo() {
  const { resolvedTheme } = useTheme();
  const scene = useMemo(() => scenePreset(resolvedTheme), [resolvedTheme]);
  return (
    <DemoStage
      renderer={
        <HeroWaveScene {...scene.background} filaments={scene.filaments} />
      }
    />
  );
}

function DeterministicDemo() {
  const { resolvedTheme } = useTheme();
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(4);
  const props = useMemo(() => {
    const preset = auroraPreset(resolvedTheme);
    return playing
      ? { ...preset, initialTime: time }
      : { ...preset, paused: true, time };
  }, [resolvedTheme, playing, time]);

  return (
    <div className="space-y-3">
      <DemoStage renderer={<HeroWaveBackground {...props} />} />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={playing ? "Pause and scrub" : "Play"}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Back one second"
          disabled={playing}
          onClick={() => setTime((value) => Math.max(0, value - 1))}
        >
          <Minus />
        </Button>
        <Slider
          value={[time]}
          min={0}
          max={30}
          step={0.05}
          disabled={playing}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            if (typeof next === "number") setTime(next);
          }}
          aria-label="Timeline"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Forward one second"
          disabled={playing}
          onClick={() => setTime((value) => Math.min(30, value + 1))}
        >
          <Plus />
        </Button>
        <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {time.toFixed(2)}s
        </span>
      </div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <FeatureCard
        title="Organic trajectories"
        description="A seeded generator lays out smooth, natural paths. The same seed always draws the exact same thread."
        hint="Reroll to lay out a brand-new trajectory."
      >
        <SeededOrganicDemo />
      </FeatureCard>

      <FeatureCard
        title="Propagation deformers"
        description="A serializable stack of harmonics, noise and pulse deformers displaces the path while the wave propagates through it."
      >
        <PresetDemo build={signalPreset} />
      </FeatureCard>

      <FeatureCard
        title="Cursor follow"
        description="In follow mode the filament chases the pointer — hybrid, cascade or echo response, with velocity-driven intensity, width and hue."
        hint="Move your cursor across the stage."
      >
        <PresetDemo build={cursorPreset} />
      </FeatureCard>

      <FeatureCard
        title="Pointer ripples"
        description="Pointer impulses inject travelling waves into the filament, with configurable frequency, damping and spatial decay."
        hint="Press and drag across the thread."
      >
        <PresetDemo build={ripplePreset} />
      </FeatureCard>

      <FeatureCard
        title="Refractive glass masks"
        description="Text or SVG shapes become volumetric glass: index of refraction, chromatic aberration, frost, bevel and specular are all tunable."
      >
        <PresetDemo build={glassPreset} />
      </FeatureCard>

      <FeatureCard
        title="Terrain dot fields"
        description="The background dot grid can rise into a 3D terrain that scrolls beneath the filament and deforms under the pointer."
        hint="Sweep the pointer to displace the landscape."
      >
        <PresetDemo build={terrainPreset} />
      </FeatureCard>

      <FeatureCard
        title="Longitudinal profiles"
        description="Width, opacity, intensity, glow and color offset can each follow a profile along the filament — flat, bell, comet head or fully custom keys."
      >
        <PresetDemo build={profilesPreset} />
      </FeatureCard>

      <FeatureCard
        title="Advanced palettes"
        description="Multi-stop gradients interpolated in sRGB, linear RGB or OKLab, with wrap modes, flow speed, hue shift and slow hue drift."
      >
        <PresetDemo build={palettePreset} />
      </FeatureCard>

      <FeatureCard
        title="SVG paths"
        description="Any SVG path becomes a trajectory — imported as-is with its own viewBox, then transformed, scaled and animated like any other path."
      >
        <PresetDemo build={svgPreset} />
      </FeatureCard>

      <FeatureCard
        title="Multi-filament scenes"
        description="HeroWaveScene renders several filaments into one shared HDR pass, each with its own path, motion, material, palette and time offset."
      >
        <SceneDemo />
      </FeatureCard>

      <FeatureCard
        title="Deterministic playback"
        description="Rendering is a pure function of time: pause, scrub and step frame-by-frame through the controlled `time` prop or the imperative handle."
        hint="Pause, then scrub the timeline — every frame is reproducible."
        className="md:col-span-2"
      >
        <DeterministicDemo />
      </FeatureCard>
    </div>
  );
}
