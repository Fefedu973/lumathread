#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

EXPECTED = {
    "hero-dark-desktop",
    "hero-light-desktop",
    "cta-dark-desktop",
    "cta-light-desktop",
    "hero-dark-mobile-2x",
    "hero-light-mobile-2x",
    "cta-dark-mobile-2x",
    "cta-light-mobile-2x",
}


def is_positive(value: Any) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value) and value > 0


def geometric(values: list[float]) -> float:
    if not values or not all(is_positive(value) for value in values):
        raise RuntimeError(f"Expected positive finite ratios, received {values}")
    return math.exp(sum(math.log(value) for value in values) / len(values))


def read_ratio(scenario: dict[str, Any], key: str) -> float:
    value = scenario.get("paired", {}).get(key, {}).get("geometricMeanRatio")
    if not is_positive(value):
        raise RuntimeError(
            f"{scenario.get('name')}: missing positive paired {key} ratio: {value}"
        )
    return float(value)


def read_median(side: dict[str, Any], group: str, key: str) -> float | None:
    value = side.get(group, {}).get(key, {}).get("median")
    return float(value) if isinstance(value, (int, float)) and math.isfinite(value) else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--markdown", required=True)
    parser.add_argument("--target-gpu-ratio", type=float, default=0.5)
    parser.add_argument("--max-scenario-gpu-ratio", type=float, default=1.03)
    args = parser.parse_args()

    report = json.loads(Path(args.input).read_text())
    scenarios = report.get("scenarios", [])
    names = {scenario.get("name") for scenario in scenarios}
    if names != EXPECTED or len(scenarios) != len(EXPECTED):
        raise RuntimeError(
            f"Fail-closed: expected {sorted(EXPECTED)}, received {sorted(names)}"
        )

    rows: list[dict[str, Any]] = []
    for scenario in scenarios:
        name = scenario["name"]
        wall = read_ratio(scenario, "wallMeanMs")
        gpu = read_ratio(scenario, "gpuTotalFrameMs")
        baseline = scenario.get("baseline", {})
        candidate = scenario.get("candidate", {})
        baseline_draws = read_median(
            baseline, "glPerFrame", "drawArraysInstanced"
        )
        candidate_draws = read_median(
            candidate, "glPerFrame", "drawArraysInstanced"
        )
        draw_ratio = (
            candidate_draws / baseline_draws
            if is_positive(candidate_draws) and is_positive(baseline_draws)
            else None
        )
        rows.append(
            {
                "name": name,
                "family": "hero" if name.startswith("hero-") else "cta",
                "wallRatio": wall,
                "fpsMultiplier": 1 / wall,
                "gpuRatio": gpu,
                "gpuReductionPercent": (1 - gpu) * 100,
                "baselineInstancedDrawsPerFrame": baseline_draws,
                "candidateInstancedDrawsPerFrame": candidate_draws,
                "instancedDrawRatio": draw_ratio,
            }
        )

    hero = [row for row in rows if row["family"] == "hero"]
    cta = [row for row in rows if row["family"] == "cta"]
    overall_wall = geometric([row["wallRatio"] for row in rows])
    overall_gpu = geometric([row["gpuRatio"] for row in rows])
    hero_wall = geometric([row["wallRatio"] for row in hero])
    hero_gpu = geometric([row["gpuRatio"] for row in hero])
    cta_wall = geometric([row["wallRatio"] for row in cta])
    cta_gpu = geometric([row["gpuRatio"] for row in cta])
    worst_gpu = max(row["gpuRatio"] for row in rows)
    accepted = (
        overall_gpu <= args.target_gpu_ratio
        and worst_gpu <= args.max_scenario_gpu_ratio
    )

    result = {
        "accepted": accepted,
        "scenarioCount": len(rows),
        "targetGpuRatio": args.target_gpu_ratio,
        "maximumScenarioGpuRatio": args.max_scenario_gpu_ratio,
        "overall": {
            "wallRatio": overall_wall,
            "fpsMultiplier": 1 / overall_wall,
            "gpuRatio": overall_gpu,
            "gpuReductionPercent": (1 - overall_gpu) * 100,
            "worstScenarioGpuRatio": worst_gpu,
        },
        "hero": {
            "wallRatio": hero_wall,
            "fpsMultiplier": 1 / hero_wall,
            "gpuRatio": hero_gpu,
            "gpuReductionPercent": (1 - hero_gpu) * 100,
        },
        "cta": {
            "wallRatio": cta_wall,
            "fpsMultiplier": 1 / cta_wall,
            "gpuRatio": cta_gpu,
            "gpuReductionPercent": (1 - cta_gpu) * 100,
        },
        "scenarios": sorted(rows, key=lambda row: row["name"]),
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")

    lines = [
        "# Final renderer direct performance proof",
        "",
        f"- GPU target verdict: **{'ACCEPT' if accepted else 'REJECT'}**",
        f"- All-surface GPU ratio: **{overall_gpu:.4f}** ({(1-overall_gpu)*100:.1f}% reduction)",
        f"- All-surface instrumented wall ratio: **{overall_wall:.4f}** ({1/overall_wall:.2f}× equivalent FPS)",
        f"- Hero GPU ratio: **{hero_gpu:.4f}**",
        f"- CTA GPU ratio: **{cta_gpu:.4f}**",
        f"- Worst individual GPU ratio: **{worst_gpu:.4f}**",
        "",
        "| Scenario | Wall ratio | FPS multiplier | GPU ratio | GPU reduction | Instanced draw ratio |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for row in result["scenarios"]:
        draw_ratio = row["instancedDrawRatio"]
        draw_text = f"{draw_ratio:.4f}" if isinstance(draw_ratio, float) else "n/a"
        lines.append(
            f"| {row['name']} | {row['wallRatio']:.4f} | {row['fpsMultiplier']:.2f}× | "
            f"{row['gpuRatio']:.4f} | {row['gpuReductionPercent']:.1f}% | {draw_text} |"
        )
    Path(args.markdown).write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 0 if accepted else 1


if __name__ == "__main__":
    raise SystemExit(main())
