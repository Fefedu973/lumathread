export interface PropRow {
  name: string;
  type: string;
  defaultValue?: string;
  description: string;
}

export interface PropGroup {
  id: string;
  title: string;
  description?: string;
  rows: PropRow[];
}

export const API_REFERENCE: PropGroup[] = [
  {
    id: "component-props",
    title: "Component props",
    description:
      "Top-level props accepted by HeroWaveBackground (HeroWaveBackgroundProps).",
    rows: [
      {
        name: "className",
        type: "string",
        description: "Extra class names applied to the root container element.",
      },
      {
        name: "style",
        type: "CSSProperties",
        description: "Inline styles merged onto the root container element.",
      },
      {
        name: "theme",
        type: '"dark" | "light"',
        defaultValue: '"dark"',
        description:
          "Visual composition; light uses a white canvas with luminous tinted blending.",
      },
      {
        name: "path",
        type: "HeroWavePathConfig",
        description:
          "Filament centerline definition: mode, control points, SVG source, transform, and organic generation.",
      },
      {
        name: "shape",
        type: "HeroWaveShapeConfig",
        description:
          "Global placement and scale of the wave inside the canvas.",
      },
      {
        name: "motion",
        type: "HeroWaveMotionConfig",
        description: "Travel behavior of the luminous segment along the path.",
      },
      {
        name: "propagation",
        type: "HeroWavePropagationOptions",
        description:
          "Travelling deformation stack applied on top of the base path.",
      },
      {
        name: "profiles",
        type: "HeroWaveLongitudinalProfiles",
        description:
          "Scalar profiles modulating width, opacity, glow, and color along the filament length.",
      },
      {
        name: "material",
        type: "HeroWaveMaterialPreset | HeroWaveMaterialConfig",
        defaultValue: '"soft-aurora"',
        description:
          "Light-scattering material as a preset name or a full configuration object.",
      },
      {
        name: "palette",
        type: "HeroWavePaletteConfig",
        description:
          "Color gradient, interpolation space, and hue animation of the filament.",
      },
      {
        name: "interaction",
        type: "HeroWaveInteractionConfig",
        description:
          "Pointer interactivity: follow behavior and filament disturbance impulses.",
      },
      {
        name: "dots",
        type: "HeroWaveDotsConfig",
        description:
          "Ambient dot field rendered behind the filament, flat or 3D terrain.",
      },
      {
        name: "glassText",
        type: "HeroWaveGlassTextConfig",
        description:
          "Refractive glass typography or SVG mask composited over the scene.",
      },
      {
        name: "backgroundImage",
        type: "HeroWaveBackgroundImageConfig",
        description: "Optional image drawn behind the wave layers.",
      },
      {
        name: "musicVisualizer",
        type: "HeroWaveMusicVisualizerConfig",
        description:
          "Audio-reactive modulation from a media element or the microphone.",
      },
      {
        name: "quality",
        type: "HeroWaveQualityPreset | HeroWaveQualityConfig",
        defaultValue: '"auto"',
        description:
          "Rendering quality as a preset name or granular overrides; auto picks by device capability.",
      },
      {
        name: "filaments",
        type: "readonly HeroWaveFilamentConfig[]",
        description:
          "Multi-filament scene definition; each entry inherits the root configuration.",
      },
      {
        name: "fadeInDuration",
        type: "number",
        defaultValue: "900",
        description: "Initial canvas reveal duration in milliseconds.",
      },
      {
        name: "fadeInEasing",
        type: "HeroWaveFadeEasingPreset | [number, number, number, number]",
        defaultValue: '"ease-out"',
        description:
          "CSS easing preset or cubic-bezier control points for the initial reveal.",
      },
      {
        name: "paused",
        type: "boolean",
        defaultValue: "false",
        description: "Freezes the internal animation clock while true.",
      },
      {
        name: "time",
        type: "number",
        description:
          "Controlled animation time in seconds; bypasses the internal clock when set.",
      },
      {
        name: "initialTime",
        type: "number",
        defaultValue: "0",
        description: "Starting value of the internal clock in seconds.",
      },
      {
        name: "playbackRate",
        type: "number",
        defaultValue: "1",
        description:
          "Multiplier on the internal clock; negative values play backwards.",
      },
      {
        name: "respectReducedMotion",
        type: "boolean",
        defaultValue: "true",
        description:
          "Renders a static frame when the user prefers reduced motion.",
      },
      {
        name: "pauseWhenOffscreen",
        type: "boolean",
        defaultValue: "true",
        description:
          "Suspends rendering while the canvas is outside the viewport.",
      },
      {
        name: "onCycle",
        type: "(event: HeroWaveCycleEvent) => void",
        description:
          "Called each time a filament head completes a traversal of the path.",
      },
      {
        name: "onReady",
        type: "() => void",
        description: "Called once after the first successful frame is drawn.",
      },
      {
        name: "onRendererStatus",
        type: "(status: HeroWaveRendererStatus) => void",
        description:
          "Reports which renderer is active and its WebGL capability details.",
      },
      {
        name: "onRendererError",
        type: "(error: Error) => void",
        description: "Called when renderer initialization or drawing fails.",
      },
      {
        name: "onFrame",
        type: "(time: number, delta: number) => void",
        description:
          "Called after an actual renderer draw, including throttled HDR frames.",
      },
      {
        name: "onPerformance",
        type: "(sample: HeroWavePerformanceSample) => void",
        description:
          "Low-frequency CPU/GPU timing diagnostics sampled without synchronous GPU reads.",
      },
    ],
  },
  {
    id: "path",
    title: "Path",
    description:
      "HeroWavePathConfig — defines the filament centerline geometry.",
    rows: [
      {
        name: "mode",
        type: '"sine" | "organic" | "custom" | "svg" | "follow"',
        defaultValue: '"organic"',
        description:
          'Path generation mode; inferred as "custom" when points are given and "svg" when svgPath is given.',
      },
      {
        name: "points",
        type: "readonly HeroTrajectoryPoint[]",
        defaultValue: "HERO_DEFAULT_TRAJECTORY (8 points)",
        description:
          "Custom trajectory control points with per-point x, y, speed, and optional Bézier handles.",
      },
      {
        name: "closed",
        type: "boolean",
        defaultValue: "false",
        description: "Joins the last control point back to the first.",
      },
      {
        name: "closedLoopTaper",
        type: "boolean",
        defaultValue: "true",
        description: "Keeps head and tail tapering active on closed loops.",
      },
      {
        name: "interpolation",
        type: '"linear" | "catmull-rom" | "centripetal-catmull-rom" | "bezier"',
        defaultValue: '"catmull-rom"',
        description: "Spline used to interpolate between control points.",
      },
      {
        name: "tension",
        type: "number",
        defaultValue: "0",
        description:
          "Catmull-Rom tangent tension; 1 collapses to straight segments.",
      },
      {
        name: "svgPath",
        type: "string",
        defaultValue: '""',
        description:
          "One continuous SVG subpath; use multiple filaments for multiple subpaths.",
      },
      {
        name: "svgViewBox",
        type: "readonly [number, number, number, number] | HeroWaveSvgViewBoxObject",
        description:
          "Coordinate system of svgPath; derived from the path bounds when omitted.",
      },
      {
        name: "transform.x",
        type: "number",
        defaultValue: "0",
        description: "Horizontal path offset in normalized canvas units.",
      },
      {
        name: "transform.y",
        type: "number",
        defaultValue: "0",
        description: "Vertical path offset in normalized canvas units.",
      },
      {
        name: "transform.scaleX",
        type: "number",
        defaultValue: "1",
        description: "Horizontal scale around the anchor point.",
      },
      {
        name: "transform.scaleY",
        type: "number",
        defaultValue: "1",
        description: "Vertical scale around the anchor point.",
      },
      {
        name: "transform.rotation",
        type: "number",
        defaultValue: "0",
        description: "Rotation around the anchor point.",
      },
      {
        name: "transform.anchorX",
        type: "number",
        defaultValue: "0.5",
        description: "Normalized horizontal anchor of the transform.",
      },
      {
        name: "transform.anchorY",
        type: "number",
        defaultValue: "0.5",
        description: "Normalized vertical anchor of the transform.",
      },
      {
        name: "organic.pointCount",
        type: "number",
        defaultValue: "12",
        description: "Number of generated control points (4 to 256).",
      },
      {
        name: "organic.turns",
        type: "number",
        defaultValue: "1.55",
        description: "Number of vertical oscillations across the canvas.",
      },
      {
        name: "organic.amplitude",
        type: "number",
        defaultValue: "0.92",
        description: "Vertical excursion of the generated trajectory.",
      },
      {
        name: "organic.roughness",
        type: "number",
        defaultValue: "0.28",
        description: "Amount of seeded randomness added to point heights.",
      },
      {
        name: "organic.horizontalJitter",
        type: "number",
        defaultValue: "0.14",
        description: "Seeded horizontal displacement of generated points.",
      },
      {
        name: "organic.speedVariation",
        type: "number",
        defaultValue: "0.7",
        description: "Per-point traversal speed variance.",
      },
      {
        name: "organic.symmetry",
        type: "number",
        defaultValue: "0",
        description:
          "Blends the trajectory toward its mirrored counterpart (0 to 1).",
      },
      {
        name: "organic.seed",
        type: "number",
        defaultValue: "731",
        description: "Deterministic seed for the organic generator.",
      },
    ],
  },
  {
    id: "shape",
    title: "Shape",
    description:
      "HeroWaveShapeConfig — global placement and scale of the wave.",
    rows: [
      {
        name: "waveY",
        type: "number",
        defaultValue: "0.68",
        description:
          "Vertical baseline of the wave, 0 = bottom and 1 = top of the canvas.",
      },
      {
        name: "strength",
        type: "number",
        defaultValue: "1",
        description: "Overall multiplier on curve displacement.",
      },
      {
        name: "scale",
        type: "number",
        defaultValue: "0.62",
        description: "Vertical scale applied to the path shape.",
      },
      {
        name: "frequency",
        type: "number",
        defaultValue: "1.4",
        description: "Base spatial frequency of the sine-mode wave.",
      },
    ],
  },
  {
    id: "motion",
    title: "Motion",
    description:
      "HeroWaveMotionConfig — how the luminous segment travels along the path.",
    rows: [
      {
        name: "mode",
        type: '"travel" | "propagate" | "anchored"',
        defaultValue: '"travel"',
        description:
          "Travel moves a segment along the path, propagate deforms a static path, anchored keeps everything still.",
      },
      {
        name: "curveTravel",
        type: "number",
        defaultValue: "0.08",
        description: "Speed at which the visible segment travels the path.",
      },
      {
        name: "pathDrift",
        type: "number",
        defaultValue: "0",
        description: "Slow drift of the whole path over time.",
      },
      {
        name: "curveMotion",
        type: "number",
        defaultValue: "0.65",
        description: "Amount of internal undulation of the curve shape.",
      },
      {
        name: "segmentLength",
        type: "number",
        defaultValue: "0.78",
        description: "Visible segment length as a fraction of the full path.",
      },
      {
        name: "tailTaper",
        type: "number",
        defaultValue: "0.24",
        description: "Fraction of the segment faded out at the tail.",
      },
      {
        name: "headTaper",
        type: "number",
        defaultValue: "0.14",
        description: "Fraction of the segment faded out at the head.",
      },
      {
        name: "speed",
        type: "number",
        defaultValue: "0.7",
        description: "Global multiplier on all motion timing.",
      },
    ],
  },
  {
    id: "propagation",
    title: "Propagation & deformers",
    description:
      "HeroWavePropagationOptions — a stack of travelling deformers displacing the sampled path.",
    rows: [
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "false",
        description:
          'Enables the deformer stack; implicitly true when motion.mode is "propagate" or a propagation object is passed without an explicit enabled.',
      },
      {
        name: "deformers",
        type: "readonly HeroWaveDeformer[]",
        defaultValue: "HERO_DEFAULT_PROPAGATION_DEFORMERS",
        description:
          "Ordered deformer stack; the default is a two-wave harmonics deformer (amplitude 0.055).",
      },
      {
        name: "domain",
        type: '"arcLength" | "travelTime"',
        defaultValue: '"arcLength"',
        description:
          "Coordinate the deformers sample: geometric arc length or traversal progress.",
      },
      {
        name: "phaseOffset",
        type: "number",
        defaultValue: "0",
        description: "Constant phase added to the shared deformer clock.",
      },
      {
        name: "phaseSpeed",
        type: "number",
        defaultValue: "1",
        description: "Speed multiplier on the shared deformer clock.",
      },
      {
        name: "combine",
        type: '"add" | "max" | "multiply"',
        defaultValue: '"add"',
        description: "How displacements from multiple deformers are merged.",
      },
      {
        name: "stage",
        type: '"before-follow" | "after-follow"',
        defaultValue: '"after-follow"',
        description:
          "Whether deformation applies before or after pointer-follow shaping.",
      },
      {
        name: "recomputeArcLength",
        type: "boolean",
        defaultValue: "false",
        description:
          "Re-parameterizes arc length after deformation for accurate tapering.",
      },
      {
        name: "deformers[].type",
        type: '"harmonics" | "sampled" | "noise" | "pulse" | "custom"',
        description: "Required discriminant selecting the deformer kind.",
      },
      {
        name: "deformers[].id",
        type: "string",
        description: "Optional stable identifier for the deformer.",
      },
      {
        name: "deformers[].enabled",
        type: "boolean",
        defaultValue: "true",
        description: "Set false to skip this deformer without removing it.",
      },
      {
        name: "deformers[].amplitude",
        type: "number",
        defaultValue: "1",
        description: "Peak displacement in viewport-height units.",
      },
      {
        name: "deformers[].envelope",
        type: "HeroWaveScalarProfile",
        defaultValue: '"flat"',
        description:
          "Longitudinal profile multiplying the amplitude along the path.",
      },
      {
        name: "deformers[].direction",
        type: '"normal" | "tangent" | "both" | "x" | "y"',
        defaultValue: '"normal" ("both" for custom)',
        description: "Axis along which the displacement is applied.",
      },
      {
        name: "deformers[].tangentAmount",
        type: "number",
        defaultValue: '1 ("tangent") / 0.35 ("both")',
        description:
          "Scale of the tangential component when direction includes tangent.",
      },
      {
        name: "deformers[].waves",
        type: "readonly HeroWaveHarmonic[]",
        description:
          "Harmonics only: sine components with required amplitude and frequency plus optional phase (0) and phaseSpeed (1).",
      },
      {
        name: "deformers[].values",
        type: "readonly number[] | Float32Array",
        description: "Sampled only: required array of displacement samples.",
      },
      {
        name: "deformers[].frequency",
        type: "number",
        defaultValue: "1 (required for noise)",
        description:
          "Sampled/noise: repetitions of the pattern across the domain.",
      },
      {
        name: "deformers[].phase",
        type: "number",
        defaultValue: "0",
        description: "Sampled/pulse: constant phase offset.",
      },
      {
        name: "deformers[].phaseSpeed",
        type: "number",
        defaultValue: "1",
        description:
          "Sampled/noise/pulse: per-deformer speed on the shared clock.",
      },
      {
        name: "deformers[].interpolation",
        type: '"linear" | "smooth" | "cubic"',
        defaultValue: '"cubic"',
        description: "Sampled only: interpolation between value samples.",
      },
      {
        name: "deformers[].wrap",
        type: '"clamp" | "repeat" | "mirror"',
        defaultValue: '"repeat"',
        description: "Sampled only: how positions outside 0-1 are wrapped.",
      },
      {
        name: "deformers[].seed",
        type: "number",
        defaultValue: "0",
        description: "Noise only: deterministic seed for the fractal noise.",
      },
      {
        name: "deformers[].octaves",
        type: "number",
        defaultValue: "3",
        description: "Noise only: fractal octave count (1 to 8).",
      },
      {
        name: "deformers[].lacunarity",
        type: "number",
        defaultValue: "2",
        description: "Noise only: frequency multiplier between octaves.",
      },
      {
        name: "deformers[].persistence",
        type: "number",
        defaultValue: "0.5",
        description: "Noise only: amplitude multiplier between octaves.",
      },
      {
        name: "deformers[].width",
        type: "number",
        description: "Pulse only: required half-width of each pulse.",
      },
      {
        name: "deformers[].count",
        type: "number",
        defaultValue: "1",
        description: "Pulse only: number of pulses along the domain.",
      },
      {
        name: "deformers[].shape",
        type: '"gaussian" | "smooth" | "triangle"',
        defaultValue: '"gaussian"',
        description: "Pulse only: falloff profile of each pulse.",
      },
      {
        name: "deformers[].callback",
        type: "HeroWaveCustomDeformerCallback",
        description:
          "Custom only: required function writing normal/tangent/x/y displacement into the output object.",
      },
      {
        name: "deformers[].version",
        type: "number",
        description:
          "Custom only: increment when captured callback data changes without the callback identity changing.",
      },
    ],
  },
  {
    id: "profiles",
    title: "Longitudinal profiles",
    description:
      'HeroWaveLongitudinalProfiles — each field is a HeroWaveScalarProfile: a number, a named preset ("flat" | "sin2" | "smoothstep" | "bell" | "head" | "tail"), a keyed curve, or a sampled array.',
    rows: [
      {
        name: "width",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description: "Multiplies the filament stroke width along its length.",
      },
      {
        name: "opacity",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description: "Multiplies opacity along the filament.",
      },
      {
        name: "intensity",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description: "Multiplies emissive intensity along the filament.",
      },
      {
        name: "glow",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description: "Multiplies glow strength along the filament.",
      },
      {
        name: "upperGlowSpread",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description:
          "Multiplies the upper-side glow spread along the filament.",
      },
      {
        name: "lowerGlowSpread",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description:
          "Multiplies the lower-side glow spread along the filament.",
      },
      {
        name: "reflection",
        type: "HeroWaveScalarProfile",
        defaultValue: "1",
        description: "Multiplies the water-line reflection along the filament.",
      },
      {
        name: "colorPosition",
        type: "HeroWaveScalarProfile",
        defaultValue: "0",
        description: "Signed offset added to the regular palette coordinate.",
      },
    ],
  },
  {
    id: "material",
    title: "Material",
    description:
      'HeroWaveMaterialConfig — scattering-layer defaults shown for the default "soft-aurora" preset; mist, neon, and plasma override them.',
    rows: [
      {
        name: "preset",
        type: '"soft-aurora" | "mist" | "neon" | "plasma"',
        defaultValue: '"soft-aurora"',
        description:
          "Base material preset providing the scattering-layer weights below.",
      },
      {
        name: "atmosphere",
        type: "number",
        defaultValue: "0.06",
        description: "Widest, faintest scattering halo around the filament.",
      },
      {
        name: "broad",
        type: "number",
        defaultValue: "0.24",
        description: "Broad outer glow layer weight.",
      },
      {
        name: "body",
        type: "number",
        defaultValue: "0.3",
        description: "Mid-distance body glow layer weight.",
      },
      {
        name: "ridge",
        type: "number",
        defaultValue: "0.46",
        description: "Tight ridge highlight layer weight.",
      },
      {
        name: "core",
        type: "number",
        defaultValue: "0.28",
        description: "Innermost hot core layer weight.",
      },
      {
        name: "veil",
        type: "number",
        defaultValue: "0.04",
        description: "Full-canvas ambient veil contribution.",
      },
      {
        name: "exposure",
        type: "number",
        defaultValue: "1",
        description: "Tone-mapping exposure applied to the composite.",
      },
      {
        name: "saturation",
        type: "number",
        defaultValue: "1",
        description: "Color saturation of the composite.",
      },
      {
        name: "intensity",
        type: "number",
        defaultValue: "1",
        description: "Global emissive intensity multiplier.",
      },
      {
        name: "glow",
        type: "number",
        defaultValue: "1",
        description: "Global glow strength multiplier.",
      },
      {
        name: "upperGlowSpread",
        type: "number",
        defaultValue: "1",
        description: "Glow spread multiplier above the filament.",
      },
      {
        name: "lowerGlowSpread",
        type: "number",
        defaultValue: "1",
        description: "Glow spread multiplier below the filament.",
      },
      {
        name: "glowAsymmetry",
        type: "number",
        defaultValue: "1",
        description: "Balance between upper and lower glow lobes.",
      },
    ],
  },
  {
    id: "palette",
    title: "Palette",
    description: "HeroWavePaletteConfig — the filament color gradient.",
    rows: [
      {
        name: "stops",
        type: "readonly HeroWaveColorStop[]",
        defaultValue: "[#2438ff @ 0, #1adff5 @ 0.5, #22f25f @ 1]",
        description: "Ordered gradient stops sampled along the filament.",
      },
      {
        name: "stops[].id",
        type: "string",
        description: "Required stable identifier for the stop.",
      },
      {
        name: "stops[].color",
        type: "string",
        description: "Required CSS color of the stop.",
      },
      {
        name: "stops[].offset",
        type: "number",
        description:
          "Optional normalized position; missing offsets are distributed evenly.",
      },
      {
        name: "stops[].easing",
        type: '"linear" | "smooth" | "hold"',
        defaultValue: '"linear"',
        description: "Interpolation from this stop to the following stop.",
      },
      {
        name: "interpolation",
        type: '"srgb" | "linear-rgb" | "oklab"',
        defaultValue: '"srgb"',
        description: "Color space used to blend between stops.",
      },
      {
        name: "wrap",
        type: '"clamp" | "repeat" | "mirror"',
        defaultValue: '"clamp"',
        description: "How palette coordinates outside 0-1 are wrapped.",
      },
      {
        name: "reverse",
        type: "boolean",
        defaultValue: "false",
        description: "Reverses the gradient direction.",
      },
      {
        name: "speed",
        type: "number",
        defaultValue: "1",
        description: "Speed of palette movement along the filament.",
      },
      {
        name: "hue",
        type: "number",
        defaultValue: "0",
        description: "Constant hue rotation in degrees.",
      },
      {
        name: "hueDrift",
        type: "number",
        defaultValue: "0",
        description: "Continuous hue rotation in degrees per second.",
      },
    ],
  },
  {
    id: "interaction-follow",
    title: "Interaction — follow",
    description:
      "HeroWaveFollowOptions — makes the filament head chase the pointer.",
    rows: [
      {
        name: "mode",
        type: '"hybrid" | "cascade" | "echo"',
        defaultValue: '"hybrid"',
        description:
          "Follow algorithm: inertial rope, lagged cascade, or gesture echo.",
      },
      {
        name: "target",
        type: '"window" | "canvas" | HTMLElement | { current: HTMLElement | null } | null',
        defaultValue: '"window"',
        description: "Area whose pointer events drive the follow behavior.",
      },
      {
        name: "activation",
        type: '"path-mode" | "canvas" | "viewport"',
        defaultValue: '"path-mode"',
        description:
          "Temporarily overrides the configured path with follow while the pointer is inside this area.",
      },
      {
        name: "transitionDuration",
        type: "number",
        defaultValue: "0",
        description:
          "Seconds used to morph between a conditional fallback path and follow.",
      },
      {
        name: "headResponse",
        type: "number",
        defaultValue: "1",
        description:
          "Responsiveness of the head to pointer movement (0.01 to 1).",
      },
      {
        name: "viscosity",
        type: "number",
        defaultValue: "0.45",
        description:
          "Hybrid-only blend between the recorded gesture and the inertial rope.",
      },
      {
        name: "memorySeconds",
        type: "number",
        defaultValue: "0.92",
        description:
          "Echo lifetime; cascade maps 0.28-1.70 seconds to its 0-1 lag range.",
      },
      {
        name: "stationaryBehavior",
        type: '"freeze" | "collapse"',
        defaultValue: '"collapse"',
        description:
          "Echo behavior while the pointer remains inside the target but stops.",
      },
      {
        name: "stationaryCollapseDuration",
        type: "number",
        defaultValue: "1.2",
        description:
          "Seconds used by echo to pull its tail along the recorded path.",
      },
      {
        name: "lengthCssPx",
        type: "number",
        defaultValue: "1800",
        description: "Maximum persistent spatial history used by hybrid mode.",
      },
      {
        name: "leaveBehavior",
        type: '"freeze" | "collapse" | "idle" | "fade"',
        defaultValue: '"collapse"',
        description:
          "What the filament does when the pointer leaves the target.",
      },
      {
        name: "fadeDuration",
        type: "number",
        defaultValue: "0.35",
        description: 'Fade duration in seconds used by leaveBehavior "fade".',
      },
      {
        name: "idleDelay",
        type: "number",
        defaultValue: "0.35",
        description: "Seconds of inactivity before the idle orbit begins.",
      },
      {
        name: "idleRadiusX",
        type: "number",
        defaultValue: "90",
        description: "Horizontal idle-orbit radius in CSS pixels.",
      },
      {
        name: "idleRadiusY",
        type: "number",
        defaultValue: "65",
        description: "Vertical idle-orbit radius in CSS pixels.",
      },
      {
        name: "idleSpeed",
        type: "number",
        description:
          "Convenience speed applied to both idle axes when the per-axis values are omitted.",
      },
      {
        name: "idleSpeedX",
        type: "number",
        defaultValue: "0.55",
        description: "Horizontal idle-orbit speed.",
      },
      {
        name: "idleSpeedY",
        type: "number",
        defaultValue: "0.4565",
        description: "Vertical idle-orbit speed.",
      },
      {
        name: "pointerTypes",
        type: 'readonly ("mouse" | "pen" | "touch")[]',
        defaultValue: '["mouse", "pen", "touch"]',
        description: "Pointer types allowed to drive the follow behavior.",
      },
      {
        name: "velocityInfluence.intensity",
        type: "number",
        defaultValue: "0.08",
        description: "Extra emissive intensity added at maximum pointer speed.",
      },
      {
        name: "velocityInfluence.width",
        type: "number",
        defaultValue: "0.05",
        description: "Extra stroke width added at maximum pointer speed.",
      },
      {
        name: "velocityInfluence.glow",
        type: "number",
        defaultValue: "0.08",
        description: "Extra glow added at maximum pointer speed.",
      },
      {
        name: "velocityInfluence.hue",
        type: "number",
        defaultValue: "8",
        description: "Hue rotation in degrees at maximum pointer speed.",
      },
      {
        name: "velocityInfluence.reflection",
        type: "number",
        defaultValue: "0.08",
        description: "Extra reflection strength at maximum pointer speed.",
      },
      {
        name: "velocityInfluence.response",
        type: "number",
        defaultValue: "12",
        description: "Smoothing rate of the velocity signal.",
      },
      {
        name: "velocityInfluence.maxVelocityCssPx",
        type: "number",
        defaultValue: "1400",
        description:
          "Pointer speed in CSS px/s that maps to full velocity influence.",
      },
      {
        name: "position",
        type: "HeroWaveFollowPosition",
        description:
          "Programmatic pointer position that replaces real pointer input when set.",
      },
      {
        name: "position.x",
        type: "number",
        description: "Required horizontal coordinate of the virtual pointer.",
      },
      {
        name: "position.y",
        type: "number",
        description: "Required vertical coordinate of the virtual pointer.",
      },
      {
        name: "position.space",
        type: '"normalized" | "client"',
        defaultValue: '"normalized"',
        description:
          "Coordinate space of x and y: normalized canvas units or client pixels.",
      },
      {
        name: "position.active",
        type: "boolean",
        defaultValue: "true",
        description: "Set false to release the virtual pointer.",
      },
    ],
  },
  {
    id: "interaction-filament",
    title: "Interaction — filament pointer",
    description:
      "HeroWaveFilamentPointerConfig — propagates local deformation impulses when the pointer crosses the rendered filament.",
    rows: [
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "false",
        description: "Enables pointer-triggered filament impulses.",
      },
      {
        name: "target",
        type: '"canvas" | "viewport"',
        defaultValue: '"canvas"',
        description:
          "Area that receives pointer input; the pointer still has to reach the filament radius.",
      },
      {
        name: "pointerTypes",
        type: 'readonly ("mouse" | "pen" | "touch")[]',
        defaultValue: '["mouse", "pen", "touch"]',
        description: "Pointer types allowed to generate impulses.",
      },
      {
        name: "radius",
        type: "number",
        defaultValue: "80",
        description: "Maximum pointer-to-filament distance in CSS pixels.",
      },
      {
        name: "strength",
        type: "number",
        defaultValue: "0.045",
        description: "Peak normal displacement relative to canvas height.",
      },
      {
        name: "propagationSpeed",
        type: "number",
        defaultValue: "0.72",
        description: "Wave-front speed in normalized path lengths per second.",
      },
      {
        name: "frequency",
        type: "number",
        defaultValue: "2.8",
        description: "Oscillation frequency behind the propagating front.",
      },
      {
        name: "damping",
        type: "number",
        defaultValue: "2.2",
        description: "Temporal exponential damping.",
      },
      {
        name: "spatialDecay",
        type: "number",
        defaultValue: "0.8",
        description: "Energy loss per normalized path length.",
      },
      {
        name: "duration",
        type: "number",
        defaultValue: "2.4",
        description: "Lifetime of one impulse in seconds.",
      },
      {
        name: "cooldown",
        type: "number",
        defaultValue: "0.07",
        description: "Minimum delay between generated impulses in seconds.",
      },
      {
        name: "maxImpulses",
        type: "number",
        defaultValue: "8",
        description: "Maximum simultaneous impulses retained per filament.",
      },
      {
        name: "direction",
        type: '"push" | "pull" | "alternate"',
        defaultValue: '"push"',
        description: "Displacement direction relative to the pointer side.",
      },
    ],
  },
  {
    id: "dots",
    title: "Dots",
    description:
      "HeroWaveDotsConfig — the ambient dot field behind the filament.",
    rows: [
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "true",
        description: "Renders the dot layer.",
      },
      {
        name: "mode",
        type: '"flat" | "terrain"',
        defaultValue: '"flat"',
        description: "Flat 2D grid or perspective 3D terrain of dots.",
      },
      {
        name: "spacing",
        type: "number",
        defaultValue: "26",
        description: "Flat-grid dot spacing in CSS pixels.",
      },
      {
        name: "opacity",
        type: "number",
        defaultValue: "0.45",
        description: "Overall dot layer opacity.",
      },
      {
        name: "twinkle",
        type: "number",
        defaultValue: "0.6",
        description: "Amount of per-dot brightness animation.",
      },
      {
        name: "reflect",
        type: "number",
        defaultValue: "0.8",
        description: "Strength of the filament light picked up by dots.",
      },
      {
        name: "maskFeather",
        type: "number",
        defaultValue: "0.55",
        description: "Default edge feather applied to the dot masks.",
      },
      {
        name: "masks",
        type: "readonly HeroDotMask[]",
        defaultValue:
          '[{ id: "left", x: 0.26, y: 0.52, radius: 0.72 },\n{ id: "right", x: 0.78, y: 0.5, radius: 0.74 }]',
        description: "Up to 8 circular masks limiting where dots are visible.",
      },
      {
        name: "masks[].id",
        type: "string",
        description: "Required stable identifier for the mask.",
      },
      {
        name: "masks[].x",
        type: "number",
        description: "Horizontal center, 0 = left and 1 = right.",
      },
      {
        name: "masks[].y",
        type: "number",
        description: "Vertical center, 0 = bottom and 1 = top.",
      },
      {
        name: "masks[].radius",
        type: "number",
        description: "Radius relative to viewport height.",
      },
      {
        name: "masks[].feather",
        type: "number",
        description:
          "Optional feather override for this mask; falls back to maskFeather.",
      },
      {
        name: "terrain.columns",
        type: "number",
        defaultValue: "112",
        description: "Number of dot columns in the terrain grid.",
      },
      {
        name: "terrain.rows",
        type: "number",
        defaultValue: "72",
        description: "Number of dot rows in the terrain grid.",
      },
      {
        name: "terrain.width",
        type: "number",
        defaultValue: "7.2",
        description: "Terrain plane width in world units.",
      },
      {
        name: "terrain.depth",
        type: "number",
        defaultValue: "6.2",
        description: "Terrain plane depth in world units.",
      },
      {
        name: "terrain.amplitude",
        type: "number",
        defaultValue: "0.42",
        description: "Height of the animated terrain waves.",
      },
      {
        name: "terrain.pointSize",
        type: "number",
        defaultValue: "2.1",
        description: "Dot size in CSS pixels.",
      },
      {
        name: "terrain.speed",
        type: "number",
        defaultValue: "0.28",
        description: "Speed of the terrain wave animation.",
      },
      {
        name: "terrain.viewAngle",
        type: "number",
        defaultValue: "52",
        description: "Camera tilt over the terrain in degrees.",
      },
      {
        name: "terrain.cameraDistance",
        type: "number",
        defaultValue: "3.2",
        description: "Camera distance from the terrain plane.",
      },
      {
        name: "terrain.frequency",
        type: "number",
        defaultValue: "1.5",
        description: "Spatial frequency of the terrain waves.",
      },
      {
        name: "terrain.opacity",
        type: "number",
        defaultValue: "0.52",
        description: "Opacity of the terrain dots.",
      },
      {
        name: "terrain.edgeFade",
        type: "number",
        defaultValue: "0.12",
        description: "Fades dots near the terrain edges.",
      },
      {
        name: "terrain.fit",
        type: '"fixed" | "cover"',
        defaultValue: '"fixed"',
        description:
          "Fixed keeps world size constant; cover scales the plane to fill the canvas.",
      },
      {
        name: "terrain.contentFade",
        type: "number",
        defaultValue: "0.48",
        description:
          "Clears space around the hero content without introducing another layer.",
      },
      {
        name: "terrain.colorLow",
        type: "string",
        defaultValue: '"#2438ff"',
        description: "Dot color at terrain valleys.",
      },
      {
        name: "terrain.colorHigh",
        type: "string",
        defaultValue: '"#22f25f"',
        description: "Dot color at terrain peaks.",
      },
      {
        name: "interaction.enabled",
        type: "boolean",
        defaultValue: "false",
        description: "Enables pointer interaction with the dot field.",
      },
      {
        name: "interaction.radius",
        type: "number",
        defaultValue: "140",
        description: "Circular influence radius in CSS pixels.",
      },
      {
        name: "interaction.softness",
        type: "number",
        defaultValue: "0.55",
        description:
          "Fraction of the radius used to feather the interaction edge.",
      },
      {
        name: "interaction.brightness",
        type: "number",
        defaultValue: "1.1",
        description:
          "Local dot-energy multiplier; zero keeps the original brightness.",
      },
      {
        name: "interaction.color",
        type: "string",
        defaultValue: '"#1adff5"',
        description: "Optional color pulled into dots under the pointer.",
      },
      {
        name: "interaction.colorStrength",
        type: "number",
        defaultValue: "0.65",
        description: "Blend amount of the interaction color.",
      },
      {
        name: "interaction.magnification",
        type: "number",
        defaultValue: "1.55",
        description: "Circular lens scale for the flat grid; one is neutral.",
      },
      {
        name: "interaction.terrainDisplacement",
        type: "number",
        defaultValue: "0.55",
        description: "Signed height impulse for terrain dots.",
      },
    ],
  },
  {
    id: "glass-text",
    title: "Glass text",
    description:
      "HeroWaveGlassTextConfig — refractive glass typography or an SVG mask rendered by the WebGL glass pass.",
    rows: [
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "false",
        description: "Enables the glass overlay.",
      },
      {
        name: "shape",
        type: '"text" | "svg"',
        defaultValue: '"text"',
        description: "Builds the glass mask from text glyphs or an SVG path.",
      },
      {
        name: "text",
        type: "string",
        defaultValue: '""',
        description: "Text content rendered as the glass mask.",
      },
      {
        name: "svgPath",
        type: "string",
        defaultValue: '""',
        description: 'SVG path data used when shape is "svg".',
      },
      {
        name: "svgViewBox",
        type: "readonly [number, number, number, number] | HeroWaveSvgViewBoxObject",
        defaultValue: "[0, 0, 100, 100]",
        description: "Coordinate system of the glass svgPath.",
      },
      {
        name: "fontFamily",
        type: "string",
        defaultValue: '"Inter, ui-sans-serif, system-ui, sans-serif"',
        description: "Font stack used to rasterize the text mask.",
      },
      {
        name: "fontWeight",
        type: "number | string",
        defaultValue: "750",
        description: "Font weight of the text mask.",
      },
      {
        name: "fontSize",
        type: "number",
        defaultValue: "96",
        description: "Base font size in CSS pixels before fitting.",
      },
      {
        name: "lineHeight",
        type: "number",
        defaultValue: "0.94",
        description: "Line height multiplier for multi-line text.",
      },
      {
        name: "letterSpacing",
        type: "number",
        defaultValue: "-2",
        description: "Letter spacing in CSS pixels.",
      },
      {
        name: "wrap",
        type: '"auto" | "explicit"',
        defaultValue: '"auto"',
        description:
          "Wraps words to maxWidth or preserves only explicit newline positions. DOM content tracking selects explicit automatically.",
      },
      {
        name: "center.x",
        type: "number",
        defaultValue: "0.5",
        description:
          "Horizontal center of the glass mask in normalized canvas coordinates.",
      },
      {
        name: "center.y",
        type: "number",
        defaultValue: "0.5",
        description:
          "Vertical center of the glass mask in normalized canvas coordinates.",
      },
      {
        name: "maxWidth",
        type: "number",
        defaultValue: "0.82",
        description: "Maximum text width as a fraction of the canvas width.",
      },
      {
        name: "maxHeight",
        type: "number",
        defaultValue: "0.42",
        description: "Maximum text height as a fraction of the canvas height.",
      },
      {
        name: "dom.target",
        type: "string | HTMLElement | RefObject<HTMLElement>",
        defaultValue: "undefined",
        description:
          "Optional CSS selector, element, or React ref whose content, typography, and bounds the text mask follows.",
      },
      {
        name: "dom.syncContent",
        type: "boolean",
        defaultValue: "true",
        description:
          "Uses the target's rendered text, including explicit line breaks.",
      },
      {
        name: "dom.syncTypography",
        type: "boolean",
        defaultValue: "true",
        description:
          "Uses the target's computed font family, weight, size, line height, and letter spacing.",
      },
      {
        name: "dom.padding",
        type: "number | { x?: number; y?: number }",
        defaultValue: "0",
        description:
          "Extra CSS-pixel room around the measured DOM element. Bounds and placement are always synchronized.",
      },
      {
        name: "refraction",
        type: "number",
        defaultValue: "18",
        description: "Refraction displacement strength in CSS pixels.",
      },
      {
        name: "edgeWrap",
        type: "number",
        defaultValue: "0",
        description:
          "Pulls background colors around the glass boundary, in CSS pixels.",
      },
      {
        name: "surfaceModel",
        type: '"simple" | "volumetric"',
        defaultValue: '"simple"',
        description: "Optical model used to shade the glass surface.",
      },
      {
        name: "bevelMode",
        type: '"biconvex" | "dome"',
        defaultValue: '"biconvex"',
        description: "Cross-section profile of the volumetric surface.",
      },
      {
        name: "surfaceDepth",
        type: "number",
        defaultValue: "40",
        description: "Depth of the volumetric surface in CSS pixels.",
      },
      {
        name: "ior",
        type: "number",
        defaultValue: "1.5",
        description: "Index of refraction of the volumetric model.",
      },
      {
        name: "magnification",
        type: "number",
        defaultValue: "0",
        description: "Uniform lens strength; zero disables magnification.",
      },
      {
        name: "magnificationX",
        type: "number",
        defaultValue: "0",
        description: "Overrides uniform magnification on the horizontal axis.",
      },
      {
        name: "magnificationY",
        type: "number",
        defaultValue: "0",
        description: "Overrides uniform magnification on the vertical axis.",
      },
      {
        name: "displacement.x",
        type: "number",
        defaultValue: "0",
        description: "Horizontal optical sample offset in CSS pixels.",
      },
      {
        name: "displacement.y",
        type: "number",
        defaultValue: "0",
        description:
          "Vertical optical sample offset in CSS pixels; positive moves downward.",
      },
      {
        name: "diffusion",
        type: "number",
        defaultValue: "0",
        description: "Broad internal light transport across the letter.",
      },
      {
        name: "blur",
        type: "number",
        defaultValue: "0.2",
        description: "Blur of the refracted background sample.",
      },
      {
        name: "distortion",
        type: "number",
        defaultValue: "0.04",
        description: "Non-uniform wobble of the refraction field.",
      },
      {
        name: "chromaticAberration",
        type: "number",
        defaultValue: "2.4",
        description: "Per-channel refraction offset in CSS pixels.",
      },
      {
        name: "frost",
        type: "number",
        defaultValue: "0.08",
        description: "Frosted-glass scattering amount.",
      },
      {
        name: "roughness",
        type: "number",
        defaultValue: "0.18",
        description: "Micro-surface roughness of the glass.",
      },
      {
        name: "bevel",
        type: "number",
        defaultValue: "1",
        description: "Strength of the edge bevel shading.",
      },
      {
        name: "ribStrength",
        type: "number",
        defaultValue: "0",
        description: "Strength of the ribbed-glass relief pattern.",
      },
      {
        name: "ribWidth",
        type: "number",
        defaultValue: "18",
        description: "Rib spacing in CSS pixels.",
      },
      {
        name: "ribAngle",
        type: "number",
        defaultValue: "-18",
        description: "Rib orientation in degrees.",
      },
      {
        name: "liquidStrength",
        type: "number",
        defaultValue: "0",
        description: "Strength of the animated liquid distortion.",
      },
      {
        name: "liquidScale",
        type: "number",
        defaultValue: "3.2",
        description: "Spatial scale of the liquid distortion.",
      },
      {
        name: "liquidSpeed",
        type: "number",
        defaultValue: "0.22",
        description: "Animation speed of the liquid distortion.",
      },
      {
        name: "edgeStrength",
        type: "number",
        defaultValue: "0.72",
        description: "Brightness of the glass rim light.",
      },
      {
        name: "specular",
        type: "number",
        defaultValue: "0.68",
        description: "Specular highlight intensity.",
      },
      {
        name: "fresnel",
        type: "number",
        defaultValue: "0.5",
        description: "Angle-dependent reflectivity of the surface.",
      },
      {
        name: "twinkle",
        type: "number",
        defaultValue: "0",
        description:
          "Animated star-like reflections inside the glass mask; zero disables them.",
      },
      {
        name: "twinkleDensity",
        type: "number",
        defaultValue: "0.28",
        description: "Fraction of sparkle cells that light up during a pulse.",
      },
      {
        name: "twinkleSpeed",
        type: "number",
        defaultValue: "0.8",
        description: "Pulse cycles per second.",
      },
      {
        name: "twinkleSize",
        type: "number",
        defaultValue: "28",
        description: "Average spacing between sparkle cells in CSS pixels.",
      },
      {
        name: "tint",
        type: "string",
        defaultValue: '"#dffcff"',
        description: "Tint color mixed into the glass.",
      },
      {
        name: "tintStrength",
        type: "number",
        defaultValue: "0.08",
        description: "Blend amount of the tint color.",
      },
      {
        name: "saturation",
        type: "number",
        defaultValue: "0",
        description: "Signed saturation adjustment of the refracted sample.",
      },
      {
        name: "brightness",
        type: "number",
        defaultValue: "0",
        description: "Signed brightness adjustment of the refracted sample.",
      },
      {
        name: "opacity",
        type: "number",
        defaultValue: "0.92",
        description: "Overall opacity of the glass overlay.",
      },
      {
        name: "intro.delay",
        type: "number",
        defaultValue: "0",
        description: "Delay before the reveal starts, in milliseconds.",
      },
      {
        name: "intro.duration",
        type: "number",
        defaultValue: "0",
        description:
          "Fade and focus duration in milliseconds; zero reveals immediately.",
      },
      {
        name: "intro.blur",
        type: "number",
        defaultValue: "0",
        description: "Initial signed-distance blur radius, in CSS pixels.",
      },
      {
        name: "intro.offsetY",
        type: "number",
        defaultValue: "0",
        description: "Initial vertical offset, in CSS pixels.",
      },
      {
        name: "intro.easing",
        type: "HeroWaveFadeEasingPreset | [number, number, number, number]",
        defaultValue: "[0, 0, 1, 1]",
        description: "Uses the same easing contract as the canvas fade-in.",
      },
    ],
  },
  {
    id: "background-image",
    title: "Background image",
    description:
      "HeroWaveBackgroundImageConfig — an image drawn behind the wave layers.",
    rows: [
      {
        name: "src",
        type: "string",
        defaultValue: '""',
        description: "Image URL; an empty string disables the layer.",
      },
      {
        name: "fit",
        type: '"cover" | "contain" | "stretch"',
        defaultValue: '"cover"',
        description: "How the image is fitted to the canvas.",
      },
      {
        name: "opacity",
        type: "number",
        defaultValue: "1",
        description: "Opacity of the background image.",
      },
    ],
  },
  {
    id: "music-visualizer",
    title: "Music visualizer",
    description:
      "HeroWaveMusicVisualizerConfig — audio-reactive modulation of the filament.",
    rows: [
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "false",
        description: "Enables audio analysis and modulation.",
      },
      {
        name: "source",
        type: '"element" | "microphone"',
        defaultValue: '"element"',
        description:
          "Analyse an existing HTMLMediaElement by id, or request a microphone stream.",
      },
      {
        name: "elementId",
        type: "string",
        defaultValue: '""',
        description:
          'DOM id of the media element used when source is "element".',
      },
      {
        name: "fftSize",
        type: "256 | 512 | 1024 | 2048",
        defaultValue: "1024",
        description: "FFT window size of the analyser node.",
      },
      {
        name: "smoothing",
        type: "number",
        defaultValue: "0.78",
        description: "Analyser smoothing time constant (0 to 0.99).",
      },
      {
        name: "sensitivity",
        type: "number",
        defaultValue: "1",
        description: "Gain applied to the analysed level.",
      },
      {
        name: "band",
        type: '"energy" | "bass" | "mid" | "treble"',
        defaultValue: '"energy"',
        description: "Frequency band driving the modulation.",
      },
      {
        name: "deformation",
        type: "number",
        defaultValue: "0",
        description: "Normal displacement relative to the canvas height.",
      },
      {
        name: "deformationFrequency",
        type: "number",
        defaultValue: "3",
        description: "Spatial frequency of the audio deformation wave.",
      },
      {
        name: "width",
        type: "number",
        defaultValue: "0",
        description: "Audio-driven stroke width gain.",
      },
      {
        name: "intensity",
        type: "number",
        defaultValue: "0",
        description: "Audio-driven emissive intensity gain.",
      },
      {
        name: "glow",
        type: "number",
        defaultValue: "0",
        description: "Audio-driven glow gain.",
      },
      {
        name: "hue",
        type: "number",
        defaultValue: "0",
        description: "Audio-driven hue rotation in degrees.",
      },
      {
        name: "reflection",
        type: "number",
        defaultValue: "0",
        description: "Audio-driven reflection gain.",
      },
    ],
  },
  {
    id: "quality",
    title: "Quality",
    description:
      'HeroWaveQualityConfig — defaults depend on the resolved preset; "auto" picks "high" or "balanced" from device memory and cores. Values below read ultra / high / balanced / low.',
    rows: [
      {
        name: "preset",
        type: '"auto" | "ultra" | "high" | "balanced" | "low"',
        defaultValue: '"auto"',
        description: "Base preset providing every value below.",
      },
      {
        name: "maxDpr",
        type: "number",
        defaultValue: "2 / 1.5 / 1.25 / 1",
        description: "Maximum device pixel ratio used for the drawing buffer.",
      },
      {
        name: "maxFps",
        type: "number",
        defaultValue: "0 / 60 / 60 / 45",
        description: "Frame-rate cap; 0 disables frame throttling.",
      },
      {
        name: "flatnessPx",
        type: "number",
        defaultValue: "0.05 / 0.08 / 0.14 / 0.28",
        description: "Adaptive-sampling flatness tolerance in pixels.",
      },
      {
        name: "maxChordPx",
        type: "number",
        defaultValue: "1.5 / 2.5 / 4 / 7",
        description: "Maximum chord length between path samples in pixels.",
      },
      {
        name: "maxSamples",
        type: "number",
        defaultValue: "32768 / 32768 / 24576 / 16384",
        description: "Upper bound on generated path samples.",
      },
      {
        name: "maxSubdivisionDepth",
        type: "number",
        defaultValue: "20 / 18 / 17 / 15",
        description: "Maximum recursive subdivision depth of the sampler.",
      },
      {
        name: "farScale",
        type: "number",
        defaultValue: "0.08 / 0.0625 / 0.05 / 0.04",
        description: "Resolution scale of the far (atmosphere) render pass.",
      },
      {
        name: "midScale",
        type: "number",
        defaultValue: "0.34 / 0.25 / 0.2 / 0.125",
        description: "Resolution scale of the mid (body) render pass.",
      },
      {
        name: "coreScale",
        type: "number",
        defaultValue: "1 / 1 / 0.8 / 0.55",
        description: "Resolution scale of the core render pass.",
      },
      {
        name: "farMaxDimension",
        type: "number",
        defaultValue: "1536 / 1024 / 768 / 512",
        description: "Maximum texture dimension of the far pass.",
      },
      {
        name: "midMaxDimension",
        type: "number",
        defaultValue: "3072 / 2048 / 1536 / 1024",
        description: "Maximum texture dimension of the mid pass.",
      },
      {
        name: "coreMaxDimension",
        type: "number",
        defaultValue: "6144 / 4096 / 3072 / 2048",
        description: "Maximum texture dimension of the core pass.",
      },
      {
        name: "farMaxChordPx",
        type: "number",
        defaultValue: "64 / 96 / 120 / 160",
        description: "Chord limit of the far-pass geometry.",
      },
      {
        name: "midMaxChordPx",
        type: "number",
        defaultValue: "28 / 48 / 64 / 90",
        description: "Chord limit of the mid-pass geometry.",
      },
      {
        name: "coreMaxChordPx",
        type: "number",
        defaultValue: "6 / 12 / 18 / 28",
        description: "Chord limit of the core-pass geometry.",
      },
      {
        name: "farFlatnessPx",
        type: "number",
        defaultValue: "2 / 4 / 5 / 7",
        description: "Flatness tolerance of the far-pass geometry.",
      },
      {
        name: "midFlatnessPx",
        type: "number",
        defaultValue: "0.45 / 1 / 1.5 / 2.5",
        description: "Flatness tolerance of the mid-pass geometry.",
      },
      {
        name: "coreFlatnessPx",
        type: "number",
        defaultValue: "0.09 / 0.2 / 0.32 / 0.6",
        description: "Flatness tolerance of the core-pass geometry.",
      },
      {
        name: "quadrature",
        type: "2 | 4",
        defaultValue: "4 / 4 / 2 / 2",
        description: "Number of quadrature taps used by the glow integral.",
      },
    ],
  },
  {
    id: "scene-filaments",
    title: "Scene filaments",
    description:
      "HeroWaveFilamentConfig — per-filament entry of a multi-filament scene; unset sections inherit the root configuration.",
    rows: [
      {
        name: "id",
        type: "string",
        description: "Required unique identifier of the filament.",
      },
      {
        name: "enabled",
        type: "boolean",
        defaultValue: "true",
        description: "Set false to skip rendering this filament.",
      },
      {
        name: "timeOffset",
        type: "number",
        defaultValue: "0",
        description:
          "Per-filament offset on the shared scene timeline, in seconds.",
      },
      {
        name: "playbackRate",
        type: "number",
        defaultValue: "1",
        description: "Per-filament multiplier on the shared scene timeline.",
      },
      {
        name: "path",
        type: "HeroWavePathConfig",
        description: "Path override; inherits the root path when omitted.",
      },
      {
        name: "shape",
        type: "HeroWaveShapeConfig",
        description: "Shape override; inherits the root shape when omitted.",
      },
      {
        name: "motion",
        type: "HeroWaveMotionConfig",
        description: "Motion override; inherits the root motion when omitted.",
      },
      {
        name: "propagation",
        type: "HeroWavePropagationOptions",
        description:
          "Propagation override; inherits the root propagation when omitted.",
      },
      {
        name: "profiles",
        type: "HeroWaveLongitudinalProfiles",
        description:
          "Profiles override; inherits the root profiles when omitted.",
      },
      {
        name: "material",
        type: "HeroWaveMaterialPreset | HeroWaveMaterialConfig",
        description:
          "Material override; inherits the root material when omitted.",
      },
      {
        name: "palette",
        type: "HeroWavePaletteConfig",
        description:
          "Palette override; inherits the root palette when omitted.",
      },
      {
        name: "interaction",
        type: "HeroWaveInteractionConfig",
        description:
          "Interaction override; inherits the root interaction when omitted.",
      },
      {
        name: "quality",
        type: "HeroWaveQualityPreset | HeroWaveQualityConfig",
        description:
          "Quality override; inherits the root quality when omitted.",
      },
    ],
  },
  {
    id: "handle-and-events",
    title: "Imperative handle & events",
    description:
      "HeroWaveBackgroundHandle methods exposed via ref, and the payload types passed to callbacks.",
    rows: [
      {
        name: "play()",
        type: "() => void",
        description: "Resumes the internal animation clock.",
      },
      {
        name: "pause()",
        type: "() => void",
        description: "Pauses the internal animation clock.",
      },
      {
        name: "seek(time)",
        type: "(time: number) => void",
        description: "Jumps the clock to an absolute time in seconds.",
      },
      {
        name: "step(seconds)",
        type: "(seconds: number) => void",
        description: "Advances the clock by a signed number of seconds.",
      },
      {
        name: "getTime()",
        type: "() => number",
        description: "Returns the current clock time in seconds.",
      },
      {
        name: "invalidate()",
        type: "() => void",
        description: "Requests a redraw without changing the clock.",
      },
      {
        name: "HeroWaveRendererStatus.renderer",
        type: '"sine" | "hdr" | "unavailable"',
        description: "Which renderer is active after capability detection.",
      },
      {
        name: "HeroWaveRendererStatus.supported",
        type: "boolean",
        description: "True when WebGL rendering is available at all.",
      },
      {
        name: "HeroWaveRendererStatus.approximate",
        type: "boolean",
        description:
          "True when the renderer intentionally approximates unsupported features.",
      },
      {
        name: "HeroWaveRendererStatus.reason",
        type: "string",
        description: "Human-readable explanation of a fallback or failure.",
      },
      {
        name: "HeroWaveRendererStatus.webglVersion",
        type: "1 | 2",
        description: "WebGL context version in use.",
      },
      {
        name: "HeroWavePerformanceSample.frame",
        type: "number",
        description:
          "Monotonic rendered-frame index for this component instance.",
      },
      {
        name: "HeroWavePerformanceSample.time",
        type: "number",
        description: "Renderer clock in seconds.",
      },
      {
        name: "HeroWavePerformanceSample.frameMs",
        type: "number",
        description:
          "Time between rendered frames, excluding intentionally throttled RAF callbacks.",
      },
      {
        name: "HeroWavePerformanceSample.cpuMs",
        type: "number",
        description:
          "Main-thread time spent preparing and submitting the sampled frame.",
      },
      {
        name: "HeroWavePerformanceSample.gpuMs",
        type: "number",
        description:
          "Asynchronous GPU time when EXT_disjoint_timer_query_webgl2 is available.",
      },
      {
        name: "HeroWavePerformanceSample.gpuDisjoint",
        type: "boolean",
        description:
          "True when the GPU invalidated the timer result, for example after clock changes.",
      },
      {
        name: "HeroWavePerformanceSample.renderer",
        type: '"sine" | "hdr" | "unavailable"',
        description: "Renderer that produced the sampled frame.",
      },
      {
        name: "HeroWaveCycleEvent.index",
        type: "number",
        description: "Number of completed cycles so far.",
      },
      {
        name: "HeroWaveCycleEvent.direction",
        type: "1 | -1",
        description: "Traversal direction of the completed cycle.",
      },
      {
        name: "HeroWaveCycleEvent.time",
        type: "number",
        description: "Clock time at which the cycle completed, in seconds.",
      },
      {
        name: "HeroWaveCycleEvent.filamentId",
        type: "string",
        description: "Identifier of the filament that completed the cycle.",
      },
    ],
  },
];
