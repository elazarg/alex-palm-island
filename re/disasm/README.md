# Tracked Disassembly

These files are saved outputs from `re/dis_bp7_aware.py` for the binary ranges
we keep revisiting during RE.

Generate or refresh them with:

```bash
python3 re/export_disasm.py
```

Prerequisite:

```bash
python3 re/build_unpacked_binary.py
```

The goal is not to dump the whole EXE into the repo. This directory is for the
small set of high-value ranges that are stable enough to cite directly in the
docs and compare across findings.
