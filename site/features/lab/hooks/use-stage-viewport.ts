import { useEffect, useRef, useState } from "react";

export function useStageViewport() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateViewportSize = () => {
      const rect = stage.getBoundingClientRect();
      setViewportSize({
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
    };

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(stage);
    updateViewportSize();
    return () => observer.disconnect();
  }, []);

  return { stageRef, viewportSize } as const;
}
