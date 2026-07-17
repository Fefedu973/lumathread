import { describe, expect, test } from "bun:test";
import { clamp, finite, finiteClamped } from "../math";

describe("numeric helpers", () => {
  test("clamp preserves values inside the range", () => {
    expect(clamp(0.35, 0, 1)).toBe(0.35);
  });

  test("clamp applies both bounds", () => {
    expect(clamp(-4, -2, 3)).toBe(-2);
    expect(clamp(8, -2, 3)).toBe(3);
  });

  test("finite keeps finite values and replaces invalid values", () => {
    expect(finite(0, 7)).toBe(0);
    expect(finite(Number.NaN, 7)).toBe(7);
    expect(finite(Number.POSITIVE_INFINITY, 7)).toBe(7);
    expect(finite(undefined, 7)).toBe(7);
  });

  test("finiteClamped applies fallback before clamping", () => {
    expect(finiteClamped(Number.NaN, 12, 0, 10)).toBe(10);
    expect(finiteClamped(-3, 4, 0, 10)).toBe(0);
  });
});
