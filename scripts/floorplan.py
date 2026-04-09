#!/usr/bin/env python
"""
Render a top-down technical floorplan PNG from a Location Bible JSON.

Uses matplotlib for high-resolution, spatially-logical drafting output.

Usage:
    python floorplan.py < bible.json > floorplan.png
    python floorplan.py --bible bible.json --out floorplan.png [--setups setups.json]

Input shape (Location Bible JSON):
    {
      "bible_id": "loc_001",
      "passport": { "location_name": "Victorian library", "era": "1890s", "type": "interior" },
      "spaces": [
        {"name": "Entry hall", "x": 0, "y": 0, "width": 4, "height": 3,
         "openings": [{"type": "door", "side": "E", "position": 0.5}]},
        {"name": "Main room", "x": 4, "y": 0, "width": 6, "height": 5,
         "openings": [{"type": "window", "side": "N", "position": 0.7}]}
      ],
      "setups": [
        {"id": 1, "name": "Master wide", "x_percent": 0.3, "y_percent": 0.6}
      ]
    }

If `spaces` is absent the script synthesises a plausible layout from the
location name and type. If `setups` is absent they are inferred from key
areas.

Dependencies: matplotlib only (stdlib + matplotlib).

Output:
    PNG to stdout (or --out path).
    If --setups is given, also writes JSON setup positions map to that path.
"""

import argparse
import json
import math
import sys
from typing import Any

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Arc, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np


# ── Canvas ──────────────────────────────────────────────────────────────────

DPI = 150
FIG_W, FIG_H = 1920 / DPI, 1080 / DPI   # inches → 1920×1080 px

WALL_LW   = 2.5
THIN_LW   = 0.8
GRID_LW   = 0.3

BG        = "#FAFAF8"
WALL_C    = "#1A1A1A"
GRID_C    = "#DDDDDA"
LABEL_C   = "#1A1A1A"
DIM_C     = "#888888"
DOOR_C    = "#1A1A1A"
WIN_C     = "#5580AA"
SETUP_C   = "#C0392B"
SETUP_FC  = "#FDFAF9"
NORTH_C   = "#1A1A1A"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalise_spaces(bible: dict[str, Any]) -> list[dict[str, Any]]:
    spaces = bible.get("spaces") or bible.get("floorplan", {}).get("spaces") or []

    if not spaces:
        # Synthesise a plausible layout from location type / name
        passport = bible.get("passport", {}) or {}
        loc_type = str(passport.get("type", "")).lower()
        name = passport.get("location_name") or bible.get("bible_id") or "Location"

        if "library" in loc_type or "library" in name.lower():
            spaces = [
                {"name": "Entry", "x": 0, "y": 1, "width": 2, "height": 3,
                 "openings": [{"type": "door", "side": "W", "position": 0.5}]},
                {"name": "Reading Room", "x": 2, "y": 0, "width": 8, "height": 5,
                 "openings": [{"type": "window", "side": "N", "position": 0.3},
                               {"type": "window", "side": "N", "position": 0.7}]},
                {"name": "Stacks", "x": 10, "y": 0, "width": 4, "height": 5,
                 "openings": [{"type": "door", "side": "W", "position": 0.5}]},
            ]
        elif "kitchen" in loc_type or "kitchen" in name.lower():
            spaces = [
                {"name": "Kitchen", "x": 0, "y": 0, "width": 6, "height": 5,
                 "openings": [{"type": "window", "side": "N", "position": 0.5},
                               {"type": "door", "side": "E", "position": 0.5}]},
                {"name": "Pantry", "x": 6, "y": 0, "width": 2, "height": 3,
                 "openings": [{"type": "door", "side": "W", "position": 0.5}]},
            ]
        elif "street" in loc_type or "exterior" in loc_type:
            spaces = [
                {"name": name, "x": 0, "y": 0, "width": 12, "height": 6},
            ]
        else:
            # Generic room
            spaces = [{"name": name, "x": 0, "y": 0, "width": 8, "height": 6,
                        "openings": [{"type": "door", "side": "S", "position": 0.5},
                                     {"type": "window", "side": "N", "position": 0.3},
                                     {"type": "window", "side": "N", "position": 0.7}]}]

    normalised = []
    for sp in spaces:
        normalised.append({
            "name":     sp.get("name", "Room"),
            "x":        float(sp.get("x", 0)),
            "y":        float(sp.get("y", 0)),
            "width":    float(sp.get("width", 4)),
            "height":   float(sp.get("height", 3)),
            "openings": sp.get("openings", []) or [],
        })
    return normalised


