import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp, colors, fadeUp, FPS, SceneTag, Surface } from "../kit";
import { glyphPreset, organicPreset, sinePreset } from "../presets";
import { WaveCanvas } from "../WaveCanvas";

const MODES = [
  {
    id: "sine",
    label: "SINE",
    description: "Analytic and precise",
    preset: sinePreset,
  },
  {
    id: "organic",
    label: "ORGANIC",
    description: "Seeded and repeatable",
    preset: organicPreset,
  },
  {
    id: "svg",
    label: "SVG",
    description: "Any vector path you import",
    preset: glyphPreset,
  },
] as const;

function transitionOpacity(frame: number) {
  const distance = Math.min(Math.abs(frame - 60), Math.abs(frame - 120));
  return distance > 7 ? 1 : clamp(distance, [0, 7], [0.08, 1]);
}

export function PathsScene() {
  const frame = useCurrentFrame();
  const activeIndex = frame < 60 ? 0 : frame < 120 ? 1 : 2;
  const active = MODES[activeIndex];

  return (
    <AbsoluteFill>
      <SceneTag index="01" text="COMPOSABLE PATHS" frame={frame} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 108,
          textAlign: "center",
          fontSize: 128,
          fontWeight: 800,
          letterSpacing: -6,
          lineHeight: 0.95,
          ...fadeUp(frame, 2, 13, 46),
        }}
      >
        DRAW THE PATH.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 258,
          textAlign: "center",
          color: colors.muted,
          fontSize: 36,
          fontWeight: 500,
          ...fadeUp(frame, 8, 13, 30),
        }}
      >
        Switch geometry without changing the material.
      </div>

      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          top: 360,
          ...fadeUp(frame, 6, 14, 60),
        }}
      >
        <Surface
          style={{ position: "relative", height: 560, overflow: "hidden" }}
        >
          <div
            style={{
              opacity: transitionOpacity(frame),
              position: "absolute",
              inset: 0,
            }}
          >
            <WaveCanvas
              {...active.preset}
              time={(frame + activeIndex * 45) / FPS}
              label={`paths-${active.id}`}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 24,
              zIndex: 2,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${colors.line}`,
              background: "rgba(5,7,10,.72)",
              fontFamily: "ui-monospace, monospace",
              fontSize: 19,
              color: colors.muted,
            }}
          >
            path.mode ={" "}
            <span style={{ color: colors.text }}>&quot;{active.id}&quot;</span>
          </div>
        </Surface>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 62,
          display: "flex",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {MODES.map((mode, index) => {
          const selected = index === activeIndex;
          return (
            <div
              key={mode.id}
              style={{
                minWidth: 238,
                padding: "14px 20px",
                borderRadius: 13,
                border: `1px solid ${selected ? colors.lineBright : colors.line}`,
                background: selected ? "#151b23" : "rgba(11,15,20,.65)",
                color: selected ? colors.text : colors.faint,
              }}
            >
              <div style={{ fontSize: 21, fontWeight: 700 }}>{mode.label}</div>
              <div style={{ marginTop: 3, fontSize: 16 }}>
                {mode.description}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
