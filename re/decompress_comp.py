#!/usr/bin/env python3
"""
COMP decompressor for Alex Palm Island DAT files.

File format:
  [0:4]   Magic: "COMP" (43 4F 4D 50)
  [4:8]   u32 LE: total decompressed size
  [8:]    One or more compressed chunks

Chunk format (5-byte header + compressed data):
  [0:2]   u16 LE: chunk decompressed size (includes 4-byte overhead)
  [2]     u8: method (0 = uncompressed, 1 = compressed)
  [3:5]   u16 LE: chunk compressed data size
  [5:]    compressed data (for method=1)

Compression scheme (method=1):
  Three token types in the compressed stream:

  0xFF <len:u8> <offset:u16 LE>   Back-reference: copy <len> bytes from
                                   output position <offset> (absolute).

  0xFE <len:u8> <byte:u8>         RLE fill: emit <byte> repeated <len> times.

  <any other byte>                 Literal: emit as-is.

  The first 4 decompressed bytes of each chunk are internal overhead
  (always 00 00 00 00) and are discarded. The useful data per chunk
  is therefore (chunk_decomp_size - 4) bytes.

Usage:
  python3 decompress_comp.py INPUT.DAT [OUTPUT]
  python3 decompress_comp.py --test          # test all COMP files in game_decrypted/cd/
"""

import struct
import sys
import os


def decompress_comp(filedata: bytes) -> bytes:
    """Decompress a COMP-format file. Returns the decompressed bytes."""
    if filedata[:4] != b'COMP':
        raise ValueError(f"Not a COMP file (magic: {filedata[:4]!r})")

    expected_size = struct.unpack_from('<I', filedata, 4)[0]
    payload = filedata[8:]

    total_out = bytearray()
    pos = 0

    while pos + 5 <= len(payload) and len(total_out) < expected_size:
        # Read chunk header
        chunk_decomp = struct.unpack_from('<H', payload, pos)[0]
        method = payload[pos + 2]
        chunk_comp = struct.unpack_from('<H', payload, pos + 3)[0]
        pos += 5

        if method == 0:
            # Uncompressed chunk
            total_out.extend(payload[pos:pos + chunk_decomp])
            pos += chunk_decomp

        elif method == 1:
            # Compressed chunk
            chunk_data = payload[pos:pos + chunk_comp]
            out = _decompress_chunk(chunk_data, chunk_decomp)
            # First 4 bytes are internal overhead; discard them
            total_out.extend(out[4:chunk_decomp])
            pos += chunk_comp

        else:
            raise ValueError(f"Unknown compression method {method} at offset {pos - 5}")

    result = bytes(total_out[:expected_size])
    if len(result) != expected_size:
        raise ValueError(
            f"Size mismatch: got {len(result)}, expected {expected_size}"
        )
    return result


def _decompress_chunk(chunk_data: bytes, max_out: int) -> bytearray:
    """Decompress a single chunk using the FF/FE token scheme."""
    out = bytearray()
    pos = 0

    while pos < len(chunk_data) and len(out) < max_out:
        b = chunk_data[pos]

        if b == 0xFF:
            # Back-reference: copy <length> bytes from absolute <offset>
            if pos + 3 >= len(chunk_data):
                break
            length = chunk_data[pos + 1]
            ref_offset = struct.unpack_from('<H', chunk_data, pos + 2)[0]
            pos += 4
            for i in range(length):
                if ref_offset + i < len(out):
                    out.append(out[ref_offset + i])
                else:
                    out.append(0)

        elif b == 0xFE:
            # RLE fill: repeat <fill_byte> for <length> times
            if pos + 2 >= len(chunk_data):
                break
            length = chunk_data[pos + 1]
            fill_byte = chunk_data[pos + 2]
            pos += 3
            out.extend([fill_byte] * length)

        else:
            # Literal byte
            out.append(b)
            pos += 1

    return out


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == '--test':
        _run_tests()
        return

    if len(sys.argv) < 2:
        print(__doc__.strip())
        sys.exit(1)

    input_path = sys.argv[1]
    with open(input_path, 'rb') as f:
        filedata = f.read()

    result = decompress_comp(filedata)

    if len(sys.argv) >= 3:
        output_path = sys.argv[2]
        with open(output_path, 'wb') as f:
            f.write(result)
        print(f"{input_path}: {len(filedata)} -> {len(result)} bytes -> {output_path}")
    else:
        basename = os.path.splitext(os.path.basename(input_path))[0]
        print(f"{input_path}: {len(filedata)} compressed -> {len(result)} decompressed")
        print(f"First 32 bytes: {result[:32].hex(' ')}")


def _run_tests():
    """Test decompression on all COMP files in game_decrypted/cd/."""
    cd_dir = os.path.join(os.path.dirname(__file__), '..', 'game_decrypted', 'cd')
    if not os.path.isdir(cd_dir):
        cd_dir = os.path.join(os.path.dirname(__file__), '..', 'game', 'cd')

    dat_files = sorted(f for f in os.listdir(cd_dir) if f.endswith('.DAT'))
    success = fail = skip = 0

    for fname in dat_files:
        path = os.path.join(cd_dir, fname)
        with open(path, 'rb') as f:
            filedata = f.read()

        if filedata[:4] != b'COMP':
            skip += 1
            continue

        try:
            result = decompress_comp(filedata)
            ratio = len(filedata) / len(result) * 100
            print(f"  {fname:20s}: {len(filedata):>10,} -> {len(result):>10,}  ({ratio:5.1f}%)  OK")
            success += 1
        except Exception as e:
            print(f"  {fname:20s}: FAILED: {e}")
            fail += 1

    print(f"\n{success} OK, {fail} FAILED, {skip} non-COMP skipped")


if __name__ == '__main__':
    main()
