# LumaThread

LumaThread is a composable WebGL luminous-filament renderer for React. It was
extracted from the OpenBacktest landing-page renderer so the visual engine can
be developed, tested, and versioned independently from the product.

The repository is private while the API and packaging are being stabilized.

## Highlights

- Analytic sine, organic, custom, SVG, and pointer-follow paths
- HDR multi-contribution rendering for smooth intersections
- Travel, anchored, and propagated motion
- Longitudinal width, opacity, intensity, glow, and color profiles
- Multi-filament scenes
- Flat and terrain dot fields with pointer interaction
- Refractive text or SVG glass masks
- Music-reactive deformation and material response
- Dark and light rendering themes

## Development

```bash
bun install
bun run dev
```

The Vite homepage exposes three compact presets and reports the active
renderer. The complete configuration laboratory is available at:

```text
http://localhost:5173/dev/hero-background
```

The regression benchmark compares the frozen extraction snapshot with the
current renderer under the same deterministic scene. It reports rolling FPS,
median and P95 frame times, and frames over 25 ms:

```text
http://localhost:5173/dev/benchmark
```

Both routes are part of the static GitHub Pages build. The deployment workflow
publishes them under the repository prefix after changes reach `main`.

## Build

```bash
bun run check
bun run build
```

The library build is emitted to `dist/` with TypeScript declarations. React is
kept external and declared as a peer dependency.

## Usage

```tsx
import { LumaThread } from "lumathread";

export function HeroBackground() {
  return (
    <section style={{ position: "relative", minHeight: 640, overflow: "hidden" }}>
      <LumaThread
        path={{ mode: "organic" }}
        motion={{ mode: "travel", speed: 0.65, segmentLength: 0.86 }}
        material={{ preset: "soft-aurora", intensity: 0.9, glow: 1.1 }}
        palette={{
          stops: [
            { id: "blue", color: "#315bff", offset: 0 },
            { id: "cyan", color: "#22d3ee", offset: 0.5 },
            { id: "green", color: "#22f25f", offset: 1 },
          ],
          interpolation: "oklab",
          wrap: "repeat",
        }}
      />
    </section>
  );
}
```

`HeroWaveBackground` and `HeroWaveScene` remain exported under their original
names for source compatibility. `LumaThread` and `LumaThreadScene` are aliases.

### Pointer-triggered filament waves

Pointer interaction can disturb an existing path without replacing it with a
cursor-follow trail. It is disabled by default and only switches a sine scene
to the HDR path pipeline when explicitly enabled.

```tsx
<LumaThread
  path={{ mode: "organic" }}
  interaction={{
    filament: {
      enabled: true,
      target: "canvas",
      radius: 80,
      strength: 0.045,
      propagationSpeed: 0.72,
      frequency: 2.8,
      damping: 2.2,
      spatialDecay: 0.8,
      duration: 2.4,
      direction: "push",
    },
  }}
/>
```

Use `direction: "pull"` to attract the filament toward the pointer or
`"alternate"` to alternate the impulse side. Closed paths propagate across the
shortest side of their seam.

## Browser requirements

Free paths use the exact HDR renderer and require WebGL2 with floating-point
render targets and blending. Unsupported devices are reported explicitly; no
approximate legacy renderer is bundled. The analytic sine renderer remains the
least expensive path.

## Origin and status

The initial source snapshot comes from the current OpenBacktest working tree.
OpenBacktest keeps its existing in-app copy for now; this repository is the new
home for future renderer work. No public license has been selected yet.
