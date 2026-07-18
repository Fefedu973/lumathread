"use client";
import { Input } from "@site/components/ui/input";
import { Label } from "@site/components/ui/label";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function InputsSection() {
  const { state, setState, panelSection } = useLabControllerContext();
  const musicOff = !state.musicVisualizerEnabled;

  const responseSlider = (
    key: keyof typeof state,
    label: string,
    min: number,
    max: number,
    step: number,
    suffix?: string,
  ) => (
    <NumberSlider
      label={label}
      value={state[key] as number}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      disabled={musicOff}
      onChange={(value) =>
        setState((previous) => ({ ...previous, [key]: value }))
      }
    />
  );

  return (
    <section className={panelSection === "inputs" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="scene input and frequency response">
        Background & audio
      </SectionHeading>

      <ControlGroup title="Background image" detail="behind the wave">
        <div className="space-y-1.5">
          <Label htmlFor="wave-background-url" className="text-[11px]">
            Image URL
          </Label>
          <Input
            id="wave-background-url"
            type="url"
            value={state.backgroundImageSrc}
            placeholder="https://… or upload below"
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                backgroundImageSrc: event.target.value,
              }))
            }
          />
          <Input
            type="file"
            accept="image/*"
            aria-label="Upload background image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setState((previous) => ({
                ...previous,
                backgroundImageSrc: URL.createObjectURL(file),
              }));
              event.currentTarget.value = "";
            }}
          />
        </div>
        <FieldRow label="Fit">
          <SelectField
            ariaLabel="Background image fit"
            className="w-32"
            value={state.backgroundImageFit ?? "cover"}
            options={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
              { value: "stretch", label: "Stretch" },
            ]}
            onChange={(backgroundImageFit) =>
              setState((previous) => ({ ...previous, backgroundImageFit }))
            }
          />
        </FieldRow>
        <NumberSlider
          label="Opacity"
          value={state.backgroundImageOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(backgroundImageOpacity) =>
            setState((previous) => ({ ...previous, backgroundImageOpacity }))
          }
        />
      </ControlGroup>

      <ControlGroup
        title="Music visualizer"
        detail={musicOff ? "disabled" : state.musicVisualizerSource}
      >
        <SwitchField
          label="Enable audio reaction"
          checked={state.musicVisualizerEnabled}
          onChange={(musicVisualizerEnabled) =>
            setState((previous) => ({ ...previous, musicVisualizerEnabled }))
          }
        />
        <FieldRow label="Source">
          <SelectField
            ariaLabel="Music visualizer source"
            className="w-36"
            value={state.musicVisualizerSource ?? "element"}
            disabled={musicOff}
            options={[
              { value: "element", label: "Audio file" },
              { value: "microphone", label: "Microphone" },
            ]}
            onChange={(musicVisualizerSource) =>
              setState((previous) => ({ ...previous, musicVisualizerSource }))
            }
          />
        </FieldRow>
        {state.musicVisualizerSource === "element" ? (
          <>
            <Input
              type="file"
              accept="audio/*"
              aria-label="Choose music file"
              disabled={musicOff}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setState((previous) => ({
                  ...previous,
                  musicAudioSrc: URL.createObjectURL(file),
                }));
                event.currentTarget.value = "";
              }}
            />
            <audio
              id="hero-wave-lab-audio"
              className="h-9 w-full"
              src={state.musicAudioSrc || undefined}
              controls
              aria-label="Music visualizer audio"
            />
          </>
        ) : (
          <audio id="hero-wave-lab-audio" className="hidden" />
        )}
      </ControlGroup>

      <ControlGroup title="Analysis" detail="FFT" muted disabled={musicOff}>
        <FieldRow label="FFT size">
          <SelectField
            ariaLabel="FFT size"
            className="w-28"
            value={
              String(state.musicFftSize ?? 1024) as
                | "256"
                | "512"
                | "1024"
                | "2048"
            }
            options={[
              { value: "256", label: "256" },
              { value: "512", label: "512" },
              { value: "1024", label: "1024" },
              { value: "2048", label: "2048" },
            ]}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                musicFftSize: Number(value) as 256 | 512 | 1024 | 2048,
              }))
            }
          />
        </FieldRow>
        <FieldRow label="Band">
          <SelectField
            ariaLabel="Reactive frequency band"
            className="w-36"
            value={state.musicBand ?? "energy"}
            options={[
              { value: "energy", label: "Full spectrum" },
              { value: "bass", label: "Bass" },
              { value: "mid", label: "Midrange" },
              { value: "treble", label: "Treble" },
            ]}
            onChange={(musicBand) =>
              setState((previous) => ({ ...previous, musicBand }))
            }
          />
        </FieldRow>
        {responseSlider("musicSmoothing", "Smoothing", 0, 0.99, 0.01)}
        {responseSlider("musicSensitivity", "Sensitivity", 0, 4, 0.05)}
      </ControlGroup>

      <ControlGroup
        title="Response"
        detail="per visual channel"
        muted
        collapsible
        defaultOpen={false}
        disabled={musicOff}
      >
        {responseSlider(
          "musicDeformation",
          "Ribbon deformation",
          0,
          0.2,
          0.0025,
        )}
        {responseSlider(
          "musicDeformationFrequency",
          "Deformation frequency",
          0.25,
          16,
          0.25,
        )}
        {responseSlider("musicWidth", "Width", -0.9, 2, 0.02)}
        {responseSlider("musicIntensity", "Intensity", -1, 4, 0.02)}
        {responseSlider("musicGlow", "Glow", -0.9, 4, 0.02)}
        {responseSlider("musicHue", "Hue", -180, 180, 1, "°")}
        {responseSlider("musicReflection", "Reflection", -1, 4, 0.02)}
      </ControlGroup>
    </section>
  );
}
