# Final Lumathread renderer results

Source commit proved: `47a6b2c7015ee9c04929fbc4e43624860dc65778`.

## Final verdict

- Visual parity: **PASS**
- Half-GPU target: **REACHED**
- 2× uncapped-FPS target: **NOT REACHED**
- Cold-start timing budget: **PASS**
- All-surface GPU ratio: **0.3804** (62.0% reduction)
- Instrumented all-surface wall ratio: **0.9965** (1.00×)
- Uninstrumented production wall ratio: **0.8105** (1.23×)
- Hero GPU ratio: **0.4597**
- CTA GPU ratio: **0.3149**
- Pointer recovered/active draw ratio: **0.3750**
- Cold-start host-ready ratio: **0.7923**
- Worst cold-start surface ratio: **1.0197**

## Direct original-to-final scenarios

| Scenario | Wall ratio | FPS multiplier | GPU ratio | GPU reduction |
|---|---:|---:|---:|---:|
| cta-dark-desktop | 1.0057 | 0.99× | 0.3167 | 68.3% |
| cta-dark-mobile-2x | 0.9863 | 1.01× | 0.3038 | 69.6% |
| cta-light-desktop | 1.0607 | 0.94× | 0.3350 | 66.5% |
| cta-light-mobile-2x | 0.9369 | 1.07× | 0.3050 | 69.5% |
| hero-dark-desktop | 0.7028 | 1.42× | 0.4668 | 53.3% |
| hero-dark-mobile-2x | 0.8930 | 1.12× | 0.4466 | 55.3% |
| hero-light-desktop | 1.3946 | 0.72× | 0.4723 | 52.8% |
| hero-light-mobile-2x | 1.1269 | 0.89× | 0.4534 | 54.7% |

## Uninstrumented production wall scenarios

| Scenario | Wall ratio | FPS multiplier | Submit ratio | Drain ratio |
|---|---:|---:|---:|---:|
| cta-dark-desktop | 0.8569 | 1.17× | 0.8575 | 0.8943 |
| cta-dark-mobile-2x | 0.8872 | 1.13× | 0.9088 | 0.4625 |
| cta-light-desktop | 0.8974 | 1.11× | 0.8889 | 1.4434 |
| cta-light-mobile-2x | 0.8403 | 1.19× | 0.8480 | 0.6482 |
| hero-dark-desktop | 0.6991 | 1.43× | 0.7019 | 0.7600 |
| hero-dark-mobile-2x | 0.7557 | 1.32× | 0.8657 | 0.5004 |
| hero-light-desktop | 0.7388 | 1.35× | 0.7318 | 0.9001 |
| hero-light-mobile-2x | 0.8322 | 1.20× | 0.8517 | 0.5862 |

## Reproducibility

- Direct proof: https://github.com/Fefedu973/lumathread/actions/runs/32603296852
- Wall/FPS proof: https://github.com/Fefedu973/lumathread/actions/runs/32603296872
- Pointer proof: https://github.com/Fefedu973/lumathread/actions/runs/32603152156
- Cold-start timing/allocation-audit proof: https://github.com/Fefedu973/lumathread/actions/runs/32603152154

The absolute values use ANGLE/SwiftShader; the paired ratios compare both builds in the same environment.
