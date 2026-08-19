#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import fmean
from typing import Any


def positive_number(value: Any) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value) and value > 0:
        return float(value)
    return None


def geometric_mean(values: list[float]) -> float:
    return math.exp(fmean(math.log(value) for value in values))


def read_run_metric(run: dict[str, Any], metric: str) -> float | None:
    if metric == "wall":
        return positive_number(run.get("wallMs", {}).get("mean"))
    if metric == "gpu":
        return positive_number(run.get("gpu", {}).get("totalFrameMs"))
    raise ValueError(metric)


def scenario_metric(
    scenario: dict[str, Any], build: str, metric: str
) -> float | None:
    values = [
        value
        for run in scenario.get("raw", {}).get(build, [])
        if (value := read_run_metric(run, metric)) is not None
    ]
    return fmean(values) if values else None


def aggregate(rows: list[dict[str, Any]], metric: str) -> dict[str, float | None]:
    valid = [
        row
        for row in rows
        if positive_number(row[f"baseline{metric.title()}Ms"]) is not None
        and positive_number(row[f"candidate{metric.title()}Ms"]) is not None
    ]
    if not valid:
        return {
            "weightedRatio": None,
            "geometricRatio": None,
            "speedup": None,
        }
    baseline_total = sum(row[f"baseline{metric.title()}Ms"] for row in valid)
    candidate_total = sum(row[f"candidate{metric.title()}Ms"] for row in valid)
    ratios = [
        row[f"candidate{metric.title()}Ms"]
        / row[f"baseline{metric.title()}Ms"]
        for row in valid
    ]
    ratio = candidate_total / baseline_total
    return {
        "weightedRatio": ratio,
        "geometricRatio": geometric_mean(ratios),
        "speedup": 1 / ratio,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--markdown", required=True)
    parser.add_argument("--target-ratio", type=float, default=0.5)
    parser.add_argument("--maximum-regression", type=float, default=0.03)
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = []
    for scenario in report.get("scenarios", []):
        baseline_wall = scenario_metric(scenario, "baseline", "wall")
        candidate_wall = scenario_metric(scenario, "candidate", "wall")
        baseline_gpu = scenario_metric(scenario, "baseline", "gpu")
        candidate_gpu = scenario_metric(scenario, "candidate", "gpu")
        if None in (
            baseline_wall,
            candidate_wall,
            baseline_gpu,
            candidate_gpu,
        ):
            continue
        rows.append(
            {
                "name": scenario.get("name", "unknown"),
                "surface": scenario.get("scenario", "unknown"),
                "baselineWallMs": baseline_wall,
                "candidateWallMs": candidate_wall,
                "wallRatio": candidate_wall / baseline_wall,
                "baselineGpuMs": baseline_gpu,
                "candidateGpuMs": candidate_gpu,
                "gpuRatio": candidate_gpu / baseline_gpu,
            }
        )

    if len(rows) < 5:
        raise SystemExit(
            f"Fail-closed: only {len(rows)} complete scenario rows were recognized."
        )

    cta_rows = [row for row in rows if row["surface"] == "cta"]
    hero_rows = [row for row in rows if row["surface"] == "hero"]
    if len(cta_rows) < 4:
        raise SystemExit(
            f"Fail-closed: only {len(cta_rows)} complete CTA rows were recognized."
        )

    aggregates = {
        "all": {
            "wall": aggregate(rows, "wall"),
            "gpu": aggregate(rows, "gpu"),
        },
        "cta": {
            "wall": aggregate(cta_rows, "wall"),
            "gpu": aggregate(cta_rows, "gpu"),
        },
        "hero": {
            "wall": aggregate(hero_rows, "wall"),
            "gpu": aggregate(hero_rows, "gpu"),
        },
    }

    worst_wall = max(row["wallRatio"] for row in rows)
    worst_gpu = max(row["gpuRatio"] for row in rows)
    cta_wall = aggregates["cta"]["wall"]["weightedRatio"]
    cta_gpu = aggregates["cta"]["gpu"]["weightedRatio"]
    all_wall = aggregates["all"]["wall"]["weightedRatio"]
    all_gpu = aggregates["all"]["gpu"]["weightedRatio"]
    accepted = bool(
        cta_wall is not None
        and cta_gpu is not None
        and all_wall is not None
        and all_gpu is not None
        and cta_wall <= args.target_ratio
        and cta_gpu <= args.target_ratio
        and all_wall <= args.target_ratio
        and all_gpu <= args.target_ratio
        and worst_wall <= 1 + args.maximum_regression
        and worst_gpu <= 1 + args.maximum_regression
    )

    result = {
        "accepted": accepted,
        "targetRatio": args.target_ratio,
        "maximumRegression": args.maximum_regression,
        "scenarioCount": len(rows),
        "aggregates": aggregates,
        "worstWallRatio": worst_wall,
        "worstGpuRatio": worst_gpu,
        "scenarios": rows,
    }
    Path(args.output).write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )

    def ratio(value: float | None) -> str:
        return "n/a" if value is None else f"{value:.4f}×"

    def speedup(value: float | None) -> str:
        return "n/a" if value is None else f"{value:.3f}×"

    lines = [
        "# Final direct-stack evaluation",
        "",
        f"- Verdict: **{'ACCEPT' if accepted else 'REJECT'}**",
        f"- Required candidate/baseline ratio: ≤ {args.target_ratio:.3f}×",
        f"- CTA weighted wall ratio: {ratio(cta_wall)}",
        f"- CTA weighted FPS multiplier: {speedup(aggregates['cta']['wall']['speedup'])}",
        f"- CTA weighted GPU ratio: {ratio(cta_gpu)}",
        f"- All-surface weighted wall ratio: {ratio(all_wall)}",
        f"- All-surface weighted FPS multiplier: {speedup(aggregates['all']['wall']['speedup'])}",
        f"- All-surface weighted GPU ratio: {ratio(all_gpu)}",
        f"- Worst individual wall ratio: {worst_wall:.4f}×",
        f"- Worst individual GPU ratio: {worst_gpu:.4f}×",
        "",
        "| Scenario | Surface | Wall before | Wall after | Wall ratio | GPU before | GPU after | GPU ratio |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in rows:
        lines.append(
            "| {name} | {surface} | {baselineWallMs:.4f} | {candidateWallMs:.4f} | "
            "{wallRatio:.4f}× | {baselineGpuMs:.4f} | {candidateGpuMs:.4f} | "
            "{gpuRatio:.4f}× |".format(**row)
        )
    markdown = "\n".join(lines) + "\n"
    Path(args.markdown).write_text(markdown, encoding="utf-8")
    print(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
