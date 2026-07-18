import type { ReactNode } from "react";
import { cn } from "@site/lib/utils";
import { LazyMount } from "./lazy-mount";

/**
 * Frame for a live renderer demo. The renderer fills the stage (it positions
 * itself absolutely), children are optional overlay content, and the whole
 * canvas only mounts while the stage is near the viewport so the page never
 * exceeds the browser's WebGL context budget.
 */
export function DemoStage({
  renderer,
  children,
  className,
  stageClassName,
}: {
  /** The live <HeroWaveBackground>/<HeroWaveScene> element. */
  renderer: ReactNode;
  /** Optional overlay content, rendered above the canvas. */
  children?: ReactNode;
  className?: string;
  stageClassName?: string;
}) {
  return (
    <LazyMount
      className={cn(
        "h-64 overflow-hidden rounded-xl border bg-white dark:bg-[#04060a]",
        className,
      )}
      placeholder={
        <div className="absolute inset-0 animate-pulse bg-muted/40" />
      }
    >
      <div className={cn("absolute inset-0", stageClassName)}>
        {renderer}
        {children}
      </div>
    </LazyMount>
  );
}
