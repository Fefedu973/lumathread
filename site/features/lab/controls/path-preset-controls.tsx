"use client";
import {
  Gauge,
  Infinity as InfinityIcon,
  Orbit,
  PenLine,
  Waves,
} from "lucide-react";
import { HERO_DEFAULT_TRAJECTORY } from "@/hero-wave-background";
import { Button } from "@site/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@site/components/ui/dropdown-menu";
import { Input } from "@site/components/ui/input";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import {
  FIGURE_EIGHT_TRAJECTORY,
  LOOP_TRAJECTORY,
  WAVE_ORBIT_TRAJECTORY,
} from "@site/features/lab/model/constants";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function PathPresetControls() {
  const { state, setState, autoRandomPath, autoCycle, applyTrajectoryPreset } =
    useLabControllerContext();

  return (
    <>
      {state.textMode ? (
        <div className="space-y-2.5 border-l border-border/70 pl-3">
          <Input
            value={state.text}
            maxLength={12}
            aria-label="Filament text"
            className="h-8 font-mono uppercase"
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                text: event.target.value.toUpperCase(),
              }))
            }
          />
          <NumberSlider
            label="Text height"
            value={state.textHeight}
            min={0.05}
            max={0.7}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                textHeight: value,
              }))
            }
          />
          <NumberSlider
            label="Letter spacing"
            value={state.textLetterSpacing}
            min={-0.2}
            max={1}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                textLetterSpacing: value,
              }))
            }
          />
          <NumberSlider
            label="Text Y"
            value={state.textY}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                textY: value,
              }))
            }
          />
          <NumberSlider
            label="Stroke hue spread"
            value={state.textHueSpread}
            min={-45}
            max={45}
            step={1}
            suffix="°"
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                textHueSpread: value,
              }))
            }
          />
          <NumberSlider
            label="Stroke time stagger"
            value={state.textStagger}
            min={-1}
            max={1}
            step={0.01}
            suffix="s"
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                textStagger: value,
              }))
            }
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 justify-start"
                  aria-label="Trajectory presets"
                />
              }
            >
              <PenLine />
              Trajectory presets
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Custom paths</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() =>
                    applyTrajectoryPreset(HERO_DEFAULT_TRAJECTORY, false, {
                      shape: { waveY: 0.5, scale: 0.9 },
                    })
                  }
                >
                  <Waves />
                  Open wave
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    applyTrajectoryPreset(WAVE_ORBIT_TRAJECTORY, false, {
                      shape: { waveY: 0.5, scale: 0.9 },
                      motion: {
                        curveTravel: 0.09,
                        segmentLength: 0.34,
                      },
                    })
                  }
                >
                  <Gauge />
                  Wave, orbit, wave
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() =>
                    applyTrajectoryPreset(LOOP_TRAJECTORY, true, {
                      shape: { waveY: 0.5, scale: 0.95 },
                    })
                  }
                >
                  <Orbit />
                  Closed loop
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    applyTrajectoryPreset(FIGURE_EIGHT_TRAJECTORY, true, {
                      shape: { waveY: 0.5, scale: 0.95 },
                    })
                  }
                >
                  <InfinityIcon />
                  Figure eight
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {autoRandomPath ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              cycle {autoCycle}
            </span>
          ) : null}
        </div>
      )}
    </>
  );
}
