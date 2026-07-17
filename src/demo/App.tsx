import { useMemo, useRef, useState } from "react";
import {
  HeroWaveBackground,
  type HeroWaveBackgroundProps,
  type HeroWaveRendererStatus,
  type HeroWaveTheme,
} from "../hero-wave-background";

type DemoPreset = "aurora" | "signal" | "cursor";

const PRESET_LABELS: Record<DemoPreset, string> = {
  aurora: "Aurora",
  signal: "Signal",
  cursor: "Cursor",
};

export function App() {
  const stageRef = useRef<HTMLElement>(null);
  const [preset, setPreset] = useState<DemoPreset>("aurora");
  const [theme, setTheme] = useState<HeroWaveTheme>("dark");
  const [paused, setPaused] = useState(false);
  const [renderer, setRenderer] = useState<HeroWaveRendererStatus | null>(null);

  const waveProps = useMemo<HeroWaveBackgroundProps>(() => {
    const shared: HeroWaveBackgroundProps = {
      theme,
      paused,
      pathRenderer: "auto",
      quality: "high",
      fadeInDuration: 700,
      palette: {
        stops: [
          { id: "blue", color: "#315bff", offset: 0 },
          { id: "cyan", color: "#22d3ee", offset: 0.48 },
          { id: "green", color: "#22f25f", offset: 1 },
        ],
        interpolation: "oklab",
        wrap: "repeat",
        speed: 0.42,
        hueDrift: 4,
      },
      dots: {
        enabled: true,
        spacing: 27,
        opacity: theme === "light" ? 0.22 : 0.34,
        twinkle: 0.22,
        reflect: 0.5,
        interaction: {
          enabled: true,
          radius: 250,
          softness: 0.8,
          brightness: 0.32,
          magnification: 1.03,
        },
      },
      onRendererStatus: setRenderer,
    };

    if (preset === "signal") {
      return {
        ...shared,
        path: { mode: "sine" },
        shape: { waveY: 0.62, strength: 1, scale: 0.5, frequency: 1.7 },
        motion: {
          mode: "propagate",
          speed: 0.62,
          curveTravel: 0.08,
          segmentLength: 0.86,
          tailTaper: 0.22,
          headTaper: 0.12,
        },
        propagation: { enabled: true, phaseSpeed: 0.82 },
        material: { preset: "neon", intensity: 0.72, glow: 1.18 },
      };
    }

    if (preset === "cursor") {
      return {
        ...shared,
        path: { mode: "follow" },
        motion: { mode: "anchored", segmentLength: 0.82, speed: 0.72 },
        interaction: {
          follow: {
            mode: "cascade",
            target: stageRef,
            memorySeconds: 0.9,
            headResponse: 1,
            leaveBehavior: "freeze",
            pointerTypes: ["mouse", "pen", "touch"],
            velocityInfluence: {
              intensity: 0.14,
              width: 0.08,
              glow: 0.12,
              hue: 10,
              reflection: 0.12,
            },
          },
        },
        material: { preset: "plasma", intensity: 0.8, glow: 1.05 },
      };
    }

    return {
      ...shared,
      path: {
        mode: "organic",
        organic: {
          pointCount: 14,
          turns: 1.35,
          amplitude: 0.84,
          roughness: 0.2,
          horizontalJitter: 0.1,
          speedVariation: 0.45,
          symmetry: 0.12,
          seed: 731,
        },
      },
      shape: { waveY: 0.62, strength: 1, scale: 0.62, frequency: 1.35 },
      motion: {
        mode: "travel",
        speed: 0.6,
        curveTravel: 0.07,
        curveMotion: 0.55,
        segmentLength: 0.9,
        tailTaper: 0.2,
        headTaper: 0.12,
      },
      material: {
        preset: "soft-aurora",
        intensity: 0.86,
        glow: 1.12,
        upperGlowSpread: 1.08,
        lowerGlowSpread: 0.95,
      },
    };
  }, [paused, preset, theme]);

  return (
    <main ref={stageRef} className="demo" data-theme={theme}>
      <HeroWaveBackground {...waveProps} />

      <header className="demo-header">
        <div>
          <div className="brand-row">
            <span className="brand-mark" aria-hidden="true" />
            <strong>LumaThread</strong>
          </div>
          <p>Composable luminous filaments for React and WebGL.</p>
        </div>
        <div className="renderer-status" aria-live="polite">
          <span
            className={renderer?.supported ? "status-dot active" : "status-dot"}
          />
          {renderer?.renderer ?? "initializing"}
        </div>
      </header>

      <section className="demo-copy">
        <p className="eyebrow">WEBGL FILAMENT ENGINE</p>
        <h1>
          Light that follows
          <br />
          the path you define.
        </h1>
        <p className="lede">
          Organic trajectories, cursor trails, HDR intersections, glass masks,
          dot fields, music response and multi-filament scenes.
        </p>
      </section>

      <div className="demo-toolbar" aria-label="LumaThread demo controls">
        <div className="segmented" aria-label="Preset">
          {(Object.keys(PRESET_LABELS) as DemoPreset[]).map((value) => (
            <button
              key={value}
              type="button"
              className={preset === value ? "selected" : undefined}
              onClick={() => setPreset(value)}
            >
              {PRESET_LABELS[value]}
            </button>
          ))}
        </div>
        <span className="toolbar-separator" />
        <button type="button" onClick={() => setPaused((value) => !value)}>
          {paused ? "Play" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() =>
            setTheme((value) => (value === "dark" ? "light" : "dark"))
          }
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </main>
  );
}
