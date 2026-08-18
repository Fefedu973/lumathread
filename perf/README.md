# Renderer performance and visual-parity harness

This harness reproduces the two production surfaces supplied for the renderer optimization work:

- the travelling hero orbit with `soft-aurora`, interactive flat dots, and volumetric glass text;
- the anchored CTA accent with cascade pointer following, `neon`, reflected interactive dots, and two-line volumetric glass text.

The hero trajectory and all renderer/material/palette/dot/glass values come from the production excerpt. The CTA excerpt references application-local accent builders and profile constants that are not part of this repository, so the harness uses a fixed deterministic underline trajectory and longitudinal profile while preserving every renderer-facing CTA setting. This keeps the measured pipeline and workload representative without inventing a dependency on the SaaS repository.

## What is measured

Each workflow run checks out commit `7f4289aa3ff640f479701ceec0b0d790af037692` as a frozen baseline and injects the exact same harness into both trees. Candidate and baseline run alternately in one Chromium/ANGLE/SwiftShader process to reduce machine drift.

The report contains:

- rendered FPS and frame-time percentiles;
- renderer CPU submit time and asynchronous GPU timer-query time from `onPerformance`;
- browser task/script duration and JavaScript heap size;
- WebGL draw, upload, allocation, and framebuffer counters;
- deterministic screenshots at controlled renderer times for dark/light, desktop/mobile, hero/CTA;
- SSIM, normalized RMSE, changed-pixel ratios, maximum channel error, PSNR, and diff heatmaps.

The visual gate defaults to SSIM ≥ 0.9995, normalized RMSE ≤ 0.002, at most 0.05% of pixels changing by more than 2/255, and at most 0.005% changing by more than 8/255.

## Local invocation

Build two trees, serve them on ports 4173 and 4174, then run:

```bash
bun perf/scripts/benchmark.mjs \
  --baseline http://127.0.0.1:4173 \
  --candidate http://127.0.0.1:4174 \
  --out perf-results \
  --repeats 3 \
  --warmup 2500 \
  --duration 5500

python perf/scripts/visual-diff.py \
  --baseline perf-results/screenshots/baseline \
  --candidate perf-results/screenshots/candidate \
  --out perf-results/visual
```

The harness itself is built with `vite.perf.config.ts`; `tsconfig.perf.json` type-checks it independently of the documentation site.
