import type {
  HeroWaveLongitudinalProfiles,
  HeroWaveScalarProfile,
} from "@/hero-wave-background";
import { INITIAL_STATE } from "./initial-state";
import type { LabState, ProfileKeyState } from "./types";

export function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = (((hue % 360) + 360) % 360) / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function parseSampledPattern(pattern: string) {
  const values = pattern
    .split(/[\s,;]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  return values.length > 1 ? values : [0, 1, 0, -1, 0];
}

function makeCurveProfile(
  first: number,
  middle: number,
  last: number,
): HeroWaveScalarProfile {
  return {
    type: "curve",
    interpolation: "cubic",
    keys: [
      { position: 0, value: first },
      { position: 0.52, value: middle },
      { position: 1, value: last },
    ],
  };
}

function buildPresetProfiles(state: LabState): HeroWaveLongitudinalProfiles {
  const strength = state.profileStrength;
  if (state.profilePreset === "comet") {
    return {
      width: {
        type: "curve",
        interpolation: "cubic",
        keys: [
          { position: 0, value: 0.05 },
          { position: 0.2, value: 0.35 * strength },
          { position: 0.72, value: 1.15 * strength },
          { position: 1, value: 0.08 },
        ],
      },
      opacity: "sin2",
      intensity: {
        type: "curve",
        interpolation: "cubic",
        keys: [
          { position: 0, value: 0 },
          { position: 0.58, value: 0.72 * strength },
          { position: 0.88, value: 1.55 * strength },
          { position: 1, value: 0 },
        ],
      },
      glow: makeCurveProfile(0.35, 1.15 * strength, 0.3),
      reflection: "head",
      colorPosition: makeCurveProfile(0, 0.08, 0),
    };
  }
  if (state.profilePreset === "center-glow") {
    return {
      width: makeCurveProfile(0.35, 1.25 * strength, 0.35),
      opacity: "bell",
      intensity: "bell",
      glow: makeCurveProfile(0.5, 1.6 * strength, 0.5),
      reflection: "bell",
      colorPosition: {
        type: "sampled",
        interpolation: "smooth",
        values: [0, 0.04, 0.12, -0.04, 0],
      },
    };
  }
  if (state.profilePreset === "segmented") {
    return {
      width: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0.1, 1 * strength, 0.18, 0.9 * strength, 0.1],
      },
      opacity: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0, 1, 0.1, 0.9, 0],
      },
      intensity: {
        type: "sampled",
        interpolation: "cubic",
        wrap: "repeat",
        values: [0.2, 1.4 * strength, 0.15, 1.1 * strength, 0.2],
      },
      glow: {
        type: "sampled",
        interpolation: "smooth",
        wrap: "repeat",
        values: [0.4, 1.3 * strength, 0.45, 1.1 * strength, 0.4],
      },
      reflection: 1,
      colorPosition: {
        type: "sampled",
        interpolation: "linear",
        wrap: "repeat",
        values: [0, 0.08, 0.18, 0.02, 0],
      },
    };
  }
  return {
    width: 1,
    opacity: 1,
    intensity: 1,
    glow: 1,
    reflection: 1,
    colorPosition: 0,
  };
}

function transformProfile(
  profile: HeroWaveScalarProfile | undefined,
  multiplier: number,
  offset: number,
  fallback: number,
): HeroWaveScalarProfile {
  if (profile === undefined || profile === "flat") {
    return fallback * multiplier + offset;
  }
  if (typeof profile === "number") return profile * multiplier + offset;
  if (typeof profile === "object") {
    if (profile.type === "curve") {
      return {
        ...profile,
        keys: profile.keys.map((key) => ({
          ...key,
          value: key.value * multiplier + offset,
          ...(key.inTangent === undefined
            ? {}
            : { inTangent: key.inTangent * multiplier }),
          ...(key.outTangent === undefined
            ? {}
            : { outTangent: key.outTangent * multiplier }),
        })),
      };
    }
    return {
      ...profile,
      values: Array.from(profile.values, (value) =>
        Number.isFinite(value) ? value * multiplier + offset : offset,
      ),
    };
  }
  const values = Array.from({ length: 65 }, (_, index) => {
    const progress = index / 64;
    const smooth = progress * progress * (3 - 2 * progress);
    const base =
      profile === "sin2"
        ? Math.sin(Math.PI * progress) ** 2
        : profile === "smoothstep"
          ? smooth
          : profile === "bell"
            ? Math.exp(-0.5 * ((progress - 0.5) / 0.22) ** 2)
            : profile === "head"
              ? smooth
              : 1 - smooth;
    return base * multiplier + offset;
  });
  return { type: "sampled", interpolation: "cubic", values };
}

export function buildProfiles(state: LabState): HeroWaveLongitudinalProfiles {
  const sortedKeys = [...(state.profileKeys ?? INITIAL_STATE.profileKeys)].sort(
    (left, right) => left.position - right.position,
  );
  const curveFor = (
    channel: keyof Omit<ProfileKeyState, "id" | "position">,
  ) => {
    const fallback = channel === "colorPosition" ? 0 : 1;
    return {
      type: "curve",
      interpolation: state.profileInterpolation,
      wrap: state.profileWrap,
      keys: sortedKeys.map((key) => ({
        position: key.position,
        value: Number.isFinite(key[channel]) ? key[channel] : fallback,
      })),
    } as const;
  };
  const profiles: HeroWaveLongitudinalProfiles =
    state.profileSource === "custom"
      ? {
          width: curveFor("width"),
          opacity: curveFor("opacity"),
          intensity: curveFor("intensity"),
          glow: curveFor("glow"),
          upperGlowSpread: curveFor("upperGlowSpread"),
          lowerGlowSpread: curveFor("lowerGlowSpread"),
          reflection: curveFor("reflection"),
          colorPosition: curveFor("colorPosition"),
        }
      : buildPresetProfiles(state);
  return {
    width: transformProfile(profiles.width, state.profileWidth, 0, 1),
    opacity: transformProfile(profiles.opacity, state.profileOpacity, 0, 1),
    intensity: transformProfile(
      profiles.intensity,
      state.profileIntensity,
      0,
      1,
    ),
    glow: transformProfile(profiles.glow, state.profileGlow, 0, 1),
    upperGlowSpread: transformProfile(
      profiles.upperGlowSpread,
      state.profileUpperGlowSpread ?? 1,
      0,
      1,
    ),
    lowerGlowSpread: transformProfile(
      profiles.lowerGlowSpread,
      state.profileLowerGlowSpread ?? 1,
      0,
      1,
    ),
    reflection: transformProfile(
      profiles.reflection,
      state.profileReflection,
      0,
      1,
    ),
    colorPosition: transformProfile(
      profiles.colorPosition,
      1,
      state.profileColorPosition,
      0,
    ),
  };
}