def _infer_setups(spaces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Infer camera setup positions from space geometry.
    Returns list of {id, name, x_world, y_world, x_percent, y_percent}.
    """
    setups = []
    sid = 1

    max_x = max(s["x"] + s["width"] for s in spaces)
    max_y = max(s["y"] + s["height"] for s in spaces)

    for sp in spaces:
        cx = sp["x"] + sp["width"] / 2
        cy = sp["y"] + sp["height"] / 2

        # Main setup: centre of room
        setups.append({
            "id": sid,
            "name": f'{sp["name"]} — wide',
            "x_world": cx,
            "y_world": cy,
            "x_percent": round(cx / max_x, 3),
            "y_percent": round(cy / max_y, 3),
        })
        sid += 1

        # If room is large enough, add an OTS/close setup near a wall
        if sp["width"] >= 4 and sp["height"] >= 4:
            setups.append({
                "id": sid,
                "name": f'{sp["name"]} — OTS',
                "x_world": sp["x"] + sp["width"] * 0.25,
                "y_world": sp["y"] + sp["height"] * 0.75,
                "x_percent": round((sp["x"] + sp["width"] * 0.25) / max_x, 3),
                "y_percent": round((sp["y"] + sp["height"] * 0.75) / max_y, 3),
            })
            sid += 1

    return setups


def _parse_setups(
    raw: list[dict[str, Any]],
    spaces: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Convert Bible-provided setups (x_percent / y_percent) to world coords,
    or fall back to _infer_setups.
    """
    if not raw:
        return _infer_setups(spaces)

    max_x = max(s["x"] + s["width"] for s in spaces)
    max_y = max(s["y"] + s["height"] for s in spaces)

    result = []
    for i, s in enumerate(raw):
        xp = float(s.get("x_percent", 0.5))
        yp = float(s.get("y_percent", 0.5))
        result.append({
            "id":        s.get("id", i + 1),
            "name":      s.get("name", f"Setup {i+1}"),
            "x_world":   xp * max_x,
            "y_world":   yp * max_y,
            "x_percent": round(xp, 3),
            "y_percent": round(yp, 3),
        })
    return result


# ── Drawing ──────────────────────────────────────────────────────────────────

def _draw_opening(ax, sp: dict, opening: dict, scale: float = 1.0) -> None:
    """Draw door swing or window glazing bars on the room outline."""
    x0, y0 = sp["x"], sp["y"]
    w, h    = sp["width"], sp["height"]
    side    = opening.get("side", "N").upper()
    pos     = float(opening.get("position", 0.5))
    kind    = opening.get("type", "door").lower()
    gap     = 0.8  # metres

    if side == "N":
        ox = x0 + w * pos
        oy = y0
        erase_rect = plt.Rectangle((ox - gap/2, oy - 0.05), gap, 0.1,
                                    color=BG, zorder=2)
        ax.add_patch(erase_rect)
        if kind == "window":
            for dy in [-0.07, 0.07]:
                ax.plot([ox - gap/2, ox + gap/2], [oy + dy, oy + dy],
                        color=WIN_C, lw=1.2, zorder=3)
        else:
            arc = Arc((ox - gap/2, oy), gap, gap, angle=0,
                      theta1=0, theta2=90, color=DOOR_C, lw=THIN_LW, zorder=3)
            ax.add_patch(arc)
            ax.plot([ox - gap/2, ox - gap/2], [oy, oy + gap/2],
                    color=DOOR_C, lw=THIN_LW, zorder=3)

    elif side == "S":
        ox = x0 + w * pos
        oy = y0 + h
        erase_rect = plt.Rectangle((ox - gap/2, oy - 0.05), gap, 0.1,
                                    color=BG, zorder=2)
        ax.add_patch(erase_rect)
        if kind == "window":
            for dy in [-0.07, 0.07]:
                ax.plot([ox - gap/2, ox + gap/2], [oy + dy, oy + dy],
                        color=WIN_C, lw=1.2, zorder=3)
        else:
            arc = Arc((ox - gap/2, oy), gap, gap, angle=0,
                      theta1=270, theta2=360, color=DOOR_C, lw=THIN_LW, zorder=3)
            ax.add_patch(arc)
            ax.plot([ox - gap/2, ox - gap/2], [oy - gap/2, oy],
                    color=DOOR_C, lw=THIN_LW, zorder=3)

    elif side == "W":
        ox = x0
        oy = y0 + h * pos
        erase_rect = plt.Rectangle((ox - 0.05, oy - gap/2), 0.1, gap,
                                    color=BG, zorder=2)
        ax.add_patch(erase_rect)
        if kind == "window":
            for dx in [-0.07, 0.07]:
                ax.plot([ox + dx, ox + dx], [oy - gap/2, oy + gap/2],
                        color=WIN_C, lw=1.2, zorder=3)
        else:
            arc = Arc((ox, oy - gap/2), gap, gap, angle=0,
                      theta1=0, theta2=90, color=DOOR_C, lw=THIN_LW, zorder=3)
            ax.add_patch(arc)
            ax.plot([ox, ox + gap/2], [oy - gap/2, oy - gap/2],
                    color=DOOR_C, lw=THIN_LW, zorder=3)

    else:  # E
        ox = x0 + w
        oy = y0 + h * pos
        erase_rect = plt.Rectangle((ox - 0.05, oy - gap/2), 0.1, gap,
                                    color=BG, zorder=2)
        ax.add_patch(erase_rect)
        if kind == "window":
            for dx in [-0.07, 0.07]:
                ax.plot([ox + dx, ox + dx], [oy - gap/2, oy + gap/2],
                        color=WIN_C, lw=1.2, zorder=3)
        else:
            arc = Arc((ox, oy - gap/2), gap, gap, angle=0,
                      theta1=90, theta2=180, color=DOOR_C, lw=THIN_LW, zorder=3)
            ax.add_patch(arc)
            ax.plot([ox - gap/2, ox], [oy - gap/2, oy - gap/2],
                    color=DOOR_C, lw=THIN_LW, zorder=3)


def _draw_north_arrow(ax, x, y, size=0.4) -> None:
    """Small north arrow compass rose."""
    ax.annotate("", xy=(x, y + size), xytext=(x, y),
                arrowprops=dict(arrowstyle="-|>", color=NORTH_C, lw=1.0),
                zorder=10)
    ax.text(x, y + size * 1.3, "N", ha="center", va="bottom",
            fontsize=7, color=NORTH_C, fontweight="bold", zorder=10)


def render(bible: dict[str, Any]) -> tuple[plt.Figure, list[dict[str, Any]]]:
    spaces  = _normalise_spaces(bible)
    raw_setups = (
        bible.get("setups")
        or bible.get("floorplan", {}).get("setups")
        or []
    )
    setups = _parse_setups(raw_setups, spaces)

    max_x = max(s["x"] + s["width"] for s in spaces)
    max_y = max(s["y"] + s["height"] for s in spaces)

    # ── Figure ───────────────────────────────────────────────────────────────
    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H), dpi=DPI)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)

    # Margins: reserve top strip for title, bottom strip for legend
    TITLE_FRAC = 0.10
    LEGEND_FRAC = 0.08
    plot_bottom = LEGEND_FRAC
    plot_height = 1.0 - TITLE_FRAC - LEGEND_FRAC

    # We draw in world coordinates; axis limits with padding
    MARGIN = max(max_x, max_y) * 0.08
    ax.set_xlim(-MARGIN, max_x + MARGIN)
    ax.set_ylim(-MARGIN, max_y + MARGIN)
    ax.set_aspect("equal")
    ax.axis("off")

    # ── Grid ─────────────────────────────────────────────────────────────────
    grid_step = 1.0  # 1 m grid
    for gx in np.arange(0, max_x + 0.01, grid_step):
        ax.axvline(gx, color=GRID_C, lw=GRID_LW, zorder=0)
    for gy in np.arange(0, max_y + 0.01, grid_step):
        ax.axhline(gy, color=GRID_C, lw=GRID_LW, zorder=0)

    # ── Rooms ─────────────────────────────────────────────────────────────────
    for sp in spaces:
        rect = plt.Rectangle(
            (sp["x"], sp["y"]), sp["width"], sp["height"],
            linewidth=WALL_LW, edgecolor=WALL_C, facecolor="white", zorder=1,
        )
        ax.add_patch(rect)

        # Openings (doors / windows)
        for opening in sp.get("openings", []):
            _draw_opening(ax, sp, opening)

        # Room label — centred, with tiny dimension tag below
        cx = sp["x"] + sp["width"] / 2
        cy = sp["y"] + sp["height"] / 2
        ax.text(cx, cy + 0.15, sp["name"], ha="center", va="center",
                fontsize=8, color=LABEL_C, fontweight="bold", zorder=4,
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.7))
        dim_str = f'{sp["width"]:g} × {sp["height"]:g} m'
        ax.text(cx, cy - 0.22, dim_str, ha="center", va="center",
                fontsize=6, color=DIM_C, zorder=4)

    # ── Setup markers ─────────────────────────────────────────────────────────
    for s in setups:
        sx, sy = s["x_world"], s["y_world"]
        r = min(max_x, max_y) * 0.025
        circle = plt.Circle((sx, sy), r, color=SETUP_FC, ec=SETUP_C,
                             lw=1.5, zorder=5)
        ax.add_patch(circle)
        ax.text(sx, sy, str(s["id"]), ha="center", va="center",
                fontsize=7, color=SETUP_C, fontweight="bold", zorder=6)

    # ── North arrow ──────────────────────────────────────────────────────────
    _draw_north_arrow(ax, max_x + MARGIN * 0.55, max_y * 0.05, size=MARGIN * 0.4)

    # ── Scale bar (bottom-left) ───────────────────────────────────────────────
    bar_len = 2.0  # metres
    bx0 = 0.0
    by0 = -MARGIN * 0.55
    ax.plot([bx0, bx0 + bar_len], [by0, by0], color=WALL_C, lw=2.0, zorder=8)
    ax.plot([bx0, bx0], [by0 - 0.05, by0 + 0.05], color=WALL_C, lw=1.5, zorder=8)
    ax.plot([bx0 + bar_len, bx0 + bar_len], [by0 - 0.05, by0 + 0.05],
            color=WALL_C, lw=1.5, zorder=8)
    ax.text(bx0 + bar_len / 2, by0 - 0.15, f"{bar_len:g} m",
            ha="center", va="top", fontsize=6, color=DIM_C, zorder=8)

    # ── Title block ───────────────────────────────────────────────────────────
    passport = bible.get("passport", {}) or {}
    title    = (passport.get("location_name") or bible.get("bible_id") or "Floorplan")
    sub_parts = []
    if passport.get("era"):
        sub_parts.append(str(passport["era"]))
    if passport.get("type"):
        sub_parts.append(str(passport["type"]))
    subtitle = " · ".join(sub_parts) if sub_parts else "Location Scout · top-down floorplan"

    fig.text(0.05, 0.95, title, ha="left", va="top",
             fontsize=18, color=LABEL_C, fontweight="bold",
             transform=fig.transFigure)
    fig.text(0.05, 0.91, subtitle, ha="left", va="top",
             fontsize=10, color=DIM_C,
             transform=fig.transFigure)

    # ── Setup legend (bottom strip) ────────────────────────────────────────────
    if setups:
        legend_items = []
        for s in setups:
            patch = mpatches.Patch(color=SETUP_C, label=f'#{s["id"]} {s["name"]}')
            legend_items.append(patch)
        ax.legend(
            handles=legend_items,
            loc="lower left",
            bbox_to_anchor=(0.0, -0.15),
            bbox_transform=ax.transAxes,
            fontsize=6,
            ncol=min(len(setups), 6),
            frameon=False,
            labelcolor=LABEL_C,
        )

    # ── Legend key (doors / windows) ──────────────────────────────────────────
    door_patch  = mpatches.Patch(color=DOOR_C,  label="Door")
    win_patch   = mpatches.Patch(color=WIN_C,   label="Window")
    setup_patch = mpatches.Patch(color=SETUP_C, label="Camera setup")
    fig.legend(
        handles=[door_patch, win_patch, setup_patch],
        loc="lower right",
        fontsize=7,
        frameon=False,
        labelcolor=LABEL_C,
    )

    return fig, setups


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bible",  help="Path to Bible JSON (default: stdin)")
    ap.add_argument("--out",    help="Output PNG path (default: stdout)")
    ap.add_argument("--setups", help="Optional path to write setup JSON map")
    args = ap.parse_args()

    if args.bible:
        with open(args.bible, "r", encoding="utf-8") as fh:
            bible = json.load(fh)
    else:
        bible = json.load(sys.stdin)

    fig, setups = render(bible)

    # Write PNG
    if args.out:
        fig.savefig(args.out, format="png", dpi=DPI,
                    bbox_inches="tight", facecolor=BG)
    else:
        if hasattr(sys.stdout, "buffer"):
            fig.savefig(sys.stdout.buffer, format="png", dpi=DPI,
                        bbox_inches="tight", facecolor=BG)
        else:
            fig.savefig(sys.stdout, format="png", dpi=DPI,
                        bbox_inches="tight", facecolor=BG)

    plt.close(fig)

    # Write setup JSON map
    setup_map = {
        "setups": [
            {
                "id":        s["id"],
                "name":      s["name"],
                "x_percent": s["x_percent"],
                "y_percent": s["y_percent"],
            }
            for s in setups
        ]
    }

    if args.setups:
        with open(args.setups, "w", encoding="utf-8") as fh:
            json.dump(setup_map, fh, indent=2, ensure_ascii=False)
    else:
        # Always emit setup map to stderr so the caller can capture it
        print(json.dumps(setup_map), file=sys.stderr)


if __name__ == "__main__":
    main()
