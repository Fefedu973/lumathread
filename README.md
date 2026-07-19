# LumaThread

LumaThread is a composable WebGL luminous-filament renderer for React. It was
extracted from the OpenBacktest landing-page renderer so the visual engine can
be developed, tested, and versioned independently from the product.

The API is still being stabilized, but the component is distributed as editable
source through its shadcn registry.

## Demo

Explore the live component showcase, complete API reference, and full visual
laboratory at [fefedu973.github.io/lumathread](https://fefedu973.github.io/lumathread/).


https://github.com/user-attachments/assets/3323b88a-c341-439f-a00d-8d49ca5c9455


## Highlights

- Analytic sine, organic, custom, SVG, and pointer-follow paths
- HDR multi-contribution rendering for smooth intersections
- Travel, anchored, and propagated motion
- Longitudinal width, opacity, intensity, glow, and color profiles
- Multi-filament scenes
- Flat and terrain dot fields with pointer interaction
- Refractive text or SVG glass masks
- Glass-only blur/fade entrances and optional DOM-aligned typography
- Music-reactive deformation and material response
- Dark and light rendering themes

## Development

```bash
bun install
bun run dev
```

The repository is split in two: `src/` holds the library (the only code
published to `dist/`), and `site/` holds the documentation website — a
shadcn/ui + Tailwind CSS v4 app configured through `components.json`.

The homepage documents the component with live demos, a preset showcase, and
the complete props reference. The full configuration laboratory is available
at:

```text
http://localhost:5173/lab
```

(The lab's previous address, `/dev/hero-background`, still resolves.) Both
routes are part of the static GitHub Pages build. The deployment workflow
publishes them under the repository prefix after changes reach `main`.

## Install

Install the component directly from the public GitHub Pages registry:

```bash
bunx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json
```

The command writes the complete modular renderer to
`@/components/ui/lumathread`. You own the installed source and can import its
public entry point without adding a LumaThread runtime dependency:

```tsx
import { LumaThread } from "@/components/ui/lumathread";
```

To use the GitHub Pages registry as a namespace, register it once and then add
the item by name:

```bash
bunx shadcn@latest registry add @lumathread=https://fefedu973.github.io/lumathread/r/{name}.json
bunx shadcn@latest add @lumathread/lumathread
```

The catalog is published at
`https://fefedu973.github.io/lumathread/r/registry.json` and the installable
item at `https://fefedu973.github.io/lumathread/r/lumathread.json`.

## Build

```bash
bun run check
bun run build
```

The library build is emitted to `dist/` with TypeScript declarations. React is
kept external and declared as a peer dependency.

## Usage

```tsx
import { LumaThread } from "@/components/ui/lumathread";

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

### Glass text entrance and DOM tracking

The initial scene reveal leaves glass fully visible by default, so the filament
can fade in behind an already-present refractive mask. Set
`fadeInAffectsGlassText` to `true` when the glass should fade with the rest of
the canvas.

The glass pass also has its own optional entrance. It does not change the scene
fade or any regular DOM content: only the refractive text/SVG mask fades from a
blurred, offset state into its final material.

```tsx
<LumaThread
  fadeInDuration={900}
  fadeInAffectsGlassText={false}
  glassText={{
    enabled: true,
    text: "Replay the market.",
    intro: {
      delay: 120,
      duration: 600,
      blur: 12,
      offsetY: 16,
      easing: [0.21, 0.47, 0.32, 0.98],
    },
  }}
/>
```

A text mask can also mirror an actual DOM heading. The target may be a CSS
selector, an `HTMLElement`, or a React ref. LumaThread observes the element,
the canvas, font loading, scrolling, and content changes; it does not hide or
otherwise mutate the source element. Browser-created line breaks, including
`text-wrap: balance`, are measured from the rendered glyphs and preserved by
the canvas mask.

```tsx
const titleRef = useRef<HTMLHeadingElement>(null);

return (
  <section className="hero">
    <LumaThread
      glassText={{
        enabled: true,
        dom: {
          target: titleRef,
          syncContent: true,
          syncTypography: true,
          padding: { x: 12, y: 5 },
        },
        intro: { duration: 600, blur: 12, offsetY: 16 },
      }}
    />
    <h1 ref={titleRef}>Replay the market.</h1>
  </section>
);
```

Set `syncContent` or `syncTypography` to `false` to retain the corresponding
manual `glassText` values while still following the target bounds. DOM
tracking is available for text masks; SVG masks continue to use their explicit
view box and placement.

## Browser requirements

Free paths use the exact HDR renderer and require WebGL2 with floating-point
render targets and blending. Unsupported devices are reported explicitly; no
approximate legacy renderer is bundled. The analytic sine renderer remains the
least expensive path.

## Registry development

The registry definition is kept at the repository root and generated with the
official shadcn CLI:

```bash
bun run registry:validate
bun run registry:build
```

`registry:build` writes the catalog and item into `site-dist/r`, which is
deployed alongside the documentation by the GitHub Pages workflow.

## Origin and status

The initial source snapshot comes from the current OpenBacktest working tree.
OpenBacktest keeps its existing in-app copy for now; this repository is the new
home for future renderer work. No public license has been selected yet.
