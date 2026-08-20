#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


def finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def nested_number(value: Any, *keys: str) -> float | None:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return finite_number(current)


def geometric_mean(values: list[float]) -> float:
    return math.exp(sum(math.log(value) for value in values) / len(values))


def median_value(side: Any, metric: str) -> float | None:
    return nested_number(side, metric, "median")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--markdown", required=True)
    parser.add_argument("--target-ratio", type=float, default=0.5)
    parser.add_argument("--maximum-regression", type=float, default=0.02)
    parser.add_argument("--minimum-scenarios", type=int, default=5)
    parser.add_argument("--minimum-gpu-scenarios", type=int, default=4)
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    raw_scenarios = report.get("scenarios")
    if not isinstance(raw_scenarios, list):
        raise RuntimeError("Fail-closed: benchmark report has no scenarios array.")

    scenarios: list[dict[str, Any]] = []
    for index, scenario in enumerate(raw_scenarios):
        if not isinstance(scenario, dict):
            continue
        label = scenario.get("name") or scenario.get("scenario") or f"scenario-{index}"
        paired = scenario.get("paired")
        if not isinstance(paired, dict):
            continue
        wall_ratio = nested_number(paired, "wallMeanMs", "geometricMeanRatio")
        gpu_ratio = nested_number(
            paired,
            "gpuTotalFrameMs",
            "geometricMeanRatio",
        )
        baseline = scenario.get("baseline") if isinstance(scenario.get("baseline"), dict) else {}
        candidate = scenario.get("candidate") if isinstance(scenario.get("candidate"), dict) else {}
        baseline_wall = median_value(baseline, "wallMeanMs")
        candidate_wall = median_value(candidate, "wallMeanMs")
        baseline_gpu = median_value(baseline, "gpuTotalFrameMs")
        candidate_gpu = median_value(candidate, "gpuTotalFrameMs")
        scenarios.append(
            {
                "label": str(label),
                "wallRatio": wall_ratio,
                "gpuRatio": gpu_ratio,
                "baselineWallMs": baseline_wall,
                "candidateWallMs": candidate_wall,
                "baselineGpuMs": baseline_gpu,
                "candidateGpuMs": candidate_gpu,
            }
        )

    wall_values = [
        row["wallRatio"]
        for row in scenarios
        if isinstance(row.get("wallRatio"), (int, float)) and row["wallRatio"] > 0
    ]
    gpu_values = [
        row["gpuRatio"]
        for row in scenarios
        if isinstance(row.get("gpuRatio"), (int, float)) and row["gpuRatio"] > 0
    ]
    if len(wall_values) < args.minimum_scenarios:
        raise RuntimeError(
            f"Fail-closed: only {len(wall_values)} paired scenario wall ratios were recognized; "
            f"{args.minimum_scenarios} are required."
        )
    if len(gpu_values) < args.minimum_gpu_scenarios:
        raise RuntimeError(
            f"Fail-closed: only {len(gpu_values)} paired scenario GPU ratios were recognized; "
            f"{args.minimum_gpu_scenarios} are required."
        )

    wall_geometric = geometric_mean(wall_values)
    gpu_geometric = geometric_mean(gpu_values)
    worst_wall = max(wall_values)
    worst_gpu = max(gpu_values)
    allowed_worst = 1 + args.maximum_regression

    baseline_wall_total = sum(
        value
        for value in (row.get("baselineWallMs") for row in scenarios)
        if isinstance(value, (int, float)) and value > 0
    )
    candidate_wall_total = sum(
        value
        for value in (row.get("candidateWallMs") for row in scenarios)
        if isinstance(value, (int, float)) and value > 0
    )
    baseline_gpu_total = sum(
        value
        for value in (row.get("baselineGpuMs") for row in scenarios)
        if isinstance(value, (int, float)) and value > 0
    )
    candidate_gpu_total = sum(
        value
        for value in (row.get("candidateGpuMs") for row in scenarios)
        if isinstance(value, (int, float)) and value > 0
    )
    weighted_wall_ratio = (
        candidate_wall_total / baseline_wall_total
        if baseline_wall_total > 0 and candidate_wall_total > 0
        else None
    )
    weighted_gpu_ratio = (
        candidate_gpu_total / baseline_gpu_total
        if baseline_gpu_total > 0 and candidate_gpu_total > 0
        else None
    )

    accepted = (
        wall_geometric <= args.target_ratio
        and gpu_geometric <= args.target_ratio
        and worst_wall <= allowed_worst
        and worst_gpu <= allowed_worst
    )

    result = {
        "accepted": accepted,
        "targetRatio": args.target_ratio,
        "maximumRegression": args.maximum_regression,
        "scenarioCount": len(wall_values),
        "gpuScenarioCount": len(gpu_values),
        "wallGeometricRatio": wall_geometric,
        "wallFpsMultiplier": 1 / wall_geometric,
        "gpuGeometricRatio": gpu_geometric,
        "gpuReduction": 1 - gpu_geometric,
        "baselineWeightedWallRatio": weighted_wall_ratio,
        "baselineWeightedGpuRatio": weighted_gpu_ratio,
        "worstWallRatio": worst_wall,
        "worstGpuRatio": worst_gpu,
        "scenarios": sorted(scenarios, key=lambda row: row["label"]),
    }
    Path(args.output).write_text(
        json.dumps(result, indent=2) + "\n",
        encoding="utf-8",
    )

    rows = []
    for scenario in result["scenarios"]:
        wall = scenario["wallRatio"]
        gpu = scenario["gpuRatio"]
        rows.append(
            "| "
            + scenario["label"].replace("|", "\\|")
            + " | "
            + (f"{wall:.4f}" if wall is not None else "—")
            + " | "
            + (f"{1 / wall:.2f}×" if wall is not None else "—")
            + " | "
            + (f"{gpu:.4f}" if gpu is not None else "—")
            + " | "
            + (f"{(1 - gpu) * 100:.2f}%" if gpu is not None else "—")
            + " |"
        )

    weighted_wall_text = (
        f"{weighted_wall_ratio:.4f}" if weighted_wall_ratio is not None else "—"
    )
    weighted_gpu_text = (
        f"{weighted_gpu_ratio:.4f}" if weighted_gpu_ratio is not None else "—"
    )
    markdown = f"""# Consolidated exact renderer target

- Verdict: **{'ACCEPT' if accepted else 'REJECT'}**
- Geometric wall ratio: **{wall_geometric:.4f}**
- Equivalent FPS multiplier: **{1 / wall_geometric:.2f}×**
- Geometric GPU ratio: **{gpu_geometric:.4f}**
- GPU work reduction: **{(1 - gpu_geometric) * 100:.2f}%**
- Baseline-time-weighted wall ratio: **{weighted_wall_text}**
- Baseline-time-weighted GPU ratio: **{weighted_gpu_text}**
- Worst wall ratio: **{worst_wall:.4f}**
- Worst GPU ratio: **{worst_gpu:.4f}**
- Required wall/GPU ratio: **≤ {args.target_ratio:.4f}**

| Scenario | Wall ratio | FPS multiplier | GPU ratio | GPU reduction |
|---|---:|---:|---:|---:|
{chr(10).join(rows)}
"""
    Path(args.markdown).write_text(markdown, encoding="utf-8")
    print(markdown)
    return 0 if accepted else 1


if __name__ == "__main__":
    raise SystemExit(main())
