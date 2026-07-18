import { useEffect, useRef, useState } from "react";
import type { HeroWaveRendererStatus } from "@/hero-wave-background";

export function useRendererMetrics() {
  const [rendererStatus, setRendererStatus] =
    useState<HeroWaveRendererStatus | null>(null);
  const [rendererFps, setRendererFps] = useState(0);
  const frameStatsRef = useRef({ count: 0, startedAt: 0, lastFrameAt: 0 });

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        frameStatsRef.current.lastFrameAt > 0 &&
        performance.now() - frameStatsRef.current.lastFrameAt > 900
      ) {
        setRendererFps(0);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const handleRendererFrame = () => {
    const now = performance.now();
    const stats = frameStatsRef.current;
    if (stats.startedAt === 0) stats.startedAt = now;
    stats.count += 1;
    stats.lastFrameAt = now;
    const elapsed = now - stats.startedAt;
    if (elapsed < 500) return;
    setRendererFps((stats.count * 1000) / elapsed);
    stats.count = 0;
    stats.startedAt = now;
  };

  const statusLabel = rendererStatus
    ? `${rendererStatus.renderer}${rendererStatus.approximate ? " · approx." : ""}`
    : "initializing";

  return {
    rendererStatus,
    setRendererStatus,
    rendererFps,
    setRendererFps,
    frameStatsRef,
    handleRendererFrame,
    statusLabel,
  } as const;
}
