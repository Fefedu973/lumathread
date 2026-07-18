"use client";

import { Checkbox } from "@site/components/ui/checkbox";
import { Label } from "@site/components/ui/label";
import {
  NumberSlider,
  SectionHeading,
} from "@site/features/lab/controls/common-controls";
import { LAB_MATERIAL_LAYERS } from "@site/features/lab/model/constants";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function MaterialAppearanceControls() {
  const { state, setState } = useLabControllerContext();

  return (
    <>
      <SectionHeading detail="applied after the shape">
        Profile multipliers
      </SectionHeading>
      <NumberSlider
        label="Width scale"
        value={state.profileWidth}
        min={0.05}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileWidth: value,
          }))
        }
      />
      <NumberSlider
        label="Opacity scale"
        value={state.profileOpacity}
        min={0}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileOpacity: value,
          }))
        }
      />
      <NumberSlider
        label="Intensity scale"
        value={state.profileIntensity}
        min={0}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileIntensity: value,
          }))
        }
      />
      <NumberSlider
        label="Glow scale"
        value={state.profileGlow}
        min={0.05}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileGlow: value,
          }))
        }
      />
      <NumberSlider
        label="Upper glow spread scale"
        value={state.profileUpperGlowSpread ?? 1}
        min={0.05}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileUpperGlowSpread: value,
          }))
        }
      />
      <NumberSlider
        label="Lower glow spread scale"
        value={state.profileLowerGlowSpread ?? 1}
        min={0.05}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileLowerGlowSpread: value,
          }))
        }
      />
      <NumberSlider
        label="Reflection scale"
        value={state.profileReflection}
        min={0}
        max={3}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileReflection: value,
          }))
        }
      />
      <NumberSlider
        label="Global color offset"
        value={state.profileColorPosition}
        min={-1}
        max={1}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            profileColorPosition: value,
          }))
        }
      />
      <Label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={state.materialAdvanced}
          onCheckedChange={(checked) =>
            setState((previous) => {
              const advanced = checked === true;
              const layers = LAB_MATERIAL_LAYERS[previous.materialPreset];
              return {
                ...previous,
                materialAdvanced: advanced,
                ...(advanced
                  ? {
                      materialAtmosphere: layers.atmosphere,
                      materialBroad: layers.broad,
                      materialBody: layers.body,
                      materialRidge: layers.ridge,
                      materialCore: layers.core,
                      materialVeil: layers.veil,
                    }
                  : {}),
              };
            })
          }
        />
        Advanced material layers
      </Label>
      {state.materialAdvanced ? (
        <div className="space-y-2.5 border-l border-border/70 pl-3">
          <NumberSlider
            label="Atmosphere"
            value={state.materialAtmosphere}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialAtmosphere: value,
              }))
            }
          />
          <NumberSlider
            label="Broad"
            value={state.materialBroad}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialBroad: value,
              }))
            }
          />
          <NumberSlider
            label="Body"
            value={state.materialBody}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialBody: value,
              }))
            }
          />
          <NumberSlider
            label="Ridge"
            value={state.materialRidge}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialRidge: value,
              }))
            }
          />
          <NumberSlider
            label="Core"
            value={state.materialCore}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialCore: value,
              }))
            }
          />
          <NumberSlider
            label="Veil"
            value={state.materialVeil}
            min={0}
            max={2}
            step={0.005}
            onChange={(value) =>
              setState((previous) => ({
                ...previous,
                materialVeil: value,
              }))
            }
          />
        </div>
      ) : null}
      <NumberSlider
        label="Material intensity"
        value={state.materialIntensity}
        min={0}
        max={2.5}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            materialIntensity: value,
          }))
        }
      />
      <NumberSlider
        label="Material glow"
        value={state.materialGlow}
        min={0.2}
        max={3}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            materialGlow: value,
          }))
        }
      />
      <NumberSlider
        label="Exposure"
        value={state.materialExposure}
        min={0.2}
        max={2.5}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            materialExposure: value,
          }))
        }
      />
      <NumberSlider
        label="Saturation"
        value={state.materialSaturation}
        min={0}
        max={2.5}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            materialSaturation: value,
          }))
        }
      />
      <NumberSlider
        label="Upper glow spread"
        value={state.upperGlowSpread}
        min={0.1}
        max={3}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            upperGlowSpread: value,
          }))
        }
      />
      <NumberSlider
        label="Lower glow spread"
        value={state.lowerGlowSpread}
        min={0.1}
        max={3}
        step={0.02}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            lowerGlowSpread: value,
          }))
        }
      />
      <NumberSlider
        label="Glow asymmetry"
        value={state.glowAsymmetry}
        min={-1}
        max={1}
        step={0.01}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            glowAsymmetry: value,
          }))
        }
      />
    </>
  );
}
