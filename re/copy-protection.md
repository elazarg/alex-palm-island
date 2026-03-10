# TRANS.BIG Copy Protection Mechanism

## Overview

TRANS.BIG is a 245 MB file on the game CD whose sole demonstrated purpose is
copy protection. It contains a traversable bootstrap structure that yields a
255-byte XOR key table used to decrypt scene files (.SCX and .DCX).

The 245 MB bulk is not needed for key retrieval — only 459 bytes of scattered
data are read. The rest likely serves as anti-copy filler: a 1996 CD-ROM can
hold it, but it cannot be casually copied to a hard disk.

## The chain structure

TRANS.BIG encodes a 51-hop linked list scattered across the file. Each hop
consists of a 4-byte NOT-encoded pointer followed by 5 bytes of payload data.

At startup the game traverses the chain:

```
for i = 1 to 51:
    ptr   = read_u32(file)              # 4-byte pointer
    adj   = FilePos(file)               # current position after read
    target = NOT(ptr) + adj             # 32-bit wrapping arithmetic
    Seek(file, target)
    data[i] = read_bytes(file, 5)       # 5 payload bytes
```

The 51 × 5 = 255 payload bytes form the XOR key table, stored at DS:0x56D8.

In the original file, the chain hops span from 5.3 MB to 245.8 MB, with each
entry ~4–6 MB apart. The first pointer also serves as a size gate: the game
computes `NOT(first_4_bytes) + 409` as the minimum file size required for the
first seek to succeed.

## How the key is used

Each .SCX (scene script) and .DCX (scene data) file is XOR-encrypted with the
255-byte key, cycling:

```
plaintext[i] = ciphertext[i] XOR key[i mod 255]
```

If the key is wrong, decrypted scene data contains garbage. The game eventually
hits a non-numeric string where it expects a number, producing the error:
`"a" could not be converted to a number!`

## Removing the protection

Two approaches work:

### 1. Pre-decrypted scenes + zero-key TRANS.BIG (recommended)

- Decrypt all .SCX/.DCX files using the extracted key (XOR is its own inverse)
- Replace TRANS.BIG with a 459-byte file where every pointer is `0xFFFFFFFF`
  and every payload is `00 00 00 00 00`

With `ptr = 0xFFFFFFFF`: `NOT(ptr) = 0`, so `target = 0 + FilePos = FilePos`.
Each seek is a no-op — the chain reads sequentially. All payload bytes are zero,
producing an all-zero key. XOR with zero is identity, so pre-decrypted scene
files pass through unchanged.

**Result**: 459-byte TRANS.BIG replaces 245 MB original. Total game size drops
from ~360 MB to ~115 MB (resource DATs + pre-decrypted scenes + game binaries).

### 2. Sparse TRANS.BIG with original key

- Keep .SCX/.DCX files encrypted (original)
- Replace TRANS.BIG with a sparse file: 245 MB apparent size, ~212 KB on disk
- Write only the 51 pointer + payload entries at their original file offsets
- Filesystem holes (zeros) fill the gaps; the game never reads those regions

**Result**: functionally identical to the original, but disk usage drops from
245 MB to 212 KB. Requires a filesystem that supports sparse files.

## Tools

| Tool | Purpose |
|------|---------|
| `re/extract_chain.py` | Extract the 51-entry chain and 255-byte key from any TRANS.BIG |
| `re/decrypt_scenes.py` | Decrypt .SCX/.DCX files using the extracted key |
| `re/build_synthetic_transbig.py` | Build the 459-byte zero-key TRANS.BIG |
| `./run_game.sh [compact\|sparse\|zerokey]` | Run the game safely from a temp copy |
| `./verify_game_files.sh` | Verify all game files against SHA256 manifest |

## File details

- **TRANS.BIG**: 245,905,459 bytes. Opened once at startup with Borland Pascal
  mode 2 (read/write, the default FileMode). Read for key extraction, then closed.
  Not observed reopening in startup traces.
- **Chain data**: 51 entries × 9 bytes = 459 bytes total. Pointers scatter from
  offset 5,325,204 to 245,841,454 (last entry is 64 KB before EOF).
- **Key**: 255 bytes, high entropy (7.47 bits/byte). Stored directly as byte values
  without transformation.
- **Protected files**: 53 .SCX + 44 .DCX = 97 files, ~266 KB total.

## Implementation notes

The chain traversal is in `transbig_reader` (unpacked binary offset 0x17527).
Key instructions:

- `0x175BD`: `BlockRead(file, buf, 4)` — read pointer
- `0x175CE`: `FilePos(file)` — get current position (dispatch 0x4634, single call site)
- `0x175DF`: `NOT AX; NOT DX` — bitwise NOT of pointer
- `0x175E3`: `ADD AX,CX; ADC DX,BX` — add FilePos
- `0x175E9`: `Seek(file, target)` — seek to computed offset
- `0x1760B`: `BlockRead(file, buf, 1)` — read one payload byte (inner loop, 5 iterations)

The outer loop counter runs from 1 to 255 in steps of 5 (= 51 iterations).
Each payload byte is converted to a 1-character string (dispatch 0x3D90) and
concatenated into the key string (dispatches 0x6E74, 0x6EF3).
