#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any


def copy_tree_contents(source: Path, target: Path) -> None:
    if not source.exists():
        return
    target.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        destination = target / item.name
        if item.is_dir():
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(item, destination)
        else:
            shutil.copy2(item, destination)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--downloaded", default="downloaded")
    parser.add_argument("--output", default="perf-results")
    parser.add_argument("--expected-artifacts", type=int, default=2)
    args = parser.parse_args()

    downloaded = Path(args.downloaded)
    artifacts = sorted(downloaded.glob("final-temporal-*"))
    if len(artifacts) != args.expected_artifacts:
        raise RuntimeError(
            f"Expected {args.expected_artifacts} focus artifacts, "
            f"found {len(artifacts)}"
        )

    reports: list[dict[str, Any]] = []
    output = Path(args.output)
    for side in ("baseline", "candidate"):
        (output / "screenshots" / side).mkdir(parents=True, exist_ok=True)
    (output / "candidate").mkdir(parents=True, exist_ok=True)

    for artifact in artifacts:
        report_path = artifact / "benchmark.json"
        if not report_path.exists():
            raise RuntimeError(f"Missing benchmark.json in {artifact}")
        reports.append(json.loads(report_path.read_text(encoding="utf-8")))
        for side in ("baseline", "candidate"):
            source = artifact / "screenshots" / side
            if source.exists():
                for image in source.glob("*.png"):
                    shutil.copy2(image, output / "screenshots" / side / image.name)
        copy_tree_contents(artifact / "candidate", output / "candidate")

    combined = dict(reports[0])
    combined["generatedAt"] = max(
        str(report.get("generatedAt", "")) for report in reports
    )
    for key in ("scenarios", "profiles", "snapshots"):
        combined[key] = [
            entry
            for report in reports
            for entry in report.get(key, [])
        ]
    (output / "benchmark.json").write_text(
        json.dumps(combined, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "artifacts": [artifact.name for artifact in artifacts],
                "scenarios": len(combined["scenarios"]),
                "profiles": len(combined["profiles"]),
                "snapshots": len(combined["snapshots"]),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
