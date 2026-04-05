from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image
from Xlib import X, XK, display
from Xlib.ext import xtest


REPO_ROOT = Path(__file__).resolve().parents[2]
GAME_RUNDIR = REPO_ROOT / "game_rundir"


@dataclass(frozen=True)
class CaptureStep:
    delay_s: float
    name: str


@dataclass(frozen=True)
class ClickStep:
    x: int
    y: int
    wait_s: float
    name: str | None = None


@dataclass(frozen=True)
class KeyStep:
    key: str
    wait_s: float
    name: str | None = None


def build_dosbox_conf(scene: str, out_path: Path) -> None:
    out_path.write_text(
        "\n".join(
            [
                "[sdl]",
                "fullscreen=false",
                "windowresolution=1280x800",
                "output=surface",
                f"mapperfile={out_path.with_suffix('.map')}",
                "",
                "[render]",
                "scaler=none",
                "aspect=false",
                "",
                "[dosbox]",
                "machine=svga_s3",
                "memsize=16",
                "",
                "[cpu]",
                "core=auto",
                "cputype=auto",
                "cycles=max",
                "",
                "[mixer]",
                "rate=44100",
                "blocksize=1024",
                "",
                "[sblaster]",
                "sbtype=sb16",
                "sbbase=220",
                "irq=7",
                "dma=1",
                "hdma=5",
                "",
                "[autoexec]",
                "@echo off",
                f"mount c {GAME_RUNDIR}",
                f"mount d {GAME_RUNDIR / 'cd'}",
                "c:",
                r"cd \ALEX",
                f"ALEX1.EXE {scene}",
                "",
            ]
        )
    )


class DosboxHarness:
    def __init__(self, conf_path: Path) -> None:
        self.conf_path = conf_path
        self.proc: subprocess.Popen[bytes] | None = None
        self.display = None
        self.root = None
        self.window = None

    def launch(self) -> None:
        self.proc = subprocess.Popen(
            ["dosbox-x", "-conf", str(self.conf_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.display = display.Display()
        self.root = self.display.screen().root
        self.window = self._find_window()

    def close(self) -> None:
        if self.proc is None:
            return
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()
        self.proc = None

    def _walk_windows(self, window):
        out = []
        try:
            children = window.query_tree().children
        except Exception:
            return out
        for child in children:
            out.append(child)
            out.extend(self._walk_windows(child))
        return out

    def _find_window(self, timeout_s: float = 30.0):
        assert self.root is not None
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            for window in self._walk_windows(self.root):
                try:
                    name = window.get_wm_name() or ""
                except Exception:
                    continue
                if "DOSBox" in name or "dosbox" in name:
                    return window
            time.sleep(0.25)
        raise RuntimeError("DOSBox-X window not found")

    def get_geometry(self):
        assert self.window is not None
        return self.window.get_geometry()

    def capture(self, out_path: Path) -> None:
        assert self.root is not None
        geom = self.get_geometry()
        image = self.root.get_image(
            geom.x, geom.y, geom.width, geom.height, X.ZPixmap, 0xFFFFFFFF
        )
        frame = Image.frombytes(
            "RGB", (geom.width, geom.height), image.data, "raw", "BGRX"
        )
        frame.save(out_path)

    def click_relative(self, x: int, y: int) -> None:
        assert self.display is not None
        geom = self.get_geometry()
        abs_x = geom.x + x
        abs_y = geom.y + y
        xtest.fake_input(self.display, X.MotionNotify, x=abs_x, y=abs_y)
        self.display.sync()
        time.sleep(0.1)
        xtest.fake_input(self.display, X.ButtonPress, detail=1)
        self.display.sync()
        time.sleep(0.05)
        xtest.fake_input(self.display, X.ButtonRelease, detail=1)
        self.display.sync()
        time.sleep(0.1)

    def press_key(self, key: str) -> None:
        assert self.display is not None
        keysym = XK.string_to_keysym(key)
        if not keysym:
            raise ValueError(f"unknown X keysym name: {key}")
        keycode = self.display.keysym_to_keycode(keysym)
        if keycode == 0:
            raise ValueError(f"no keycode for keysym: {key}")
        xtest.fake_input(self.display, X.KeyPress, detail=keycode)
        self.display.sync()
        time.sleep(0.05)
        xtest.fake_input(self.display, X.KeyRelease, detail=keycode)
        self.display.sync()
        time.sleep(0.1)

    def __enter__(self) -> "DosboxHarness":
        self.launch()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
