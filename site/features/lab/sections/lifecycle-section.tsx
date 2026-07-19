"use client";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function LifecycleSection() {
  const {
    state,
    setState,
    panelSection,
    setRenderEpoch,
    setRendererFps,
    waveRef,
    frameStatsRef,
    updateFadeCurve,
  } = useLabControllerContext();

  const replay = () => {
    frameStatsRef.current = { count: 0, startedAt: 0, lastFrameAt: 0 };
    setRendererFps(0);
    setRenderEpoch((value) => value + 1);
  };

  const stepFrame = (direction: 1 | -1) =>
    setState((previous) => ({
      ...previous,
      timelineTime: Math.max(0, previous.timelineTime + direction / 30),
    }));

  return (
    <section className={panelSection === "lifecycle" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="internal or deterministic clock">
        Time & lifecycle
      </SectionHeading>

      <ControlGroup
        title="Reveal"
        detail="initial fade"
        action={
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            title="Replay reveal"
            aria-label="Replay reveal"
            onClick={replay}
          >
            <RefreshCw />
          </Button>
        }
      >
        <NumberSlider
          label="Duration"
          value={state.fadeInDuration}
          min={0}
          max={3000}
          step={25}
          suffix="ms"
          onChange={(value) =>
            setState((previous) => ({ ...previous, fadeInDuration: value }))
          }
        />
        <SwitchField
          label="Fade glass with filament"
          hint="When disabled, the scene reveals while the glass overlay stays fully visible."
          checked={state.fadeInAffectsGlassText}
          onChange={(fadeInAffectsGlassText) =>
            setState((previous) => ({
              ...previous,
              fadeInAffectsGlassText,
            }))
          }
        />
        <FieldRow label="Easing">
          <SelectField
            ariaLabel="Reveal easing"
            className="w-40"
            value={state.fadeCurvePreset}
            options={[
              { value: "linear", label: "Linear" },
              { value: "ease", label: "Ease" },
              { value: "ease-in", label: "Ease in" },
              { value: "ease-out", label: "Ease out" },
              { value: "ease-in-out", label: "Ease in out" },
              { value: "custom", label: "Custom cubic" },
            ]}
            onChange={(fadeCurvePreset) =>
              setState((previous) => ({ ...previous, fadeCurvePreset }))
            }
          />
        </FieldRow>
        {state.fadeCurvePreset === "custom" ? (
          <ControlGroup title="Cubic bezier" muted>
            {(
              [
                ["X1", 0, 0, 1],
                ["Y1", 1, -1, 2],
                ["X2", 2, 0, 1],
                ["Y2", 3, -1, 2],
              ] as const
            ).map(([label, index, min, max]) => (
              <NumberSlider
                key={label}
                label={label}
                value={state.fadeCurve[index]}
                min={min}
                max={max}
                step={0.01}
                onChange={(value) => updateFadeCurve(index, value)}
              />
            ))}
          </ControlGroup>
        ) : null}
      </ControlGroup>

      <ControlGroup title="Playback" detail="clock source">
        <SwitchField
          label="Paused"
          checked={state.paused}
          onChange={(paused) => {
            setState((previous) => ({ ...previous, paused }));
            if (paused) waveRef.current?.pause();
            else waveRef.current?.play();
          }}
        />
        <SwitchField
          label="Controlled time"
          hint="Drive the renderer from an explicit timeline."
          checked={state.controlledTime}
          onChange={(controlledTime) =>
            setState((previous) => ({ ...previous, controlledTime }))
          }
        />
        <NumberSlider
          label="Initial time"
          value={state.initialTime}
          min={-20}
          max={20}
          step={0.05}
          suffix="s"
          disabled={state.controlledTime}
          onChange={(value) => {
            setState((previous) => ({ ...previous, initialTime: value }));
            waveRef.current?.seek(value);
          }}
        />
        {state.controlledTime ? (
          <ControlGroup title="Timeline" muted>
            <NumberSlider
              label="Time"
              value={state.timelineTime}
              min={0}
              max={20}
              step={0.01}
              suffix="s"
              onChange={(value) =>
                setState((previous) => ({ ...previous, timelineTime: value }))
              }
            />
            <FieldRow label="Step one frame">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Back one frame"
                title="Back one frame"
                onClick={() => stepFrame(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Forward one frame"
                title="Forward one frame"
                onClick={() => stepFrame(1)}
              >
                <ChevronRight />
              </Button>
            </FieldRow>
          </ControlGroup>
        ) : null}
        <NumberSlider
          label="Playback rate"
          value={state.playbackRate}
          min={-3}
          max={3}
          step={0.05}
          suffix="×"
          onChange={(value) =>
            setState((previous) => ({ ...previous, playbackRate: value }))
          }
        />
      </ControlGroup>

      <ControlGroup title="Behaviour" detail="host integration">
        <SwitchField
          label="Respect reduced motion"
          checked={state.respectReducedMotion}
          onChange={(respectReducedMotion) =>
            setState((previous) => ({ ...previous, respectReducedMotion }))
          }
        />
        <SwitchField
          label="Pause when offscreen"
          checked={state.pauseWhenOffscreen}
          onChange={(pauseWhenOffscreen) =>
            setState((previous) => ({ ...previous, pauseWhenOffscreen }))
          }
        />
      </ControlGroup>
    </section>
  );
}
