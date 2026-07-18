"use client";

import { MousePointer2, PenLine } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HeroWaveBackground, HeroWaveScene } from "@/hero-wave-background";
import { cn } from "@site/lib/utils";
import { useLabControllerContext } from "../lab-controller-context";

export function LabStage() {
  const {
    state,
    showContent,
    showPathEditor,
    showMaskGuides,
    selectedPoint,
    setSelectedPoint,
    viewportSize,
    renderEpoch,
    stageRef,
    waveRef,
    backgroundProps,
    sceneFilaments,
    sceneActive,
    verticalScale,
    editorPath,
    updatePointPosition,
    updateMaskFromPointer,
    commonCallbacks,
    lightTheme,
  } = useLabControllerContext();

  const editorActive =
    (showPathEditor && state.pathMode === "custom" && !state.textMode) ||
    showMaskGuides;

  return (
    <div ref={stageRef} className="absolute inset-0 overflow-hidden">
      {sceneActive ? (
        <HeroWaveScene
          key={`scene-${renderEpoch}`}
          ref={waveRef}
          {...backgroundProps}
          {...commonCallbacks}
          filaments={sceneFilaments}
        />
      ) : (
        <HeroWaveBackground
          key={`wave-${renderEpoch}`}
          ref={waveRef}
          {...backgroundProps}
          {...commonCallbacks}
        />
      )}

      {showMaskGuides ? (
        <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
          {state.dotMasks.map((mask, index) => {
            const diameter = mask.radius * viewportSize.height * 2;
            const pointerHandlers = (mode: "center" | "radius") => ({
              onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                updateMaskFromPointer(
                  index,
                  mode,
                  event.clientX,
                  event.clientY,
                );
              },
              onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                updateMaskFromPointer(
                  index,
                  mode,
                  event.clientX,
                  event.clientY,
                );
              },
              onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              },
            });
            return (
              <div
                key={mask.id}
                className="absolute rounded-full border border-cyan-300/50 bg-cyan-300/3"
                style={{
                  left: `${mask.x * 100}%`,
                  top: `${(1 - mask.y) * 100}%`,
                  width: diameter,
                  height: diameter,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <button
                  type="button"
                  className="pointer-events-auto absolute top-1/2 left-1/2 grid size-6 -translate-1/2 cursor-move place-items-center rounded-full border border-cyan-100 bg-black/85 font-mono text-[10px] text-cyan-100 shadow-[0_0_14px_rgb(34_211_238/0.55)] outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  aria-label={`Move dot mask ${index + 1}`}
                  title={`Move mask ${index + 1}`}
                  {...pointerHandlers("center")}
                >
                  {index + 1}
                </button>
                <button
                  type="button"
                  className="pointer-events-auto absolute top-1/2 right-0 size-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-cyan-50 bg-cyan-400 shadow-[0_0_12px_rgb(34_211_238/0.7)] outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  aria-label={`Resize dot mask ${index + 1}`}
                  title={`Resize mask ${index + 1}`}
                  {...pointerHandlers("radius")}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {showPathEditor && state.pathMode === "custom" ? (
        <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden">
          <svg
            aria-hidden
            className="absolute inset-0 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d={`${editorPath}${state.closed ? " Z" : ""}`}
              fill="none"
              stroke="rgb(103 232 249 / 0.55)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {state.pathPoints.map((point, index) => {
            const selected = selectedPoint === index;
            const top = state.shape.waveY - point.y * verticalScale;
            return (
              <button
                key={point.id}
                type="button"
                aria-label={`Trajectory point ${index + 1}`}
                aria-pressed={selected}
                className={cn(
                  "pointer-events-auto absolute -translate-1/2 cursor-move rounded-full border border-cyan-100 bg-cyan-400 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
                  selected
                    ? "size-5 shadow-[0_0_18px_rgb(255_255_255/0.9)] ring-2 ring-white"
                    : "size-4 shadow-[0_0_14px_rgb(34_211_238/0.7)]",
                )}
                style={{
                  left: `${point.x * 100}%`,
                  top: `${Math.min(0.98, Math.max(0.02, top)) * 100}%`,
                }}
                onPointerDown={(event) => {
                  setSelectedPoint(index);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updatePointPosition(index, event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updatePointPosition(index, event.clientX, event.clientY);
                  }
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
              />
            );
          })}
        </div>
      ) : null}

      {editorActive ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur-md",
            lightTheme
              ? "border-black/10 bg-white/80 text-black/70"
              : "border-white/10 bg-black/60 text-white/80",
          )}
        >
          {showMaskGuides ? (
            <>
              <MousePointer2 className="size-3.5" aria-hidden />
              Drag mask handles to move and resize
            </>
          ) : (
            <>
              <PenLine className="size-3.5" aria-hidden />
              Drag the points to reshape the trajectory
            </>
          )}
        </div>
      ) : null}

      {showContent ? (
        <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide backdrop-blur-sm",
              lightTheme
                ? "border-black/10 bg-white/50 text-black/60"
                : "border-white/10 bg-white/5 text-white/60",
            )}
          >
            Structured API playground
          </p>
          <h1
            id="lumathread-lab-glass-target"
            className="max-w-4xl text-4xl font-semibold tracking-tight text-balance md:text-6xl"
            style={{
              opacity:
                state.glassTextEnabled && state.glassDomTargetEnabled ? 0 : 1,
            }}
          >
            Compose light, motion and geometry.
          </h1>
          <p
            className={cn(
              "max-w-2xl text-balance",
              lightTheme ? "text-black/55" : "text-white/60",
            )}
          >
            Every parameter of the renderer, live. Paths, serializable
            deformers, longitudinal profiles, advanced palettes, cursor trails
            and shared HDR filaments in one reusable scene.
          </p>
        </div>
      ) : null}
    </div>
  );
}
