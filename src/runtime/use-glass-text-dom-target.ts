import { useEffect, useMemo, useState, type RefObject } from "react";
import type { HeroWaveGlassTextConfig } from "../types";
import {
  applyGlassTextDomSnapshot,
  measureGlassTextDomTarget,
  resolveGlassTextDomTarget,
  sameGlassTextDomSnapshot,
  type GlassTextDomSnapshot,
} from "../dom/glass-text-target";

export function useGlassTextDomTarget(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  config: HeroWaveGlassTextConfig | undefined,
) {
  const [snapshot, setSnapshot] = useState<GlassTextDomSnapshot | null>(null);
  const dom = config?.dom;
  const target = dom?.target;
  const paddingX =
    typeof dom?.padding === "number" ? dom.padding : dom?.padding?.x;
  const paddingY =
    typeof dom?.padding === "number" ? dom.padding : dom?.padding?.y;

  useEffect(() => {
    if (!config?.enabled || config.shape === "svg" || !dom || !target) {
      setSnapshot((current) => (current === null ? current : null));
      return;
    }

    let frame = 0;
    let observedElement: HTMLElement | null = null;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => scheduleMeasure());
    const elementObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => scheduleMeasure());

    const observeElement = (element: HTMLElement | null) => {
      if (element === observedElement) return;
      if (observedElement) {
        resizeObserver?.unobserve(observedElement);
        elementObserver?.disconnect();
      }
      observedElement = element;
      if (!element) return;
      resizeObserver?.observe(element);
      elementObserver?.observe(element, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
        attributeFilter: ["class", "style", "aria-label"],
      });
    };

    const measure = () => {
      frame = 0;
      const canvas = canvasRef.current;
      const element = resolveGlassTextDomTarget(target);
      observeElement(element);
      const next =
        canvas && element
          ? measureGlassTextDomTarget(canvas, element, dom)
          : null;
      setSnapshot((current) =>
        sameGlassTextDomSnapshot(current, next) ? current : next,
      );
    };

    function scheduleMeasure() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    const canvas = canvasRef.current;
    if (canvas) resizeObserver?.observe(canvas);
    const targetCanBeReplaced =
      typeof target === "string" ||
      (typeof target === "object" && "current" in target);
    const documentObserver =
      !targetCanBeReplaced ||
      typeof MutationObserver === "undefined" ||
      !document.body
        ? null
        : new MutationObserver(scheduleMeasure);
    documentObserver?.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    document.fonts?.addEventListener?.("loadingdone", scheduleMeasure);
    void document.fonts?.ready.then(scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      elementObserver?.disconnect();
      documentObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      document.fonts?.removeEventListener?.("loadingdone", scheduleMeasure);
    };
  }, [canvasRef, config?.enabled, config?.shape, paddingX, paddingY, target]);

  return useMemo(
    () => (config?.dom ? applyGlassTextDomSnapshot(config, snapshot) : config),
    [config, snapshot],
  );
}
