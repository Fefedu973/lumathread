import { describe, expect, test } from "bun:test";
import {
  PATH_INTEGRAL_FRAGMENT_SHADER,
  PATH_INTEGRAL_FRAGMENT_SHADERS,
} from "../rendering/shaders";

function kernelCallCount(source: string) {
  return source.match(/lineKernel\(/g)?.length ?? 0;
}

describe("HDR path shader specialization", () => {
  test("keeps the generic parity shader intact", () => {
    expect(kernelCallCount(PATH_INTEGRAL_FRAGMENT_SHADER)).toBe(7);
    expect(PATH_INTEGRAL_FRAGMENT_SHADER).toContain("uLayerMask0.x");
    expect(PATH_INTEGRAL_FRAGMENT_SHADER).toContain("uLayerMask1.y");
  });

  test("compiles only the kernels used by each render pass", () => {
    const [far, mid, core] = PATH_INTEGRAL_FRAGMENT_SHADERS;
    expect(kernelCallCount(far)).toBe(4);
    expect(kernelCallCount(mid)).toBe(3);
    expect(kernelCallCount(core)).toBe(2);

    expect(far).toContain("lineKernel(4.6");
    expect(far).toContain("4.6 * radialDistance");
    expect(far).not.toContain("lineKernel(92.0");
    expect(mid).toContain("lineKernel(20.0");
    expect(mid).toContain("20.0 * radialDistance");
    expect(mid).not.toContain("lineKernel(11.0");
    expect(core).toContain("lineKernel(92.0");
    expect(core).toContain("92.0 * radialDistance");
    expect(core).not.toContain("lineKernel(4.6");
  });

  test("removes the runtime layer-mask branch from specialized shaders", () => {
    for (const shader of PATH_INTEGRAL_FRAGMENT_SHADERS) {
      expect(shader).not.toContain("uLayerMask0.x\n    * lineKernel");
      expect(shader).not.toContain("uLayerMask1.y\n    * lineKernel");
    }
  });
});
