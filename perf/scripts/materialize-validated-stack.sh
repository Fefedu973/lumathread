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

# Prefer the exact src tree that was directly benchmarked by the final-stack PR.
# If that PR only stores a transformer, replay the transformer instead.
final_patch="/tmp/lumathread-final-stack-src.patch"
git diff --binary "$base_sha" "refs/remotes/origin/${final_branch}" -- src \
  > "$final_patch"
if [[ -s "$final_patch" ]] && git apply --check "$final_patch"; then
  echo "Applying directly benchmarked final-stack src diff."
  git apply --whitespace=nowarn "$final_patch"
else
  rm -f "$final_patch"
  run_branch_script \
    "$final_branch" \
    'apply.*(final|complete|validated).*(stack|renderer)|(final|complete).*(stack|renderer).*apply' \
    'direct final stack'
fi

# These two caches were measured incrementally after the exact direct stack.
run_branch_script \
  "$integral_branch" \
  'apply.*integral.*(static.*uniform|uniform.*cache)|integral.*(static.*uniform|uniform.*cache).*apply' \
  'static integral uniform cache'
run_branch_script \
  "$glass_branch" \
  'apply.*glass.*(static.*uniform|uniform.*cache)|glass.*(static.*uniform|uniform.*cache).*apply' \
  'static glass uniform cache'

printf '%s\n' \
  'final-stack-direct' \
  'integral-static-uniforms' \
  'glass-static-uniforms' \
  > perf/materialized-stack.txt

echo "Materialized consolidated renderer stack."
