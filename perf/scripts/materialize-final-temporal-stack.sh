#!/usr/bin/env bash
set -euo pipefail

readonly BASE_STACK_SHA="b3c926b88b4861d851075015c141c67f225517fb"
readonly TEMPORAL_TRANSFORM_SHA="0abfb298182f20dc9d7eb49ef773334a50fe015b"
readonly TEMPORAL_FIX_SHA="be587db834a56bc084f3ac31fb61404a23e243bf"

bash perf/scripts/materialize-validated-stack.sh

git fetch --no-tags origin \
  "$TEMPORAL_TRANSFORM_SHA" \
  "$TEMPORAL_FIX_SHA"

git show \
  "$TEMPORAL_TRANSFORM_SHA:perf/experiments/apply-hero-temporal-interpolation-experiment.mjs.gz.b64" \
  | base64 --decode \
  | gzip --decompress \
  > /tmp/apply-hero-temporal-interpolation-experiment.mjs
node /tmp/apply-hero-temporal-interpolation-experiment.mjs

git show \
  "$TEMPORAL_FIX_SHA:perf/scripts/fix-hero-temporal-cache-state.mjs" \
  > /tmp/fix-hero-temporal-cache-state.mjs
node /tmp/fix-hero-temporal-cache-state.mjs

grep -q "updateTemporalHeroCache" src/runtime/path-renderer.ts
grep -q "temporalHeroSettingsKey" src/runtime/path-renderer.ts
grep -q "root.quality.quadrature >= 2" src/runtime/path-renderer.ts
grep -q "temporalSettingsKey" src/rendering/webgl-resources.ts

bunx biome format --write \
  src/rendering/shaders.ts \
  src/rendering/webgl-resources.ts \
  src/runtime/resource-manager.ts \
  src/runtime/draw-common.ts \
  src/runtime/path-renderer.ts

cat > perf/materialized-final-temporal-stack.txt <<EOF
base-stack=$BASE_STACK_SHA
temporal-transform=$TEMPORAL_TRANSFORM_SHA
temporal-fix=$TEMPORAL_FIX_SHA
anchor-rate-hz=30
EOF

printf '%s\n' "Materialized consolidated CTA stack plus active 30 Hz Hero HDR cache."
