"use client";

import {
  ArrowLeft,
  AudioWaveform,
  Check,
  Copy,
  Dices,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Sun,
} from "lucide-react";
import { Button } from "@site/components/ui/button";
import { cn } from "@site/lib/utils";
import { siteHref } from "@site/routing";
import { LabControlPanel } from "./controls/lab-control-panel";
import { useLabControllerContext } from "./lab-controller-context";
import { LabStage } from "./stage/lab-stage";

function Telemetry() {
  const {
    rendererStatus,
    statusLabel,
    rendererFps,
    cycleCount,
    state,
    activeFilamentCount,
  } = useLabControllerContext();

  const items = [
    { label: "renderer", value: statusLabel },
    { label: "fps", value: rendererFps.toFixed(0) },
    { label: "quality", value: state.quality },
    { label: "cycle", value: String(cycleCount) },
    {
      label: "filaments",
      value: String(activeFilamentCount),
    },
  ];

  return (
    <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-1 py-1 lg:flex">
      <span
        className={cn(
          "ml-1.5 size-1.5 rounded-full",
          rendererStatus?.supported ? "bg-emerald-500" : "bg-amber-500",
        )}
        aria-hidden
      />
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-baseline gap-1 px-1.5 font-mono text-[10px]"
        >
          <span className="text-muted-foreground">{item.label}</span>
          <span className="text-foreground tabular-nums">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function LabTopBar() {
  const {
    state,
    setState,
    panelOpen,
    setPanelOpen,
    copied,
    waveRef,
    randomize,
    applyPreset,
    copyConfiguration,
    markCustom,
  } = useLabControllerContext();

  const togglePaused = () => {
    setState((previous) => {
      const paused = !previous.paused;
      if (paused) waveRef.current?.pause();
      else waveRef.current?.play();
      return { ...previous, paused };
    });
  };

  const toggleTheme = () => {
    setState((previous) => ({
      ...previous,
      theme: previous.theme === "dark" ? "light" : "dark",
    }));
    markCustom();
  };

  return (
    <header className="dark relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-border/70 bg-background/90 px-3 text-foreground backdrop-blur-xl">
      <a
        href={siteHref("/", import.meta.env.BASE_URL)}
        className="group flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight"
      >
        <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
          <AudioWaveform className="size-3.5" aria-hidden />
        </span>
        <span className="hidden sm:inline">LumaThread</span>
        <span className="hidden rounded-full border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          lab
        </span>
      </a>

      <a
        href={siteHref("/", import.meta.env.BASE_URL)}
        className="ml-1 hidden items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Docs
      </a>

      <div className="mx-auto">
        <Telemetry />
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={state.paused ? "Play" : "Pause"}
          aria-pressed={state.paused}
          title={state.paused ? "Play" : "Pause"}
          onClick={togglePaused}
        >
          {state.paused ? <Play /> : <Pause />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={toggleTheme}
        >
          {state.theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Randomize"
          title="Randomize"
          onClick={randomize}
        >
          <Dices />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Reset to reference"
          title="Reset to reference"
          onClick={() => applyPreset("reference")}
        >
          <RotateCcw />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Copy configuration"
          title="Copy configuration as TSX"
          onClick={copyConfiguration}
        >
          {copied ? <Check className="text-emerald-500" /> : <Copy />}
        </Button>
        <Button
          type="button"
          variant={panelOpen ? "secondary" : "default"}
          size="icon-sm"
          aria-label={panelOpen ? "Hide controls" : "Show controls"}
          aria-pressed={panelOpen}
          title={panelOpen ? "Hide controls" : "Show controls"}
          onClick={() => setPanelOpen((value) => !value)}
        >
          {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </div>
    </header>
  );
}

export function LabShell() {
  const { state, lightTheme, panelOpen, panelDocked } =
    useLabControllerContext();

  return (
    <div
      data-theme={state.theme}
      className={cn(
        "flex h-svh flex-col overflow-hidden",
        lightTheme ? "bg-white text-black" : "bg-[#04060a] text-white",
      )}
    >
      <LabTopBar />
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <LabStage />
        </div>
        {panelOpen && panelDocked ? (
          <aside className="dark hidden w-[25rem] shrink-0 border-l border-border/70 bg-background text-foreground md:block">
            <LabControlPanel />
          </aside>
        ) : null}
        {panelOpen && !panelDocked ? (
          <aside className="dark absolute top-3 right-3 bottom-3 z-20 flex w-[25rem] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-border/70 bg-background/95 text-foreground shadow-2xl backdrop-blur-xl">
            <LabControlPanel />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
