#!/bin/bash
# Build a decrypted copy of the game with copy protection removed.
#
# Creates game_decrypted/ with:
# - A 459-byte TRANS.BIG (zero key, valid chain)
# - All SCX/DCX files pre-decrypted (XOR key removed)
# - All other CD files copied unchanged
#
# The game reads TRANS.BIG at startup to extract the XOR key table. With the
# synthetic file, every key byte is zero, so XOR decryption is identity.
# Pre-decrypted SCX/DCX files thus pass through unchanged.

set -euo pipefail
cd "$(dirname "$0")"

OUT="game_decrypted"

if [ -d "$OUT" ]; then
    echo "ERROR: $OUT/ already exists. Remove it first."
    exit 1
fi

echo "Building decrypted game in $OUT/..."

# Verify originals first
./verify_game_files.sh
echo

mkdir -p "$OUT/cd"

# Build synthetic zero-key TRANS.BIG (459 bytes)
python3 re/build_synthetic_transbig.py "$OUT/cd/TRANS.BIG"
echo

# Copy and decrypt CD files
python3 -c "
import sys, os, shutil
sys.path.insert(0, 're')
from decrypt_scenes import get_xor_key, xor_decrypt

key = get_xor_key()
cd_dir = 'game/cd'
out_dir = '$OUT/cd'
enc = 0
copied = 0
for fname in sorted(os.listdir(cd_dir)):
    src = os.path.join(cd_dir, fname)
    dst = os.path.join(out_dir, fname)
    if not os.path.isfile(src):
        continue
    upper = fname.upper()
    if upper == 'TRANS.BIG':
        continue  # already built
    elif upper.endswith('.SCX') or upper.endswith('.DCX'):
        raw = open(src, 'rb').read()
        dec = xor_decrypt(raw, key)
        open(dst, 'wb').write(dec)
        enc += 1
    else:
        shutil.copy2(src, dst)
        copied += 1

print(f'Pre-decrypted {enc} SCX/DCX files')
print(f'Copied {copied} other CD files unchanged')
"

echo
echo "Done. Run with: ./run_game.sh decrypted"
echo "Verify with:    ./run_game.sh (original) should still work"
