import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@site/lib/utils";

/**
 * Mounts children only while the container is near the viewport and unmounts
 * them again once it scrolls far away. Every live demo owns a WebGL context,
 * and browsers cap concurrent contexts (~8-16), so a page full of renderers
 * must keep only the visible ones alive.
 */
export function LazyMount({
  children,
  className,
  placeholder,
  rootMargin = "25% 0px 25% 0px",
}: {
  children: ReactNode;
  className?: string;
  placeholder?: ReactNode;
  rootMargin?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {visible ? children : placeholder}
    </div>
  );
}
