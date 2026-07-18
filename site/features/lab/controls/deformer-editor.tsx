"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@site/components/ui/button";
import { Checkbox } from "@site/components/ui/checkbox";
import { Label } from "@site/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { Textarea } from "@site/components/ui/textarea";
import type { HarmonicState, LabDeformerState } from "../model/types";
import { NumberSlider } from "./common-controls";

export function DeformerEditor({
  deformer,
  index,
  propagationEnabled,
  onChange,
  onRemove,
  onUpdateHarmonic,
}: {
  deformer: LabDeformerState;
  index: number;
  propagationEnabled: boolean;
  onChange: (changes: Partial<Omit<LabDeformerState, "id">>) => void;
  onRemove: () => void;
  onUpdateHarmonic: (
    harmonicId: string,
    changes: Partial<Omit<HarmonicState, "id">>,
  ) => void;
}) {
  const disabled = !propagationEnabled || !deformer.enabled;
  return (
    <div className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={deformer.enabled}
            disabled={!propagationEnabled}
            onCheckedChange={(checked) =>
              onChange({ enabled: checked === true })
            }
          />
          Deformer {index + 1}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={`Remove deformer ${index + 1}`}
          aria-label={`Remove deformer ${index + 1}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={deformer.type}
          disabled={!propagationEnabled}
          onValueChange={(value) => {
            if (
              value === "harmonics" ||
              value === "sampled" ||
              value === "noise" ||
              value === "pulse"
            ) {
              onChange({ type: value });
            }
          }}
        >
          <SelectTrigger size="sm" aria-label={`Deformer ${index + 1} type`}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="harmonics">harmonics</SelectItem>
            <SelectItem value="sampled">sampled</SelectItem>
            <SelectItem value="noise">noise</SelectItem>
            <SelectItem value="pulse">pulse</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={deformer.envelope}
          disabled={disabled}
          onValueChange={(value) => {
            if (
              value === "flat" ||
              value === "sin2" ||
              value === "smoothstep" ||
              value === "bell" ||
              value === "head" ||
              value === "tail"
            ) {
              onChange({ envelope: value });
            }
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Deformer ${index + 1} envelope`}
          >
            <SelectValue placeholder="Envelope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">flat</SelectItem>
            <SelectItem value="sin2">sin²</SelectItem>
            <SelectItem value="smoothstep">smoothstep</SelectItem>
            <SelectItem value="bell">bell</SelectItem>
            <SelectItem value="head">head</SelectItem>
            <SelectItem value="tail">tail</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Select
        value={deformer.direction}
        disabled={disabled}
        onValueChange={(value) => {
          if (
            value === "normal" ||
            value === "tangent" ||
            value === "both" ||
            value === "x" ||
            value === "y"
          ) {
            onChange({ direction: value });
          }
        }}
      >
        <SelectTrigger size="sm" aria-label={`Deformer ${index + 1} direction`}>
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="normal">normal</SelectItem>
          <SelectItem value="tangent">tangent</SelectItem>
          <SelectItem value="both">both</SelectItem>
          <SelectItem value="x">x</SelectItem>
          <SelectItem value="y">y</SelectItem>
        </SelectContent>
      </Select>
      <NumberSlider
        label="Amplitude"
        value={deformer.amplitude}
        min={0}
        max={0.25}
        step={0.001}
        disabled={disabled}
        onChange={(value) => onChange({ amplitude: value })}
      />
      <NumberSlider
        label="Tangent amount"
        value={deformer.tangentAmount}
        min={-2}
        max={2}
        step={0.01}
        disabled={disabled || deformer.direction === "normal"}
        onChange={(value) => onChange({ tangentAmount: value })}
      />

      {deformer.type === "harmonics" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              Harmonics {deformer.harmonics.length}/8
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              title="Add harmonic"
              aria-label={`Add harmonic to deformer ${index + 1}`}
              disabled={disabled || deformer.harmonics.length >= 8}
              onClick={() =>
                onChange({
                  harmonics: [
                    ...deformer.harmonics,
                    {
                      id: `harmonic-${Date.now()}`,
                      amplitude: 0.25,
                      frequency: 2,
                      phase: 0,
                      phaseSpeed: 1,
                    },
                  ],
                })
              }
            >
              <Plus />
            </Button>
          </div>
          {deformer.harmonics.map((harmonic, harmonicIndex) => (
            <div
              key={harmonic.id}
              className="space-y-2 border-t border-border/50 pt-2 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">Wave {harmonicIndex + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title={`Remove harmonic ${harmonicIndex + 1}`}
                  aria-label={`Remove harmonic ${harmonicIndex + 1}`}
                  disabled={disabled || deformer.harmonics.length <= 1}
                  onClick={() =>
                    onChange({
                      harmonics: deformer.harmonics.filter(
                        (candidate) => candidate.id !== harmonic.id,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <NumberSlider
                label="Weight"
                value={harmonic.amplitude}
                min={-2}
                max={2}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { amplitude: value })
                }
              />
              <NumberSlider
                label="Frequency"
                value={harmonic.frequency}
                min={0.05}
                max={32}
                step={0.05}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { frequency: value })
                }
              />
              <NumberSlider
                label="Phase"
                value={harmonic.phase}
                min={-2}
                max={2}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { phase: value })
                }
              />
              <NumberSlider
                label="Phase speed"
                value={harmonic.phaseSpeed}
                min={-4}
                max={4}
                step={0.01}
                disabled={disabled}
                onChange={(value) =>
                  onUpdateHarmonic(harmonic.id, { phaseSpeed: value })
                }
              />
            </div>
          ))}
        </div>
      ) : null}

      {deformer.type === "sampled" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <Label
            htmlFor={`sampled-pattern-${deformer.id}`}
            className="text-xs text-muted-foreground"
          >
            Sample values
          </Label>
          <Textarea
            id={`sampled-pattern-${deformer.id}`}
            value={deformer.sampledPattern}
            rows={2}
            spellCheck={false}
            disabled={disabled}
            className="min-h-14 resize-y text-[10px]"
            onChange={(event) =>
              onChange({ sampledPattern: event.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={deformer.sampledInterpolation}
              disabled={disabled}
              onValueChange={(value) => {
                if (
                  value === "linear" ||
                  value === "smooth" ||
                  value === "cubic"
                ) {
                  onChange({ sampledInterpolation: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Deformer ${index + 1} sampled interpolation`}
              >
                <SelectValue placeholder="Interpolation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">linear</SelectItem>
                <SelectItem value="smooth">smooth</SelectItem>
                <SelectItem value="cubic">cubic</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={deformer.sampledWrap}
              disabled={disabled}
              onValueChange={(value) => {
                if (
                  value === "clamp" ||
                  value === "repeat" ||
                  value === "mirror"
                ) {
                  onChange({ sampledWrap: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={`Deformer ${index + 1} sampled wrap`}
              >
                <SelectValue placeholder="Wrap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clamp">clamp</SelectItem>
                <SelectItem value="repeat">repeat</SelectItem>
                <SelectItem value="mirror">mirror</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberSlider
            label="Frequency"
            value={deformer.sampledFrequency}
            min={0.05}
            max={32}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ sampledFrequency: value })}
          />
          <NumberSlider
            label="Phase"
            value={deformer.sampledPhase}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ sampledPhase: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.sampledPhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ sampledPhaseSpeed: value })}
          />
        </div>
      ) : null}

      {deformer.type === "noise" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <NumberSlider
            label="Seed"
            value={deformer.noiseSeed}
            min={0}
            max={10_000}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ noiseSeed: Math.round(value) })}
          />
          <NumberSlider
            label="Frequency"
            value={deformer.noiseFrequency}
            min={0.05}
            max={32}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ noiseFrequency: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.noisePhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ noisePhaseSpeed: value })}
          />
          <NumberSlider
            label="Octaves"
            value={deformer.noiseOctaves}
            min={1}
            max={8}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ noiseOctaves: Math.round(value) })}
          />
          <NumberSlider
            label="Lacunarity"
            value={deformer.noiseLacunarity}
            min={1}
            max={4}
            step={0.05}
            disabled={disabled}
            onChange={(value) => onChange({ noiseLacunarity: value })}
          />
          <NumberSlider
            label="Persistence"
            value={deformer.noisePersistence}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ noisePersistence: value })}
          />
        </div>
      ) : null}

      {deformer.type === "pulse" ? (
        <div className="space-y-2.5 border-l border-border/60 pl-3">
          <Select
            value={deformer.pulseShape}
            disabled={disabled}
            onValueChange={(value) => {
              if (
                value === "gaussian" ||
                value === "smooth" ||
                value === "triangle"
              ) {
                onChange({ pulseShape: value });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={`Deformer ${index + 1} pulse shape`}
            >
              <SelectValue placeholder="Pulse shape" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gaussian">gaussian</SelectItem>
              <SelectItem value="smooth">smooth</SelectItem>
              <SelectItem value="triangle">triangle</SelectItem>
            </SelectContent>
          </Select>
          <NumberSlider
            label="Width"
            value={deformer.pulseWidth}
            min={0.005}
            max={0.5}
            step={0.005}
            disabled={disabled}
            onChange={(value) => onChange({ pulseWidth: value })}
          />
          <NumberSlider
            label="Count"
            value={deformer.pulseCount}
            min={1}
            max={32}
            step={1}
            disabled={disabled}
            onChange={(value) => onChange({ pulseCount: Math.round(value) })}
          />
          <NumberSlider
            label="Phase"
            value={deformer.pulsePhase}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ pulsePhase: value })}
          />
          <NumberSlider
            label="Phase speed"
            value={deformer.pulsePhaseSpeed}
            min={-4}
            max={4}
            step={0.01}
            disabled={disabled}
            onChange={(value) => onChange({ pulsePhaseSpeed: value })}
          />
        </div>
      ) : null}
    </div>
  );
}
