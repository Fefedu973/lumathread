import { clamp } from "../math";
import type {
  HeroWaveColorStop,
  HeroWaveColorStopEasing,
  HeroWavePaletteInterpolation,
} from "../types";
import { HERO_PALETTE_TEXTURE_WIDTH } from "./constants";

interface NormalizedColorStop {
  offset: number;
  easing: HeroWaveColorStopEasing;
  srgb: [number, number, number];
}

const WHITE_FALLBACK: readonly HeroWaveColorStop[] = [
  { id: "fallback-start", color: "#ffffff", offset: 0 },
  { id: "fallback-end", color: "#ffffff", offset: 1 },
];

export function hexToVec3(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((channel) => channel + channel)
          .join("")
      : value;
  const number = Number.parseInt(full, 16);
  if (Number.isNaN(number) || full.length !== 6) return [1, 1, 1];
  return [
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255,
  ];
}

function srgbChannelToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number) {
  const clamped = Math.max(value, 0);
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function linearRgbToOklab(
  color: readonly [number, number, number],
): [number, number, number] {
  const l =
    0.4122214708 * color[0] + 0.5363325363 * color[1] + 0.0514459929 * color[2];
  const m =
    0.2119034982 * color[0] + 0.6806995451 * color[1] + 0.1073969566 * color[2];
  const valueS =
    0.0883024619 * color[0] + 0.2817188376 * color[1] + 0.6299787005 * color[2];
  const lRoot = Math.cbrt(Math.max(l, 0));
  const mRoot = Math.cbrt(Math.max(m, 0));
  const sRoot = Math.cbrt(Math.max(valueS, 0));
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function oklabToLinearRgb(
  color: readonly [number, number, number],
): [number, number, number] {
  const lRoot = color[0] + 0.3963377774 * color[1] + 0.2158037573 * color[2];
  const mRoot = color[0] - 0.1055613458 * color[1] - 0.0638541728 * color[2];
  const sRoot = color[0] - 0.0894841775 * color[1] - 1.291485548 * color[2];
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const valueS = sRoot ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * valueS,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * valueS,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * valueS,
  ];
}

function applyStopEasing(amount: number, easing: HeroWaveColorStopEasing) {
  if (easing === "hold") return 0;
  if (easing === "smooth") return amount * amount * (3 - 2 * amount);
  return amount;
}

function normalizeColorStops(
  source: readonly HeroWaveColorStop[],
  fallback: readonly HeroWaveColorStop[],
  reverse: boolean,
) {
  const colors =
    source.length > 0
      ? source
      : fallback.length > 0
        ? fallback
        : WHITE_FALLBACK;
  const offsets: Array<number | undefined> = colors.map((stop) =>
    Number.isFinite(stop.offset)
      ? clamp(stop.offset as number, 0, 1)
      : undefined,
  );
  if (!offsets.some((offset) => offset !== undefined)) {
    for (let index = 0; index < offsets.length; index++) {
      offsets[index] = index / Math.max(offsets.length - 1, 1);
    }
  } else {
    if (offsets[0] === undefined) offsets[0] = 0;
    if (offsets[offsets.length - 1] === undefined) {
      offsets[offsets.length - 1] = 1;
    }
    let left = 0;
    while (left < offsets.length - 1) {
      let right = left + 1;
      while (right < offsets.length && offsets[right] === undefined) right += 1;
      const from = offsets[left] ?? 0;
      const to = Math.max(offsets[right] ?? from, from);
      const span = right - left;
      for (let index = 1; index < span; index++) {
        offsets[left + index] = from + ((to - from) * index) / span;
      }
      offsets[right] = to;
      left = right;
    }
  }
  const normalized: NormalizedColorStop[] = colors
    .map((stop, index) => ({
      offset: offsets[index] ?? index / Math.max(colors.length - 1, 1),
      easing: stop.easing ?? "linear",
      srgb: hexToVec3(stop.color),
    }))
    .sort((left, right) => left.offset - right.offset);
  if (normalized.length === 1) {
    normalized.push({ ...normalized[0]!, offset: 1 });
    normalized[0]!.offset = 0;
  }
  if (!reverse) return normalized;
  return normalized
    .map((stop) => ({ ...stop, offset: 1 - stop.offset }))
    .reverse();
}

function interpolatePaletteColor(
  left: NormalizedColorStop,
  right: NormalizedColorStop,
  amount: number,
  interpolation: HeroWavePaletteInterpolation,
): [number, number, number] {
  const eased = applyStopEasing(clamp(amount, 0, 1), left.easing);
  if (interpolation === "srgb") {
    return [0, 1, 2].map(
      (index) =>
        left.srgb[index]! + (right.srgb[index]! - left.srgb[index]!) * eased,
    ) as [number, number, number];
  }
  const leftLinear = left.srgb.map(srgbChannelToLinear) as [
    number,
    number,
    number,
  ];
  const rightLinear = right.srgb.map(srgbChannelToLinear) as [
    number,
    number,
    number,
  ];
  let mixed: [number, number, number];
  if (interpolation === "oklab") {
    const first = linearRgbToOklab(leftLinear);
    const second = linearRgbToOklab(rightLinear);
    mixed = oklabToLinearRgb([
      first[0] + (second[0] - first[0]) * eased,
      first[1] + (second[1] - first[1]) * eased,
      first[2] + (second[2] - first[2]) * eased,
    ]);
  } else {
    mixed = [0, 1, 2].map(
      (index) =>
        leftLinear[index]! + (rightLinear[index]! - leftLinear[index]!) * eased,
    ) as [number, number, number];
  }
  return mixed.map((value) => clamp(linearChannelToSrgb(value), 0, 1)) as [
    number,
    number,
    number,
  ];
}

function paletteColorAt(
  stops: readonly NormalizedColorStop[],
  progress: number,
  interpolation: HeroWavePaletteInterpolation,
  cyclic: boolean,
) {
  const position = cyclic ? ((progress % 1) + 1) % 1 : clamp(progress, 0, 1);
  if (
    cyclic &&
    (position < stops[0]!.offset || position >= stops[stops.length - 1]!.offset)
  ) {
    const left = stops[stops.length - 1]!;
    const right = stops[0]!;
    const span = 1 - left.offset + right.offset;
    const adjusted = position < right.offset ? position + 1 : position;
    return interpolatePaletteColor(
      left,
      right,
      span > 0 ? (adjusted - left.offset) / span : 0,
      interpolation,
    );
  }
  let rightIndex = 1;
  while (rightIndex < stops.length && position > stops[rightIndex]!.offset) {
    rightIndex += 1;
  }
  const right = stops[Math.min(stops.length - 1, rightIndex)]!;
  const left = stops[Math.max(0, rightIndex - 1)] ?? right;
  return interpolatePaletteColor(
    left,
    right,
    (position - left.offset) / Math.max(right.offset - left.offset, 0.000001),
    interpolation,
  );
}

export function buildHeroPaletteTextureData(
  source: readonly HeroWaveColorStop[],
  interpolation: HeroWavePaletteInterpolation = "srgb",
  reverse = false,
  fallback: readonly HeroWaveColorStop[] = WHITE_FALLBACK,
) {
  const stops = normalizeColorStops(source, fallback, reverse);
  const data = new Uint8Array(HERO_PALETTE_TEXTURE_WIDTH * 4);
  const half = HERO_PALETTE_TEXTURE_WIDTH / 2;
  const write = (index: number, progress: number, cyclic: boolean) => {
    const color = paletteColorAt(stops, progress, interpolation, cyclic);
    const offset = index * 4;
    data[offset] = Math.round(color[0] * 255);
    data[offset + 1] = Math.round(color[1] * 255);
    data[offset + 2] = Math.round(color[2] * 255);
    data[offset + 3] = 255;
  };
  for (let index = 0; index < half; index++) {
    const progress = index / Math.max(half - 1, 1);
    write(index, progress, false);
    write(half + index, progress, true);
  }
  return data;
}
