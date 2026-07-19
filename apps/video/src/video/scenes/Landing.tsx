import { BookOpen } from "lucide-react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { BrowserWindow, clamp, colors, fadeUp, FPS, Pill } from "../kit";

/**
 * Real screen recording of the Open Backtest landing page (1920×1080\@60fps).
 * It plays at natural speed while the dolly-out shows the hero light pass,
 * then accelerates quadratically so the whole 21.6s capture fits the shot.
 */
const RECORDING = "openbacktest-landing.mp4";
const MEDIA_SECONDS = 21.57;
const SCENE_FRAMES = 120;
const HOLD_FRAMES = 42;

const TAIL_SECONDS = (SCENE_FRAMES - HOLD_FRAMES) / FPS;
const HOLD_SECONDS = HOLD_FRAMES / FPS;
// Solve ∫(1 + a·u²)du over the tail so the ramp lands just before the end
// of the recording: hold + tail + a·tail³/3 = media − margin.
const ACCEL =
  ((MEDIA_SECONDS - 0.35 - HOLD_SECONDS - TAIL_SECONDS) * 3) /
  TAIL_SECONDS ** 3;

const speedAt = (frame: number) =>
  frame < HOLD_FRAMES ? 1 : 1 + ACCEL * ((frame - HOLD_FRAMES) / FPS) ** 2;

/** Accumulated media position in composition-fps frames (Remotion's
 * accelerated-video recipe: re-anchor the video each frame via `startFrom`). */
const mediaFrameAt = (frame: number) => {
  let sum = 0;
  for (let index = 0; index < frame; index += 1) {
    sum += speedAt(index);
  }
  return Math.min(sum, (MEDIA_SECONDS - 0.15) * FPS);
};

export function LandingScene() {
  const frame = useCurrentFrame();
  const scale =
    clamp(frame, [22, 78], [2.08, 1], Easing.bezier(0.5, 0, 0.15, 1)) *
    clamp(frame, [82, 120], [1, 0.988], Easing.inOut(Easing.quad));
  const center = clamp(
    frame,
    [22, 78],
    [136, 0],
    Easing.bezier(0.5, 0, 0.15, 1),
  );

  return (
    <AbsoluteFill style={{ opacity: clamp(frame, [0, 5], [0, 1]) }}>
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 46,
          width: 1780,
          height: 986,
          transformOrigin: "50% 22%",
          transform: `translateY(${center}px) scale(${scale})`,
        }}
      >
        <BrowserWindow width={1780} url="openbacktest.com">
          <div
            style={{
              position: "relative",
              height: 920,
              overflow: "hidden",
              background: colors.background,
            }}
          >
            <Sequence from={frame} layout="none">
              <OffthreadVideo
                muted
                src={staticFile(RECORDING)}
                startFrom={Math.round(mediaFrameAt(frame))}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
            </Sequence>
          </div>
        </BrowserWindow>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 42,
          display: "flex",
          justifyContent: "center",
          ...fadeUp(frame, 84, 12, 24),
        }}
      >
        <Pill style={{ height: 48, paddingInline: 22, fontSize: 20 }}>
          <BookOpen size={18} />
          <span style={{ color: colors.text, fontWeight: 700 }}>
            LumaThread in production
          </span>
          · powering the Open Backtest hero
        </Pill>
      </div>
    </AbsoluteFill>
  );
}
