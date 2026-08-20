# Lumathread renderer benchmark

Reference: `7f4289aa3ff640f479701ceec0b0d790af037692`

Measurements use paired baseline/candidate pages kept alive together and stepped in an interleaved order. Each frame is followed by `gl.finish()` so wall time includes all queued rendering work under the same Chromium/ANGLE/SwiftShader environment. Absolute software-renderer timings are not representative of a discrete GPU; paired A/B ratios are the primary metric.

| Scenario | Metric | Baseline | Candidate | Change |
|---|---:|---:|---:|---:|
| hero-dark-desktop | FPS equivalent | 1209.73 | 1150.57 | -4.9% |
| hero-dark-desktop | Wall mean (ms) | 0.83 | 0.90 | +8.5% |
| hero-dark-desktop | Wall p95 (ms) | 1.95 | 2.10 | +7.4% |
| hero-dark-desktop | Submit mean (ms) | 0.54 | 0.50 | -7.0% |
| hero-dark-desktop | GPU drain mean (ms) | 0.35 | 0.36 | +2.4% |
| hero-dark-desktop | GPU timer total (ms) | 3520.24 | 2311.03 | -34.4% |
| hero-dark-desktop | Task duration (ms) | 1201.74 | 332.64 | -72.3% |
| hero-light-desktop | FPS equivalent | 1231.53 | 1013.62 | -17.7% |
| hero-light-desktop | Wall mean (ms) | 0.83 | 1.08 | +29.0% |
| hero-light-desktop | Wall p95 (ms) | 2.01 | 2.77 | +38.0% |
| hero-light-desktop | Submit mean (ms) | 0.41 | 0.58 | +41.8% |
| hero-light-desktop | GPU drain mean (ms) | 0.42 | 0.50 | +16.7% |
| hero-light-desktop | GPU timer total (ms) | 3602.65 | 2320.66 | -35.6% |
| hero-light-desktop | Task duration (ms) | 887.63 | 286.23 | -67.8% |
| cta-dark-desktop | FPS equivalent | 167.54 | 142.67 | -14.8% |
| cta-dark-desktop | Wall mean (ms) | 6.00 | 10.08 | +68.1% |
| cta-dark-desktop | Wall p95 (ms) | 7.46 | 14.53 | +94.7% |
| cta-dark-desktop | Submit mean (ms) | 5.87 | 9.83 | +67.6% |
| cta-dark-desktop | GPU drain mean (ms) | 0.07 | 0.20 | +161.1% |
| cta-dark-desktop | GPU timer total (ms) | 2373.68 | 597.46 | -74.8% |
| cta-dark-desktop | Task duration (ms) | 567.73 | 230.72 | -59.4% |
| cta-light-desktop | FPS equivalent | 174.75 | 148.92 | -14.8% |
| cta-light-desktop | Wall mean (ms) | 5.73 | 9.33 | +62.6% |
| cta-light-desktop | Wall p95 (ms) | 7.95 | 12.80 | +61.0% |
| cta-light-desktop | Submit mean (ms) | 5.64 | 9.20 | +63.1% |
| cta-light-desktop | GPU drain mean (ms) | 0.05 | 0.13 | +138.5% |
| cta-light-desktop | GPU timer total (ms) | 2355.92 | 598.81 | -74.6% |
| cta-light-desktop | Task duration (ms) | 492.03 | 209.01 | -57.5% |
| hero-dark-mobile-2x | FPS equivalent | 1638.80 | 1523.08 | -7.1% |
| hero-dark-mobile-2x | Wall mean (ms) | 0.61 | 0.69 | +12.2% |
| hero-dark-mobile-2x | Wall p95 (ms) | 1.40 | 1.21 | -13.7% |
| hero-dark-mobile-2x | Submit mean (ms) | 0.51 | 0.49 | -3.3% |
| hero-dark-mobile-2x | GPU drain mean (ms) | 0.11 | 0.21 | +85.2% |
| hero-dark-mobile-2x | GPU timer total (ms) | 2749.97 | 1546.90 | -43.7% |
| hero-dark-mobile-2x | Task duration (ms) | 651.66 | 259.57 | -60.2% |
| hero-light-mobile-2x | FPS equivalent | 2016.95 | 1793.84 | -11.1% |
| hero-light-mobile-2x | Wall mean (ms) | 0.50 | 0.68 | +37.0% |
| hero-light-mobile-2x | Wall p95 (ms) | 0.85 | 1.22 | +44.4% |
| hero-light-mobile-2x | Submit mean (ms) | 0.41 | 0.50 | +21.2% |
| hero-light-mobile-2x | GPU drain mean (ms) | 0.10 | 0.19 | +91.7% |
| hero-light-mobile-2x | GPU timer total (ms) | 2711.04 | 1485.30 | -45.2% |
| hero-light-mobile-2x | Task duration (ms) | 605.55 | 233.32 | -61.5% |
| cta-dark-mobile-2x | FPS equivalent | 232.45 | 229.56 | -1.2% |
| cta-dark-mobile-2x | Wall mean (ms) | 4.40 | 5.48 | +24.3% |
| cta-dark-mobile-2x | Wall p95 (ms) | 6.63 | 7.82 | +18.1% |
| cta-dark-mobile-2x | Submit mean (ms) | 4.28 | 5.41 | +26.3% |
| cta-dark-mobile-2x | GPU drain mean (ms) | 0.07 | 0.08 | +11.8% |
| cta-dark-mobile-2x | GPU timer total (ms) | 2399.23 | 528.24 | -78.0% |
| cta-dark-mobile-2x | Task duration (ms) | 570.23 | 166.33 | -70.8% |
| cta-light-mobile-2x | FPS equivalent | 251.84 | 238.58 | -5.3% |
| cta-light-mobile-2x | Wall mean (ms) | 4.05 | 5.63 | +39.1% |
| cta-light-mobile-2x | Wall p95 (ms) | 5.24 | 7.77 | +48.2% |
| cta-light-mobile-2x | Submit mean (ms) | 4.01 | 5.55 | +38.4% |
| cta-light-mobile-2x | GPU drain mean (ms) | 0.05 | 0.09 | +75.0% |
| cta-light-mobile-2x | GPU timer total (ms) | 2394.34 | 537.45 | -77.6% |
| cta-light-mobile-2x | Task duration (ms) | 489.84 | 160.65 | -67.2% |

