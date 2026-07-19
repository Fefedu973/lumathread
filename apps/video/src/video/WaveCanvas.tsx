import {
  HeroWaveBackground,
  type HeroWaveBackgroundProps,
} from "@lumathread/hero-wave-background";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "remotion";

export function WaveCanvas({
  time,
  label,
  style,
  fadeInDuration = 0,
  ...props
}: HeroWaveBackgroundProps & {
  time: number;
  label: string;
  style?: CSSProperties;
}) {
  const [handle] = useState(() => delayRender(`wave:${label}`));
  const released = useRef(false);
  const release = useCallback(() => {
    if (released.current) return;
    released.current = true;
    continueRender(handle);
  }, [handle]);

  useEffect(() => {
    const timeout = window.setTimeout(release, 8000);
    return () => {
      window.clearTimeout(timeout);
      release();
    };
  }, [release]);

  return (
    <HeroWaveBackground
      {...props}
      time={time}
      paused
      respectReducedMotion={false}
      pauseWhenOffscreen={false}
      // The built-in reveal is a CSS transition; index.css disables all
      // transitions for deterministic rendering, so scenes that want the fade
      // mirror the same duration/easing with a frame-driven wrapper opacity.
      fadeInDuration={fadeInDuration}
      onReady={release}
      onRendererError={release}
      onRendererStatus={(status) => {
        if (!status.supported) release();
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }}
    />
  );
}
