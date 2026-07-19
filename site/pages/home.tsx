import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HeroWaveBackground,
  type HeroWaveRendererStatus,
} from "@/hero-wave-background";
import {
  createHeroOrbitPreset,
  type HeroOrbitLayout,
} from "@/presets/hero-orbit";
import {
  ApiReference,
  ApiReferenceMarkdownButton,
} from "../components/demo/api-reference";
import { DemoSection } from "../components/demo-section";
import { FeatureGrid } from "../components/demo/feature-demos";
import { InstallTabs } from "../components/demo/install-tabs";
import { LabCallout } from "../components/demo/lab-callout";
import { LazyMount } from "../components/demo/lazy-mount";
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

const USAGE_SNIPPET = `import { LumaThread } from "@/components/ui/lumathread";

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
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const glassTitleRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<HeroWaveRendererStatus | null>(null);
  const [orbitLayout, setOrbitLayout] = useState<HeroOrbitLayout | null>(null);

  const revealContent = useCallback(() => {
    const content = contentRef.current;
    if (content) content.style.visibility = "visible";
  }, []);

  const handleRendererStatus = useCallback(
    (nextStatus: HeroWaveRendererStatus) => {
      setStatus(nextStatus);
      if (!nextStatus.supported) revealContent();
    },
    [revealContent],
  );

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;

    const measure = () => {
      const sectionRect = section.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      if (
        sectionRect.width <= 0 ||
        sectionRect.height <= 0 ||
        titleRect.width <= 0 ||
        titleRect.height <= 0
      ) {
        return;
      }
      const next: HeroOrbitLayout = {
        width: sectionRect.width,
        height: sectionRect.height,
        contentLeft: titleRect.left - sectionRect.left,
        contentTop: titleRect.top - sectionRect.top,
        contentWidth: titleRect.width,
        contentHeight: titleRect.height,
      };
      setOrbitLayout((current) => {
        if (
          current &&
          Object.keys(next).every(
            (key) =>
              Math.abs(
                current[key as keyof HeroOrbitLayout] -
                  next[key as keyof HeroOrbitLayout],
              ) < 1,
          )
        ) {
          return current;
        }
        return next;
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(title);
    measure();
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  const props = useMemo(() => {
    const preset = createHeroOrbitPreset(resolvedTheme, {
      quality: "high",
      ...(orbitLayout ? { layout: orbitLayout } : {}),
    });
    return {
      ...preset,
      glassText: {
        enabled: true,
        shape: "text" as const,
        text: "the path you define.",
        wrap: "explicit" as const,
        dom: {
          target: glassTitleRef,
          syncContent: true,
          syncTypography: true,
          padding: { x: 12, y: 6 },
        },
        surfaceModel: "volumetric" as const,
        bevelMode: "dome" as const,
        surfaceDepth: 15,
        ior: 1.25,
        refraction: resolvedTheme === "light" ? 54 : 64,
        diffusion: resolvedTheme === "light" ? 0.68 : 0.82,
        blur: resolvedTheme === "light" ? 0.72 : 1,
        distortion: 0,
        chromaticAberration: resolvedTheme === "light" ? 7 : 12,
        frost: resolvedTheme === "light" ? 0.72 : 1,
        roughness: 0,
        bevel: 0,
        edgeStrength: resolvedTheme === "light" ? 0.62 : 0.2,
        specular: resolvedTheme === "light" ? 0.2 : 0.4,
        fresnel: resolvedTheme === "light" ? 1.05 : 0.76,
        twinkle: resolvedTheme === "light" ? 0.56 : 0.82,
        twinkleDensity: 0.24,
        twinkleSpeed: 0.72,
        twinkleSize: 36,
        tint: resolvedTheme === "light" ? "#063b49" : "#dffcff",
        tintStrength: resolvedTheme === "light" ? 0.52 : 0.04,
        saturation: resolvedTheme === "light" ? 0.82 : 1.44,
        brightness: resolvedTheme === "light" ? -0.18 : 0.6,
        opacity: resolvedTheme === "light" ? 0.98 : 0.96,
      },
      onReady: revealContent,
      onRendererStatus: handleRendererStatus,
      onRendererError: revealContent,
    };
  }, [handleRendererStatus, orbitLayout, resolvedTheme, revealContent]);

  const glassActive =
    orbitLayout !== null &&
    status?.supported === true &&
    status.renderer === "hdr" &&
    !status.approximate;
  const showGlassFallback = status !== null && !glassActive;

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <LazyMount className="absolute inset-0 overflow-hidden">
        <HeroWaveBackground {...props} />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-b from-transparent to-background"
        />
      </LazyMount>
      <div
        ref={contentRef}
        style={{ visibility: "hidden" }}
        className="relative mx-auto flex min-h-[720px] max-w-6xl flex-col items-center justify-center px-4 py-24 text-center md:min-h-[780px] md:px-6 md:py-28"
      >
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          React 19 · WebGL2 · shadcn/ui registry
          <span
            className={
              status?.supported
                ? "size-1.5 rounded-full bg-emerald-500"
                : "size-1.5 rounded-full bg-muted-foreground/40"
            }
            title={status ? `renderer: ${status.renderer}` : "initializing"}
          />
        </p>
        <h1
          ref={titleRef}
          className="max-w-5xl text-4xl font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl"
        >
          Light that follows
          <br />
          <span
            ref={glassTitleRef}
            style={{ opacity: showGlassFallback ? 1 : 0 }}
            className="inline-block bg-linear-to-r from-blue-700 via-cyan-600 to-emerald-600 bg-clip-text text-transparent transition-opacity duration-300 dark:from-[#315bff] dark:via-[#22d3ee] dark:to-[#22f25f]"
          >
            the path you define.
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          LumaThread renders luminous filaments in WebGL — organic trajectories,
          cursor trails, HDR intersections, glass masks, dot fields, music
          response and multi-filament scenes, all from one declarative React
          component installed as source through the shadcn registry.
        </p>
        <div className="mt-8">
          <InstallTabs className="bg-background/70" />
        </div>
        <ul className="mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
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
          description="The full public surface of the registry component, grouped by configuration domain. LumaThread and LumaThreadScene are aliases of HeroWaveBackground and HeroWaveScene."
          action={<ApiReferenceMarkdownButton />}
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
