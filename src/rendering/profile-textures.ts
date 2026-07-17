import { clamp, finite } from "../math";
import {
  HERO_GLOW_TEXTURE_WIDTH,
  HERO_MASK_TEXTURE_HEIGHT,
  HERO_PATH_K0_LUT_WIDTH,
} from "../config/settings";
import {
  HERO_GLOW_PROFILE_MAX_DISTANCE,
  HERO_PATH_K0_MAX_ARGUMENT,
  HERO_PATH_K0_MIN_ARGUMENT,
} from "./constants";
import { MAX_HERO_DOT_MASKS, type HeroDotMask } from "../types";

export function buildGlowProfileTextureData() {
  const profile0 = new Uint8Array(HERO_GLOW_TEXTURE_WIDTH * 4);
  const profile1 = new Uint8Array(HERO_GLOW_TEXTURE_WIDTH * 4);
  const encode = (value: number) =>
    Math.round(clamp(Math.sqrt(Math.max(value, 0)), 0, 1) * 255);

  for (let index = 0; index < HERO_GLOW_TEXTURE_WIDTH; index++) {
    const distance =
      (index / (HERO_GLOW_TEXTURE_WIDTH - 1)) * HERO_GLOW_PROFILE_MAX_DISTANCE;
    const atmosphere = Math.exp(-distance * 4.6);
    const broad = Math.exp(-distance * 6.2);
    const body = Math.exp(-distance * 11);
    const ridge = Math.exp(-distance * 20);
    const core = Math.exp(-distance * 92);
    const veil = Math.exp(-distance * 25);
    const reflection = broad * 0.36 + body * 0.54 + ridge * 0.34;
    const offset = index * 4;
    profile0[offset] = encode(atmosphere);
    profile0[offset + 1] = encode(broad);
    profile0[offset + 2] = encode(body);
    profile0[offset + 3] = encode(ridge);
    profile1[offset] = encode(core);
    profile1[offset + 1] = encode(veil);
    profile1[offset + 2] = encode(reflection);
    profile1[offset + 3] = 255;
  }

  return { profile0, profile1 };
}

export let cachedGlowProfileTextureData: ReturnType<
  typeof buildGlowProfileTextureData
> | null = null;

export function getGlowProfileTextureData() {
  cachedGlowProfileTextureData ??= buildGlowProfileTextureData();
  return cachedGlowProfileTextureData;
}

export function modifiedBesselI0(value: number) {
  const x = Math.abs(value);
  if (x < 3.75) {
    const y = (x / 3.75) ** 2;
    return (
      1 +
      y *
        (3.5156229 +
          y *
            (3.0899424 +
              y *
                (1.2067492 +
                  y * (0.2659732 + y * (0.0360768 + y * 0.0045813)))))
    );
  }
  const y = 3.75 / x;
  return (
    (Math.exp(x) / Math.sqrt(x)) *
    (0.39894228 +
      y *
        (0.01328592 +
          y *
            (0.00225319 +
              y *
                (-0.00157565 +
                  y *
                    (0.00916281 +
                      y *
                        (-0.02057706 +
                          y *
                            (0.02635537 +
                              y * (-0.01647633 + y * 0.00392377))))))))
  );
}

export function modifiedBesselK0(value: number) {
  const x = Math.max(value, HERO_PATH_K0_MIN_ARGUMENT);
  if (x <= 2) {
    const y = (x * x) / 4;
    return (
      -Math.log(x / 2) * modifiedBesselI0(x) +
      (-0.57721566 +
        y *
          (0.4227842 +
            y *
              (0.23069756 +
                y *
                  (0.0348859 +
                    y * (0.00262698 + y * (0.0001075 + y * 0.0000074))))))
    );
  }
  const y = 2 / x;
  return (
    (Math.exp(-x) / Math.sqrt(x)) *
    (1.25331414 +
      y *
        (-0.07832358 +
          y *
            (0.02189568 +
              y *
                (-0.01062446 +
                  y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))))
  );
}

/**
 * K0 is sampled with a quadratic coordinate, concentrating texels around its
 * logarithmic singularity while retaining a long, smooth tail.
 */
export function buildPathK0TextureData() {
  const data = new Float32Array(HERO_PATH_K0_LUT_WIDTH);
  for (let index = 0; index < HERO_PATH_K0_LUT_WIDTH; index++) {
    const normalized = index / Math.max(HERO_PATH_K0_LUT_WIDTH - 1, 1);
    const argument = Math.max(
      HERO_PATH_K0_MIN_ARGUMENT,
      HERO_PATH_K0_MAX_ARGUMENT * normalized * normalized,
    );
    data[index] = modifiedBesselK0(argument);
  }
  return data;
}

export let cachedPathK0TextureData: Float32Array | null = null;

export function getPathK0TextureData() {
  cachedPathK0TextureData ??= buildPathK0TextureData();
  return cachedPathK0TextureData;
}

export function buildDotMaskTextureData(
  sourceMasks: readonly HeroDotMask[],
  feather: number,
  aspect: number,
) {
  const height = HERO_MASK_TEXTURE_HEIGHT;
  const width = clamp(Math.round(height * aspect), 64, 1024);
  const masks = sourceMasks.slice(0, MAX_HERO_DOT_MASKS).map((mask) => ({
    x: clamp(finite(mask.x, 0.5), 0, 1),
    y: clamp(finite(mask.y, 0.5), 0, 1),
    radius: clamp(finite(mask.radius, 0.5), 0.01, 2),
    feather: clamp(finite(mask.feather, feather), 0.001, 1),
  }));
  const data = new Uint8Array(width * height);
  if (masks.length === 0) {
    return { data, width, height };
  }

  for (let y = 0; y < height; y++) {
    const uvY = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const uvX = (x + 0.5) / width;
      let signal = 0;
      for (const mask of masks) {
        const dx = (uvX - mask.x) * aspect;
        const dy = uvY - mask.y;
        const distance = Math.hypot(dx, dy);
        const inner = mask.radius * (1 - mask.feather);
        const normalized = clamp(
          (distance - inner) / Math.max(mask.radius - inner, 0.000001),
          0,
          1,
        );
        const smooth = normalized * normalized * (3 - 2 * normalized);
        signal = Math.max(signal, 1 - smooth);
      }
      data[y * width + x] = Math.round(signal * 255);
    }
  }
  return { data, width, height };
}
