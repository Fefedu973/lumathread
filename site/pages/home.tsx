import { useMemo, useState } from "react";
import {
  HeroWaveBackground,
  type HeroWaveRendererStatus,
} from "@/hero-wave-background";
import { ApiReference } from "../components/demo/api-reference";
import { DemoSection } from "../components/demo-section";
import { FeatureGrid } from "../components/demo/feature-demos";
import { InstallTabs } from "../components/demo/install-tabs";
import { LabCallout } from "../components/demo/lab-callout";
import { LazyMount } from "../components/demo/lazy-mount";
import { auroraPreset } from "../components/demo/presets";
import { Showcase } from "../components/demo/showcase";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { useTheme } from "../components/theme";

const HIGHLIGHTS = [
  "Sine · organic · custom · SVG · follow paths",
  "HDR multi-contribution rendering",
  "Serializable deformer stacks",
  "Cursor follow & pointer ripples",
  "Refractive glass masks",
  "Flat & terrain dot fields",
  "Music-reactive deformation",
  "Deterministic, scrubbable time",
];

const USAGE_SNIPPET = `import { LumaThread } from "lumathread";

export function Hero() {
  return (
    <section className="relative">
      <LumaThread
        path={{ mode: "organic" }}
        material={{ preset: "soft-aurora" }}
        interaction={{ follow: { mode: "cascade" } }}
      />
      {/* your content */}
    </section>
  );
}`;

function Hero() {
  const { resolvedTheme } = useTheme();
  const [status, setStatus] = useState<HeroWaveRendererStatus | null>(null);
  const props = useMemo(() => {
    const preset = auroraPreset(resolvedTheme);
    return {
      ...preset,
      shape: { ...preset.shape, waveY: 0.42 },
      onRendererStatus: setStatus,
    };
  }, [resolvedTheme]);

  return (
    <section className="relative">
      <LazyMount className="absolute inset-0 overflow-hidden">
        <HeroWaveBackground {...props} />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-b from-transparent to-background"
        />
      </LazyMount>
      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-24 md:px-6 md:pt-28 md:pb-36">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          React 19 · WebGL2 · Zero runtime dependencies
          <span
            className={
              status?.supported
                ? "size-1.5 rounded-full bg-emerald-500"
                : "size-1.5 rounded-full bg-muted-foreground/40"
            }
            title={status ? `renderer: ${status.renderer}` : "initializing"}
          />
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Light that follows the path you define.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          LumaThread renders luminous filaments in WebGL — organic trajectories,
          cursor trails, HDR intersections, glass masks, dot fields, music
          response and multi-filament scenes, all from one declarative React
          component.
        </p>
        <div className="mt-8">
          <InstallTabs className="bg-background/70" />
        </div>
        <ul className="mt-8 flex max-w-3xl flex-wrap gap-2">
          {HIGHLIGHTS.map((highlight) => (
            <li
              key={highlight}
              className="rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
            >
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <div id="top" className="min-h-svh bg-background text-foreground">
      <SiteHeader />
      <Hero />

      <main className="mx-auto max-w-6xl px-4 md:px-6">
        <DemoSection
          id="showcase"
          index="01 — Showcase"
          title="One component, many personalities"
          description="Six complete scenes built from the same renderer. Switch presets to see paths, materials, interactions and dot fields recombine."
        >
          <Showcase />
        </DemoSection>

        <DemoSection
          id="features"
          index="02 — Features"
          title="Every capability, isolated"
          description="Each card demonstrates one feature with its own live stage. Demos mount as they scroll into view and pause when hidden, so the page stays light."
        >
          <FeatureGrid />
        </DemoSection>

        <DemoSection
          id="lab"
          index="03 — Lab"
          title="Go deeper than the demos"
          description="The Lab exposes the complete structured configuration — every prop on this page, editable live."
        >
          <LabCallout />
        </DemoSection>

        <DemoSection
          id="api"
          index="04 — API"
          title="Props reference"
          description="The full public surface of LumaThread, grouped by configuration domain. LumaThread and LumaThreadScene are aliases of HeroWaveBackground and HeroWaveScene."
        >
          <div className="mb-8 overflow-x-auto rounded-xl border bg-card/50">
            <pre className="min-w-[560px] p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {USAGE_SNIPPET}
            </pre>
          </div>
          <ApiReference />
        </DemoSection>
      </main>

      <SiteFooter />
    </div>
  );
}
