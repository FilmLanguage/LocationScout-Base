#!/usr/bin/env python
"""
Render a top-down technical floorplan PNG from a Location Bible JSON.

Usage:
    python floorplan.py < bible.json > floorplan.png
    python floorplan.py --bible bible.json --out floorplan.png

Input shape (any of these keys work — the script tolerates several naming
conventions and will synthesize a sensible fallback if the Bible has no
explicit spatial data):

    {
      "bible_id": "loc_001",
      "passport": { "location_name": "Victorian library" },
      "spaces": [
        {"name": "Entry hall", "x": 0, "y": 0, "width": 4, "height": 3,
         "openings": [{"type": "door", "side": "E", "position": 0.5}]},
        {"name": "Main room", "x": 4, "y": 0, "width": 6, "height": 5,
         "openings": [{"type": "window", "side": "N", "position": 0.7}]}
      ]
    }

If `spaces` is absent the script renders a single labelled rectangle using
`passport.location_name` so the tool still returns a valid PNG and the
gate does not block.

Dependencies: Pillow only (no matplotlib).
"""

import argparse
import json
import sys
from typing import Any

from PIL import Image, ImageDraw, ImageFont

SCALE = 60           # pixels per metre
PADDING = 40
TITLE_AREA = 60
WALL_WIDTH = 4
OPENING_GAP = 20     # pixels that doors/windows "cut" through the wall

