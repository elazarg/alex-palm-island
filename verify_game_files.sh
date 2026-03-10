#!/bin/bash
# Verify game files against the recovery manifest and restore if needed.
# Usage: ./verify_game_files.sh [--fix]

set -euo pipefail
cd "$(dirname "$0")"

MANIFEST="recovery/file_manifest.sha256"
CD_DIR="game/cd"
ALEX_DIR="game/ALEX"
FIX="${1:-}"

if [ ! -f "$MANIFEST" ]; then
    echo "ERROR: $MANIFEST not found"
    exit 1
fi

bad=0
fixed=0

while IFS='  ' read -r expected_hash filename; do
    # Try CD dir first, then ALEX dir
    if [ -f "$CD_DIR/$filename" ]; then
        filepath="$CD_DIR/$filename"
    elif [ -f "$ALEX_DIR/$filename" ]; then
        filepath="$ALEX_DIR/$filename"
    else
        # Special case: ALEX1.EX~ on CD becomes ALEX1.EXE installed
        if [ "$filename" = "ALEX1.EX~" ] && [ -f "$ALEX_DIR/ALEX1.EXE" ]; then
            filepath="$ALEX_DIR/ALEX1.EXE"
        else
            continue
        fi
    fi

    actual_hash=$(sha256sum "$filepath" | awk '{print $1}')
    if [ "$actual_hash" != "$expected_hash" ]; then
        echo "MISMATCH: $filepath"
        bad=$((bad + 1))
        if [ "$FIX" = "--fix" ] && [ -f "$CD_DIR/$filename" ] && [ "$filepath" != "$CD_DIR/$filename" ]; then
            cp "$CD_DIR/$filename" "$filepath"
            echo "  RESTORED from $CD_DIR/$filename"
            fixed=$((fixed + 1))
        fi
    fi
done < "$MANIFEST"

if [ $bad -eq 0 ]; then
    echo "All files OK."
else
    echo "$bad file(s) modified."
    if [ "$FIX" != "--fix" ] && [ $bad -gt 0 ]; then
        echo "Run with --fix to restore from CD copies."
    else
        echo "$fixed file(s) restored."
    fi
fi
