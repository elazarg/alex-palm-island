"""Extract the 255-byte bootstrap chain from TRANS.BIG.

The transbig_reader function traverses a 51-entry chain scattered across
the file. Each entry contains a NOT-encoded pointer (4 bytes) followed by
5 data bytes. The adjustment for the NOT decoding is FilePos (the current
file position after reading the pointer).

Algorithm:
  for i in range(51):
      ptr = read_u32(file)          # 4-byte pointer
      adj = file.tell()             # FilePos after read = adjustment
      seek_target = NOT(ptr) + adj  # 32-bit wrapping
      file.seek(seek_target)
      data[i] = file.read(5)        # 5 data bytes

Usage:
    python3 re/extract_chain.py [path_to_trans_big]
    python3 re/extract_chain.py                      # defaults to game/cd/TRANS.BIG
"""
import struct
import sys

DEFAULT_PATH = 'game/cd/TRANS.BIG'
NUM_ITERS = 51
DATA_PER_ITER = 5


def extract_chain(filepath):
    data = open(filepath, 'rb').read()
    file_size = len(data)
    pos = 0
    entries = []

    for i in range(NUM_ITERS):
        if pos + 4 > file_size:
            print(f'Chain broke at iter {i+1}: pos={pos} past EOF', file=sys.stderr)
            break

        ptr = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        adj = pos  # FilePos after BlockRead(4)
        seek = ((~ptr) & 0xFFFFFFFF) + adj
        seek &= 0xFFFFFFFF

        if seek + DATA_PER_ITER > file_size:
            print(f'Chain broke at iter {i+1}: seek=0x{seek:08X} past EOF', file=sys.stderr)
            break

        d = data[seek:seek + DATA_PER_ITER]
        entries.append({
            'iter': i + 1,
            'ptr_offset': pos - 4,
            'ptr': ptr,
            'adj': adj,
            'seek': seek,
            'data': d,
        })
        pos = seek + DATA_PER_ITER

    return entries


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    entries = extract_chain(filepath)

    # Header
    print(f'Chain extracted from {filepath}: {len(entries)} entries')
    print(f'{"Iter":>4} {"PtrOff":>10} {"Pointer":>10} {"Adj":>10} '
          f'{"SeekTarget":>12} {"Data (hex)":>16} {"Data (chr)"}')
    print('-' * 85)

    all_data = bytearray()
    for e in entries:
        chars = ''.join(chr(b) if 32 <= b < 127 else '.' for b in e['data'])
        print(f'{e["iter"]:4d} {e["ptr_offset"]:10d} 0x{e["ptr"]:08X} {e["adj"]:10d} '
              f'0x{e["seek"]:08X} {e["data"].hex():>16} "{chars}"')
        all_data.extend(e['data'])

    print()
    print(f'Total data bytes: {len(all_data)}')
    print(f'Final file position: {entries[-1]["seek"] + DATA_PER_ITER}')

    # Hex dump of all extracted data
    print()
    print('All extracted data:')
    for i in range(0, len(all_data), 16):
        chunk = all_data[i:i + 16]
        hexs = ' '.join(f'{b:02X}' for b in chunk)
        asci = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
        print(f'  +{i:3d}: {hexs:<48s} {asci}')


if __name__ == '__main__':
    main()
