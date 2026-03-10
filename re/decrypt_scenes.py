"""Decrypt SCX/DCX scene files using the XOR key extracted from TRANS.BIG.

The 255-byte XOR key is extracted from TRANS.BIG via the chained navigation
structure (51 entries × 5 bytes). Each byte in the file is XOR'd with the
corresponding key byte, cycling every 255 bytes.

Usage:
    python3 re/decrypt_scenes.py                    # decrypt all SCX/DCX files
    python3 re/decrypt_scenes.py game/cd/LOGO.SCX   # decrypt specific file
    python3 re/decrypt_scenes.py --dump game/cd/LOGO.SCX  # decrypt and print content
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from extract_chain import extract_chain

DEFAULT_TRANS_BIG = 'game/cd/TRANS.BIG'
DEFAULT_CD_DIR = 'game/cd'


def get_xor_key(trans_big_path=DEFAULT_TRANS_BIG):
    """Extract the 255-byte XOR key from TRANS.BIG."""
    entries = extract_chain(trans_big_path)
    key = bytearray()
    for e in entries:
        key.extend(e['data'])
    assert len(key) == 255, f"Expected 255 key bytes, got {len(key)}"
    return key


def xor_decrypt(data, key):
    """XOR-decrypt data using a cycling 255-byte key."""
    out = bytearray(len(data))
    for i in range(len(data)):
        out[i] = data[i] ^ key[i % 255]
    return out


def decrypt_file(filepath, key):
    """Decrypt a single file and return the plaintext."""
    with open(filepath, 'rb') as f:
        data = f.read()
    return xor_decrypt(data, key)


def main():
    dump_mode = '--dump' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--dump']

    key = get_xor_key()

    if args:
        # Decrypt specific files
        for filepath in args:
            dec = decrypt_file(filepath, key)
            if dump_mode:
                print(f"=== {filepath} ({len(dec)} bytes) ===")
                # Print as text, replacing non-printable chars
                try:
                    # Skip first byte (0xC0 header) if present
                    start = 1 if dec[0] == 0xC0 else 0
                    text = dec[start:].decode('ascii', errors='replace')
                    print(text)
                except Exception as e:
                    print(f"Error: {e}")
                    # Hex dump instead
                    for i in range(0, min(len(dec), 512), 16):
                        chunk = dec[i:i+16]
                        hexs = ' '.join(f'{b:02x}' for b in chunk)
                        asci = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
                        print(f'  {i:04x}: {hexs:<48s} {asci}')
            else:
                outpath = filepath + '.dec'
                with open(outpath, 'wb') as f:
                    f.write(dec)
                print(f"  {filepath} -> {outpath} ({len(dec)} bytes)")
    else:
        # Decrypt all SCX/DCX files in the CD directory
        cd_dir = DEFAULT_CD_DIR
        encrypted_files = sorted(
            f for f in os.listdir(cd_dir)
            if f.upper().endswith(('.SCX', '.DCX'))
        )
        print(f"Found {len(encrypted_files)} encrypted files in {cd_dir}")
        print(f"XOR key: {key[:16].hex()}... ({len(key)} bytes)")
        print()

        for fname in encrypted_files:
            filepath = os.path.join(cd_dir, fname)
            dec = decrypt_file(filepath, key)
            header = f'0x{dec[0]:02x}' if dec else 'empty'

            # Find first line of text content
            start = 0
            while start < min(10, len(dec)) and (dec[start] < 0x20 or dec[start] > 0x7E):
                start += 1
            line_end = dec.index(b'\r\n', start) if b'\r\n' in dec[start:start+80] else start + 40
            preview = dec[start:min(line_end, start+50)].decode('ascii', errors='replace')

            print(f"  {fname:20s} {len(dec):6d}B  hdr={header}  {preview}")


if __name__ == '__main__':
    main()
