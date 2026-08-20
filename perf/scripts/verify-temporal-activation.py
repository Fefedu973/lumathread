#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


def number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def nested(value: Any, *keys: str) -> float | None:
    current = value
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return number(current)


def geometric(values: list[float]) -> float | None:
    if not values:
        return None
    return math.exp(sum(math.log(value) for value in values) / len(values))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="perf-results/benchmark.json")
    parser.add_argument(
        "--output",
        default="perf-results/temporal-activation.json",
    )
    parser.add_argument("--maximum-draw-ratio", type=float, default=0.5)
    parser.add_argument("--maximum-query-ratio", type=float, default=0.95)
    parser.add_argument("--minimum-scenarios", type=int, default=4)
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    draw_ratios: list[float] = []
    query_ratios: list[float] = []
    rows: list[dict[str, Any]] = []
    for scenario in report.get("scenarios", []):
        baseline = scenario.get("baseline", {})
        candidate = scenario.get("candidate", {})
        baseline_draws = nested(
            baseline,
            "glPerFrame",
            "drawArraysInstanced",
            "median",
        )
        candidate_draws = nested(
            candidate,
            "glPerFrame",
            "drawArraysInstanced",
            "median",
        )
        baseline_queries = nested(baseline, "gpuSampleCount", "median")
        candidate_queries = nested(candidate, "gpuSampleCount", "median")
        draw_ratio = (
            candidate_draws / baseline_draws
            if baseline_draws is not None
            and candidate_draws is not None
            and baseline_draws > 0
            else None
        )
        query_ratio = (
            candidate_queries / baseline_queries
            if baseline_queries is not None
            and candidate_queries is not None
            and baseline_queries > 0
            else None
        )
        if draw_ratio is not None and draw_ratio > 0:
            draw_ratios.append(draw_ratio)
        if query_ratio is not None and query_ratio > 0:
            query_ratios.append(query_ratio)
        rows.append(
            {
                "name": scenario.get("name"),
                "baselineInstancedDraws": baseline_draws,
                "candidateInstancedDraws": candidate_draws,
                "drawRatio": draw_ratio,
                "baselineGpuQueries": baseline_queries,
                "candidateGpuQueries": candidate_queries,
                "queryRatio": query_ratio,
            }
        )

    draw_ratio = geometric(draw_ratios)
    query_ratio = geometric(query_ratios)
    active = (
        len(rows) >= args.minimum_scenarios
        and draw_ratio is not None
        and draw_ratio <= args.maximum_draw_ratio
        and query_ratio is not None
        and query_ratio <= args.maximum_query_ratio
    )
    result = {
        "active": active,
        "scenarioCount": len(rows),
        "drawArraysInstancedRatio": draw_ratio,
        "gpuQueryRatio": query_ratio,
        "maximumDrawRatio": args.maximum_draw_ratio,
        "maximumQueryRatio": args.maximum_query_ratio,
        "scenarios": rows,
    }
    Path(args.output).write_text(
        json.dumps(result, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result, indent=2))
    if not active:
        raise RuntimeError("Hero temporal cache activation gate failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
