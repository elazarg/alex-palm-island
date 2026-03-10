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

The fully unpacked binary is 129,028 bytes.

## Disassembly

| Script | Purpose |
|--------|---------|
| `dis_bp7_aware.py` | Disassembler that understands BP7 inline data patterns (F7 A9, AA dispatch) |

## Historical

The `historical/` subdirectory (uncommitted) contains earlier research notes,
Ghidra scripts, and experimental tools from the analysis process.
