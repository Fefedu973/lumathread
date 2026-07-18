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
import { NumberSlider } from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function FilamentSceneControls() {
  const { state, addSceneFilament, updateSceneFilament, removeSceneFilament } =
    useLabControllerContext();

  return (
    <>
      {state.sceneMode ? (
        <div className="space-y-3 border-l border-border/70 pl-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              Additional filaments {state.sceneFilaments.length}/5
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              title="Add filament"
              aria-label="Add filament"
              disabled={state.sceneFilaments.length >= 5}
              onClick={addSceneFilament}
            >
              <Plus />
            </Button>
          </div>
          {state.sceneFilaments.map((filament, index) => (
            <div
              key={filament.id}
              className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={filament.enabled}
                    onCheckedChange={(checked) =>
                      updateSceneFilament(index, {
                        enabled: checked === true,
                      })
                    }
                  />
                  Filament {index + 2}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title={`Remove filament ${index + 2}`}
                  aria-label={`Remove filament ${index + 2}`}
                  onClick={() => removeSceneFilament(index)}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={filament.pathMode}
                  onValueChange={(value) => {
                    if (
                      value === "sine" ||
                      value === "organic" ||
                      value === "custom" ||
                      value === "svg" ||
                      value === "follow"
                    ) {
                      updateSceneFilament(index, {
                        pathMode: value,
                        closed: value === "svg" ? true : filament.closed,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Filament ${index + 2} path`}
                  >
                    <SelectValue placeholder="Path" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sine">sine</SelectItem>
                    <SelectItem value="organic">organic</SelectItem>
                    <SelectItem value="custom">custom</SelectItem>
                    <SelectItem value="svg">svg</SelectItem>
                    <SelectItem value="follow">follow</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filament.quality}
                  onValueChange={(value) => {
                    if (
                      value === "auto" ||
                      value === "ultra" ||
                      value === "high" ||
                      value === "balanced" ||
                      value === "low"
                    ) {
                      updateSceneFilament(index, {
                        quality: value,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Filament ${index + 2} quality`}
                  >
                    <SelectValue placeholder="Quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">auto</SelectItem>
                    <SelectItem value="ultra">ultra</SelectItem>
                    <SelectItem value="high">high</SelectItem>
                    <SelectItem value="balanced">balanced</SelectItem>
                    <SelectItem value="low">low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={filament.motionMode}
                  onValueChange={(value) => {
                    if (
                      value === "travel" ||
                      value === "propagate" ||
                      value === "anchored"
                    ) {
                      updateSceneFilament(index, {
                        motionMode: value,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Filament ${index + 2} motion`}
                  >
                    <SelectValue placeholder="Motion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="travel">travel</SelectItem>
                    <SelectItem value="propagate">propagate</SelectItem>
                    <SelectItem value="anchored">anchored</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filament.materialPreset}
                  onValueChange={(value) => {
                    if (
                      value === "soft-aurora" ||
                      value === "mist" ||
                      value === "neon" ||
                      value === "plasma"
                    ) {
                      updateSceneFilament(index, {
                        materialPreset: value,
                      });
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Filament ${index + 2} material`}
                  >
                    <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft-aurora">soft aurora</SelectItem>
                    <SelectItem value="mist">mist</SelectItem>
                    <SelectItem value="neon">neon</SelectItem>
                    <SelectItem value="plasma">plasma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-2">
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={filament.closed}
                    disabled={
                      filament.pathMode === "sine" ||
                      filament.pathMode === "follow"
                    }
                    onCheckedChange={(checked) =>
                      updateSceneFilament(index, {
                        closed: checked === true,
                      })
                    }
                  />
                  Closed
                </Label>
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={filament.propagationEnabled}
                    onCheckedChange={(checked) =>
                      updateSceneFilament(index, {
                        propagationEnabled: checked === true,
                      })
                    }
                  />
                  Propagation
                </Label>
              </div>
              <NumberSlider
                label="Seed offset"
                value={filament.seedOffset}
                min={0}
                max={10_000}
                step={1}
                onChange={(value) =>
                  updateSceneFilament(index, { seedOffset: value })
                }
              />
              <NumberSlider
                label="Band Y"
                value={filament.waveY}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { waveY: value })
                }
              />
              <NumberSlider
                label="Shape strength"
                value={filament.shapeStrength}
                min={0}
                max={4}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    shapeStrength: value,
                  })
                }
              />
              <NumberSlider
                label="Shape scale"
                value={filament.shapeScale}
                min={0}
                max={4}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { shapeScale: value })
                }
              />
              <NumberSlider
                label="Shape frequency"
                value={filament.shapeFrequency}
                min={0.05}
                max={32}
                step={0.05}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    shapeFrequency: value,
                  })
                }
              />
              <NumberSlider
                label="Time offset"
                value={filament.timeOffset}
                min={-10}
                max={10}
                step={0.05}
                suffix="s"
                onChange={(value) =>
                  updateSceneFilament(index, { timeOffset: value })
                }
              />
              <NumberSlider
                label="Playback rate"
                value={filament.playbackRate}
                min={-3}
                max={3}
                step={0.05}
                suffix="×"
                onChange={(value) =>
                  updateSceneFilament(index, {
                    playbackRate: value,
                  })
                }
              />
              <NumberSlider
                label="Offset X"
                value={filament.offsetX}
                min={-1}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { offsetX: value })
                }
              />
              <NumberSlider
                label="Offset Y"
                value={filament.offsetY}
                min={-1}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { offsetY: value })
                }
              />
              <NumberSlider
                label="Scale X"
                value={filament.scaleX}
                min={0.1}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { scaleX: value })
                }
              />
              <NumberSlider
                label="Scale Y"
                value={filament.scaleY}
                min={0.1}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { scaleY: value })
                }
              />
              <NumberSlider
                label="Rotation"
                value={filament.rotation}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(value) =>
                  updateSceneFilament(index, { rotation: value })
                }
              />
              <NumberSlider
                label="Envelope travel"
                value={filament.curveTravel}
                min={-1}
                max={1}
                step={0.005}
                onChange={(value) =>
                  updateSceneFilament(index, { curveTravel: value })
                }
              />
              <NumberSlider
                label="Shape morph"
                value={filament.curveMotion}
                min={0}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { curveMotion: value })
                }
              />
              <NumberSlider
                label="Filament length"
                value={filament.segmentLength}
                min={0.05}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    segmentLength: value,
                  })
                }
              />
              <NumberSlider
                label="Tail taper"
                value={filament.tailTaper}
                min={0.001}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { tailTaper: value })
                }
              />
              <NumberSlider
                label="Head taper"
                value={filament.headTaper}
                min={0.001}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { headTaper: value })
                }
              />
              <NumberSlider
                label="Profile width"
                value={filament.profileWidth}
                min={0.05}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    profileWidth: value,
                  })
                }
              />
              <NumberSlider
                label="Profile opacity"
                value={filament.profileOpacity}
                min={0}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    profileOpacity: value,
                  })
                }
              />
              <NumberSlider
                label="Profile glow"
                value={filament.profileGlow}
                min={0.05}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { profileGlow: value })
                }
              />
              <NumberSlider
                label="Profile reflection"
                value={filament.profileReflection}
                min={0}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    profileReflection: value,
                  })
                }
              />
              <NumberSlider
                label="Intensity"
                value={filament.intensity}
                min={0}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { intensity: value })
                }
              />
              <NumberSlider
                label="Glow"
                value={filament.glow}
                min={0.05}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { glow: value })
                }
              />
              <NumberSlider
                label="Exposure"
                value={filament.exposure}
                min={0.1}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { exposure: value })
                }
              />
              <NumberSlider
                label="Saturation"
                value={filament.saturation}
                min={0}
                max={3}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, { saturation: value })
                }
              />
              <NumberSlider
                label="Upper glow spread"
                value={filament.upperGlowSpread}
                min={0.05}
                max={4}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    upperGlowSpread: value,
                  })
                }
              />
              <NumberSlider
                label="Lower glow spread"
                value={filament.lowerGlowSpread}
                min={0.05}
                max={4}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    lowerGlowSpread: value,
                  })
                }
              />
              <NumberSlider
                label="Glow asymmetry"
                value={filament.glowAsymmetry}
                min={-1}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    glowAsymmetry: value,
                  })
                }
              />
              <NumberSlider
                label="Hue"
                value={filament.hue}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(value) => updateSceneFilament(index, { hue: value })}
              />
              <NumberSlider
                label="Palette flow"
                value={filament.paletteSpeed}
                min={-3}
                max={3}
                step={0.05}
                onChange={(value) =>
                  updateSceneFilament(index, {
                    paletteSpeed: value,
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
