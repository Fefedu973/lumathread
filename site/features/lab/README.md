# Lab architecture

The lab is intentionally organized as a feature rather than a page-sized
component. `site/pages/lab.tsx` only creates the controller and mounts the
feature shell.

```text
site/pages/lab.tsx
  -> LabControllerProvider
     -> LabShell
        -> LabStage
        -> LabControlPanel
           -> sections/*
              -> controls/*

use-lab-controller.ts
  -> hooks/*      browser/runtime concerns and derived state
  -> model/*      serializable state, presets, adapters, path/profile logic
```

## Boundaries

- `model/` is renderer-independent lab data and pure conversion logic. It must
  stay importable from tests without mounting React.
- `hooks/` owns browser lifecycles and derived React state.
- `controls/` contains focused editors. A control may read the controller
  context, but it must not own renderer state.
- `sections/` only orders related controls and handles panel visibility.
- `stage/` owns the canvas, overlays, and pointer editing surface.
- `use-lab-controller.ts` is the single orchestration boundary for state and
  commands. It must not contain JSX.

## Change workflow

1. Add serializable data to `model/types.ts` and `model/initial-state.ts`.
2. Map it to the public component API in `model/adapters.ts`.
3. Add or extend one focused control.
4. Mount that control from the matching section.
5. Extend the model and architecture tests before changing the page shell.

The architecture test enforces size limits so the lab cannot silently collapse
back into a single multi-thousand-line page.
