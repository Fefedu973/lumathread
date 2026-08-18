#!/usr/bin/env python3
"""Deterministic visual parity checks for Lumathread benchmark captures."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--min-ssim", type=float, default=0.9995)
    parser.add_argument("--max-rmse", type=float, default=0.002)
    parser.add_argument("--max-changed-2", type=float, default=0.0005)
    parser.add_argument("--max-changed-8", type=float, default=0.00005)
    return parser.parse_args()


def compare_image(
    baseline_path: Path,
    candidate_path: Path,
    diff_path: Path,
) -> dict[str, Any]:
    baseline_image = Image.open(baseline_path).convert("RGBA")
    candidate_image = Image.open(candidate_path).convert("RGBA")
    if baseline_image.size != candidate_image.size:
        return {
            "name": baseline_path.stem,
            "passed": False,
            "reason": (
                f"dimension mismatch: {baseline_image.size} != "
                f"{candidate_image.size}"
            ),
            "baseline": str(baseline_path),
            "candidate": str(candidate_path),
        }

    baseline = np.asarray(baseline_image, dtype=np.float32)
    candidate = np.asarray(candidate_image, dtype=np.float32)
    absolute = np.abs(candidate - baseline)
    rgb_absolute = absolute[..., :3]
    per_pixel_max = rgb_absolute.max(axis=2)
    normalized_delta = (candidate[..., :3] - baseline[..., :3]) / 255.0
    mse = float(np.mean(np.square(normalized_delta), dtype=np.float64))
    rmse = math.sqrt(mse)
    mae = float(np.mean(rgb_absolute, dtype=np.float64) / 255.0)
    max_error = int(rgb_absolute.max(initial=0))
    changed_0 = float(np.mean(per_pixel_max > 0))
    changed_2 = float(np.mean(per_pixel_max > 2))
    changed_8 = float(np.mean(per_pixel_max > 8))
    psnr = float("inf") if mse == 0 else 10.0 * math.log10(1.0 / mse)

    baseline_rgb = np.asarray(baseline_image.convert("RGB"), dtype=np.uint8)
    candidate_rgb = np.asarray(candidate_image.convert("RGB"), dtype=np.uint8)
    ssim = float(
        structural_similarity(
            baseline_rgb,
            candidate_rgb,
            channel_axis=2,
            data_range=255,
        )
    )

    heat = np.clip(per_pixel_max * 10.0, 0, 255).astype(np.uint8)
    heatmap = np.zeros((*heat.shape, 4), dtype=np.uint8)
    heatmap[..., 0] = heat
    heatmap[..., 1] = np.clip(heat * 0.2, 0, 255).astype(np.uint8)
    heatmap[..., 2] = np.clip(255 - heat, 0, 255).astype(np.uint8)
    heatmap[..., 3] = np.where(per_pixel_max > 0, 255, 0).astype(np.uint8)
    diff_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(heatmap, mode="RGBA").save(diff_path)

    return {
        "name": baseline_path.stem,
        "baseline": str(baseline_path),
        "candidate": str(candidate_path),
        "diff": str(diff_path),
        "width": baseline_image.width,
        "height": baseline_image.height,
        "mae": mae,
        "rmse": rmse,
        "maxError8Bit": max_error,
        "changedPixelRatioAny": changed_0,
        "changedPixelRatioOver2": changed_2,
        "changedPixelRatioOver8": changed_8,
        "psnrDb": psnr,
        "ssim": ssim,
    }


def main() -> int:
    args = parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    baseline_files = sorted(args.baseline.glob("*.png"))
    candidate_names = {path.name for path in args.candidate.glob("*.png")}
    baseline_names = {path.name for path in baseline_files}
    missing_candidate = sorted(baseline_names - candidate_names)
    extra_candidate = sorted(candidate_names - baseline_names)

    results: list[dict[str, Any]] = []
    for baseline_path in baseline_files:
        candidate_path = args.candidate / baseline_path.name
        if not candidate_path.exists():
            continue
        comparison = compare_image(
            baseline_path,
            candidate_path,
            args.out / "diffs" / baseline_path.name,
        )
        if "reason" not in comparison:
            comparison["passed"] = (
                comparison["ssim"] >= args.min_ssim
                and comparison["rmse"] <= args.max_rmse
                and comparison["changedPixelRatioOver2"] <= args.max_changed_2
                and comparison["changedPixelRatioOver8"] <= args.max_changed_8
            )
        results.append(comparison)

    passed = (
        bool(results)
        and not missing_candidate
        and not extra_candidate
        and all(result.get("passed", False) for result in results)
    )
    report = {
        "passed": passed,
        "thresholds": {
            "minSsim": args.min_ssim,
            "maxRmse": args.max_rmse,
            "maxChangedPixelRatioOver2": args.max_changed_2,
            "maxChangedPixelRatioOver8": args.max_changed_8,
        },
        "missingCandidate": missing_candidate,
        "extraCandidate": extra_candidate,
        "images": results,
    }
    (args.out / "visual-diff.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )

    lines = [
        "# Lumathread visual parity",
        "",
        f"Overall: **{'PASS' if passed else 'FAIL'}**",
        "",
        "| Capture | SSIM | RMSE | Pixels > 2 | Pixels > 8 | Max error | Result |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for result in results:
        if "reason" in result:
            lines.append(
                f"| {result['name']} | n/a | n/a | n/a | n/a | n/a | FAIL: {result['reason']} |"
            )
            continue
        lines.append(
            "| {name} | {ssim:.7f} | {rmse:.7f} | {changed2:.5%} | "
            "{changed8:.5%} | {max_error} | {status} |".format(
                name=result["name"],
                ssim=result["ssim"],
                rmse=result["rmse"],
                changed2=result["changedPixelRatioOver2"],
                changed8=result["changedPixelRatioOver8"],
                max_error=result["maxError8Bit"],
                status="PASS" if result["passed"] else "FAIL",
            )
        )
    if missing_candidate:
        lines.extend(["", f"Missing candidate captures: `{missing_candidate}`"])
    if extra_candidate:
        lines.extend(["", f"Unexpected candidate captures: `{extra_candidate}`"])
    (args.out / "visual-diff.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("\n".join(lines))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
