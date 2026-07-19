import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { BrandMark, clamp, colors, fadeUp, FPS, Pill } from "../kit";
import {
  HOOK_FADE_MS,
  heroTitleGlassPreset,
  ORBIT_PASS_SECONDS,
} from "../presets";
import { WaveCanvas } from "../WaveCanvas";

/** CSS "ease-out", the curve behind the preset's built-in `fadeInEasing`. */
const FADE_EASING = Easing.bezier(0, 0, 0.58, 1);

export function HookScene() {
  const frame = useCurrentFrame();
  const titleOpacity = clamp(frame, [10, 24], [0, 1]);
  const titleBlur = clamp(frame, [10, 28], [18, 0]);
  // The glass line lives inside the canvas and cannot scale with the DOM, so
  // the headline keeps a fixed scale and enters on opacity + blur alone.
  // Linear wave time: the arrival/wrap/departure pacing already lives in the
  // per-point `speed` values, exactly as the Open Backtest hero does it.
  const waveTime = (frame / FPS) * (ORBIT_PASS_SECONDS / (120 / FPS));
  const fadeFrames = (HOOK_FADE_MS / 1000) * FPS;

  return (
    <AbsoluteFill>
      <WaveCanvas
        {...heroTitleGlassPreset}
        time={waveTime}
        label="hero-orbit"
        style={{
          opacity: clamp(frame, [0, fadeFrames], [0, 1], FADE_EASING),
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 66,
          zIndex: 4,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          ...fadeUp(frame, 3, 12, 20),
        }}
      >
        <BrandMark size={42} />
        <span style={{ fontSize: 29, fontWeight: 720, color: colors.text }}>
          LumaThread
        </span>
        <Pill style={{ height: 38, fontSize: 17 }}>React + WebGL</Pill>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          zIndex: 3,
          width: 1600,
          transform: "translate(-50%, -50%)",
          opacity: titleOpacity,
          filter: `blur(${titleBlur}px)`,
          textAlign: "center",
          textShadow: "0 12px 60px rgba(0,0,0,.92)",
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 820,
            letterSpacing: -7,
            lineHeight: 0.94,
          }}
        >
          LIGHT THAT FOLLOWS
          <br />
          {/* The second line is drawn by the engine's refractive glassText
              (heroTitleGlassPreset); this span only reserves its layout. */}
          <span style={{ opacity: 0 }}>THE PATH YOU DEFINE.</span>
        </div>
        <div
          style={{
            marginTop: 38,
            color: colors.muted,
            fontSize: 27,
            fontWeight: 520,
            letterSpacing: 0,
          }}
        >
          A composable luminous filament renderer for React.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 70,
          zIndex: 4,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          ...fadeUp(frame, 38, 14, 18),
        }}
      >
        {["Any path", "HDR light", "Glass masks", "Pointer physics"].map(
          (label) => (
            <Pill key={label} style={{ fontSize: 17 }}>
              {label}
            </Pill>
          ),
        )}
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "radial-gradient(ellipse 52% 34% at 50% 48%, rgba(5,7,10,.28), transparent 82%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}
