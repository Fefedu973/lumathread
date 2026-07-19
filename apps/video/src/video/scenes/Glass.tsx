import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp, colors, fadeUp, FPS, SceneTag, Surface } from "../kit";
import { glassPreset } from "../presets";
import { WaveCanvas } from "../WaveCanvas";

export function GlassScene() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <SceneTag index="02" text="REFRACTIVE MASKS" frame={frame} />
      <div
        style={{
          position: "absolute",
          left: 108,
          top: 270,
          width: 570,
          fontSize: 132,
          fontWeight: 800,
          letterSpacing: -6,
          lineHeight: 0.92,
          ...fadeUp(frame, 4, 13, 50),
        }}
      >
        REFRACT
        <br />
        <span style={{ color: colors.muted }}>THE LIGHT.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 680,
          width: 520,
          color: colors.muted,
          fontSize: 29,
          lineHeight: 1.42,
          ...fadeUp(frame, 12, 13, 30),
        }}
      >
        Text or SVG masks sample the rendered scene with volumetric glass,
        chromatic split and edge wrap.
      </div>

      <div
        style={{
          position: "absolute",
          left: 720,
          top: 170,
          width: 1100,
          height: 760,
          opacity: clamp(frame, [4, 16], [0, 1]),
          transform: `translateY(${clamp(frame, [4, 22], [60, 0])}px)`,
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
          <WaveCanvas {...glassPreset} time={frame / FPS} label="glass" />
          <div
            style={{
              position: "absolute",
              right: 24,
              bottom: 22,
              display: "flex",
              gap: 10,
            }}
          >
            {["volumetric", "dome", "same canvas"].map((label) => (
              <span
                key={label}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${colors.line}`,
                  background: "rgba(5,7,10,.72)",
                  color: colors.muted,
                  fontSize: 17,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </Surface>
      </div>
    </AbsoluteFill>
  );
}
