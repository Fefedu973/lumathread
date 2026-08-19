# Per-source support bounds

The source-instanced CTA renderer originally expanded every quadrature source to the worst longitudinal profile width and glow observed anywhere on the filament. This experiment computes the same conservative cutoff from the width, glow and upper/lower spread sampled for each individual source, capped by the former global rectangle.

It changes only raster coverage; every fragment that is still generated executes the identical shader. The global integral renderer and all non-anchored configurations remain unchanged.
