import type { HeroTrajectoryPoint } from "@lumathread/hero-wave-background";
import { getHeroTrajectoryVerticalScale } from "@lumathread/hero-wave-background";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp, colors, Cursor, fadeUp, FPS, SceneTag, Surface } from "../kit";
import { INTERACTION_SHAPE, interactionPreset } from "../presets";
import { WaveCanvas } from "../WaveCanvas";

const PANEL = { left: 250, top: 340, width: 1420, height: 560 };

const INTERACTION_VERTICAL_SCALE = getHeroTrajectoryVerticalScale(
  INTERACTION_SHAPE.scale,
  INTERACTION_SHAPE.strength,
);

/**
 * The renderer places a point at `waveY - y * verticalScale` measured from the
 * top, so screen space converts back with that same sign. Inverting it mirrors
 * the filament against the drawn cursor.
 */
function pointerAt(progress: number) {
  const x = 0.08 + progress * 0.84;
  const screenY =
    0.5 +
    Math.sin(progress * Math.PI * 2.3) * 0.17 +
    Math.sin(progress * Math.PI * 5.1 + 0.6) * 0.035;
  return {
    x,
    screenY,
    pathY: (INTERACTION_SHAPE.waveY - screenY) / INTERACTION_VERTICAL_SCALE,
  };
}

function trailAt(frame: number): readonly HeroTrajectoryPoint[] {
  const progress = Math.min(1, Math.max(0.015, frame / 112));
  const memory = 0.38;
  return Array.from({ length: 24 }, (_, index) => {
    const sampleProgress = Math.max(
      0,
      progress - memory + (memory * index) / 23,
    );
    const point = pointerAt(sampleProgress);
    return {
      id: `trail-${index}`,
      x: point.x,
      y: point.pathY,
      speed: 1,
    };
  });
}

export function InteractionScene() {
  const frame = useCurrentFrame();
  const progress = Math.min(1, Math.max(0, frame / 112));
  const pointer = pointerAt(progress);
  const points = trailAt(frame);

  return (
    <AbsoluteFill>
      <SceneTag index="03" text="INTERACTION" frame={frame} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 108,
          textAlign: "center",
          fontSize: 122,
          fontWeight: 800,
          letterSpacing: -6,
          ...fadeUp(frame, 2, 13, 46),
        }}
      >
        THE CANVAS RESPONDS.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 255,
          textAlign: "center",
          color: colors.muted,
          fontSize: 34,
          ...fadeUp(frame, 8, 13, 30),
        }}
      >
        Cursor trails, dot lenses and propagating filament ripples.
      </div>

      <div
        style={{
          position: "absolute",
          left: PANEL.left,
          top: PANEL.top,
          width: PANEL.width,
          height: PANEL.height,
          ...fadeUp(frame, 6, 14, 60),
        }}
      >
        <Surface
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <WaveCanvas
            {...interactionPreset(points)}
            time={frame / FPS}
            label="interaction"
          />
          <div
            style={{
              position: "absolute",
              left: 24,
              top: 22,
              padding: "9px 13px",
              borderRadius: 9,
              border: `1px solid ${colors.line}`,
              background: "rgba(5,7,10,.72)",
              color: colors.muted,
              fontFamily: "ui-monospace, monospace",
              fontSize: 18,
            }}
          >
            interaction.follow.mode ={" "}
            <span style={{ color: colors.text }}>&quot;cascade&quot;</span>
          </div>
        </Surface>
      </div>
      <Cursor
        x={PANEL.left + pointer.x * PANEL.width}
        y={PANEL.top + pointer.screenY * PANEL.height}
        pressed={frame > 26 && frame < 34}
        opacity={clamp(frame, [8, 15], [0, 1])}
      />
    </AbsoluteFill>
  );
}
