#!/bin/bash
# Build a compact .jsdos bundle for browser play via js-dos.
# Requires: ./build_decrypted.sh has been run first.

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d game_decrypted/cd ]; then
    echo "ERROR: game_decrypted/ not found. Run ./build_decrypted.sh first."
    exit 1
fi

STAGING=$(mktemp -d)
trap "rm -rf $STAGING" EXIT

# DOSBox config for js-dos
mkdir -p "$STAGING/.jsdos"
cat > "$STAGING/.jsdos/dosbox.conf" << 'EOF'
[sdl]
fullscreen=false

[dosbox]
machine=svga_s3
memsize=16

[cpu]
core=auto
cputype=auto
cycles=max

[mixer]
rate=44100
blocksize=1024

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5

[autoexec]
@echo off
mount c .
mount d cd
c:
cd \ALEX
ALEX1.EXE
EOF

# ALEX (installed) files
mkdir -p "$STAGING/ALEX"
cp game/ALEX/ALEX.BAT game/ALEX/ALEX1.CFG game/ALEX/ALEX1.DAT \
   game/ALEX/ALEX1.EXE game/ALEX/ALEX1.NDX game/ALEX/ALEX1.OVR \
   "$STAGING/ALEX/"

# CD files (decrypted)
mkdir -p "$STAGING/cd"
cp game_decrypted/cd/* "$STAGING/cd/"

# Build zip (include dotfiles like .jsdos/)
OUT="alex-compact.jsdos"
rm -f "$OUT"
(cd "$STAGING" && zip -r "/home/elazarg/workspace/alex/$OUT" .)

echo
ls -lh "$OUT"
echo "Done: $OUT"
