#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path
from typing import Any

WALL_RATIO_KEYS = (
    "pairedWallRatio",
    "wallRatio",
    "candidateToBaselineRatio",
    "candidateBaselineWallRatio",
)
GPU_RATIO_KEYS = (
    "pairedGpuRatio",
    "gpuRatio",
    "candidateToBaselineGpuRatio",
    "candidateBaselineGpuRatio",
)
WALL_VALUE_KEYS = (
    "medianWallMs",
    "meanWallMs",
    "wallMs",
    "frameWallMs",
    "medianMs",
    "meanMs",
)
GPU_VALUE_KEYS = (
    "medianGpuMs",
    "meanGpuMs",
    "gpuMs",
    "gpuDurationMs",
    "totalGpuMs",
    "drainedGpuMs",
)
LABEL_KEYS = ("scenario", "name", "id", "label", "title")
SCENARIO_WORDS = ("hero", "cta", "desktop", "mobile", "dark", "light", "dpr")


def finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def first_number(value: Any, keys: tuple[str, ...]) -> float | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        number = finite_number(value.get(key))
        if number is not None:
            return number
    return None


def label_for(value: dict[str, Any], path: str) -> str:
    for key in LABEL_KEYS:
        label = value.get(key)
        if isinstance(label, str) and label.strip():
            return label.strip()
    return path


def nested_ratio(value: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    baseline = value.get("baseline")
    candidate = value.get("candidate")
    if not isinstance(baseline, dict) or not isinstance(candidate, dict):
        return None
    baseline_value = first_number(baseline, keys)
    candidate_value = first_number(candidate, keys)
    if baseline_value is None or candidate_value is None or baseline_value <= 0:
        return None
    return candidate_value / baseline_value


def walk(
    value: Any,
    path: str,
    records: list[dict[str, Any]],
) -> None:
    if isinstance(value, list):
        for index, child in enumerate(value):
            walk(child, f"{path}[{index}]", records)
        return
    if not isinstance(value, dict):
        return

    label = label_for(value, path)
    wall_ratio = first_number(value, WALL_RATIO_KEYS)
    gpu_ratio = first_number(value, GPU_RATIO_KEYS)
    if wall_ratio is None:
        wall_ratio = nested_ratio(value, WALL_VALUE_KEYS)
    if gpu_ratio is None:
        gpu_ratio = nested_ratio(value, GPU_VALUE_KEYS)

    if wall_ratio is not None or gpu_ratio is not None:
        records.append(
            {
                "label": label,
                "path": path,
                "wallRatio": wall_ratio,
                "gpuRatio": gpu_ratio,
            }
        )

    for key, child in value.items():
        walk(child, f"{path}.{key}", records)


def geometric_mean(values: list[float]) -> float:
    return math.exp(sum(math.log(value) for value in values) / len(values))


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
    raw_records: list[dict[str, Any]] = []
    walk(report, "root", raw_records)

    scenario_records = [
        record
        for record in raw_records
        if any(
            word in f"{record['label']} {record['path']}".lower()
            for word in SCENARIO_WORDS
        )
    ]
    if not scenario_records:
        scenario_records = raw_records

    grouped: dict[str, dict[str, list[float]]] = {}
    for record in scenario_records:
        bucket = grouped.setdefault(record["label"], {"wall": [], "gpu": []})
        wall = finite_number(record.get("wallRatio"))
        gpu = finite_number(record.get("gpuRatio"))
        if wall is not None and wall > 0:
            bucket["wall"].append(wall)
        if gpu is not None and gpu > 0:
            bucket["gpu"].append(gpu)

    scenarios = []
    for label, values in grouped.items():
        wall = statistics.median(values["wall"]) if values["wall"] else None
        gpu = statistics.median(values["gpu"]) if values["gpu"] else None
        if wall is None and gpu is None:
            continue
        scenarios.append({"label": label, "wallRatio": wall, "gpuRatio": gpu})

    wall_values = [row["wallRatio"] for row in scenarios if row["wallRatio"]]
    gpu_values = [row["gpuRatio"] for row in scenarios if row["gpuRatio"]]
    if len(wall_values) < args.minimum_scenarios:
        raise RuntimeError(
            f"Fail-closed: only {len(wall_values)} scenario wall ratios were recognized; "
            f"{args.minimum_scenarios} are required."
        )
    if len(gpu_values) < args.minimum_gpu_scenarios:
        raise RuntimeError(
            f"Fail-closed: only {len(gpu_values)} scenario GPU ratios were recognized; "
            f"{args.minimum_gpu_scenarios} are required."
        )

    wall_geometric = geometric_mean(wall_values)
    gpu_geometric = geometric_mean(gpu_values)
    worst_wall = max(wall_values)
    worst_gpu = max(gpu_values)
    allowed_worst = 1 + args.maximum_regression
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
        "worstWallRatio": worst_wall,
        "worstGpuRatio": worst_gpu,
        "scenarios": sorted(scenarios, key=lambda row: row["label"]),
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

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

    markdown = f"""# Consolidated exact renderer target

- Verdict: **{'ACCEPT' if accepted else 'REJECT'}**
- Geometric wall ratio: **{wall_geometric:.4f}**
- Equivalent FPS multiplier: **{1 / wall_geometric:.2f}×**
- Geometric GPU ratio: **{gpu_geometric:.4f}**
- GPU work reduction: **{(1 - gpu_geometric) * 100:.2f}%**
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
