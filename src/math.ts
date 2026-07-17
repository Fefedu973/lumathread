export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

export function finiteClamped(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  return clamp(finite(value, fallback), minimum, maximum);
}
