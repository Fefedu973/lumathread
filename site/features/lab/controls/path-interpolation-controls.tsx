"use client";

import { PenLine } from "lucide-react";
import { Button } from "@site/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/features/lab/controls/lab-select";
import { useLabControllerContext } from "../lab-controller-context";

export function PathInterpolationControls() {
  const { state, setState, showPathEditor, setShowPathEditor } =
    useLabControllerContext();

  if (state.pathMode !== "custom" || state.textMode) return null;

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Select
        value={state.interpolation}
        onValueChange={(value) => {
          if (
            value === "linear" ||
            value === "catmull-rom" ||
            value === "centripetal-catmull-rom" ||
            value === "bezier"
          ) {
            setState((previous) => ({
              ...previous,
              interpolation: value,
            }));
          }
        }}
      >
        <SelectTrigger size="sm" aria-label="Path interpolation">
          <SelectValue placeholder="Interpolation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="linear">linear</SelectItem>
          <SelectItem value="catmull-rom">catmull-rom</SelectItem>
          <SelectItem value="centripetal-catmull-rom">centripetal</SelectItem>
          <SelectItem value="bezier">bezier</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={showPathEditor ? "secondary" : "outline"}
        size="icon-sm"
        title="Edit path points"
        aria-label="Edit path points"
        onClick={() => setShowPathEditor((value) => !value)}
      >
        <PenLine />
      </Button>
    </div>
  );
}
