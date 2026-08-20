# Final renderer provenance

Frozen original comparison: `7f4289aa3ff640f479701ceec0b0d790af037692`.

The committed `src/` tree contains the directly selected renderer stack:

- exact CTA source-instanced q4 integration and support bounds;
- split idle dots with local exact pointer-warp fallback;
- bounded glass effect and persistent framebuffer resources;
- shared path segment upload, cached source-integral VAOs and static uniforms;
- Hero HDR temporal anchors at 15 Hz;
- stable anchored CTA HDR temporal anchors at 10 Hz;
- immediate frame-by-frame fallback while the pointer is active;
- static non-temporal CTA composite shaders;
- generic fallback for unsupported settings.

This file and the materialized source are generated together, then TypeScript,
Biome and the production build are rerun before the commit is pushed.
