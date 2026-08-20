#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REQUIRED_WORKFLOWS = {
    "gpuVisual": {
        "name": "Final production GPU and visual proof",
        "file": "final-gpu-proof.json",
    },
    "wallFps": {
        "name": "Final production wall and FPS proof",
        "file": "final-wall-proof.json",
    },
    "pointer": {
        "name": "Final production pointer-transition proof",
        "file": "final-pointer-proof.json",
    },
    "coldStart": {
        "name": "Final production cold-start proof",
        "file": "final-cold-start-proof.json",
    },
}


def run(*args: str, capture: bool = True, check: bool = True) -> str:
    completed = subprocess.run(
        args,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    return completed.stdout.strip() if capture else ""


def git(*args: str) -> str:
    return run("git", *args)


def gh_json(endpoint: str) -> Any:
    output = run("gh", "api", endpoint)
    return json.loads(output)


def src_tree_sha(commit: str) -> str | None:
    subprocess.run(
        ["git", "fetch", "--no-tags", "origin", commit],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    completed = subprocess.run(
        ["git", "rev-parse", f"{commit}:src"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def list_runs(repository: str, branch: str) -> list[dict[str, Any]]:
    encoded_branch = branch.replace("/", "%2F")
    payload = gh_json(
        f"repos/{repository}/actions/runs?branch={encoded_branch}&per_page=100"
    )
    return payload.get("workflow_runs", [])


def select_matching_runs(
    runs: list[dict[str, Any]], current_src_tree: str
) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    selected: dict[str, dict[str, Any]] = {}
    diagnostics: dict[str, list[dict[str, Any]]] = {}
    tree_cache: dict[str, str | None] = {}
    for key, specification in REQUIRED_WORKFLOWS.items():
        matches: list[dict[str, Any]] = []
        for workflow_run in runs:
            if workflow_run.get("name") != specification["name"]:
                continue
            commit = workflow_run.get("head_sha")
            if not isinstance(commit, str):
                continue
            if commit not in tree_cache:
                tree_cache[commit] = src_tree_sha(commit)
            if tree_cache[commit] != current_src_tree:
                continue
            matches.append(
                {
                    "id": workflow_run.get("id"),
                    "headSha": commit,
                    "status": workflow_run.get("status"),
                    "conclusion": workflow_run.get("conclusion"),
                    "createdAt": workflow_run.get("created_at"),
                    "htmlUrl": workflow_run.get("html_url"),
                }
            )
        diagnostics[key] = matches
        successful = next(
            (
                item
                for item in matches
                if item["status"] == "completed" and item["conclusion"] == "success"
            ),
            None,
        )
        if successful:
            selected[key] = successful
    return selected, diagnostics


def download_run(run_id: int, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    run("gh", "run", "download", str(run_id), "--dir", str(destination), capture=False)


def find_unique(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one {filename} below {root}, found {len(matches)}: {matches}"
        )
    return matches[0]


def load_accepted(path: Path, proof_name: str) -> dict[str, Any]:
    payload = json.loads(path.read_text())
    if payload.get("accepted") is not True:
        raise RuntimeError(f"{proof_name} is not accepted: {payload}")
    return payload


def markdown_report(result: dict[str, Any]) -> str:
    gpu = result["proofs"]["gpuVisual"]
    wall = result["proofs"]["wallFps"]
    pointer = result["proofs"]["pointer"]
    cold = result["proofs"]["coldStart"]
    lines = [
        "# Lumathread final production renderer validation",
        "",
        f"- Verdict: **{'ACCEPT' if result['accepted'] else 'REJECT'}**",
        f"- Source commit: `{result['sourceCommit']}`",
        f"- Source tree: `{result['srcTreeSha']}`",
        f"- Weighted GPU ratio: **{gpu['baselineWeightedGpuRatio']:.4f}**",
        f"- GPU work reduction: **{(1 - gpu['baselineWeightedGpuRatio']) * 100:.2f}%**",
        f"- Weighted wall ratio: **{wall['baselineTimeWeightedWallRatio']:.4f}**",
        f"- Equivalent weighted uncapped FPS: **{wall['equivalentWeightedFpsMultiplier']:.2f}×**",
        f"- Geometric wall ratio: **{wall['geometricWallRatio']:.4f}**",
        f"- Equivalent geometric uncapped FPS: **{wall['equivalentGeometricFpsMultiplier']:.2f}×**",
        f"- Pointer exact-active draw ratio: **{pointer['activeDrawRatio']:.4f}**",
        f"- Pointer recovered-cache draw ratio: **{pointer['recoveredDrawRatio']:.4f}**",
        f"- Cold-start geometric ready ratio: **{cold['geometricHostReadyRatio']:.4f}**",
        "",
        "## Gates",
        "",
        "| Gate | Result |",
        "|---|---:|",
        f"| GPU ratio <= 0.5 | {gpu['baselineWeightedGpuRatio']:.4f} |",
        f"| Wall ratio <= 0.5 | {wall['baselineTimeWeightedWallRatio']:.4f} |",
        f"| Exact pointer fallback | {pointer['activeDrawRatio']:.4f} |",
        f"| Cache recovery <= 0.6 | {pointer['recoveredDrawRatio']:.4f} |",
        f"| Cold-start budget <= 1.15 | {cold['geometricHostReadyRatio']:.4f} |",
        "| Strict visual parity | PASS in GPU/visual and pointer workflows |",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--timeout-seconds", type=int, default=7200)
    parser.add_argument("--poll-seconds", type=int, default=30)
    parser.add_argument("--out", default="perf/final-proof-downloads")
    args = parser.parse_args()

    current_src_tree = git("rev-parse", "HEAD:src")
    source_commit = git("log", "-1", "--format=%H", "--", "src")
    deadline = time.monotonic() + args.timeout_seconds
    selected: dict[str, dict[str, Any]] = {}
    diagnostics: dict[str, list[dict[str, Any]]] = {}

    while time.monotonic() < deadline:
        runs = list_runs(args.repository, args.branch)
        selected, diagnostics = select_matching_runs(runs, current_src_tree)
        summary = {
            "currentSrcTree": current_src_tree,
            "selected": selected,
            "diagnostics": diagnostics,
        }
        print(json.dumps(summary, indent=2), flush=True)
        if set(selected) == set(REQUIRED_WORKFLOWS):
            break
        time.sleep(args.poll_seconds)
    else:
        Path("perf/final-proof-timeout.json").write_text(
            json.dumps(
                {
                    "currentSrcTree": current_src_tree,
                    "selected": selected,
                    "diagnostics": diagnostics,
                },
                indent=2,
            )
            + "\n"
        )
        raise RuntimeError("Timed out before all final proofs succeeded.")

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    proofs: dict[str, dict[str, Any]] = {}
    proof_runs: dict[str, dict[str, Any]] = {}
    proof_directory = Path("perf/proofs")
    proof_directory.mkdir(parents=True, exist_ok=True)

    for key, specification in REQUIRED_WORKFLOWS.items():
        workflow_run = selected[key]
        destination = out / key
        download_run(int(workflow_run["id"]), destination)
        proof_path = find_unique(destination, specification["file"])
        proof = load_accepted(proof_path, key)
        proofs[key] = proof
        proof_runs[key] = workflow_run
        marker = {
            "proof": key,
            "accepted": True,
            "sourceCommit": workflow_run["headSha"],
            "srcTreeSha": current_src_tree,
            "workflowRun": workflow_run,
            "result": proof,
        }
        (proof_directory / f"{key}.json").write_text(
            json.dumps(marker, indent=2) + "\n"
        )

    accepted = all(
        (
            proofs["gpuVisual"]["accepted"],
            proofs["wallFps"]["accepted"],
            proofs["pointer"]["accepted"],
            proofs["coldStart"]["accepted"],
            proofs["gpuVisual"]["baselineWeightedGpuRatio"] <= 0.5,
            proofs["wallFps"]["baselineTimeWeightedWallRatio"] <= 0.5,
            proofs["wallFps"]["equivalentWeightedFpsMultiplier"] >= 2,
        )
    )
    result = {
        "accepted": accepted,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "repository": args.repository,
        "branch": args.branch,
        "sourceCommit": source_commit,
        "srcTreeSha": current_src_tree,
        "renderer": json.loads(Path("perf/final-production-renderer.json").read_text()),
        "proofRuns": proof_runs,
        "proofs": proofs,
    }
    Path("perf/final-validation.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    Path("perf/final-validation.md").write_text(markdown_report(result))
    print(markdown_report(result))
    if not accepted:
        raise RuntimeError(f"Final production renderer is not accepted: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
