#!/bin/bash
# Run the game from a fresh writable copy.
# Usage: ./run_game.sh [decrypted]
#   No args:    runs from original game files
#   decrypted:  runs with copy protection removed (requires ./build_decrypted.sh first)

set -euo pipefail
cd "$(dirname "$0")"

WORK="game_rundir"
MODE="${1:-original}"

# Clean slate
rm -rf "$WORK"
mkdir -p "$WORK/ALEX" "$WORK/cd"

# Always copy ALEX (installed) files from the known-good originals
cp game/ALEX/ALEX.BAT game/ALEX/ALEX1.CFG game/ALEX/ALEX1.DAT \
   game/ALEX/ALEX1.EXE game/ALEX/ALEX1.NDX game/ALEX/ALEX1.OVR \
   "$WORK/ALEX/"

case "$MODE" in
    decrypted)
        if [ ! -d game_decrypted/cd ]; then
            echo "ERROR: game_decrypted/ not found. Run ./build_decrypted.sh first."
            rm -rf "$WORK"
            exit 1
        fi
        echo "Setting up: decrypted game (no copy protection)..."
        cp game_decrypted/cd/* "$WORK/cd/"
        ;;
    *)
        echo "Setting up: original game..."
        cp game/cd/* "$WORK/cd/"
        ;;
esac

# Ensure everything is writable (game opens files with mode 2 = read/write)
chmod -R u+w "$WORK"

cat > "$WORK/dosbox.conf" <<'EOF'
[sdl]
fullscreen=true
fullresolution=desktop
output=opengl

[render]
scaler=none
aspect=true

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

[dos]
keyboardlayout=il

[autoexec]
@echo off
mount c game_rundir
mount d game_rundir/cd
c:
cd \ALEX
ALEX1.EXE
EOF

echo "Running game..."
dosbox-x -defaultconf -conf "$WORK/dosbox.conf"

echo "Cleaning up..."
rm -rf "$WORK"
