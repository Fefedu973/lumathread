import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shadcn-style keyboard focus for plain links and custom interactive
 * elements — components/ui primitives already draw their own ring.
 * Pair with a radius (rounded-xs…) so the ring hugs the element.
 */
export const focusRing =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