## Paired A/B ratios

A ratio below 1 means the candidate was faster. The geometric mean is computed from one candidate/baseline ratio per paired repeat.

| Scenario | Pair count | Wall ratio geomean | Wall ratio median | Paired improvement | Range |
|---|---:|---:|---:|---:|---:|
| hero-dark-desktop | 4 | 0.9433 | 1.0094 | +5.7% | 0.5333–1.6593 |
| hero-light-desktop | 4 | 1.3416 | 1.5454 | -34.2% | 0.6212–2.8621 |
| cta-dark-desktop | 4 | 1.3859 | 1.6045 | -38.6% | 0.7556–2.4727 |
| cta-light-desktop | 4 | 1.3699 | 1.5144 | -37.0% | 0.7935–2.4875 |
| hero-dark-mobile-2x | 4 | 1.1049 | 1.1765 | -10.5% | 0.8406–1.2821 |
| hero-light-mobile-2x | 4 | 1.0859 | 0.9597 | -8.6% | 0.7966–1.9333 |
| cta-dark-mobile-2x | 4 | 1.1185 | 1.1538 | -11.8% | 0.7344–1.7192 |
| cta-light-mobile-2x | 4 | 1.2302 | 1.2441 | -23.0% | 0.7943–2.0487 |

## GPU timer-query ratios

These values are the sum of `EXT_disjoint_timer_query_webgl2` draw timings per rendered frame. A ratio of 0.5 corresponds to half the measured GPU work per frame.

| Scenario | Pair count | GPU ratio geomean | GPU ratio median | GPU improvement | Range |
|---|---:|---:|---:|---:|---:|
| hero-dark-desktop | 3 | 0.5315 | 0.8753 | +46.8% | 0.1942–0.8833 |
| hero-light-desktop | 2 | 0.8878 | 0.8878 | +11.2% | 0.8856–0.8900 |
| cta-dark-desktop | 4 | 0.2708 | 0.2919 | +72.9% | 0.1824–0.4012 |
| cta-light-desktop | 4 | 0.2738 | 0.2946 | +72.6% | 0.1854–0.4043 |
| hero-dark-mobile-2x | 4 | 0.5791 | 0.6502 | +42.1% | 0.3512–0.9335 |
| hero-light-mobile-2x | 4 | 0.5184 | 0.6384 | +48.2% | 0.2422–0.9386 |
| cta-dark-mobile-2x | 4 | 0.2471 | 0.2798 | +75.3% | 0.1478–0.4096 |
| cta-light-mobile-2x | 4 | 0.2531 | 0.2853 | +74.7% | 0.1532–0.4180 |

## Pipeline attribution

The ablations are diagnostic only: `no-glass` keeps the filament and dots, `path-only` also removes dots, and `no-twinkle` keeps glass but disables its sparkle field.

| Surface | Variant | Baseline wall (ms) | Candidate wall (ms) | Baseline vs full | Candidate vs full |
|---|---:|---:|---:|---:|---:|
| hero-dark-desktop | full | 0.82 | 1.23 | +0.0% | +0.0% |
| hero-dark-desktop | no-glass | 0.40 | 1.60 | -51.0% | +29.7% |
| hero-dark-desktop | path-only | 0.35 | 0.82 | -57.1% | -33.8% |
| hero-dark-desktop | no-twinkle | 1.15 | 0.82 | +40.8% | -33.8% |
| cta-dark-desktop | full | 5.28 | 4.40 | +0.0% | +0.0% |
| cta-dark-desktop | no-glass | 6.93 | 11.42 | +31.2% | +159.5% |
| cta-dark-desktop | path-only | 5.13 | 4.13 | -2.8% | -6.1% |
| cta-dark-desktop | no-twinkle | 7.58 | 15.85 | +43.5% | +260.2% |

## Renderer and environment

- Renderer status: `{"renderer":"hdr","supported":true,"webglVersion":2}`
- WebGL: `{"version":"WebGL 2.0 (OpenGL ES 3.0 Chromium)","shadingLanguageVersion":"WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)","vendor":"Google Inc. (Google)","renderer":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"}`
- Main runs: 4 paired A/B repeats × 12 measured frames after 8 interleaved warmup frame(s).
- Attribution runs: 6 measured frame(s) per variant.
