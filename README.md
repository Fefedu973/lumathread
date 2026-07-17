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
- WebGL1 legacy fallback when the exact renderer is unavailable
- Dark and light rendering themes

## Development

```bash
bun install
bun run dev
```

The Vite demo exposes three compact presets and reports the active renderer.

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

## Browser requirements

The exact free-path renderer prefers WebGL2 with floating-point render targets
and blending. `pathRenderer="auto"` falls back to the included WebGL1 renderer
when required capabilities are missing. The analytic sine renderer remains the
least expensive path.

## Origin and status

The initial source snapshot comes from the current OpenBacktest working tree.
OpenBacktest keeps its existing in-app copy for now; this repository is the new
home for future renderer work. No public license has been selected yet.
