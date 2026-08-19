#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
cd "$repo_root"

git fetch origin \
  perf/major-2x-local-support-bounds:refs/remotes/origin/perf/major-2x-local-support-bounds \
  perf/major-2x-dot-split:refs/remotes/origin/perf/major-2x-dot-split \
  perf/visual-parity-renderer-optimization:refs/remotes/origin/perf/visual-parity-renderer-optimization \
  perf/major-2x-source-vao:refs/remotes/origin/perf/major-2x-source-vao \
  perf/major-2x-shared-segment-buffer:refs/remotes/origin/perf/major-2x-shared-segment-buffer \
  perf/major-2x-pixel-space-source:refs/remotes/origin/perf/major-2x-pixel-space-source \
  perf/major-2x-integral-static-uniforms:refs/remotes/origin/perf/major-2x-integral-static-uniforms

git show \
  origin/perf/major-2x-local-support-bounds:perf/scripts/apply-benchmark-reliability-fixes.mjs \
  > /tmp/apply-benchmark-reliability-fixes.mjs
git show \
  origin/perf/major-2x-local-support-bounds:perf/scripts/apply-single-frame-paired-harness-fix.mjs \
  > /tmp/apply-single-frame-paired-harness-fix.mjs
git show \
  origin/perf/major-2x-local-support-bounds:perf/experiments/local-support-bounds.patch \
  > /tmp/local-support-bounds.patch
git show \
  origin/perf/major-2x-dot-split:perf/experiments/dot-split-incremental.patch.gz.b64 \
  | tr -d "\n" | base64 --decode | gzip --decompress \
  > /tmp/dot-split.patch
git show \
  origin/perf/visual-parity-renderer-optimization:perf/scripts/apply-persistent-glass-framebuffers-experiment.mjs \
  > /tmp/apply-persistent-glass-framebuffers-experiment.mjs
git show \
  origin/perf/major-2x-source-vao:perf/scripts/apply-source-vao-experiment.mjs \
  > /tmp/apply-source-vao-experiment.mjs
git show \
  origin/perf/major-2x-shared-segment-buffer:perf/scripts/apply-shared-segment-buffer-experiment.mjs \
  > /tmp/apply-shared-segment-buffer-experiment.mjs
git show \
  origin/perf/major-2x-pixel-space-source:perf/scripts/apply-pixel-space-source-experiment.mjs \
  > /tmp/apply-pixel-space-source-experiment.mjs
git show \
  origin/perf/major-2x-integral-static-uniforms:perf/scripts/apply-integral-static-uniform-cache.mjs \
  > /tmp/apply-integral-static-uniform-cache.mjs

cat perf/experiments/major-2x-specializations.patch.gz.b64.* \
  | tr -d "\n" | base64 --decode | gzip --decompress \
  > /tmp/major.patch
git apply --whitespace=nowarn /tmp/major.patch

python - <<'PY'
from pathlib import Path
path = Path("src/runtime/path-renderer.ts")
source = path.read_text(encoding="utf-8")
if source.count("useSourceInstancedQuadrature") != 2:
    raise SystemExit("unexpected source-instanced helper count")
source = source.replace(
    "useSourceInstancedQuadrature",
    "shouldUseSourceInstancedQuadrature",
)
if source.count("settings.headTaper <= 0.000001") != 1:
    raise SystemExit("unexpected normalized taper threshold count")
source = source.replace(
    "settings.headTaper <= 0.000001",
    "settings.headTaper <= 0.001001",
)
path.write_text(source, encoding="utf-8")
PY

git apply --whitespace=nowarn /tmp/dot-split.patch
python - <<'PY'
from pathlib import Path

shader_path = Path("src/rendering/shaders.ts")
shader_source = shader_path.read_text(encoding="utf-8")
marker = "export const PATH_DOTS_POINTER_FRAGMENT_SHADER"
start = shader_source.find(marker)
anchor = "uniform float uDotPointerMagnification;\n\n${COMMON_THEME_GLSL}"
position = shader_source.find(anchor, start)
if start < 0 or position < 0:
    raise SystemExit("pointer-dot luminance anchor missing")
replacement = (
    "uniform float uDotPointerMagnification;\n\n"
    "const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);\n\n"
    "${COMMON_THEME_GLSL}"
)
shader_source = (
    shader_source[:position]
    + shader_source[position:].replace(anchor, replacement, 1)
)
shader_path.write_text(shader_source, encoding="utf-8")

renderer_path = Path("src/runtime/path-renderer.ts")
renderer_source = renderer_path.read_text(encoding="utf-8")
before = '''  const shouldSplitFlatDots = (settings: Settings) =>
    settings.dotsEnabled &&
    settings.dotMode === "flat" &&'''
after = '''  const shouldSplitFlatDots = (settings: Settings) =>
    settings.motionMode === "anchored" &&
    settings.dotsEnabled &&
    settings.dotMode === "flat" &&'''
if renderer_source.count(before) != 1:
    raise SystemExit("unexpected split-dot eligibility block")
renderer_path.write_text(
    renderer_source.replace(before, after),
    encoding="utf-8",
)
PY

git apply --whitespace=nowarn /tmp/local-support-bounds.patch
node perf/scripts/apply-glass-effect-bounds-experiment.mjs
node /tmp/apply-persistent-glass-framebuffers-experiment.mjs
node /tmp/apply-source-vao-experiment.mjs
node /tmp/apply-shared-segment-buffer-experiment.mjs
node /tmp/apply-pixel-space-source-experiment.mjs
node /tmp/apply-integral-static-uniform-cache.mjs

python - <<'PY'
from pathlib import Path
path = Path("src/rendering/shaders.ts")
source = path.read_text(encoding="utf-8")
start = source.index("  float positiveRadius = min(")
end = source.index("  float alongRadius =", start)
block = source[start:end]
if block.count("+ 2.0,") != 2:
    raise SystemExit("unexpected source-support padding anchors")
block = block.replace("+ 2.0,", "+ 0.5,")
path.write_text(source[:start] + block + source[end:], encoding="utf-8")
PY

node /tmp/apply-benchmark-reliability-fixes.mjs
node /tmp/apply-single-frame-paired-harness-fix.mjs

echo "Applied final exact CTA optimization stack."
