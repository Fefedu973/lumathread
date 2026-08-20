#!/usr/bin/env bash
set -euo pipefail

readonly CTA_IDLE_TRANSFORM_SHA="f4f7baff286944acf7483320c679311957001788"
readonly HERO_TEMPORAL_RATE_HZ="15"
readonly CTA_TEMPORAL_RATE_HZ="10"

# Materialize the directly validated consolidated stack, the active Hero cache,
# and the exact non-temporal CTA composite.
bash perf/scripts/materialize-final-temporal-stack.sh

# Reuse the pointer-safe anchored selector measured in the CTA idle and pointer
# transition proofs. Pin the source commit so this final tree is reproducible.
git fetch --no-tags origin "$CTA_IDLE_TRANSFORM_SHA"
git show \
  "$CTA_IDLE_TRANSFORM_SHA:perf/scripts/apply-cta-temporal-idle-experiment.mjs" \
  > /tmp/apply-cta-temporal-idle-experiment.mjs
node /tmp/apply-cta-temporal-idle-experiment.mjs

python - <<'PY'
from pathlib import Path

path = Path("src/runtime/path-renderer.ts")
source = path.read_text(encoding="utf-8")
old = '''    const visualStep = Math.max(
      Math.abs(root.speed * root.filamentPlaybackRate) / 15,
      1 / 240,
    );'''
new = '''    const temporalAnchorRateHz = root.motionMode === "anchored" ? 10 : 15;
    const visualStep = Math.max(
      Math.abs(root.speed * root.filamentPlaybackRate) / temporalAnchorRateHz,
      1 / 240,
    );'''
if new not in source:
    count = source.count(old)
    if count != 1:
        raise SystemExit(
            f"expected exactly one selected 15 Hz visualStep block, found {count}"
        )
    source = source.replace(old, new)
    path.write_text(source, encoding="utf-8")
PY

for marker in \
  'temporalAnchorRateHz = root.motionMode === "anchored" ? 10 : 15' \
  'shouldUseTemporalPathCache' \
  'anchoredSceneIsStable' \
  'pointerState.dotPointerActive' \
  'root.motionMode === "travel"' \
  'root.motionMode === "anchored"'; do
  grep -Fq "$marker" src/runtime/path-renderer.ts
done
for marker in \
  'PATH_INTEGRAL_STATIC_COMPOSITE_FRAGMENT_SHADER' \
  'PATH_INTEGRAL_STATIC_BASE_COMPOSITE_FRAGMENT_SHADER' \
  'PATH_DOTS_IDLE_STATIC_FRAGMENT_SHADER' \
  'PATH_DOTS_POINTER_STATIC_FRAGMENT_SHADER'; do
  grep -Fq "$marker" src/rendering/shaders.ts
done

bunx biome format --write \
  src \
  perf/scripts/materialize-final-temporal-stack.sh \
  perf/scripts/materialize-final-production-renderer.sh
bun run check
bun run build
bunx tsc -p tsconfig.perf.json --noEmit

cat > perf/final-production-renderer.json <<EOF
{
  "frozenOriginal": "7f4289aa3ff640f479701ceec0b0d790af037692",
  "consolidatedBase": "b3c926b88b4861d851075015c141c67f225517fb",
  "ctaIdleTransform": "$CTA_IDLE_TRANSFORM_SHA",
  "heroTemporalRateHz": $HERO_TEMPORAL_RATE_HZ,
  "ctaIdleTemporalRateHz": $CTA_TEMPORAL_RATE_HZ,
  "pointerActiveRendering": "exact-frame-by-frame",
  "staticCtaComposite": true
}
EOF

printf '%s\n' \
  "Materialized final renderer: Hero 15 Hz, idle CTA 10 Hz, exact pointer fallback."
