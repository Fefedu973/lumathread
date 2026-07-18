"use client";

import { Activity, Dices, Orbit, Plus, Waves } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@site/components/ui/dropdown-menu";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  SectionHeading,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { DeformerEditor } from "@site/features/lab/controls/deformer-editor";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function PropagationControls() {
  const {
    state,
    setState,
    panelSection,
    updateDeformer,
    addDeformer,
    updateHarmonic,
  } = useLabControllerContext();

  const off = !state.propagationEnabled;

  return (
    <section className={panelSection === "motion" ? "space-y-3" : "hidden"}>
      <SectionHeading detail="serializable CPU stack">
        Propagation
      </SectionHeading>

      <ControlGroup
        title="Deformers"
        detail={`${state.propagationDeformers.length}/8`}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  title="Add deformer"
                  aria-label="Add deformer"
                  disabled={state.propagationDeformers.length >= 8}
                />
              }
            >
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => addDeformer("harmonics")}>
                <Waves /> Harmonics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addDeformer("sampled")}>
                <Activity /> Sampled
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addDeformer("noise")}>
                <Dices /> Noise
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addDeformer("pulse")}>
                <Orbit /> Pulse
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <SwitchField
          label="Enable propagation"
          checked={state.propagationEnabled}
          onChange={(propagationEnabled) =>
            setState((previous) => ({ ...previous, propagationEnabled }))
          }
        />
        {state.propagationDeformers.map((deformer, index) => (
          <DeformerEditor
            key={deformer.id}
            deformer={deformer}
            index={index}
            propagationEnabled={state.propagationEnabled}
            onChange={(changes) => updateDeformer(deformer.id, changes)}
            onRemove={() =>
              setState((previous) => ({
                ...previous,
                propagationDeformers: previous.propagationDeformers.filter(
                  (candidate) => candidate.id !== deformer.id,
                ),
              }))
            }
            onUpdateHarmonic={(harmonicId, changes) =>
              updateHarmonic(deformer.id, harmonicId, changes)
            }
          />
        ))}
      </ControlGroup>

      <ControlGroup title="Phase" detail="shared clock" muted disabled={off}>
        <NumberSlider
          label="Global offset"
          value={state.propagationPhaseOffset}
          min={-4}
          max={4}
          step={0.01}
          disabled={off}
          onChange={(propagationPhaseOffset) =>
            setState((previous) => ({ ...previous, propagationPhaseOffset }))
          }
        />
        <NumberSlider
          label="Global speed"
          value={state.propagationPhaseSpeed}
          min={-4}
          max={4}
          step={0.01}
          disabled={off}
          onChange={(propagationPhaseSpeed) =>
            setState((previous) => ({ ...previous, propagationPhaseSpeed }))
          }
        />
      </ControlGroup>

      <ControlGroup
        title="Evaluation"
        detail="how the stack is applied"
        muted
        collapsible
        defaultOpen={false}
      >
        <FieldRow label="Domain">
          <SelectField
            ariaLabel="Domain"
            className="w-36"
            value={state.propagationDomain}
            options={[
              { value: "arcLength", label: "Arc length" },
              { value: "travelTime", label: "Travel time" },
            ]}
            onChange={(propagationDomain) =>
              setState((previous) => ({ ...previous, propagationDomain }))
            }
          />
        </FieldRow>
        <FieldRow label="Combine">
          <SelectField
            ariaLabel="Combine"
            className="w-36"
            value={state.propagationCombine}
            options={[
              { value: "add", label: "Add" },
              { value: "max", label: "Max" },
              { value: "multiply", label: "Multiply" },
            ]}
            onChange={(propagationCombine) =>
              setState((previous) => ({ ...previous, propagationCombine }))
            }
          />
        </FieldRow>
        <FieldRow label="Stage">
          <SelectField
            ariaLabel="Follow stage"
            className="w-36"
            value={state.propagationStage}
            options={[
              { value: "before-follow", label: "Before follow" },
              { value: "after-follow", label: "After follow" },
            ]}
            onChange={(propagationStage) =>
              setState((previous) => ({ ...previous, propagationStage }))
            }
          />
        </FieldRow>
        <SwitchField
          label="Recompute progress"
          hint="Re-parameterise arc length after deformation."
          checked={state.recomputeArcLength}
          onChange={(recomputeArcLength) =>
            setState((previous) => ({ ...previous, recomputeArcLength }))
          }
        />
      </ControlGroup>
    </section>
  );
}
