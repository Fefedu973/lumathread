#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCENARIO_WORDS = ("hero", "cta", "desktop", "mobile", "dark", "light", "dpr")
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


def finite(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return None


def first_number(value: Any, keys: tuple[str, ...]) -> float | None:
    if not isinstance(value, dict):
        return None
    for key in keys:
        result = finite(value.get(key))
        if result is not None:
            return result
    return None


def walk(value: Any, path: str = "root"):
    if isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        yield path, value
        for key, child in value.items():
            yield from walk(child, f"{path}.{key}")


def nested_ratio(value: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    baseline = value.get("baseline")
    candidate = value.get("candidate")
    if not isinstance(baseline, dict) or not isinstance(candidate, dict):
        return None
    before = first_number(baseline, keys)
    after = first_number(candidate, keys)
    if before is None or before <= 0 or after is None:
        return None
    return after / before


def label_for(value: dict[str, Any], path: str) -> str:
    for key in ("scenario", "name", "id", "label", "title"):
        label = value.get(key)
        if isinstance(label, str) and label.strip():
            return label.strip()
    return path


def geometric(values: list[float]) -> float | None:
    if not values:
        return None
    return math.exp(sum(math.log(value) for value in values) / len(values))


@dataclass
class Measurement:
    wall_ratio: float | None
    gpu_ratio: float | None
    worst_wall: float | None
    worst_gpu: float | None
    scenario_count: int
    gpu_scenario_count: int
    visual_pass: bool
    source: str

    def to_json(self) -> dict[str, Any]:
        return {
            "wallRatio": self.wall_ratio,
            "gpuRatio": self.gpu_ratio,
            "worstWallRatio": self.worst_wall,
            "worstGpuRatio": self.worst_gpu,
            "scenarioCount": self.scenario_count,
            "gpuScenarioCount": self.gpu_scenario_count,
            "visualPass": self.visual_pass,
            "source": self.source,
        }


def visual_report_pass(directory: Path) -> bool:
    reports = list(directory.rglob("visual-diff.json"))
    if not reports:
        return False
    verdicts: list[bool] = []
    for report_path in reports:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        local: list[bool] = []
        for _, value in walk(report):
            for key in ("passed", "pass", "ok", "accepted", "success"):
                if isinstance(value.get(key), bool):
                    local.append(value[key])
        if not local or not all(local):
            return False
        verdicts.extend(local)
    return bool(verdicts) and all(verdicts)


def measure(directory: Path) -> Measurement:
    benchmark_files = list(directory.rglob("benchmark.json"))
    records: list[tuple[str, float | None, float | None]] = []
    for benchmark_path in benchmark_files:
        report = json.loads(benchmark_path.read_text(encoding="utf-8"))
        for path, value in walk(report):
            label = label_for(value, path)
            wall = first_number(value, WALL_RATIO_KEYS)
            gpu = first_number(value, GPU_RATIO_KEYS)
            if wall is None:
                wall = nested_ratio(value, WALL_VALUE_KEYS)
            if gpu is None:
                gpu = nested_ratio(value, GPU_VALUE_KEYS)
            if wall is not None or gpu is not None:
                records.append((label, wall, gpu))

    scenario_records = [
        record
        for record in records
        if any(word in record[0].lower() for word in SCENARIO_WORDS)
    ] or records
    wall_values = [
        wall for _, wall, _ in scenario_records if wall is not None and wall > 0
    ]
    gpu_values = [
        gpu for _, _, gpu in scenario_records if gpu is not None and gpu > 0
    ]
    return Measurement(
        wall_ratio=geometric(wall_values),
        gpu_ratio=geometric(gpu_values),
        worst_wall=max(wall_values) if wall_values else None,
        worst_gpu=max(gpu_values) if gpu_values else None,
        scenario_count=len(wall_values),
        gpu_scenario_count=len(gpu_values),
        visual_pass=visual_report_pass(directory),
        source=str(directory),
    )


def incremental_from_direct(
    direct: Measurement,
    baseline: Measurement,
    label: str,
) -> Measurement:
    wall = (
        direct.wall_ratio / baseline.wall_ratio
        if direct.wall_ratio is not None
        and baseline.wall_ratio is not None
        and baseline.wall_ratio > 0
        else None
    )
    gpu = (
        direct.gpu_ratio / baseline.gpu_ratio
        if direct.gpu_ratio is not None
        and baseline.gpu_ratio is not None
        and baseline.gpu_ratio > 0
        else None
    )
    return Measurement(
        wall_ratio=wall,
        gpu_ratio=gpu,
        worst_wall=None,
        worst_gpu=None,
        scenario_count=min(direct.scenario_count, baseline.scenario_count),
        gpu_scenario_count=min(
            direct.gpu_scenario_count,
            baseline.gpu_scenario_count,
        ),
        visual_pass=direct.visual_pass and baseline.visual_pass,
        source=label,
    )


def eligible(measurement: Measurement) -> bool:
    if not measurement.visual_pass:
        return False
    if measurement.wall_ratio is None or measurement.gpu_ratio is None:
        return False
    if measurement.wall_ratio > 1.01 or measurement.gpu_ratio > 1.01:
        return False
    return measurement.wall_ratio < 0.995 or measurement.gpu_ratio < 0.995


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--markdown", required=True)
    args = parser.parse_args()

    root = Path(args.root)
    consolidated = measure(root / "consolidated")
    if (
        not consolidated.visual_pass
        or consolidated.wall_ratio is None
        or consolidated.gpu_ratio is None
    ):
        raise RuntimeError(
            "Fail-closed: consolidated stack has no complete visual/wall/GPU report."
        )

    direct_uniform = measure(root / "uniform")
    uniform = incremental_from_direct(
        direct_uniform,
        consolidated,
        "uniform-location versus consolidated",
    )
    path_core = measure(root / "path-core")
    optical = measure(root / "optical")

    clear_candidates: list[tuple[int, Measurement]] = []
    clear_root = root / "clear"
    if clear_root.exists():
        for directory in sorted(path for path in clear_root.iterdir() if path.is_dir()):
            match = re.search(r"clear-elision-(\d+)-", directory.name)
            if match:
                clear_candidates.append((int(match.group(1)), measure(directory)))
    clear_candidates = [entry for entry in clear_candidates if eligible(entry[1])]
    clear_candidates.sort(
        key=lambda entry: (
            (entry[1].wall_ratio or 1) * (entry[1].gpu_ratio or 1),
            entry[1].gpu_ratio or 1,
        )
    )
    selected_clear = clear_candidates[0][0] if clear_candidates else None

    selected = {
        "uniformLocationCache": eligible(uniform),
        "pathCoreOutput": eligible(path_core),
        "opticalFieldCache": eligible(optical),
        "clearElisionIndex": selected_clear,
    }

    result = {
        "selected": selected,
        "consolidated": consolidated.to_json(),
        "uniformLocation": uniform.to_json(),
        "uniformLocationDirect": direct_uniform.to_json(),
        "pathCoreOutput": path_core.to_json(),
        "opticalFieldCache": optical.to_json(),
        "clearCandidates": [
            {"index": index, **measurement.to_json()}
            for index, measurement in clear_candidates
        ],
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    def row(name: str, measurement: Measurement, chosen: bool) -> str:
        wall = f"{measurement.wall_ratio:.4f}" if measurement.wall_ratio else "—"
        gpu = f"{measurement.gpu_ratio:.4f}" if measurement.gpu_ratio else "—"
        return (
            f"| {name} | {'yes' if chosen else 'no'} | "
            f"{'PASS' if measurement.visual_pass else 'FAIL'} | {wall} | {gpu} |"
        )

    rows = [
        row("consolidated direct", consolidated, True),
        row("uniform-location incremental", uniform, selected["uniformLocationCache"]),
        row("path-core incremental", path_core, selected["pathCoreOutput"]),
        row("optical-field incremental", optical, selected["opticalFieldCache"]),
    ]
    if selected_clear is not None:
        rows.append(
            row(
                f"clear-elision {selected_clear}",
                clear_candidates[0][1],
                True,
            )
        )
    markdown = (
        "# Exact candidate selection\n\n"
        f"- Uniform-location cache: **{selected['uniformLocationCache']}**\n"
        f"- Path core-output fusion: **{selected['pathCoreOutput']}**\n"
        f"- Optical-field cache: **{selected['opticalFieldCache']}**\n"
        f"- Clear-elision index: **{selected_clear if selected_clear is not None else 'none'}**\n\n"
        "| Candidate | Selected | Visual | Wall ratio | GPU ratio |\n"
        "|---|---|---|---:|---:|\n"
        + "\n".join(rows)
        + "\n"
    )
    Path(args.markdown).write_text(markdown, encoding="utf-8")
    print(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
