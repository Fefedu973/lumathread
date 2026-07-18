"use client";
import { MIN_HERO_TRAJECTORY_POINTS } from "@/hero-wave-background";
import { Label } from "@site/components/ui/label";
import { Textarea } from "@site/components/ui/textarea";
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function PathSourceParameters() {
  const { state, setState } = useLabControllerContext();

  return (
    <>
      {state.pathMode === "organic" ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
          <NumberSlider
            label="Seed"
            value={state.organic.seed}
            min={1}
            max={5000}
            step={1}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: { ...previous.organic, seed: value },
              }))
            }
          />
          <NumberSlider
            label="Point count"
            value={state.organic.pointCount}
            min={MIN_HERO_TRAJECTORY_POINTS}
            max={64}
            step={1}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: {
                  ...previous.organic,
                  pointCount: Math.round(value),
                },
              }))
            }
          />
          <NumberSlider
            label="Turns"
            value={state.organic.turns}
            min={0.2}
            max={6}
            step={0.05}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: { ...previous.organic, turns: value },
              }))
            }
          />
          <NumberSlider
            label="Amplitude"
            value={state.organic.amplitude}
            min={0}
            max={4}
            step={0.02}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: {
                  ...previous.organic,
                  amplitude: value,
                },
              }))
            }
          />
          <NumberSlider
            label="Roughness"
            value={state.organic.roughness}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: { ...previous.organic, roughness: value },
              }))
            }
          />
          <NumberSlider
            label="Symmetry"
            value={state.organic.symmetry}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: { ...previous.organic, symmetry: value },
              }))
            }
          />
          <NumberSlider
            label="Horizontal jitter"
            value={state.organic.horizontalJitter}
            min={0}
            max={0.45}
            step={0.01}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: {
                  ...previous.organic,
                  horizontalJitter: value,
                },
              }))
            }
          />
          <NumberSlider
            label="Speed variation"
            value={state.organic.speedVariation}
            min={0}
            max={3}
            step={0.02}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                organic: {
                  ...previous.organic,
                  speedVariation: value,
                },
              }))
            }
          />
        </div>
      ) : null}

      {state.pathMode === "svg" ? (
        <div className="space-y-1.5">
          <Label htmlFor="svg-path" className="text-xs text-muted-foreground">
            SVG path data
          </Label>
          <Textarea
            id="svg-path"
            value={state.svgPath}
            rows={3}
            spellCheck={false}
            className="min-h-20 resize-y text-[10px] leading-relaxed"
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                svgPath: event.target.value,
              }))
            }
          />
          {(
            [
              ["ViewBox min X", 0, -1000, 1000, 1],
              ["ViewBox min Y", 1, -1000, 1000, 1],
              ["ViewBox width", 2, 1, 2000, 1],
              ["ViewBox height", 3, 1, 2000, 1],
            ] as const
          ).map(([label, index, min, max, step]) => (
            <NumberSlider
              key={label}
              label={label}
              value={state.svgViewBox[index]}
              min={min}
              max={max}
              step={step}
              onChange={(value) =>
                setState((previous) => {
                  const svgViewBox: [number, number, number, number] = [
                    ...previous.svgViewBox,
                  ];
                  svgViewBox[index] = value;
                  return { ...previous, svgViewBox };
                })
              }
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
