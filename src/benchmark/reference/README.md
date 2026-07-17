# Frozen renderer reference

This directory contains the renderer snapshot captured before the next optimization pass.
It is imported only by the development benchmark and is intentionally excluded from the
published package entry point. Do not refactor it alongside the production renderer: its
purpose is to preserve a stable visual and performance baseline.
