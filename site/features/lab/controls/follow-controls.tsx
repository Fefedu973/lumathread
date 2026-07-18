"use client";
import {
  ControlGroup,
  FieldRow,
  NumberSlider,
  Segmented,
  SelectField,
  SwitchField,
} from "@site/features/lab/controls/common-controls";
import { useLabControllerContext } from "@site/features/lab/lab-controller-context";

export function FollowControls() {
  const { state, setState, viewportSize } = useLabControllerContext();

  const set = <Key extends keyof typeof state>(
    key: Key,
    value: (typeof state)[Key],
  ) => setState((previous) => ({ ...previous, [key]: value }));

  return (
    <>
      <FieldRow label="Mode">
        <Segmented
          ariaLabel="Follow mode"
          value={state.followMode}
          options={[
            { value: "hybrid", label: "Hybrid" },
            { value: "cascade", label: "Cascade" },
            { value: "echo", label: "Echo" },
          ]}
          onChange={(followMode) => set("followMode", followMode)}
        />
      </FieldRow>

      <NumberSlider
        label="Head response"
        value={state.followHeadResponse}
        min={0.05}
        max={1}
        step={0.01}
        onChange={(value) => set("followHeadResponse", value)}
      />

      {state.followMode === "hybrid" ? (
        <>
          <NumberSlider
            label="Hybrid drift"
            value={state.followViscosity}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => set("followViscosity", value)}
          />
          <NumberSlider
            label="Trail length"
            value={state.followLengthCssPx}
            min={100}
            max={4000}
            step={25}
            suffix="px"
            onChange={(value) => set("followLengthCssPx", value)}
          />
        </>
      ) : null}

      {state.followMode === "cascade" ? (
        <NumberSlider
          label="Cascade lag"
          value={state.followCascadeLag}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) => set("followCascadeLag", value)}
        />
      ) : null}

      {state.followMode === "echo" ? (
        <>
          <NumberSlider
            label="Echo memory"
            value={state.followMemorySeconds}
            min={0.05}
            max={4}
            step={0.05}
            suffix="s"
            onChange={(value) => set("followMemorySeconds", value)}
          />
          <FieldRow label="When stationary">
            <SelectField
              ariaLabel="Echo stationary behavior"
              className="w-40"
              value={state.followStationaryBehavior}
              options={[
                { value: "collapse", label: "Collapse along trail" },
                { value: "freeze", label: "Freeze trail" },
              ]}
              onChange={(value) => set("followStationaryBehavior", value)}
            />
          </FieldRow>
          {state.followStationaryBehavior === "collapse" ? (
            <NumberSlider
              label="Collapse duration"
              value={state.followStationaryCollapseDuration}
              min={0.1}
              max={8}
              step={0.05}
              suffix="s"
              onChange={(value) =>
                set("followStationaryCollapseDuration", value)
              }
            />
          ) : null}
        </>
      ) : null}

      <ControlGroup title="Pointer" detail="input source" muted collapsible>
        <FieldRow label="Target">
          <SelectField
            ariaLabel="Follow target"
            className="w-32"
            value={state.followTarget}
            disabled={
              state.followExternalEnabled ||
              state.followActivation !== "path-mode"
            }
            options={[
              { value: "window", label: "Window" },
              { value: "canvas", label: "Canvas" },
            ]}
            onChange={(value) => set("followTarget", value)}
          />
        </FieldRow>
        {(
          [
            ["Mouse", "followPointerMouse"],
            ["Pen", "followPointerPen"],
            ["Touch", "followPointerTouch"],
          ] as const
        ).map(([label, key]) => (
          <SwitchField
            key={key}
            label={label}
            checked={state[key]}
            disabled={state.followExternalEnabled}
            onChange={(checked) => set(key, checked)}
          />
        ))}
        <SwitchField
          label="External position"
          hint="Drive the pointer programmatically."
          checked={state.followExternalEnabled}
          onChange={(checked) => set("followExternalEnabled", checked)}
        />
        {state.followExternalEnabled ? (
          <>
            <FieldRow label="Space">
              <SelectField
                ariaLabel="External position space"
                className="w-36"
                value={state.followExternalSpace}
                options={[
                  { value: "normalized", label: "Normalized" },
                  { value: "client", label: "Client pixels" },
                ]}
                onChange={(value) =>
                  setState((previous) => ({
                    ...previous,
                    followExternalSpace: value,
                    followExternalX:
                      value === "normalized" ? 0.5 : viewportSize.width / 2,
                    followExternalY:
                      value === "normalized" ? 0.5 : viewportSize.height / 2,
                  }))
                }
              />
            </FieldRow>
            <NumberSlider
              label="External X"
              value={state.followExternalX}
              min={0}
              max={
                state.followExternalSpace === "normalized"
                  ? 1
                  : viewportSize.width
              }
              step={state.followExternalSpace === "normalized" ? 0.01 : 1}
              onChange={(value) => set("followExternalX", value)}
            />
            <NumberSlider
              label="External Y"
              value={state.followExternalY}
              min={0}
              max={
                state.followExternalSpace === "normalized"
                  ? 1
                  : viewportSize.height
              }
              step={state.followExternalSpace === "normalized" ? 0.01 : 1}
              onChange={(value) => set("followExternalY", value)}
            />
          </>
        ) : null}
      </ControlGroup>

      <ControlGroup title="On leave" detail="pointer exits" muted collapsible>
        <FieldRow label="Behaviour">
          <SelectField
            ariaLabel="Leave behavior"
            className="w-32"
            value={state.followLeaveBehavior}
            options={[
              { value: "freeze", label: "Freeze" },
              { value: "collapse", label: "Collapse" },
              { value: "idle", label: "Idle orbit" },
              { value: "fade", label: "Fade" },
            ]}
            onChange={(value) => set("followLeaveBehavior", value)}
          />
        </FieldRow>
        <NumberSlider
          label="Leave fade"
          value={state.followFadeDuration}
          min={0.05}
          max={3}
          step={0.05}
          suffix="s"
          disabled={state.followLeaveBehavior !== "fade"}
          onChange={(value) => set("followFadeDuration", value)}
        />
        <NumberSlider
          label="Idle delay"
          value={state.followIdleDelay}
          min={0}
          max={3}
          step={0.05}
          suffix="s"
          disabled={
            state.followLeaveBehavior !== "idle" &&
            state.followLeaveBehavior !== "fade"
          }
          onChange={(value) => set("followIdleDelay", value)}
        />
        {state.followLeaveBehavior === "idle" ? (
          <>
            <NumberSlider
              label="Idle radius X"
              value={state.followIdleRadiusX}
              min={0}
              max={500}
              step={5}
              suffix="px"
              onChange={(value) => set("followIdleRadiusX", value)}
            />
            <NumberSlider
              label="Idle radius Y"
              value={state.followIdleRadiusY}
              min={0}
              max={500}
              step={5}
              suffix="px"
              onChange={(value) => set("followIdleRadiusY", value)}
            />
            <NumberSlider
              label="Idle speed X"
              value={state.followIdleSpeedX}
              min={-3}
              max={3}
              step={0.05}
              onChange={(value) => set("followIdleSpeedX", value)}
            />
            <NumberSlider
              label="Idle speed Y"
              value={state.followIdleSpeedY}
              min={-3}
              max={3}
              step={0.05}
              onChange={(value) => set("followIdleSpeedY", value)}
            />
          </>
        ) : null}
      </ControlGroup>

      <ControlGroup
        title="Velocity response"
        detail="per visual channel"
        muted
        collapsible
        defaultOpen={false}
      >
        {(
          [
            ["Intensity", "followVelocityIntensity", -1, 1, 0.01, undefined],
            ["Width", "followVelocityWidth", -1, 1, 0.01, undefined],
            ["Glow", "followVelocityGlow", -1, 1, 0.01, undefined],
            ["Hue", "followVelocityHue", -180, 180, 1, "°"],
            ["Reflection", "followVelocityReflection", -1, 1, 0.01, undefined],
            ["Response", "followVelocityResponse", 0.1, 60, 0.5, undefined],
            [
              "Velocity ceiling",
              "followMaxVelocityCssPx",
              100,
              5000,
              50,
              "px/s",
            ],
          ] as const
        ).map(([label, key, min, max, step, suffix]) => (
          <NumberSlider
            key={key}
            label={label}
            value={state[key]}
            min={min}
            max={max}
            step={step}
            suffix={suffix}
            onChange={(value) => set(key, value)}
          />
        ))}
      </ControlGroup>
    </>
  );
}
