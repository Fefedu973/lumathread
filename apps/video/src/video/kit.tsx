import { AudioWaveform } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { useEffect, useRef, useState } from "react";

export const FPS = 30;
export const BEAT = 15;
export const BAR = 60;
export const DURATION = 870;

export const fonts = {
  sans: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", "Cascadia Mono", monospace',
};

export const colors = {
  background: "#05070a",
  panel: "#0b0f14",
  raised: "#111720",
  line: "rgba(255,255,255,.1)",
  lineBright: "rgba(255,255,255,.18)",
  muted: "#9ca3af",
  faint: "#5f6875",
  text: "#f8fafc",
  blue: "#315bff",
  cyan: "#22d3ee",
  green: "#22f25f",
};

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  snap: Easing.bezier(0.3, 1.4, 0.4, 1),
};

export function clamp(
  frame: number,
  range: readonly number[],
  output: readonly number[],
  easing = ease.out,
) {
  return interpolate(frame, [...range], [...output], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

export function piecewise(
  frame: number,
  points: ReadonlyArray<readonly [frame: number, value: number]>,
  easing = ease.inOut,
) {
  if (frame <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [fromFrame, fromValue] = points[index - 1];
    const [toFrame, toValue] = points[index];
    if (frame <= toFrame) {
      if (fromFrame === toFrame || fromValue === toValue) return toValue;
      return interpolate(frame, [fromFrame, toFrame], [fromValue, toValue], {
        easing,
      });
    }
  }
  return points[points.length - 1][1];
}

export function fadeUp(
  frame: number,
  start: number,
  duration = 12,
  distance = 34,
): CSSProperties {
  return {
    opacity: clamp(frame, [start, start + duration], [0, 1]),
    transform: `translateY(${clamp(
      frame,
      [start, start + duration],
      [distance, 0],
    )}px)`,
    filter: `blur(${clamp(frame, [start, start + duration], [10, 0])}px)`,
  };
}

export function useFontsReady() {
  const [handle] = useState(() => delayRender("video-fonts"));
  const released = useRef(false);

  useEffect(() => {
    const release = () => {
      if (released.current) return;
      released.current = true;
      continueRender(handle);
    };
    document.fonts.ready.then(release, release);
    return release;
  }, [handle]);
}

export function Surface({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${colors.line}`,
        background:
          "linear-gradient(160deg, rgba(17,23,32,.96) 0%, rgba(7,10,14,.96) 100%)",
        boxShadow:
          "0 40px 110px rgba(0,0,0,.5), inset 0 1px rgba(255,255,255,.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function WindowDots() {
  return (
    <div style={{ display: "flex", gap: 9 }}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: "#343b45",
          }}
        />
      ))}
    </div>
  );
}

export function BrowserWindow({
  width,
  url = "lumathread.dev",
  children,
  style,
}: {
  width: number;
  url?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Surface
      style={{ position: "relative", width, overflow: "hidden", ...style }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 62,
          paddingInline: 24,
          borderBottom: `1px solid ${colors.line}`,
          background: "rgba(255,255,255,.025)",
        }}
      >
        <WindowDots />
        <div
          style={{
            position: "absolute",
            insetInline: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              maxWidth: width - 180,
              overflow: "hidden",
              padding: "6px 18px",
              borderRadius: 8,
              border: `1px solid ${colors.line}`,
              background: "rgba(5,7,10,.72)",
              color: colors.muted,
              fontFamily: fonts.mono,
              fontSize: 17,
              letterSpacing: 0,
              whiteSpace: "nowrap",
            }}
          >
            {url}
          </span>
        </div>
      </div>
      {children}
    </Surface>
  );
}

export function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <span
      style={{
        display: "grid",
        width: size,
        height: size,
        placeItems: "center",
        borderRadius: size * 0.26,
        background: colors.text,
        color: colors.background,
        boxShadow: "0 10px 34px rgba(255,255,255,.14)",
      }}
    >
      <AudioWaveform size={size * 0.58} strokeWidth={2.5} />
    </span>
  );
}

export function Pill({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: 42,
        paddingInline: 17,
        borderRadius: 999,
        border: `1px solid ${colors.line}`,
        background: "rgba(12,16,22,.82)",
        color: colors.muted,
        fontSize: 19,
        fontWeight: 600,
        letterSpacing: 0,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function SceneTag({
  index,
  text,
  frame,
}: {
  index: string;
  text: string;
  frame: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        top: 66,
        display: "flex",
        alignItems: "center",
        gap: 16,
        color: colors.muted,
        fontSize: 23,
        fontWeight: 700,
        letterSpacing: 3,
        ...fadeUp(frame, 2, 10, 18),
      }}
    >
      <span style={{ color: colors.text }}>{index}</span>
      <span style={{ width: 46, height: 1, background: colors.faint }} />
      {text}
    </div>
  );
}

export function AmbientBackground() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill aria-hidden>
      <div
        style={{
          position: "absolute",
          inset: -80,
          opacity: 0.2,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: `translate(${interpolate(frame, [0, DURATION], [0, -72])}px, ${interpolate(frame, [0, DURATION], [0, -36])}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -240,
          right: -240,
          top: 150,
          height: 2,
          opacity: 0.18,
          background:
            "linear-gradient(90deg, transparent, #315bff 25%, #22d3ee 52%, #22f25f 76%, transparent)",
          filter: "blur(24px)",
          transform: `translateY(${Math.sin(frame / 100) * 120}px) rotate(-8deg)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function Vignette() {
  return (
    <AbsoluteFill
      aria-hidden
      style={{
        background:
          "radial-gradient(ellipse 74% 65% at 50% 44%, transparent 58%, rgba(0,0,0,.48) 100%)",
        pointerEvents: "none",
      }}
    />
  );
}

export function Cursor({
  x,
  y,
  pressed = false,
  opacity = 1,
}: {
  x: number;
  y: number;
  pressed?: boolean;
  opacity?: number;
}) {
  return (
    <svg
      width={34}
      height={40}
      viewBox="0 0 17 20"
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 80,
        opacity,
        pointerEvents: "none",
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,.55))",
        transform: `scale(${pressed ? 0.82 : 1})`,
        transformOrigin: "2px 2px",
      }}
    >
      <path
        d="M1.5 1.5 L1.5 15.2 L5.4 11.7 L7.9 17.4 L10.6 16.2 L8.1 10.6 L13.3 10.2 Z"
        fill="#fafafa"
        stroke="#18181b"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SceneShell({
  duration,
  out = "full",
  children,
}: {
  duration: number;
  out?: "full" | "fade" | "none";
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const inScale = clamp(frame, [0, 9], [1.055, 1]);
  const inY = clamp(frame, [0, 9], [26, 0]);
  const opacityIn = clamp(frame, [0, 5], [0, 1]);
  const outStart = duration - 7;
  const opacityOut =
    out === "none"
      ? 1
      : clamp(frame, [outStart, duration - 1], [1, 0], ease.inOut);
  const outScale =
    out === "full"
      ? clamp(frame, [outStart, duration - 1], [1, 0.965], ease.inOut)
      : 1;
  const outY =
    out === "full"
      ? clamp(frame, [outStart, duration - 1], [0, -18], ease.inOut)
      : 0;

  return (
    <AbsoluteFill
      style={{
        opacity: opacityIn * opacityOut,
        transform: `translateY(${inY + outY}px) scale(${inScale * outScale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function CutFlashes({ cuts }: { cuts: readonly number[] }) {
  const frame = useCurrentFrame();
  const strength = cuts.reduce((value, cut) => {
    if (frame < cut || frame > cut + 3) return value;
    return Math.max(value, interpolate(frame, [cut, cut + 3], [0.055, 0]));
  }, 0);
  if (strength <= 0) return null;

  return (
    <AbsoluteFill
      aria-hidden
      style={{
        zIndex: 90,
        opacity: strength,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(255,255,255,.75), rgba(255,255,255,.2) 55%, transparent)",
      }}
    />
  );
}

export function ProgressRail() {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        zIndex: 100,
        width: `${interpolate(frame, [0, DURATION - 1], [0, 100])}%`,
        height: 3,
        background:
          "linear-gradient(90deg, #315bff 0%, #22d3ee 55%, #22f25f 100%)",
        boxShadow: "0 0 18px rgba(34,211,238,.35)",
      }}
    />
  );
}
