#!/usr/bin/env python3
"""Download game files from GitHub release."""

import hashlib
import io
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile

REPO = "elazarg/alex-palm-island"
ASSET_NAME = "game-files.zip"
ASSET_SHA256 = "4c791814c6df9f02b374c955b437c8607e8f53169d1dcba763843e164ddc4cd4"

ISO_ASSET = "alex_palm_island.iso"
ISO_SHA256 = "8fe8738fcad102b284c81951de798418df658c19d51a7312877b3c69c214cd9d"

MAX_RETRIES = 3


def get_latest_release_assets():
    url = f"https://api.github.com/repos/{REPO}/releases/latest"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["assets"]


def find_asset_url(assets, name):
    for a in assets:
        if a["name"] == name:
            return a["browser_download_url"], a["size"]
    return None, None


def download(url, size_hint=0):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        total = int(resp.headers.get("Content-Length", size_hint))
        buf = io.BytesIO()
        downloaded = 0
        while True:
            chunk = resp.read(256 * 1024)
            if not chunk:
                break
            buf.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                bar = "#" * (pct // 2) + "-" * (50 - pct // 2)
                print(f"\r  [{bar}] {pct}%  {downloaded/1e6:.1f}/{total/1e6:.1f} MB", end="", flush=True)
        print()
        return buf.getvalue()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def download_with_retry(url, expected_sha256, label, size_hint=0):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"Downloading {label} (attempt {attempt}/{MAX_RETRIES})...")
            data = download(url, size_hint)
            got = sha256(data)
            if got != expected_sha256:
                print(f"  SHA256 mismatch: expected {expected_sha256[:16]}..., got {got[:16]}...")
                if attempt < MAX_RETRIES:
                    continue
                print("  Hash verification failed after all retries.")
                sys.exit(1)
            print(f"  SHA256 verified: {got[:16]}...")
            return data
        except urllib.error.URLError as e:
            print(f"  Download error: {e}")
            if attempt == MAX_RETRIES:
                print("  Failed after all retries.")
                sys.exit(1)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    game_dir = os.path.join(script_dir, "game")
    cd_dir = os.path.join(game_dir, "cd")

    # Check if already downloaded
    if os.path.isdir(cd_dir) and len(os.listdir(cd_dir)) > 100:
        print(f"Game files already present in {cd_dir} ({len(os.listdir(cd_dir))} files).")
        if "--force" not in sys.argv and "--iso" not in sys.argv:
            print("Use --force to re-download, or --iso to download the disc image.")
            return

    want_iso = "--iso" in sys.argv
    want_game = "--force" in sys.argv or not os.path.isdir(cd_dir) or len(os.listdir(cd_dir)) < 100

    print(f"Fetching release info from {REPO}...")
    try:
        assets = get_latest_release_assets()
    except urllib.error.URLError as e:
        print(f"Error fetching release info: {e}")
        sys.exit(1)

    if want_game:
        url, size = find_asset_url(assets, ASSET_NAME)
        if not url:
            print(f"Asset '{ASSET_NAME}' not found in latest release.")
            sys.exit(1)

        data = download_with_retry(url, ASSET_SHA256, ASSET_NAME, size)

        print("Extracting to game/...")
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            zf.extractall(game_dir)

        n = len(os.listdir(cd_dir))
        alex_dir = os.path.join(game_dir, "ALEX")
        if os.path.isdir(alex_dir):
            n_alex = len(os.listdir(alex_dir))
            print(f"Done. {n} files in game/cd/, {n_alex} files in game/ALEX/.")
        else:
            print(f"Done. {n} files in game/cd/.")

    if want_iso:
        iso_dir = os.path.join(script_dir, "recovery", "disc_image")
        iso_path = os.path.join(iso_dir, ISO_ASSET)

        if os.path.exists(iso_path) and "--force" not in sys.argv:
            print(f"ISO already present at {iso_path}. Use --force to re-download.")
        else:
            url, size = find_asset_url(assets, ISO_ASSET)
            if not url:
                print(f"Asset '{ISO_ASSET}' not found in latest release.")
                sys.exit(1)

            data = download_with_retry(url, ISO_SHA256, ISO_ASSET, size)

            os.makedirs(iso_dir, exist_ok=True)
            with open(iso_path, "wb") as f:
                f.write(data)
            print(f"ISO saved to {iso_path}.")


if __name__ == "__main__":
    if "--help" in sys.argv or "-h" in sys.argv:
        print("Usage: python download.py [--iso] [--force]")
        print()
        print("Downloads game files needed to play Alex: Palm Island Mission.")
        print()
        print("Options:")
        print("  --iso    Also download the raw disc image (351 MB)")
        print("  --force  Re-download even if files already exist")
        sys.exit(0)
    main()