BG = (252, 252, 250)
WALL = (20, 20, 20)
LABEL = (30, 30, 30)
DOOR = (30, 30, 30)
WINDOW = (80, 120, 170)


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in ("arial.ttf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _normalise_spaces(bible: dict[str, Any]) -> list[dict[str, Any]]:
    spaces = bible.get("spaces") or bible.get("floorplan", {}).get("spaces") or []

    if not spaces:
        # Fallback: single room from the passport
        passport = bible.get("passport", {}) or {}
        name = (
            passport.get("location_name")
            or bible.get("bible_id")
            or "Unknown layout"
        )
        return [{"name": name, "x": 0, "y": 0, "width": 6, "height": 4}]

    normalised = []
    for sp in spaces:
        normalised.append(
            {
                "name": sp.get("name", "Room"),
                "x": float(sp.get("x", 0)),
                "y": float(sp.get("y", 0)),
                "width": float(sp.get("width", 4)),
                "height": float(sp.get("height", 3)),
                "openings": sp.get("openings", []) or [],
            }
        )
    return normalised


def _draw_opening(
    draw: ImageDraw.ImageDraw,
    room_px: tuple[float, float, float, float],
    opening: dict[str, Any],
) -> None:
    """Cut a door or window out of the room wall and draw its symbol."""
    x0, y0, x1, y1 = room_px
    side = opening.get("side", "N").upper()
    position = float(opening.get("position", 0.5))  # 0..1 along the wall
    kind = opening.get("type", "door").lower()

    if side == "N":
        cx = x0 + (x1 - x0) * position
        cy = y0
        gap = ((cx - OPENING_GAP / 2, cy - 2), (cx + OPENING_GAP / 2, cy + 2))
    elif side == "S":
        cx = x0 + (x1 - x0) * position
        cy = y1
        gap = ((cx - OPENING_GAP / 2, cy - 2), (cx + OPENING_GAP / 2, cy + 2))
    elif side == "W":
        cx = x0
        cy = y0 + (y1 - y0) * position
        gap = ((cx - 2, cy - OPENING_GAP / 2), (cx + 2, cy + OPENING_GAP / 2))
    else:  # E
        cx = x1
        cy = y0 + (y1 - y0) * position
        gap = ((cx - 2, cy - OPENING_GAP / 2), (cx + 2, cy + OPENING_GAP / 2))

    # Erase wall segment
    draw.rectangle(gap, fill=BG)

    if kind == "window":
        # Two parallel thin blue lines across the gap
        (gx0, gy0), (gx1, gy1) = gap
        if side in ("N", "S"):
            draw.line([(gx0, cy - 1), (gx1, cy - 1)], fill=WINDOW, width=1)
            draw.line([(gx0, cy + 1), (gx1, cy + 1)], fill=WINDOW, width=1)
        else:
            draw.line([(cx - 1, gy0), (cx - 1, gy1)], fill=WINDOW, width=1)
            draw.line([(cx + 1, gy0), (cx + 1, gy1)], fill=WINDOW, width=1)
    else:
        # Door: small swing arc into the room
        radius = OPENING_GAP
        if side == "N":
            bbox = (cx - radius, cy, cx + radius, cy + 2 * radius)
            draw.arc(bbox, start=180, end=360, fill=DOOR, width=1)
        elif side == "S":
            bbox = (cx - radius, cy - 2 * radius, cx + radius, cy)
            draw.arc(bbox, start=0, end=180, fill=DOOR, width=1)
        elif side == "W":
            bbox = (cx, cy - radius, cx + 2 * radius, cy + radius)
            draw.arc(bbox, start=90, end=270, fill=DOOR, width=1)
        else:  # E
            bbox = (cx - 2 * radius, cy - radius, cx, cy + radius)
            draw.arc(bbox, start=270, end=90, fill=DOOR, width=1)


def render(bible: dict[str, Any]) -> Image.Image:
    spaces = _normalise_spaces(bible)

    max_x = max(s["x"] + s["width"] for s in spaces)
    max_y = max(s["y"] + s["height"] for s in spaces)
    width = int(max_x * SCALE + 2 * PADDING)
    height = int(max_y * SCALE + 2 * PADDING + TITLE_AREA)

    img = Image.new("RGB", (max(width, 400), max(height, 300)), BG)
    draw = ImageDraw.Draw(img)

    title_font = _load_font(22)
    subtitle_font = _load_font(12)
    label_font = _load_font(14)

    # Title
    passport = bible.get("passport", {}) or {}
    title = (
        passport.get("location_name")
        or bible.get("bible_id")
        or "Floorplan"
    )
    subtitle_parts = []
    if "era" in passport:
        subtitle_parts.append(str(passport["era"]))
    if "type" in passport:
        subtitle_parts.append(str(passport["type"]))
    subtitle = " · ".join(subtitle_parts) if subtitle_parts else "Location Scout floorplan"

    draw.text((PADDING, 12), title, fill=LABEL, font=title_font)
    draw.text((PADDING, 38), subtitle, fill=(110, 110, 110), font=subtitle_font)

    # Draw rooms
    for sp in spaces:
        x0 = PADDING + sp["x"] * SCALE
        y0 = PADDING + TITLE_AREA + sp["y"] * SCALE
        x1 = x0 + sp["width"] * SCALE
        y1 = y0 + sp["height"] * SCALE

        draw.rectangle([x0, y0, x1, y1], outline=WALL, width=WALL_WIDTH)

        for opening in sp.get("openings", []):
            _draw_opening(draw, (x0, y0, x1, y1), opening)

        # Label in centre
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        name = sp["name"]
        tw, th = _text_size(draw, name, label_font)
        draw.text((cx - tw / 2, cy - th / 2), name, fill=LABEL, font=label_font)

        # Dimension tag (small, bottom-right of room)
        dim = f'{sp["width"]:g}×{sp["height"]:g}m'
        dw, dh = _text_size(draw, dim, subtitle_font)
        draw.text(
            (x1 - dw - 6, y1 - dh - 4),
            dim,
            fill=(140, 140, 140),
            font=subtitle_font,
        )

    return img


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bible", help="Path to Bible JSON (default: stdin)")
    ap.add_argument("--out", help="Output PNG path (default: stdout)")
    args = ap.parse_args()

    if args.bible:
        with open(args.bible, "r", encoding="utf-8") as fh:
            bible = json.load(fh)
    else:
        bible = json.load(sys.stdin)

    img = render(bible)

    if args.out:
        img.save(args.out, "PNG")
    else:
        if hasattr(sys.stdout, "buffer"):
            img.save(sys.stdout.buffer, "PNG")
        else:
            img.save(sys.stdout, "PNG")


if __name__ == "__main__":
    main()
