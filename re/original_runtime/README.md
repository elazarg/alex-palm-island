# Original Runtime Automation

Reusable tooling for driving the original DOS game under `dosbox-x` and
capturing screenshots from scene-specific entry points. This is for reverse
engineering the original runtime, not for the remake.

## Requirements

- `dosbox-x`
- `xvfb-run`
- Python packages:
  - `Pillow`
  - `python-xlib`

A simple way to provide them is a throwaway venv:

```bash
python3 -m venv /tmp/alex-x11-venv
source /tmp/alex-x11-venv/bin/activate
pip install pillow python-xlib
```

## What this solves

The original executable accepts command-line arguments, but for the retail
binary they do **not** reliably bypass the title/menu flow. In practice, this
automation is still useful because it:

```bash
ALEX1.EXE STRIPAIR
```

and then continues through a reproducible title/menu path. The harness:

- generates a DOSBox-X config
- launches the original game in a chosen scene
- finds the DOSBox-X window over X11
- sends relative mouse clicks
- captures screenshots

For future work, prefer keeping the automation here and extending it with
reusable wrappers (for example, menu click sequences or temporary save-file
swaps) instead of writing scene-specific one-offs in `/tmp`.

## Capture a scene

Example:

```bash
source /tmp/alex-x11-venv/bin/activate
xvfb-run -s '-screen 0 1400x1000x24' \
  python re/original_runtime/capture_scene.py \
    --scene STRIPAIR \
    --output-dir /tmp/stripair-capture \
    --startup-delay 8 \
    --capture 0,start \
    --click 260,190,4,visible \
    --click 120,150,4,upperleft \
    --click 90,250,4,lowerleft
```

Coordinates are relative to the DOSBox-X window, not absolute screen space.

## Notes

- The scene argument belongs to the original game executable, not the remake.
- For the retail executable, the scene argument should be treated as a startup
  hint, not a guaranteed "jump directly into this scene" mechanism.
- This harness is deliberately generic. Scene-specific click scripts should be
  added as thin wrappers rather than copied into `/tmp`.
- For future scenes, prefer keeping automation sequences here under `re/` so the
  reverse-engineering workflow remains reproducible.
