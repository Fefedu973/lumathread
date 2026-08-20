#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <source-json> <destination-json> <proof-name> <source-commit>" >&2
  exit 2
fi

readonly source_json="$1"
readonly destination_json="$2"
readonly proof_name="$3"
readonly source_commit="$4"
readonly target_branch="perf/final-production-renderer"

if [ ! -s "$source_json" ]; then
  echo "Proof source is missing or empty: $source_json" >&2
  exit 1
fi

readonly src_tree_sha="$(git rev-parse "${source_commit}:src")"
readonly temporary_json="$(mktemp)"
python - "$source_json" "$temporary_json" "$proof_name" "$source_commit" "$src_tree_sha" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

source, destination, proof_name, source_commit, src_tree_sha = sys.argv[1:]
payload = json.loads(Path(source).read_text())
if payload.get("accepted") is not True:
    raise SystemExit(f"refusing to publish non-accepted proof {proof_name}: {payload}")
wrapped = {
    "proof": proof_name,
    "accepted": True,
    "sourceCommit": source_commit,
    "srcTreeSha": src_tree_sha,
    "publishedAt": datetime.now(timezone.utc).isoformat(),
    "result": payload,
}
Path(destination).write_text(json.dumps(wrapped, indent=2) + "\n")
PY

git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
git fetch origin "$target_branch"
git checkout -B final-proof-publisher "origin/$target_branch"

readonly current_src_tree_sha="$(git rev-parse HEAD:src)"
if [ "$current_src_tree_sha" != "$src_tree_sha" ]; then
  echo "Renderer source changed while proof was running." >&2
  echo "proved:  $src_tree_sha" >&2
  echo "current: $current_src_tree_sha" >&2
  exit 1
fi

mkdir -p "$(dirname "$destination_json")"
cp "$temporary_json" "$destination_json"
git add "$destination_json"
if git diff --cached --quiet; then
  echo "Proof marker is already current: $destination_json"
  exit 0
fi

git commit -m "test(perf): publish ${proof_name} proof [skip ci]"
for attempt in 1 2 3 4 5; do
  if git pull --rebase origin "$target_branch" \
      && [ "$(git rev-parse HEAD:src)" = "$src_tree_sha" ] \
      && git push origin HEAD:"$target_branch"; then
    echo "Published $destination_json"
    exit 0
  fi
  echo "Proof marker push attempt $attempt failed; retrying." >&2
  git rebase --abort 2>/dev/null || true
  git fetch origin "$target_branch"
  git reset --hard "origin/$target_branch"
  cp "$temporary_json" "$destination_json"
  git add "$destination_json"
  git commit -m "test(perf): publish ${proof_name} proof [skip ci]"
done

echo "Unable to publish proof marker after five attempts." >&2
exit 1
