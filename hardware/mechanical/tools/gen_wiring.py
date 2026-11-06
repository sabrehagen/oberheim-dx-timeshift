#!/usr/bin/env python3
"""DX TimeShift rev A: wiring diagram (A3) and DIP-plug mapping sheet (A4).

Writes
    hardware/mechanical/wiring-diagram.svg
    hardware/mechanical/dip-plug-mapping.svg
PDF/PNG are made by build_all.py.

The J1 <-> DIP mapping and the U701 pin functions are imported from the single source of
truth hardware/kicad/tools/netlist.py (the same file the schematic and PCB are generated
from), so the drawings can never disagree with the board. A built-in copy of the brief 3.5
table is used only if that file is missing.

DX board geometry (positions of U701, R791/Q709 etc.) is scaled from the Oberheim "Parts
Layout, DX Processor Board Rev C" (docs/reference/electrongate/dx_proc_board_layout.jpg,
printed 1:1 on a 17 x 22 in sheet: 3.58 px/mm). It is APPROXIMATE (+/- 3 mm) and only used
to show where things are.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import svgkit as K  # noqa: E402

MECH = os.path.dirname(HERE)
REPO = os.environ.get("DXTS_REPO") or os.path.dirname(os.path.dirname(MECH))
DATE = "2026-11-06"
REV = "A"

try:
    sys.path.insert(0, os.path.join(REPO, "hardware", "kicad", "tools"))
    import netlist as NL  # noqa: E402
    HDR2DIP = dict(NL.HDR2DIP)
    U701_FUNC = dict(NL.U701_FUNC)
    U3PINS = NL.BY_REF["U3"]["pins"]
    PLUG_TO_U3 = {15: [p for p, n in U3PINS.items() if n == "RST2_PLUG"][0],
                  12: [p for p, n in U3PINS.items() if n == "FFA2_PLUG"][0],
                  10: [p for p, n in U3PINS.items() if n == "FFB2_PLUG"][0]}
    SOURCE = "hardware/kicad/tools/netlist.py"
except Exception:  # pragma: no cover - fallback copy of PROJECT_BRIEF.md 3.5
    HDR2DIP = {1: 1, 2: 16, 3: 2, 4: 15, 5: 3, 6: 14, 7: 4, 8: 13,
               9: 5, 10: 12, 11: 6, 12: 11, 13: 7, 14: 10, 15: 8, 16: 9}
    U701_FUNC = {1: "CLR (tied +5V)", 2: "Q1 = RST1 (bass)", 3: "D1 = bus D0", 4: "D2 = bus D1",
                 5: "Q2 = FFA1 (bass)", 6: "D3 = bus D2", 7: "Q3 = FFB1 (bass)", 8: "VSS = GND",
                 9: "CLK = GEN0*", 10: "Q4 = FFB2 (SNARE)", 11: "D4 = bus D5", 12: "Q5 = FFA2 (SNARE)",
                 13: "D5 = bus D4", 14: "D6 = bus D3", 15: "Q6 = RST2 (SNARE)", 16: "VDD = +5V"}
    PLUG_TO_U3 = {15: 4, 12: 7, 10: 9}
    SOURCE = "PROJECT_BRIEF.md 3.5 (fallback copy)"

INTERCEPTED = (10, 12, 15)

# DX TimeShift rev A board (from the final KiCad layout, hardware2 2026-11-06):
# 84.0 x 63.0 mm, r = 2 mm corners, 4 x M3 (3.2 mm NPTH) 3.5 mm in from each corner
# (hole centres 77.0 x 56.0 mm). J1 top centre, J2/J3 on the right edge, Nano USB to the left.
BOARD_W, BOARD_H = 84.0, 63.0
HOLE_INSET = 3.5


def dip_kind(d):
    if d in INTERCEPTED:
        return "intercepted"
    if d == 16:
        return "+5V"
    if d == 8:
        return "GND"
    return "through"


KIND_COL = {"intercepted": K.ORANGE, "+5V": K.RED, "GND": K.BLACK_WIRE, "through": "#555555"}


# ===========================================================================
#  WIRING DIAGRAM (A3 landscape)
# ===========================================================================
def wire(s, pts, colour, sw=1.0, outline=True):
    """Thick coloured wire with a thin dark outline so yellow/white stay visible."""
    if outline:
        s.polyline(pts, stroke="#333333", sw=sw + 0.35)
    s.polyline(pts, stroke=colour, sw=sw)


def bezier(s, p0, p1, p2, p3, colour, sw=1.0, outline=True):
    d = "M%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f" % (p0 + p1 + p2 + p3)
    if outline:
        s.path(d, stroke="#333333", sw=sw + 0.35, cap="round")
    s.path(d, stroke=colour, sw=sw, cap="round")


def marker(s, x, y, n, colour=K.INK):
    s.circle(x, y, 2.3, stroke=colour, sw=0.35, fill="#ffffff")
    s.text(x, y + 1.05, str(n), size=2.8, anchor="middle", weight="bold", fill=colour)


def dip_outline(s, x, y, w, h, pins=16, vertical=True, label="", pin1_top_left=True, fill="#2b2b2b",
                pin_numbers=False, size=1.6):
    """Draw a DIP body. vertical: long axis along y, pin 1 top-left, notch at top."""
    s.rect(x, y, w, h, stroke=K.INK, sw=0.25, fill=fill)
    if vertical:
        s.path("M%.2f,%.2f a%.2f,%.2f 0 0 0 %.2f,0" % (x + w / 2 - w * 0.18, y, w * 0.18, w * 0.18, w * 0.36),
               stroke="#bbbbbb", sw=0.2)
        n = pins // 2
        pitch = h / n
        for i in range(n):
            yy = y + pitch * (i + 0.5)
            s.rect(x - 0.9, yy - 0.35, 0.9, 0.7, stroke="none", sw=0, fill="#c0c0c0")
            s.rect(x + w, yy - 0.35, 0.9, 0.7, stroke="none", sw=0, fill="#c0c0c0")
            if pin_numbers:
                s.text(x - 1.4, yy + size * 0.35, str(i + 1), size=size, anchor="end")
                s.text(x + w + 1.4, yy + size * 0.35, str(pins - i), size=size)
    if label:
        s.text(x + w / 2, y + h / 2, label, size=1.8, anchor="middle", fill="#ffffff", rotate=-90)


def draw_dx_board(s, BX, BY, k):
    """Top view of the DX Processor Board (rear edge at top). Returns dict of anchor points."""
    P = lambda x, y: (BX + x * k, BY + y * k)  # noqa: E731
    W, H = 360.0, 287.0
    a = {}
    # case rear panel strip (above the board)
    s.rect(BX - 4, BY - 13, W * k + 8, 5.0, stroke=K.INK, sw=0.3, fill="#3a3a3a")
    s.text(BX + W * k, BY - 15.0, "REAR PANEL (inside view, from above)", size=2.2, anchor="end",
           fill=K.INK, weight="bold")
    # board
    s.rect(BX, BY, W * k, H * k, stroke=K.GREEN, sw=0.5, fill="#e9f3ec", rx=1)
    s.text(BX, BY + H * k + 4.0, "OBERHEIM DX PROCESSOR BOARD 1721A (top view, front of the DX at the bottom)",
           size=2.1, fill=K.GREEN, weight="bold")
    # jacks along the rear edge (inside view order, left to right)
    names = ["BASS", "SNARE", "HI-HAT", "TOMS", "CYMBAL", "PERC", "CLICK", "RIGHT", "MONO", "LEFT",
             "NEXT", "START", "TRIG", "CLK OUT", "CLK IN"]
    for i, nm in enumerate(names):
        jx = 50.0 + i * 16.9
        x0, y0 = P(jx - 6.5, -6)
        s.rect(x0, y0, 13 * k, 17 * k, stroke=K.INK, sw=0.2, fill="#555555")
        if nm in ("SNARE", "CLK OUT"):
            s.text(x0 + 6.5 * k, y0 + 17 * k + 2.3, nm, size=1.6, anchor="middle", fill=K.INK)
    s.text(P(180, 16)[0], P(180, 16)[1], "board-mounted output / clock jacks", size=1.7, anchor="middle",
           fill=K.GREY)
    # tuning-pot PCB behind the panel, pots
    x0, y0 = P(0, -9)
    s.rect(x0, y0 - 1.2, 118 * k, 2.4, stroke=K.INK, sw=0.2, fill="#6aa57a")
    pots = ["BASS", "SNARE", "HI-HAT", "TOMS", "CYMBAL", "PERC"]
    for i, nm in enumerate(pots):
        px, py = P(4.5 + i * 20.5, -9)
        s.circle(px, py - 3.6, 1.4, stroke=K.INK, sw=0.2, fill="#bbbbbb")
    s.text(BX - 4, BY - 15.0, "DRUM TUNING pots on their own PCB (harness → header D)",
           size=1.8, fill=K.INK)
    # new pot below SNARE (on the panel, lower down)
    nx, ny = P(4.5 + 20.5, -9)
    s.circle(nx, ny - 3.6, 2.0, stroke=K.RED, sw=0.5, fill="#ffd6d6")
    a["pot"] = (nx, ny - 3.6)
    # header D
    x0, y0 = P(1.5, 160)
    s.rect(x0, y0, 4.5 * k, 26 * k, stroke=K.INK, sw=0.2, fill="#ffffff")
    s.text(x0 + 3.2, y0 + 5, "D", size=1.8)
    s.polyline([P(4, 161), P(-3, 120), P(-3, 10), P(10, -8)], stroke="#9467bd", sw=0.6)
    # voice columns
    for nm, x in (("BASS", 31), ("SNARE", 60), ("HI-HAT", 97), ("TOMS", 130), ("PERC", 162)):
        s.text(P(x, 236)[0], P(x, 236)[1], nm, size=1.8, anchor="middle", fill=K.GREY)
    s.text(P(40, 280)[0], P(40, 280)[1], "CYMBAL", size=1.8, anchor="middle", fill=K.GREY)
    x0, y0 = P(46, 20)
    s.rect(x0, y0, 22 * k, 208 * k, stroke=K.GREY, sw=0.2, dash="1 0.6")
    s.text(x0 + 11 * k, y0 + 3, "snare", size=1.6, anchor="middle", fill=K.GREY)
    s.text(x0 + 11 * k, y0 + 5.2, "voice", size=1.6, anchor="middle", fill=K.GREY)
    # C701/C702 470 uF
    for cx in (187, 207):
        x0, y0 = P(cx - 8, 52)
        s.rect(x0, y0, 16 * k, 5 * k, stroke=K.INK, sw=0.2, fill="#cfcfcf", rx=0.8)
    # U701..U704
    for nm, cx, ln in (("U701", 194.4, 21.0), ("U702", 209.0, 21.0), ("U703", 223.2, 21.0), ("U704", 240.3, 26.0)):
        x0, y0 = P(cx - 3.8, 70.3 - 10.5)
        hl = nm == "U701"
        s.rect(x0, y0, 7.6 * k, ln * k, stroke=K.ORANGE if hl else K.INK, sw=0.5 if hl else 0.2,
               fill="#2b2b2b")
        s.text(x0 + 3.8 * k, y0 + ln * k + 2.4, nm, size=1.5 if not hl else 1.8, anchor="middle",
               weight="bold" if hl else "normal", fill=K.ORANGE if hl else K.INK)
    a["u701"] = P(194.4, 59.8)
    # Z80 + ROM + RAM
    for (x, y, w, h, nm) in ((252, 58, 59, 16, "U712 Z80"), (252, 86, 31, 15, "U713"), (252, 108, 31, 15, "U714"),
                             (252, 140, 31, 15, "U715"), (252, 160, 31, 15, "U716"), (252, 180, 31, 15, "U717"),
                             (252, 200, 31, 15, "U718")):
        x0, y0 = P(x, y)
        s.rect(x0, y0, w * k, h * k, stroke=K.INK, sw=0.2, fill="#2b2b2b")
        s.text(x0 + w * k / 2, y0 + h * k / 2 + 0.6, nm, size=1.5, anchor="middle", fill="#ffffff")
    # C723, battery, Q709/R791
    x0, y0 = P(331, 38)
    s.rect(x0, y0, 26 * k, 52 * k, stroke=K.INK, sw=0.2, fill="#d0d0d0", rx=1.5)
    s.text(x0 + 13 * k, y0 + 26 * k, "C723", size=1.5, anchor="middle")
    bx, by = P(345, 213)
    s.circle(bx, by, 6.0, stroke=K.INK, sw=0.25, fill="#f2e08a")
    s.text(bx, by + 0.6, "B1", size=1.7, anchor="middle")
    rx, ry = P(303, 232)
    s.rect(rx - 0.8, ry - 2.5, 1.6, 5.0, stroke=K.INK, sw=0.2, fill="#d9b38c")
    s.text(rx - 1.6, ry + 0.6, "R791", size=1.6, anchor="end", weight="bold", fill=K.BLUE)
    qx, qy = P(328, 233)
    s.path("M%.2f,%.2f a1.6,1.6 0 0 1 3.2,0 z" % (qx - 1.6, qy + 0.8), stroke=K.INK, sw=0.2, fill="#2b2b2b")
    s.text(qx + 2.2, qy + 0.8, "Q709", size=1.6)
    a["r791"] = (rx, ry)
    # optional boards
    x0, y0 = P(159, 129)
    s.rect(x0, y0, 193 * k, 17 * k, stroke=K.PURPLE, sw=0.3, dash="1.5 0.8")
    s.text(x0 + 1, y0 + 17 * k + 2.3, "1760B sync board (if fitted)", size=1.6, fill=K.PURPLE)
    # suggested zones
    za = (150, 88)
    x0, y0 = P(*za)
    s.rect(x0, y0, BOARD_W * k, BOARD_H * k, stroke=K.GREEN, sw=0.5, dash="2.5 1", fill="#d3ecd9", opacity=0.85)
    s.text(x0 + BOARD_W / 2 * k, y0 + BOARD_H / 2 * k - 2.0, "ZONE A (preferred)", size=1.9, anchor="middle",
           weight="bold", fill=K.GREEN)
    s.text(x0 + BOARD_W / 2 * k, y0 + BOARD_H / 2 * k + 0.6, "TimeShift %.0f × %.0f mm" % (BOARD_W, BOARD_H),
           size=1.6, anchor="middle", fill=K.GREEN)
    s.text(x0 + BOARD_W / 2 * k, y0 + BOARD_H / 2 * k + 2.9, "on 12.7 mm supports", size=1.6, anchor="middle",
           fill=K.GREEN)
    a["zoneA"] = (x0 + BOARD_W / 2 * k, y0)
    zb = (205, H - BOARD_H - 1.0)
    x0, y0 = P(*zb)
    s.rect(x0, y0, BOARD_W * k, BOARD_H * k, stroke=K.GREEN, sw=0.35, dash="1 1")
    s.text(x0 + BOARD_W / 2 * k, y0 + BOARD_H / 2 * k + 0.6, "ZONE B (alternative)", size=1.7, anchor="middle",
           fill=K.GREEN)
    a["zoneB"] = (x0, y0 + BOARD_H / 2 * k)
    return a


POSITIONS_CSV = os.path.join(REPO, "hardware", "exports", "positions.csv")
# Fallback copy of hardware/exports/positions.csv (2026-11-06 10:23), used only if that file is missing.
_POS_FALLBACK = {
    "C1": (135.0, 107.0, 0), "C2": (144.0, 121.0, -90), "C3": (114.0, 114.5, 0), "C4": (168.9, 127.0, -90),
    "C5": (159.0, 138.0, 0), "C6": (172.0, 128.0, -90), "C7": (168.9, 117.0, -90),
    "J1": (146.0, 111.0, 90), "J2": (181.0, 124.0, -90), "J3": (181.0, 112.5, -90), "JP1": (102.2, 119.5, 0),
    "R1": (134.3, 117.0, -90), "R2": (137.6, 117.0, -90), "R3": (140.9, 117.0, -90), "R4": (175.3, 127.0, -90),
    "R5": (109.0, 115.0, -90), "R6": (172.0, 111.0, -90), "R7": (175.3, 114.0, -90),
    "TP1": (104.0, 127.5, 0), "TP2": (130.0, 111.5, 0), "TP3": (125.0, 111.5, 0), "TP4": (119.5, 108.5, 0),
    "TP5": (167.2, 138.5, 0), "U1": (147.27, 129.5, 90), "U2": (150.8, 139.0, -90), "U3": (112.7, 128.0, 90),
    "U4": (175.42, 143.16, -90)}
BOARD_X0, BOARD_Y0 = 100.0, 100.0      # KiCad position of the board's top-left corner


def load_positions():
    """Footprint origins from the KiCad position file (KiCad y-down coordinates)."""
    try:
        import csv as _csv
        pos = {}
        with open(POSITIONS_CSV, newline="") as f:
            for r in _csv.DictReader(f):
                pos[r["Ref"]] = (float(r["PosX"]), -float(r["PosY"]), float(r["Rot"]))
        return pos, "hardware/exports/positions.csv"
    except Exception:
        return dict(_POS_FALLBACK), "built-in copy of positions.csv"


def _bbox(ref, x, y, rot):
    """Approximate body outline (x0, y0, x1, y1) in board mm for the footprints used on rev A."""
    if ref in ("U1", "U3"):                       # DIP-16 socket, rot 90: pin 1 bottom-left
        return x - 1.3, y - 8.9, x + 19.1, y + 1.3
    if ref == "U4":                                # DIP-14 socket, rot -90: pin 1 top-right
        return x - 16.5, y - 1.3, x + 1.3, y + 8.9
    if ref == "U2":                                # Nano, rot -90: pin 1 top-right
        return x - 36.9, y - 1.3, x + 1.3, y + 16.5
    if ref == "J1":                                # 2x8 box header, rot 90: pin 1 bottom-left
        return x - 4.5, y - 7.0, x + 22.3, y + 4.5
    if ref in ("J2", "J3"):
        n = 3 if ref == "J2" else 2
        return x - 2.4, y - 2.45, x + 3.4, y + (n - 1) * 2.5 + 2.45
    if ref == "JP1":
        return x - 1.3, y - 1.3, x + 3.84, y + 3.84
    if ref.startswith("R"):
        return x - 1.2, y - 0.8, x + 1.2, y + 10.96
    if ref.startswith("C") and ref != "C1":
        return (x - 1.25, y - 0.8, x + 1.25, y + 5.8) if rot else (x - 0.8, y - 1.25, x + 5.8, y + 1.25)
    return None


def draw_timeshift(s, x, y, w, h):
    """TimeShift rev A top view drawn from the real component placement. Returns anchors."""
    a = {}
    pos, src = load_positions()
    k = w / BOARD_W

    def P(px, py):
        return x + (px - BOARD_X0) * k, y + (py - BOARD_Y0) * k

    s.rect(x, y, w, h, stroke=K.GREEN, sw=0.6, fill="#2f6b45", rx=2 * k)
    for hx in (HOLE_INSET, BOARD_W - HOLE_INSET):
        for hy in (HOLE_INSET, BOARD_H - HOLE_INSET):
            s.circle(x + hx * k, y + hy * k, 1.6 * k, stroke=K.INK, sw=0.2, fill="#ffffff")
    style = {"U1": ("#2b2b2b", K.ORANGE, 0.5), "U3": ("#2b2b2b", K.INK, 0.25), "U4": ("#2b2b2b", K.INK, 0.25),
             "U2": ("#1d4f91", "#9fc1ff", 0.4), "J1": ("#d9d9d9", K.INK, 0.3), "J2": ("#eeeeee", K.INK, 0.3),
             "J3": ("#eeeeee", K.INK, 0.3), "JP1": ("#d9d9d9", K.INK, 0.25)}
    for ref, (px, py, rot) in sorted(pos.items(), key=lambda r: r[0] != "U2"):
        if ref.startswith("H"):
            continue
        if ref.startswith("TP"):
            cx, cy = P(px, py)
            s.circle(cx, cy, 1.3 * k, stroke=K.INK, sw=0.2, fill="#5b9bd5")
            s.text(cx, cy - 1.7 * k, ref, size=1.4, anchor="middle", fill="#ffffff")
            continue
        if ref == "C1":
            cx, cy = P(px + 1.0, py)
            s.circle(cx, cy, 2.5 * k, stroke=K.INK, sw=0.2, fill="#e6893a")
            s.text(cx, cy + 0.5, "C1", size=1.3, anchor="middle", fill="#ffffff")
            continue
        bb = _bbox(ref, px, py, rot)
        if not bb:
            continue
        x0, y0 = P(bb[0], bb[1])
        x1, y1 = P(bb[2], bb[3])
        fill, stroke, sw = style.get(ref, ("#e6893a" if ref.startswith("C") else "#d8c38f", K.INK, 0.15))
        s.rect(x0, y0, x1 - x0, y1 - y0, stroke=stroke, sw=sw, fill=fill, rx=0.3)
        if ref.startswith(("R", "C")):
            s.text((x0 + x1) / 2, (y0 + y1) / 2 + 0.5, ref, size=1.2, anchor="middle", fill=K.INK,
                   rotate=-90 if (y1 - y0) > (x1 - x0) else None)
        # pin-1 mark (red) on ICs and connectors
        if ref in ("U1", "U2", "U3", "U4", "J1", "J2", "J3", "JP1"):
            mx, my = P(px, py)
            s.rect(mx - 0.7, my - 0.7, 1.4, 1.4, stroke="none", sw=0, fill="#ff3030")
    lab = {"U1": ("U1 ← ORIGINAL U701", "#ffd8a8"), "U3": ("U3 74HC157", "#ffffff"),
           "U4": ("U4 74HC14", "#ffffff"), "U2": ("U2 Arduino Nano", "#ffffff"), "J1": ("J1 DX PLUG", K.INK)}
    for ref, (t, col) in lab.items():
        if ref in pos:
            bb = _bbox(ref, *pos[ref])
            cx, cy = P((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
            s.text(cx, cy + (0.6 if ref != "U2" else -1.6), t, size=1.8 if ref != "U1" else 1.6, anchor="middle",
                   fill=col, weight="bold")
    if "U2" in pos:
        bb = _bbox("U2", *pos["U2"])
        cx, cy = P((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)
        s.text(cx, cy + 1.4, "UNPLUG NANO BEFORE USB", size=1.7, anchor="middle", fill="#ffd400", weight="bold")
        s.text(cx, cy + 4.0, "◄ USB end faces the left board edge", size=1.4, anchor="middle", fill="#cfe0ff")
    if "JP1" in pos:
        jx, jy = P(pos["JP1"][0], pos["JP1"][1])
        s.text(jx - 0.6, jy - 2.4, "JP1 PPQN", size=1.5, fill="#ffffff")
    # anchors: J1 top centre, J2/J3 pins at the right board edge
    if "J1" in pos:
        bb = _bbox("J1", *pos["J1"])
        a["J1"] = P((bb[0] + bb[2]) / 2, bb[1])
        p1x, p1y = P(pos["J1"][0], pos["J1"][1])
        s.text(p1x - 2.0, p1y + 3.4, "▲ pin 1", size=1.5, fill="#ffb3b3")
    for nm, n in (("J2", 3), ("J3", 2)):
        px, py, rot = pos[nm]
        for i in range(n):
            ax_, ay_ = P(BOARD_X0 + BOARD_W, py + i * 2.5)
            a["%s-%d" % (nm, i + 1)] = (ax_, ay_)
        bx, by = P(px - 2.6, py + 0.6)
        s.text(bx, by, nm, size=1.9, anchor="end", weight="bold", fill="#ffffff")
    s.text(x, y + h + 3.6, "DX TIMESHIFT rev A, top view", size=2.1, weight="bold", fill=K.GREEN)
    s.text(x, y + h + 6.3, "from %s · %.0f × %.0f mm · 4 × M3 at %.0f × %.0f mm" % (
        src.replace("hardware/exports/", ""), BOARD_W, BOARD_H, BOARD_W - 2 * HOLE_INSET,
        BOARD_H - 2 * HOLE_INSET), size=1.5, fill=K.GREEN)
    return a


def wiring_diagram(path):
    W, H = 420.0, 297.0
    s = K.SVG(W, H, "DX TimeShift - wiring diagram")
    K.frame(s, 10, 10, 10, 10)
    s.text(14, 19, "WIRING DIAGRAM — DX TimeShift in an Oberheim DX (board 1721A, U701)", size=4.6, weight="bold")
    s.text(14, 24.6, "Not to scale. DX board positions scaled from the Oberheim parts layout (±3 mm). "
           "Colours = suggested wire colours. Every pin number is also on the PCB silkscreen.",
           size=2.4, fill=K.GREY)

    # ------------------------------------------------ DX board view (left)
    a = draw_dx_board(s, 20.0, 54.0, 0.44)
    marker(s, a["u701"][0] - 6.0, a["u701"][1] + 2.5, 1, K.ORANGE)
    marker(s, a["pot"][0] + 4.6, a["pot"][1] - 3.6, 2, K.RED)
    marker(s, a["r791"][0] - 3.0, a["r791"][1] - 6.5, 3, K.BLUE)
    marker(s, a["zoneA"][0] - 21.5, a["zoneA"][1] + 14, 4, K.GREEN)

    # ------------------------------------------------ TimeShift block (right)
    TX, TW = 238.0, 96.0
    TY, TH = 48.0, 96.0 * BOARD_H / BOARD_W
    t = draw_timeshift(s, TX, TY, TW, TH)

    # ribbon J1 -> U701 (grey band with red stripe)
    j1x, j1y = t["J1"]
    ux, uy = a["u701"]
    p0, p1, p2, p3 = (j1x, j1y), (j1x, j1y - 22), (ux + 50, uy - 34), (ux + 1, uy - 1.0)
    d = "M%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f" % (p0 + p1 + p2 + p3)
    s.path(d, stroke="#555555", sw=5.6, cap="butt")
    s.path(d, stroke=K.RIBBON, sw=5.0, cap="butt")
    d2 = "M%.2f,%.2f C%.2f,%.2f %.2f,%.2f %.2f,%.2f" % (p0[0] - 2.2, p0[1], p1[0] - 2.2, p1[1] - 1, p2[0] - 1.5,
                                                         p2[1] - 2, p3[0] - 1.8, p3[1] - 1.2)
    s.path(d2, stroke=K.RED, sw=0.6)
    s.rect(ux - 3.0, uy - 1.2, 6.0, 11.0, stroke=K.INK, sw=0.3, fill="#6b6b6b")
    s.text(ux - 9.5, uy + 9.5, "DIP-16 IDC plug in the", size=1.8, anchor="end", weight="bold")
    s.text(ux - 9.5, uy + 11.8, "empty U701 socket", size=1.8, anchor="end", weight="bold")
    s.text(ux - 9.5, uy + 14.1, "(red stripe / pin 1 to the notch)", size=1.6, anchor="end")
    s.text(j1x + 5, j1y - 13.0, "16-way ribbon, 10–15 cm", size=2.2, weight="bold")
    s.text(j1x + 5, j1y - 10.2, "red stripe = conductor 1 = J1 pin 1 = DIP pin 1", size=1.8)
    s.text(j1x + 5, j1y - 7.8, "(table below; check with dip-plug-mapping.pdf)", size=1.8, fill=K.GREY)

    # ------------------------------------------------ pot inset
    IX, IY, IW, IH = 200.0, 128.0, 100.0, 56.0
    s.rect(IX, IY, IW, IH, stroke=K.INK, sw=0.3, fill="#ffffff")
    marker(s, IX + 4, IY + 4.5, 2, K.RED)
    s.text(IX + 7.5, IY + 5.5, "SNARE DELAY pot (rear panel, below SNARE)", size=2.3, weight="bold")
    s.text(IX + 7.5, IY + 8.6, "10 k lin, TT P160KNP-0EC15B10K, seen from INSIDE (solder side)", size=1.75,
           fill=K.GREY)
    cx, cy = IX + 20, IY + 25
    s.circle(cx, cy, 9.0, stroke=K.INK, sw=0.4, fill="#e8e8e8")
    s.circle(cx, cy, 3.0, stroke=K.INK, sw=0.3, fill="#ffffff")
    s.text(cx, cy - 10.2, "body Ø17", size=1.7, anchor="middle", fill=K.GREY)
    lugs = [(3, "CW"), (2, "wiper"), (1, "CCW")]
    lug_pts = {}
    for i, (n, role) in enumerate(lugs):
        lx = cx - 5 + i * 5
        s.rect(lx - 1.1, cy + 8.0, 2.2, 6.5, stroke=K.INK, sw=0.25, fill="#d4af37")
        s.circle(lx, cy + 12.6, 0.6, stroke=K.INK, sw=0.15, fill="#ffffff")
        lug_pts[n] = (lx, cy + 14.5)
    # lug numbers + roles to the left/right of the lug row
    s.text(cx - 7.5, cy + 12.0, "lug 3 (CW)", size=1.8, anchor="end", weight="bold", fill=K.RED)
    s.text(cx + 7.5, cy + 12.0, "lug 1 (CCW)", size=1.8, weight="bold")
    s.text(cx, cy + 6.6, "2", size=1.8, anchor="middle", weight="bold", fill="#8a6d00")
    s.lines(IX + 42, IY + 15, [
        "Fully anticlockwise (from outside) = 0",
        "= no delay (bypass); fully clockwise",
        "= 1 beat.",
        "Find lug 1 with a meter: shaft fully",
        "anticlockwise (from outside) → lug 1",
        "to lug 2 reads ≈ 0 Ω. Lug 2 = middle.",
        "From INSIDE, lug 1 is on the RIGHT",
        "when the lugs point down (mirrored).",
        "Twist the 3 wires; length ≈ 300 mm.",
    ], size=1.8, lh=2.5)
    # wires lug -> J2 : down, right through the gap between the insets, up, into J2
    col = {1: K.BLACK_WIRE, 2: K.YELLOW, 3: K.RED}
    lane = {3: 301.6, 2: 303.6, 1: 305.6}
    jlane = {3: 344.0, 2: 341.0, 1: 338.0}
    for n in (3, 2, 1):
        lx, ly = lug_pts[n]
        yrun = ly + 2.5 + (3 - n) * 2.2
        jx, jy = t["J2-%d" % n]
        ybus = TY + TH + 4 + (3 - n) * 2.2
        wire(s, [(lx, ly), (lx, yrun), (lane[n], yrun), (lane[n], ybus), (jlane[n], ybus), (jlane[n], jy),
                 (jx + 0.8, jy)], col[n], sw=0.9)
    s.text(cx - 9, IY + IH - 3.0, "GND  (lug 1 → J2-1)   WIPER  (lug 2 → J2-2)   +5 V  (lug 3 → J2-3)",
           size=1.7, fill=K.GREY)

    # ------------------------------------------------ clock tap inset
    CX, CY, CW, CH = 309.0, 128.0, 99.0, 56.0
    s.rect(CX, CY, CW, CH, stroke=K.INK, sw=0.3, fill="#ffffff")
    marker(s, CX + 4, CY + 4.5, 3, K.BLUE)
    s.text(CX + 7.5, CY + 5.5, "Clock tap at R791 (CLOCK OUT node)", size=2.3, weight="bold")
    s.text(CX + 7.5, CY + 8.6, "front-right of the DX board, next to battery B1", size=1.75, fill=K.GREY)
    sx, sy = CX + 14, CY + 19
    s.text(sx - 1, sy + 1.6, "+5 V", size=1.8, anchor="end", fill=K.RED)
    s.line(sx, sy + 1, sx + 6, sy + 1, stroke=K.INK, sw=0.3)
    s.rect(sx + 6, sy - 0.4, 9, 2.8, stroke=K.INK, sw=0.3, fill="#d9b38c")
    s.text(sx + 10.5, sy - 1.4, "R791 1 kΩ", size=1.7, anchor="middle")
    s.line(sx + 15, sy + 1, sx + 30, sy + 1, stroke=K.INK, sw=0.3)
    s.circle(sx + 24, sy + 1, 0.6, stroke=K.INK, sw=0.1, fill=K.INK)
    s.text(sx + 30.5, sy + 1.6, "→ CLOCK OUT jack tip", size=1.7)
    s.line(sx + 24, sy + 1, sx + 24, sy + 6, stroke=K.INK, sw=0.3)
    s.circle(sx + 24, sy + 8.5, 2.6, stroke=K.INK, sw=0.3)
    s.text(sx + 27.5, sy + 8.0, "Q709 (emitter to GND;", size=1.6)
    s.text(sx + 27.5, sy + 10.2, "leg order UNCONFIRMED)", size=1.6)
    s.line(sx + 24, sy + 11, sx + 24, sy + 13, stroke=K.INK, sw=0.3)
    s.line(sx + 22.5, sy + 13, sx + 25.5, sy + 13, stroke=K.INK, sw=0.3)
    gx, gy = sx + 17.5, sy + 1
    s.polygon([(gx, gy + 0.4), (gx - 1.4, gy + 4.5), (gx + 1.4, gy + 4.5)], stroke=K.INK, sw=0.2, fill="#d62728")
    s.rect(gx - 1.4, gy + 4.5, 2.8, 4.0, stroke=K.INK, sw=0.2, fill="#d62728")
    s.text(gx - 2.2, gy + 7.0, "mini-grabber", size=1.6, anchor="end")
    s.text(gx - 2.2, gy + 9.1, "on this lead", size=1.6, anchor="end")
    s.lines(CX + 3, CY + 40.0, [
        "Clip on the R791 lead at the Q709-COLLECTOR side (not the +5 V side).",
        "Check: DX on and stopped, this lead ≈ 0 V (other lead 5.0 V); DX off: 0 Ω to CLOCK OUT tip.",
        "96 PPQN, rising edge = tick. Or tack-solder the wire to the lead.",
        "GND wire (J3-2) is OPTIONAL: to a DX ground point with 0 Ω to U701 pin 8,",
        "or leave it unconnected with its end insulated. Don't use a Q709 leg:",
        "which Q709 leg is the emitter is UNCONFIRMED. Twist CLK + GND; ≈ 250 mm.",
    ], size=1.75, lh=2.45)
    # wires grabber -> J3 : up out of the inset, right lanes, up into J3
    jx1, jy1 = t["J3-1"]
    jx2, jy2 = t["J3-2"]
    wire(s, [(gx, gy + 8.5), (gx, CY + 34.0), (CX + CW - 5.0, CY + 34.0), (CX + CW - 5.0, jy1),
             (jx1 + 0.8, jy1)], K.BLUE, sw=0.9)
    wire(s, [(gx + 1.0, gy + 8.5), (gx + 1.0, CY + 32.0), (CX + CW - 2.6, CY + 32.0), (CX + CW - 2.6, jy2),
             (jx2 + 0.8, jy2)], K.BLACK_WIRE, sw=0.9)

    # J2 / J3 pin text (right of the lanes)
    s.lines(357.0, TY + 2.5, ["J3 pin 1 = CLK (blue)", "J3 pin 2 = GND (black)"], size=1.9, lh=2.6)
    s.lines(357.0, TY + 24.0, ["J2 pin 1 = GND (black, lug 1, CCW)", "J2 pin 2 = WIPER (yellow, lug 2)",
                               "J2 pin 3 = +5 V (red, lug 3, CW)"], size=1.9, lh=2.6)

    # links from board-view markers to the insets / block (thin dashed)
    s.line(a["pot"][0] + 6.9, a["pot"][1] - 3.6, IX + 1.7, IY + 4.5, stroke=K.RED, sw=0.2, dash="1.2 1")
    s.polyline([(a["r791"][0] - 3.0, a["r791"][1] - 4.2), (a["r791"][0] - 3.0, 189.0), (CX + 4, 189.0),
                (CX + 4, CY + CH)], stroke=K.BLUE, sw=0.2, dash="1.2 1")
    s.polyline([(a["zoneA"][0] + 18.5, a["zoneA"][1] + 14), (TX, TY + 30)], stroke=K.GREEN, sw=0.2,
               dash="1.2 1")

    # ------------------------------------------------ mapping table
    MX, MY = 14.0, 196.0
    s.text(MX, MY, "J1 ↔ RIBBON ↔ DIP-16 PLUG MAPPING (brief 3.5; source: %s)" % SOURCE, size=2.5,
           weight="bold")
    cols = [("J1 pin", 0), ("cond.", 11), ("DIP pin", 21), ("U701 signal at that DIP pin", 33),
            ("TimeShift path", 76)]
    for half in range(2):
        hx = MX + half * 114
        yy = MY + 4.6
        for c, dx in cols:
            s.text(hx + dx, yy, c, size=1.9, weight="bold")
        s.line(hx, yy + 1.0, hx + 110, yy + 1.0, stroke=K.INK, sw=0.2)
        for i in range(8):
            h = half * 8 + i + 1
            dpin = HDR2DIP[h]
            kind = dip_kind(dpin)
            yy += 3.15
            if i % 2 == 0:
                s.rect(hx, yy - 2.3, 110, 3.15, stroke="none", sw=0, fill="#f3f3f3")
            colr = KIND_COL[kind]
            how = {"intercepted": "INTERCEPTED via U3 mux (not U1)", "+5V": "+5 V supply (≤ 60 mA)",
                   "GND": "GND", "through": "straight through to U1 pin %d" % dpin}[kind]
            s.text(hx + 3, yy, str(h), size=1.9, family=K.MONO)
            s.text(hx + 13, yy, str(h), size=1.9, family=K.MONO, fill=K.RED if h == 1 else K.INK)
            s.text(hx + 24, yy, str(dpin), size=1.9, family=K.MONO, weight="bold", fill=colr)
            s.text(hx + 33, yy, U701_FUNC[dpin], size=1.9, fill=colr)
            s.text(hx + 76, yy, how, size=1.75, fill=colr)
    s.text(MX, MY + 34.0, "Conductor n of the ribbon lands on J1 pin n; the DIP plug puts conductor n on the "
           "DIP pin shown. Orange = the three snare lines the TimeShift intercepts.", size=1.9, fill=K.GREY)

    # ------------------------------------------------ legend + notes
    LX, LY = 14.0, 238.0
    K.legend(s, LX, LY, [
        ("thick", K.RED, "+5 V (pot lug 3 / CW)", None),
        ("thick", K.BLACK_WIRE, "GND (pot lug 1 / CCW, clock GND)", None),
        ("thick", K.YELLOW, "pot wiper (lug 2)", None),
        ("thick", K.BLUE, "clock tap (R791 → J3-1)", None),
        ("thick", K.RIBBON, "16-way ribbon, red stripe = 1", None),
        ("line", K.ORANGE, "intercepted snare lines (10/12/15)", None),
        ("line", K.GREEN, "suggested board zones", "2.5 1"),
    ], size=1.9, w=66)
    s.lines(LX + 71, LY + 3.6, [
        "① U701 socket: lift the original MC14174B out (note the notch), fit it in U1 on the TimeShift, then push the",
        "    DIP plug into the empty DX socket, pin 1 to the notch end. (Findings Q1: confirm U701 is socketed first.)",
        "② New pot hole: rear-panel-drill-template.pdf. Do not touch the tuning-pot harness (header D).",
        "③ Clock tap: mini-grabber on R791 (Q709-collector side). 10 kΩ + Schmitt input on the TimeShift side.",
        "④ Board (84 × 63 mm) in ZONE A on 4 self-adhesive snap-lock supports (12.7 mm), J1 towards U701,",
        "    ribbon ≤ 15 cm. Check lid clearance first (findings Q3: ≥ 32 mm incl. the Nano) and any 1760B sync",
        "    board or Electrongate MIDI board in the area. ZONE B needs a 20–25 cm ribbon: use it only after the",
        "    GEN0* scope check (findings Q4). Power comes through the ribbon (U701 pins 16/8): no extra wires;",
        "    never use the +5M battery rail. Flash the Nano OUT of the board, or only with the DX switched on.",
        "JP1 (PPQN): no shunt = 96 (plain DX); shunt on JP1 1-2 = 48 (D10); shunt on JP1 3-4 = 24 (D11).",
    ], size=1.85, lh=2.6)

    K.title_block(s, 302.0, 252.0, 104.0, 35.0, "Wiring diagram (pot, clock tap, ribbon)", "DXTS-MECH-002",
                  "NTS", DATE, rev=REV, note="A3 landscape")
    s.save(path)


# ===========================================================================
#  DIP PLUG MAPPING (A4 landscape)
# ===========================================================================
def dip_plug_mapping(path):
    W, H = 297.0, 210.0
    s = K.SVG(W, H, "DX TimeShift - J1 / ribbon / DIP-16 plug mapping")
    K.frame(s, 10, 8, 10, 8)
    s.text(14, 16, "J1 BOX HEADER ↔ 16-WAY RIBBON ↔ DIP-16 IDC PLUG — continuity check sheet", size=4.0,
           weight="bold")
    s.text(14, 21, "Standard DIP-IDC plug: conductors 1,2 land on DIP pins 1,16; 3,4 on 2,15; … 15,16 on 8,9. "
           "TO BE CONFIRMED on YOUR cable with a meter before first power-up (mandatory).", size=2.3, fill=K.GREY)

    # ---------- J1 box header (top view, as on the rev A board) ----------
    hx, hy = 22.0, 40.0
    pitch = 5.0
    s.text(hx, hy - 8, "J1 box header (top view, as on the PCB)", size=2.4, weight="bold")
    s.rect(hx - 3, hy - 3, 8 * pitch + 6, 2 * pitch + 6, stroke=K.INK, sw=0.5, fill="#3a3a3a", rx=0.8)
    hdr_xy = {}
    for i in range(8):
        for r in range(2):
            n = 2 * i + (2 if r == 0 else 1)          # top row even, bottom row odd (pin 1 bottom-left)
            px, py = hx + pitch * i + pitch / 2, hy + pitch * r + pitch / 2
            s.rect(px - 1.2, py - 1.2, 2.4, 2.4, stroke="none", sw=0, fill="#d4af37" if n != 1 else K.RED)
            s.text(px, py + (-2.0 if r == 0 else 4.4) + (-pitch if r == 0 else pitch), str(n), size=2.0,
                   anchor="middle", family=K.MONO, weight="bold" if n == 1 else "normal",
                   fill=K.RED if n == 1 else K.INK)
            hdr_xy[n] = (px, py)
    s.polygon([(hx - 5.5, hy + 7.5), (hx - 3.6, hy + 6.4), (hx - 3.6, hy + 8.6)], stroke=K.RED, sw=0.1, fill=K.RED)


    # ---------- ribbon (flat, conductors left→right) ----------
    rx0, ry0, ry1 = 22.0, 74.0, 112.0
    rp = 2.6
    s.text(rx0, ry1 + 12.5, "16-way ribbon, 1.27 mm (drawn ×2 wide)", size=2.4, weight="bold")
    s.text(rx0, ry1 + 15.6, "IDC socket at J1: conductor n → J1 pin n (red stripe → pin 1).", size=1.8)
    s.text(rx0, ry1 + 18.2, "J1: top row even pins 2…16, bottom row odd pins 1…15; ◄ = pin 1.", size=1.8)
    s.rect(rx0 - 1.5, ry0, 16 * rp + 3, ry1 - ry0, stroke=K.INK, sw=0.3, fill="#d8d8d8")
    rib_x = {}
    for n in range(1, 17):
        x = rx0 + (n - 0.5) * rp
        s.line(x, ry0, x, ry1, stroke=K.RED if n == 1 else "#8a8a8a", sw=1.2 if n == 1 else 0.7)
        s.text(x, ry1 + 3.6, str(n), size=1.6, anchor="middle", family=K.MONO, fill=K.RED if n == 1 else K.INK)
        rib_x[n] = x
    s.text(rx0 - 2.5, ry0 + 4, "red", size=1.7, anchor="end", fill=K.RED)
    s.text(rx0 - 2.5, ry0 + 6.2, "stripe", size=1.7, anchor="end", fill=K.RED)
    s.text(rx0 + 8 * rp, ry1 + 7.5, "conductor number", size=1.8, anchor="middle", fill=K.GREY)
    # header pin -> conductor (short connectors)
    ys = hy + 2 * pitch + 3 + 5.0
    for n in range(1, 17):
        px, py = hdr_xy[n]
        kind = dip_kind(HDR2DIP[n])
        off = -0.9 if n % 2 else 0.9
        s.polyline([(px + off, ys), (px + off, ys + 3), (rib_x[n], ry0 - 3), (rib_x[n], ry0 - 0.3)],
                   stroke=KIND_COL[kind], sw=0.35)

    # ---------- DIP-16 IDC plug: how the conductor pairs land ----------
    px0, py0 = 92.0, 40.0
    s.text(px0, py0 - 8, "DIP-16 IDC plug: conductor → pin", size=2.4, weight="bold")
    s.text(px0, py0 - 4.8, "(plug seen from the cable side, notch/pin 1 at the top)", size=1.8, fill=K.GREY)
    pw, ph = 26.0, 72.0
    s.rect(px0, py0, pw, ph, stroke=K.INK, sw=0.4, fill="#5a5a5a", rx=1)
    s.path("M%.2f,%.2f a3,3 0 0 0 6,0" % (px0 + pw / 2 - 3, py0), stroke="#dddddd", sw=0.4)
    dip_xy = {}
    for i in range(8):
        yy = py0 + 5 + i * 9.0
        dip_xy[i + 1] = (px0 + 4, yy)
        dip_xy[16 - i] = (px0 + pw - 4, yy)
        s.circle(px0 + 4, yy, 1.4, stroke=K.INK, sw=0.2, fill="#d4af37")
        s.circle(px0 + pw - 4, yy, 1.4, stroke=K.INK, sw=0.2, fill="#d4af37")
        s.text(px0 + 4, yy + 0.7, str(i + 1), size=1.6, anchor="middle", weight="bold")
        s.text(px0 + pw - 4, yy + 0.7, str(16 - i), size=1.6, anchor="middle", weight="bold")
    # conductors drawn crossing the plug: pair k lands at row k
    for n in range(1, 17):
        d = HDR2DIP[n]
        x, y = dip_xy[d]
        kind = dip_kind(d)
        s.text(px0 - 2.0 if x < px0 + pw / 2 else px0 + pw + 2.0, y + 0.7, "c%d" % n, size=1.7,
               anchor="end" if x < px0 + pw / 2 else "start", family=K.MONO, fill=KIND_COL[kind])
    s.text(px0, py0 + ph + 4.5, "Each row of the plug takes two neighbouring", size=1.8)
    s.text(px0, py0 + ph + 7.0, "conductors: odd n → left pin, even n → right pin.", size=1.8)

    # ---------- DX socket view (what the pins carry) ----------
    sx0, sy0 = 140.0, 40.0
    s.text(sx0, sy0 - 8, "In the DX U701 socket (top view, notch up)", size=2.4, weight="bold")
    dip_outline(s, sx0 + 22, sy0, 10, ph, pins=16, pin_numbers=False)
    for i in range(8):
        yy = sy0 + ph / 8 * (i + 0.5)
        for d, x, anc in ((i + 1, sx0 + 20.0, "end"), (16 - i, sx0 + 34.0, "start")):
            kind = dip_kind(d)
            s.text(x, yy + 0.7, "%d %s" % (d, U701_FUNC[d].split("(")[0].strip()) if anc == "start"
                   else "%s %d" % (U701_FUNC[d].split("(")[0].strip(), d), size=1.75, anchor=anc,
                   fill=KIND_COL[kind], weight="bold" if kind == "intercepted" else "normal")

    # ---------- full table ----------
    tx, ty = 200.0, 32.0
    s.text(tx, ty - 0.5, "MAPPING TABLE (source: %s)" % SOURCE, size=2.3, weight="bold")
    hdrs = [("c / J1", 0), ("DIP", 12), ("U701 signal", 21), ("expect on the board", 51)]
    yy = ty + 4.0
    for c, dx in hdrs:
        s.text(tx + dx, yy, c, size=1.8, weight="bold")
    s.line(tx, yy + 1.0, tx + 82, yy + 1.0, stroke=K.INK, sw=0.2)
    for n in range(1, 17):
        d = HDR2DIP[n]
        kind = dip_kind(d)
        yy += 3.2
        if n % 2:
            s.rect(tx, yy - 2.3, 82, 3.2, stroke="none", sw=0, fill="#f3f3f3")
        exp = {"intercepted": "→ U3 pin %d (mux Y)" % PLUG_TO_U3.get(d, 0), "+5V": "U1 pin 16, +5 V",
               "GND": "U1 pin 8, TP4 GND", "through": "U1 pin %d" % d}[kind]
        s.text(tx + 2, yy, "%2d" % n, size=1.85, family=K.MONO, fill=K.RED if n == 1 else K.INK)
        s.text(tx + 13, yy, "%2d" % d, size=1.85, family=K.MONO, weight="bold", fill=KIND_COL[kind])
        s.text(tx + 21, yy, U701_FUNC[d], size=1.7, fill=KIND_COL[kind])
        s.text(tx + 51, yy, exp, size=1.7, fill=KIND_COL[kind])

    # ---------- test procedure ----------
    qx, qy = 14.0, 138.0
    s.rect(qx, qy, 170, 60, stroke=K.INK, sw=0.3, fill="#fffdf3")
    s.text(qx + 2, qy + 4.5, "CONTINUITY TESTS (meter on beep / Ω; A–D: all chips and the Nano OUT of their sockets)",
           size=2.2, weight="bold")
    rows = [
        ("A", "Cable alone. Probe J1-socket hole n (or the cable's pin-1 end) and the DIP plug: conductor n must"),
        ("", "beep ONLY to the DIP pin in the table (c1→1, c2→16, c3→2 … c16→9). Also check each DIP pin against"),
        ("", "its two neighbours: no beep (catches a squashed IDC)."),
        ("B", "Cable plugged into J1 on the TimeShift. DIP plug pin k ↔ U1 socket pin k must beep for"),
        ("", "k = 1–9, 11, 13, 14, 16 (13 straight-through pins)."),
        ("C", "DIP plug pins 15 / 12 / 10 ↔ U3 socket pins %d / %d / %d must beep, and must NOT beep to"
         % (PLUG_TO_U3[15], PLUG_TO_U3[12], PLUG_TO_U3[10])),
        ("", "U1 pins 15 / 12 / 10 (those go to the Nano and the mux A inputs only)."),
        ("D", "DIP pin 16 (+5 V) ↔ DIP pin 8 (GND): no dead short (the meter may beep briefly while C1 charges)."),
        ("E", "Plug orientation in the DX socket (docs/03-install-in-the-dx.md §8.1). DX switched OFF and"),
        ("", "unplugged from the mains, DIP plug fitted in the U701 socket; chips may stay fitted. Meter on Ω:"),
        ("", "TP4 ↔ DX U702 pin 8: < 1 Ω.   C1 + lead ↔ U702 pin 16: < 1 Ω.   TP4 ↔ U702 pin 16: NOT near 0 Ω"),
        ("", "(may climb as capacitors charge).   TimeShift U1 pin 1 ↔ C1 + lead: < 1 Ω."),
        ("", "Record A–E in docs/04-test-and-calibrate.md §1. Any mismatch: STOP, do not power the DX."),
    ]
    yy = qy + 9.0
    for k, t in rows:
        if k:
            s.circle(qx + 4.5, yy - 0.7, 1.9, stroke=K.INK, sw=0.3, fill="#ffffff")
            s.text(qx + 4.5, yy, k, size=2.0, anchor="middle", weight="bold")
        s.text(qx + 8.5, yy, t, size=1.95)
        nxt = rows[rows.index((k, t)) + 1][0] if rows.index((k, t)) + 1 < len(rows) else "x"
        yy += 3.0 if nxt == "" else 4.4

    K.legend(s, 200.0, 94.5, [
        ("line", K.ORANGE, "intercepted snare lines (DIP 10, 12, 15)", None),
        ("line", K.RED, "+5 V (DIP 16); red stripe = conductor 1", None),
        ("line", K.BLACK_WIRE, "GND (DIP 8)", None),
        ("line", "#555555", "straight-through signals", None),
    ], size=1.8, w=82)

    K.title_block(s, 187.0, 167.0, 100.0, 35.0, "J1 / ribbon / DIP-16 plug mapping", "DXTS-MECH-003", "NTS",
                  DATE, rev=REV, note="A4 landscape")
    s.save(path)


def main():
    wiring_diagram(os.path.join(MECH, "wiring-diagram.svg"))
    dip_plug_mapping(os.path.join(MECH, "dip-plug-mapping.svg"))
    print("wrote wiring-diagram.svg, dip-plug-mapping.svg (mapping source: %s)" % SOURCE)


if __name__ == "__main__":
    main()
