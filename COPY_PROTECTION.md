# Copy Protection in *The Adventures of Alex — Palm Island Mission*

*The Adventures of Alex — Palm Island Mission* is a 1996 MS-DOS point-and-click
adventure game by Onda Publications / Eric Cohen Edutainment (Israel). It ships
on a single CD-ROM. The engine is written in Borland Pascal 7.0.

The game has two layers of copy protection: the executable is encrypted and
compressed, and the game data is encrypted with a key hidden inside a 245 MB
decoy file. This document describes both, and how they were defeated.

## The executable: HackStop + LZSS

The game executable (ALEX1.EXE, 72,864 bytes on disk) is double-packed.

The outer layer is **HackStop**, a commercial EXE protector. It XOR-encrypts the
code image using CRC-CCITT (polynomial 0x1021) as a running key, processing
32 KB chunks backwards from the end of the file. A CRC check after decryption
verifies integrity. The signature "Hack!" is visible in the packed binary.

Underneath HackStop is an **LZSS compression** layer. After the XOR decryption
runs at load time, an LZSS decompressor unpacks the code into its final form.

The fully unpacked binary is 129,028 bytes — a standard Borland Pascal 7.0 FBOV
overlay executable. Unpacking was needed only for static analysis of the data
protection described below; the game ships with the original packed EXE.

## The data: TRANS.BIG

The CD contains a 245 MB file called **TRANS.BIG**. Of those 245 MB, the game
reads exactly **459 bytes**. The rest is filler — it exists only to make the file
too large to copy to a hard disk (typical drives in 1996 were 500 MB to 1 GB).

Without TRANS.BIG, the game crashes at startup with:
`"a" could not be converted to a number!`

### What those 459 bytes encode

TRANS.BIG contains a 51-entry linked list scattered across the file. Each entry
is 9 bytes: a 4-byte NOT-encoded pointer, then 5 bytes of payload.

At startup, the game traverses the chain:

```
for i = 1 to 51:
    ptr    = read_u32(file)             # 4-byte little-endian pointer
    pos    = FilePos(file)              # current position after the read
    target = NOT(ptr) + pos             # 32-bit wrapping arithmetic
    Seek(file, target)
    data[i] = read_bytes(file, 5)       # 5 payload bytes
```

The 51 × 5 = 255 payload bytes form a XOR key table. The chain hops span from
offset 5.3 MB to 245.8 MB, spaced roughly 4–6 MB apart, forcing the game to
seek across most of the file. The first pointer doubles as a size gate: the game
computes `NOT(first_4_bytes) + 409` as the minimum file size for the first seek.

### How the key encrypts scene files

Every `.SCX` (scene script) and `.DCX` (scene data) file on the CD is XOR'd
with this 255-byte key, cycling:

```
plaintext[i] = ciphertext[i] XOR key[i mod 255]
```

97 files are encrypted (53 .SCX + 44 .DCX, ~266 KB total). Everything else on
the disc — graphics, sounds, indexes — is unencrypted. If the key is wrong, the
decrypted scenes are garbage and the game crashes on the first non-numeric value
it encounters.

## Removing the protection

The compact release (~115 MB, down from ~360 MB) removes the data protection
entirely. The game binary is unmodified.

The approach: decrypt all scene files in advance, then replace TRANS.BIG with a
tiny file that makes the game derive an all-zero key — which is the identity
under XOR.

Concretely:

1. Extract the real 255-byte key by replaying the chain traversal.
2. XOR-decrypt all 97 .SCX/.DCX files (XOR is its own inverse).
3. Replace TRANS.BIG with a 459-byte file where every pointer is `0xFFFFFFFF`
   and every payload byte is `0x00`.

This works because `NOT(0xFFFFFFFF) = 0`, so `target = 0 + FilePos = FilePos` —
every seek is a no-op, and the chain reads straight through the file
sequentially. The resulting key is 255 zero bytes, and XOR with zero leaves the
pre-decrypted files unchanged.

An alternative approach preserves the original encrypted files by replacing
TRANS.BIG with a **sparse file** — 245 MB apparent size but only ~212 KB on disk,
with the 51 chain entries at their original offsets and filesystem holes filling
the gaps. This only works on filesystems that support sparse files (ext4, NTFS),
so it is not used for distribution.

The disc used for this project has minor physical damage: 60 KB of TRANS.BIG
(30 scattered sectors) could not be read. Since all 30 bad sectors fall in the
unread filler region — far from any of the 51 chain entries — this damage almost
certainly has no effect on the game.

## Numbers

| | |
|---|---|
| TRANS.BIG on disc | 245,905,459 bytes |
| Data actually read | 459 bytes (51 × 9) |
| XOR key | 255 bytes, 7.47 bits/byte entropy |
| Encrypted files | 97 (53 .SCX + 44 .DCX), ~266 KB |
| Compact TRANS.BIG | 459 bytes |
| ALEX1.EXE packed | 72,864 bytes |
| ALEX1.EXE unpacked | 129,028 bytes |

