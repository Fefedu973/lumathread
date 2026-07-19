import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BrandMark, clamp, colors, ease, fadeUp, fonts } from "../kit";

export function EndScene() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: clamp(frame, [0, 6], [0, 1]),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${clamp(frame, [0, 20], [0.94, 1], ease.snap)})`,
        }}
      >
        <div style={fadeUp(frame, 3, 12, 28)}>
          <BrandMark size={72} />
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: 88,
            fontWeight: 800,
            letterSpacing: -4,
            ...fadeUp(frame, 9, 12, 34),
          }}
        >
          Light, under your control.
        </div>
        <div
          style={{
            marginTop: 16,
            color: colors.muted,
            fontSize: 32,
            fontWeight: 500,
            ...fadeUp(frame, 15, 12, 26),
          }}
        >
          Install from the shadcn registry. Own every line of the renderer.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 52,
            padding: "20px 30px",
            borderRadius: 16,
            border: `1px solid ${colors.lineBright}`,
            background: "rgba(11,15,20,.88)",
            boxShadow: "0 28px 80px rgba(0,0,0,.45)",
            fontFamily: fonts.mono,
            fontSize: 22,
            ...fadeUp(frame, 22, 12, 30),
          }}
        >
          <span style={{ color: colors.faint }}>$</span>
          bunx shadcn@latest add
          https://fefedu973.github.io/lumathread/r/lumathread.json
        </div>
        <div
          style={{
            marginTop: 30,
            color: colors.faint,
            fontSize: 24,
            fontWeight: 600,
            ...fadeUp(frame, 28, 12, 22),
          }}
        >
          github.com/Fefedu973/lumathread
        </div>
      </div>
    </AbsoluteFill>
  );
}
