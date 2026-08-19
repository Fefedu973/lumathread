#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

base_sha="${BASE_SHA:-b3c926b88b4861d851075015c141c67f225517fb}"
final_branch="${FINAL_BRANCH:-perf/major-2x-final-stack-direct}"
integral_branch="${INTEGRAL_BRANCH:-perf/major-2x-integral-static-uniforms}"
glass_branch="${GLASS_BRANCH:-perf/major-2x-glass-static-uniforms}"

branches=("$final_branch" "$integral_branch" "$glass_branch")
for branch in "${branches[@]}"; do
  git fetch --no-tags origin "+refs/heads/${branch}:refs/remotes/origin/${branch}"
done

copy_branch_file() {
  local branch="$1"
  local path="$2"
  mkdir -p "$(dirname "$path")"
  git show "refs/remotes/origin/${branch}:${path}" > "$path"
}

copy_branch_files_matching() {
  local branch="$1"
  local expression="$2"
  local label="$3"
  local count=0
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    copy_branch_file "$branch" "$path"
    count=$((count + 1))
  done < <(
    git ls-tree -r --name-only "refs/remotes/origin/${branch}" \
      | grep -E "$expression" || true
  )
  if [[ "$count" -eq 0 ]]; then
    echo "Unable to find ${label} on ${branch}." >&2
    return 1
  fi
}

find_branch_script() {
  local branch="$1"
  local pattern="$2"
  git ls-tree -r --name-only "refs/remotes/origin/${branch}" \
    | grep -E '^perf/scripts/.*\.(mjs|js|cjs|sh)$' \
    | grep -Ei "$pattern" \
    | head -n 1
}

run_branch_script() {
  local branch="$1"
  local pattern="$2"
  local label="$3"
  local script
  script="$(find_branch_script "$branch" "$pattern" || true)"
  if [[ -z "$script" ]]; then
    echo "Unable to find ${label} transformer on ${branch}." >&2
    echo "Available scripts:" >&2
    git ls-tree -r --name-only "refs/remotes/origin/${branch}" \
      | grep -E '^perf/scripts/.*\.(mjs|js|cjs|sh)$' >&2 || true
    return 1
  fi
  echo "Applying ${label} through ${branch}:${script}"
  copy_branch_file "$branch" "$script"
  case "$script" in
    *.sh)
      bash "$script"
      ;;
    *)
      node "$script"
      ;;
  esac
}

prepare_final_stack_dependencies() {
  local branch="$1"
  copy_branch_files_matching \
    "$branch" \
    '^perf/experiments/major-2x-specializations\.patch\.gz\.b64\.[0-9]+$' \
    'major renderer patch fragments'
  copy_branch_file \
    "$branch" \
    'perf/scripts/apply-glass-effect-bounds-experiment.mjs'
}

# Prefer an exact src diff if the final-stack branch has already materialized its
# candidate. Otherwise replay its transformer together with the files that the
# transformer intentionally reads from its own branch.
final_patch="/tmp/lumathread-final-stack-src.patch"
git diff --binary "$base_sha" "refs/remotes/origin/${final_branch}" -- src \
  > "$final_patch"
if [[ -s "$final_patch" ]] && git apply --check "$final_patch"; then
  echo "Applying directly benchmarked final-stack src diff."
  git apply --whitespace=nowarn "$final_patch"
else
  rm -f "$final_patch"
  prepare_final_stack_dependencies "$final_branch"
  run_branch_script \
    "$final_branch" \
    'apply.*(final|complete|validated).*(stack|renderer)|(final|complete).*(stack|renderer).*apply' \
    'direct final stack'
fi

# The current direct-stack transformer already includes the integral cache. Keep
# this replay idempotent so later versions may either include or omit it without
# breaking consolidation.
if grep -q 'integralStaticUniformKeys' src/runtime/path-renderer.ts; then
  echo "Static integral uniform cache already materialized; skipping duplicate replay."
else
  run_branch_script \
    "$integral_branch" \
    'apply.*integral.*(static.*uniform|uniform.*cache)|integral.*(static.*uniform|uniform.*cache).*apply' \
    'static integral uniform cache'
fi

if grep -q 'glassStaticUniformKeys' src/runtime/glass-terrain-renderer.ts; then
  echo "Static glass uniform cache already materialized; skipping duplicate replay."
else
  run_branch_script \
    "$glass_branch" \
    'apply.*glass.*(static.*uniform|uniform.*cache)|glass.*(static.*uniform|uniform.*cache).*apply' \
    'static glass uniform cache'
fi

printf '%s\n' \
  'final-stack-direct' \
  'integral-static-uniforms' \
  'glass-static-uniforms' \
  > perf/materialized-stack.txt

echo "Materialized consolidated renderer stack."
