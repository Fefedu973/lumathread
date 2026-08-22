#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"Expected one {label} block, found {count}")
    return source.replace(before, after)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "path",
        nargs="?",
        default="baseline/src/runtime/use-hero-wave-renderer.ts",
    )
    args = parser.parse_args()

    path = Path(args.path)
    source = path.read_text(encoding="utf-8")
    request_before = (
        "      if (\n"
        "        !running ||\n"
        "        frameScheduled ||\n"
        "        document.visibilityState === \"hidden\" ||"
    )
    request_after = (
        "      if (\n"
        "        !running ||\n"
        "        frameScheduled ||\n"
        "        settings.paused ||\n"
        "        manualPausedRef.current ||\n"
        "        document.visibilityState === \"hidden\" ||"
    )
    step_before = (
        "      step: (seconds: number) => {\n"
        "        const safeSeconds = finite(seconds, 0);"
    )
    step_after = (
        "      step: (seconds: number) => {\n"
        "        if (frameScheduled) {\n"
        "          cancelAnimationFrame(raf);\n"
        "          frameScheduled = false;\n"
        "        }\n"
        "        const safeSeconds = finite(seconds, 0);"
    )
    source = replace_once(
        source,
        request_before,
        request_after,
        "requestFrame pause selector",
    )
    source = replace_once(
        source,
        step_before,
        step_after,
        "debug.step cancellation",
    )
    path.write_text(source, encoding="utf-8")
    print(f"Applied symmetric one-frame debug stepping to {path}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
