#!/usr/bin/env python3
"""Generate Android launcher PNGs from Concordia team logo (CEO + 4 chefs)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "concordia-frontend" / "public" / "images" / "concordia-logo-people-tiered.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
CREAM = (250, 248, 245, 255)

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def trim_white(img: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = img.convert("RGBA")
    bbox = None
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and (r < threshold or g < threshold or b < threshold):
                if bbox is None:
                    bbox = [x, y, x, y]
                else:
                    bbox[0] = min(bbox[0], x)
                    bbox[1] = min(bbox[1], y)
                    bbox[2] = max(bbox[2], x)
                    bbox[3] = max(bbox[3], y)
    if bbox is None:
        return rgba
    pad = max(4, int(min(w, h) * 0.02))
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(w, bbox[2] + pad + 1)
    bottom = min(h, bbox[3] + pad + 1)
    return rgba.crop((left, top, right, bottom))


def key_white_to_alpha(img: Image.Image, threshold: int = 248) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (255, 255, 255, 0)
    return rgba


def fit_square(img: Image.Image, size: int, *, transparent: bool) -> Image.Image:
    bg = (0, 0, 0, 0) if transparent else CREAM
    canvas = Image.new("RGBA", (size, size), bg)
    trimmed = trim_white(img)
    tw, th = trimmed.size
    side = max(tw, th)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - tw) // 2
    oy = (side - th) // 2
    square.paste(trimmed, (ox, oy), trimmed)
    inset = int(size * 0.08)
    target = size - inset * 2
    square = square.resize((target, target), Image.Resampling.LANCZOS)
    canvas.paste(square, (inset, inset), square)
    return canvas


def make_icons(source: Image.Image, size: int) -> tuple[Image.Image, Image.Image]:
    legacy = fit_square(source, size, transparent=False).convert("RGB")
    foreground = fit_square(key_white_to_alpha(source), size, transparent=True)
    return legacy, foreground


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Team logo not found: {SRC}")

    source = Image.open(SRC)
    resources = ROOT / "resources"
    resources.mkdir(parents=True, exist_ok=True)
    fit_square(source, 1024, transparent=False).convert("RGB").save(
        resources / "icon.png", optimize=True
    )

    for folder, size in DENSITIES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        legacy, foreground = make_icons(source, size)
        legacy.save(out_dir / "ic_launcher.png", optimize=True)
        legacy.save(out_dir / "ic_launcher_round.png", optimize=True)
        foreground.save(out_dir / "ic_launcher_foreground.png", optimize=True)
        print(f"wrote {folder} @ {size}px")

    print("done")


if __name__ == "__main__":
    main()
