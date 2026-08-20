#!/usr/bin/env bash
set -euo pipefail

# Every transform is pinned so the benchmarked source tree is reproducible.
# The final proof materializes this exact tree independently in both matrix jobs.
readonly BASE_STACK_SHA="b3c926b88b4861d851075015c141c67f225517fb"
readonly TEMPORAL_TRANSFORM_SHA="0abfb298182f20dc9d7eb49ef773334a50fe015b"
readonly TEMPORAL_FIX_SHA="be587db834a56bc084f3ac31fb61404a23e243bf"
readonly TEMPORAL_ANCHOR_RATE_HZ="15"

bash perf/scripts/materialize-validated-stack.sh

git fetch --no-tags origin \
  "$TEMPORAL_TRANSFORM_SHA" \
  "$TEMPORAL_FIX_SHA"

if ! grep -q "updateTemporalHeroCache" src/runtime/path-renderer.ts; then
  git show \
    "$TEMPORAL_TRANSFORM_SHA:perf/experiments/apply-hero-temporal-interpolation-experiment.mjs.gz.b64" \
    | base64 --decode \
    | gzip --decompress \
    > /tmp/apply-hero-temporal-interpolation-experiment.mjs
  set +e
  node /tmp/apply-hero-temporal-interpolation-experiment.mjs
  temporal_transform_exit=$?
  set -e
  if [ "$temporal_transform_exit" -eq 0 ]; then
    temporal_transform_status="applied"
  elif grep -q "updateTemporalHeroCache" src/runtime/path-renderer.ts; then
    temporal_transform_status="completed-from-partial"
  else
    echo "Temporal transform failed before producing its required resources." >&2
    exit "$temporal_transform_exit"
  fi
else
  temporal_transform_status="already-materialized"
fi

node perf/scripts/complete-hero-temporal-scheduling.mjs

git show \
  "$TEMPORAL_FIX_SHA:perf/scripts/fix-hero-temporal-cache-state.mjs" \
  > /tmp/fix-hero-temporal-cache-state.mjs
node /tmp/fix-hero-temporal-cache-state.mjs

python - <<'PY'
from pathlib import Path

path = Path("src/runtime/path-renderer.ts")
source = path.read_text(encoding="utf-8")
before = "Math.abs(root.speed * root.filamentPlaybackRate) / 30,"
after = "Math.abs(root.speed * root.filamentPlaybackRate) / 15,"
if after not in source:
    count = source.count(before)
    if count != 1:
        raise SystemExit(
            f"expected exactly one 30 Hz temporal anchor expression, found {count}"
        )
    source = source.replace(before, after)
    path.write_text(source, encoding="utf-8")
PY

for required in \
  "updateTemporalHeroCache" \
  "temporalHeroSettingsKey" \
  "root.quality.quadrature >= 2" \
  "Math.abs(root.speed * root.filamentPlaybackRate) / 15" \
  "if (shouldUseTemporalHeroCache(root, preparedSceneFrames))"; do
  grep -Fq "$required" src/runtime/path-renderer.ts
done
grep -Fq "temporalSettingsKey" src/rendering/webgl-resources.ts
grep -Fq "temporalFramebuffers" src/rendering/webgl-resources.ts
grep -Fq "uTemporalMix" src/rendering/shaders.ts

bunx biome format --write \
  src/rendering/shaders.ts \
  src/rendering/webgl-resources.ts \
  src/runtime/resource-manager.ts \
  src/runtime/draw-common.ts \
  src/runtime/path-renderer.ts \
  perf/scripts/complete-hero-temporal-scheduling.mjs

cat > perf/materialized-final-temporal-stack.txt <<EOF
base-stack=$BASE_STACK_SHA
temporal-transform=$TEMPORAL_TRANSFORM_SHA
temporal-transform-status=$temporal_transform_status
temporal-fix=$TEMPORAL_FIX_SHA
anchor-rate-hz=$TEMPORAL_ANCHOR_RATE_HZ
EOF

printf '%s\n' \
  "Materialized consolidated CTA stack plus active 15 Hz Hero HDR cache ($temporal_transform_status)."
