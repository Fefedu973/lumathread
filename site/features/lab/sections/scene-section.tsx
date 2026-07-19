"use client";
import {
  ColorField,
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  Segmented,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { FilamentSceneControls } from "@site/features/lab/controls/filament-scene-controls";
import { DotRendererControls } from "@site/features/lab/controls/dot-renderer-controls";
import { DotMaskControls } from "@site/features/lab/controls/dot-mask-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function SceneSection() {
  const { state, setState, setSceneMode, panelSection } =
    useLabControllerContext();
  const interactionOff = !state.dotsEnabled || !state.dotInteractionEnabled;

  const set = <Key extends keyof typeof state>(
    key: Key,
    value: (typeof state)[Key],
  ) => setState((previous) => ({ ...previous, [key]: value }));

  return (
    <section className={panelSection === "scene" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="shared accumulation and global dots">
        Scene & dots
      </SectionHeading>

      <ControlGroup
        title="Filaments"
        detail={state.sceneMode ? "multi-filament" : "single filament"}
      >
        <SwitchField
          label="Multi-filament scene"
          hint="Render several filaments into one shared HDR pass."
          checked={state.sceneMode}
          onChange={setSceneMode}
        />
        <FilamentSceneControls />
      </ControlGroup>

      <ControlGroup
        title="Dot field"
        detail={state.dotsEnabled ? state.dotMode : "disabled"}
      >
        <SwitchField
          label="Enable dots"
          checked={state.dotsEnabled}
          onChange={(dotsEnabled) => set("dotsEnabled", dotsEnabled)}
        />
        <FieldRow label="Renderer">
          <Segmented
            ariaLabel="Dot renderer"
            value={state.dotMode}
            disabled={!state.dotsEnabled}
            options={[
              { value: "flat", label: "Flat grid" },
              { value: "terrain", label: "3D terrain" },
            ]}
            onChange={(dotMode) => set("dotMode", dotMode)}
          />
        </FieldRow>
        <DotRendererControls />
      </ControlGroup>

      <ControlGroup
        title="Pointer interaction"
        detail="dots under the cursor"
        muted
        collapsible
        defaultOpen={false}
      >
        <SwitchField
          label="Enable interaction"
          checked={state.dotInteractionEnabled}
          disabled={!state.dotsEnabled}
          onChange={(dotInteractionEnabled) =>
            set("dotInteractionEnabled", dotInteractionEnabled)
          }
        />
        <NumberSlider
          label="Radius"
          value={state.dotInteractionRadius}
          min={20}
          max={480}
          step={2}
          suffix="px"
          disabled={interactionOff}
          onChange={(value) => set("dotInteractionRadius", value)}
        />
        <NumberSlider
          label="Edge softness"
          value={state.dotInteractionSoftness}
          min={0.01}
          max={1}
          step={0.01}
          disabled={interactionOff}
          onChange={(value) => set("dotInteractionSoftness", value)}
        />
        {state.dotMode === "terrain" ? (
          <NumberSlider
            label="Landscape displacement"
            value={state.terrainPointerDisplacement}
            min={-1.5}
            max={1.5}
            step={0.01}
            disabled={interactionOff}
            onChange={(value) => set("terrainPointerDisplacement", value)}
          />
        ) : (
          <>
            <NumberSlider
              label="Brightness"
              value={state.dotInteractionBrightness}
              min={-1}
              max={4}
              step={0.02}
              disabled={interactionOff}
              onChange={(value) => set("dotInteractionBrightness", value)}
            />
            <NumberSlider
              label="Magnification"
              value={state.dotInteractionMagnification}
              min={0.35}
              max={3}
              step={0.01}
              disabled={interactionOff}
              onChange={(value) => set("dotInteractionMagnification", value)}
            />
            <NumberSlider
              label="Color strength"
              value={state.dotInteractionColorStrength}
              min={0}
              max={1}
              step={0.01}
              disabled={interactionOff}
              onChange={(value) => set("dotInteractionColorStrength", value)}
            />
            <ColorField
              label="Interaction color"
              value={state.dotInteractionColor}
              disabled={interactionOff}
              onChange={(value) => set("dotInteractionColor", value)}
            />
          </>
        )}
      </ControlGroup>

      <ControlGroup
        title="Masks"
        detail="where dots are visible"
        muted
        collapsible
        defaultOpen={false}
      >
        <DotMaskControls />
      </ControlGroup>
    </section>
  );
}
