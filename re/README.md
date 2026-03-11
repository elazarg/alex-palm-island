# Reverse Engineering Tools

Scripts for analyzing and modifying the game's copy protection and binary.

## Copy protection removal

| Script | Purpose |
|--------|---------|
| `extract_chain.py` | Extract the 51-entry chain and 255-byte XOR key from any TRANS.BIG |
| `decrypt_scenes.py` | Decrypt/encrypt .SCX/.DCX files using the extracted key |
| `build_synthetic_transbig.py` | Build the 459-byte zero-key TRANS.BIG |

See [`COPY_PROTECTION.md`](../COPY_PROTECTION.md) for how the protection works.

## Binary unpacking

ALEX1.EXE is a Borland Pascal 7.0 FBOV overlay executable, double-packed:
HackStop XOR encryption (outer) wrapping LZSS compression (inner).

| Script | Purpose |
|--------|---------|
| `unpack_hackstop.py` | Remove HackStop XOR encryption layer |
| `emu_decompress.py` | Decompress LZSS layer via Unicorn CPU emulator |
| `build_unpacked_binary.py` | Run both steps and write stable outputs to `game_decrypted/bin/` |

The fully unpacked binary is 129,028 bytes.

### Stable output location

The repo keeps decrypted scene files under `game_decrypted/`, but the unpacked
EXE was previously only produced ad hoc. Use:

```bash
python3 re/build_unpacked_binary.py
```

This writes:

- `game_decrypted/bin/ALEX1_decrypted.bin`
- `game_decrypted/bin/ALEX1_unpacked.bin`

These are generated analysis artifacts, not source assets. The scripts now use
that location as the default so the workflow is reproducible and the path is
obvious.

## Disassembly

| Script | Purpose |
|--------|---------|
| `dis_bp7_aware.py` | Disassembler that understands BP7 inline data patterns (F7 A9, AA dispatch) |
| `export_disasm.py` | Save a tracked set of high-value disassembly ranges into `re/disasm/` |
| `generate_pseudo_save.py` | Mutate a real sample save into a loadable pseudo-save with tweaked money, flags, position, inventory, and visibility |

Example:

```bash
python3 re/dis_bp7_aware.py --bin game_decrypted/bin/ALEX1_unpacked.bin 0x59c6 0x5b1d
```

To refresh the tracked disassembly snippets used in the docs:

```bash
python3 re/export_disasm.py
```

## Save experiments

To create conservative, loadable pseudo-saves from the checked-in sample saves:

```bash
python3 re/generate_pseudo_save.py --base stripair --money 250 /tmp/stripair_250.GAM
```

This preserves the original scene-specific record layout and only patches fields
that are already understood. It is suitable for "start near this scene with
modified state", not arbitrary full-game save synthesis.

## Historical

The `historical/` subdirectory (uncommitted) contains earlier research notes,
Ghidra scripts, and experimental tools from the analysis process.
