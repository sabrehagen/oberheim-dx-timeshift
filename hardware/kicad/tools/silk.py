"""Silkscreen for the DX TimeShift board (called from gen_pcb.py).

Coordinates are mm relative to the board's top-left corner. Every text the technician needs
is here: board name / revision / model warning, the USB warning next to the Nano's USB end,
connector names + pin legends, test-point names, PPQN jumper legend, Nano orientation marks
and the U1 'original U701 chip' legend with its notch arrow.
"""
import pcbnew

import netlist as N

MM = pcbnew.FromMM

# custom component labels that replace the footprint reference on the silkscreen
# ref: (text, x, y, angle, size)
PART_LABELS = {
    "R1": ("R1 1k", 34.3, 20.08, 90, 1.0),
    "R2": ("R2 1k", 37.6, 20.08, 90, 1.0),
    "R3": ("R3 1k", 40.9, 20.08, 90, 1.0),
    "R4": ("R4 1k", 75.3, 30.08, 90, 1.0),
    "R5": ("R5 10k", 9.0, 18.08, 90, 1.0),
    "R6": ("R6 10k", 72.0, 14.08, 90, 1.0),
    "R7": ("R7 100k", 75.3, 17.08, 90, 0.9),
    "C1": ("C1", 36.0, 8.6, 0, 0.9),
    "C2": ("C2", 44.0, 21.5, 90, 0.9),
    "C3": ("C3", 16.5, 12.5, 0, 0.9),
    "C4": ("C4", 62.7, 34.2 + 3.0, 0, 0.9),
    "C5": ("C5", 45.68, 52.4 + 3.0, 0, 0.9),
    "C6": ("C6", 72.0, 28.5, 90, 0.9),
    "C7": ("C7", 68.9, 17.5, 90, 0.9),
}

# reference positions for parts that keep their own reference text (x, y, angle, size)
REF_POS = {
    "U1": (56.16, 22.6, 0, 1.2),   # inside the socket (visible before the socket is fitted)
    "U3": (21.59, 22.2, 0, 1.2),
    "U4": (67.82, 45.03, 0, 1.2),
    "U2": (37.0, 38.6 + 3.0, 0, 1.5),
    "J1": (43.6, 7.7, 0, 1.0),
    "JP1": (3.5, 23.0, 0, 1.0),
}


def add_all(board, fps, add_text, add_line, add_poly, W, H, DY=0.0, YOFF=0.0):
    S = pcbnew.F_SilkS
    # ---------------------------------------------------------------- references
    for ref, fp in fps.items():
        f = fp.Reference()
        if ref in PART_LABELS or ref.startswith("TP") or ref.startswith("H") or ref in ("J2", "J3"):
            f.SetVisible(False)
        if ref in REF_POS:
            x, y, a, s = REF_POS[ref]
            f.SetPosition(pcbnew.VECTOR2I(MM(100 + x), MM(100 + y + YOFF)))
            f.SetTextAngleDegrees(a)
            f.SetTextSize(pcbnew.VECTOR2I(MM(s), MM(s)))
            f.SetTextThickness(MM(s * 0.16))
    for ref, (t, x, y, a, s) in PART_LABELS.items():
        add_text(board, t, x, y, s, S, angle=a)

    # ---------------------------------------------------------------- title + model warning
    add_text(board, "DX TIMESHIFT rev A — SNARE", 24.5, 52.4 + DY, 1.3, S, bold=True)
    add_text(board, "fits Oberheim DX board 1721A (U701). NOT for DXa (U715)", W / 2, 55.9 + DY, 1.1, S, bold=True)

    # ---------------------------------------------------------------- USB warning at the Nano's USB end
    add_text(board, "UNPLUG NANO", 3.0, 40.0 + DY, 1.1, S, angle=90, bold=True)
    add_text(board, "BEFORE USB", 5.2, 40.0 + DY, 1.1, S, angle=90, bold=True)

    # ---------------------------------------------------------------- Nano orientation (pin labels)
    add_text(board, "D12", 15.24, 36.4 + DY, 0.9, S)
    add_text(board, "TX1", 50.8, 36.4 + DY, 0.9, S)
    add_text(board, "D13", 15.24, 46.9 + DY, 0.9, S)
    add_text(board, "VIN", 50.8, 46.9 + DY, 0.9, S)
    add_text(board, "ARDUINO NANO (5V)", 37.0, 41.6 + DY, 1.0, S)
    add_text(board, "USB END LEFT, ON SOCKETS", 37.0, 43.6 + DY, 0.9, S)

    # ---------------------------------------------------------------- J1 DX PLUG
    for k in range(8):   # DIP pin numbers at the plug end, printed next to each header pin
        x = 46.0 + 2.54 * k
        add_text(board, str(1 + k), x, 14.5, 0.8, S)
        add_text(board, str(16 - k), x, 1.8, 0.8, S)
    add_text(board, "DIP", 43.3, 14.5, 0.8, S)
    add_text(board, "DIP", 43.3, 1.8, 0.8, S)
    add_text(board, "DX PLUG", 36.8, 11.0, 1.0, S, bold=True)
    add_text(board, "U1 = ORIGINAL U701 (MC14174B)", 55.6, 16.6, 0.9, S, bold=True)
    add_text(board, "U3 74HC157", 21.6, 15.4, 1.0, S, bold=True)
    add_text(board, "U4 74HC14", 67.8, 48.7 + DY, 1.0, S, bold=True)

    # ---------------------------------------------------------------- U1 legend + notch arrow
    add_text(board, "ORIG. U701 MC14174B", 56.6, 24.8, 0.9, S)
    add_text(board, "NOTCH = PIN 1 END", 47.0, 30.4, 0.9, S, just="left")
    add_poly(board, [(45.4, 30.15), (46.6, 29.6), (46.6, 30.7)], S)

    # ---------------------------------------------------------------- PPQN jumper legend (JP1 at 2.2,17.5)
    add_text(board, "PPQN", 0.8, 5.6, 1.0, S, bold=True, just="left")
    add_text(board, "open=96", 0.8, 7.2, 0.8, S, just="left")
    add_text(board, "JP1 1-2=48", 0.8, 8.7, 0.8, S, just="left")
    add_text(board, "JP1 3-4=24", 0.8, 10.2, 0.8, S, just="left")

    # ---------------------------------------------------------------- test points
    add_text(board, "TP1 REPLAY", 4.0, 28.4, 0.8, S)
    add_text(board, "TP4 GND", 19.5, 3.3, 0.8, S)
    add_text(board, "TP3", 25.0, 2.6, 0.8, S)
    add_text(board, "RST2", 25.0, 4.0, 0.8, S)
    add_text(board, "PLUG", 25.0, 5.4, 0.8, S)
    add_text(board, "TP2", 30.0, 2.6, 0.8, S)
    add_text(board, "RST2", 30.0, 4.0, 0.8, S)
    add_text(board, "CHIP", 30.0, 5.4, 0.8, S)
    add_text(board, "TP5 CLK", 69.5, 30.4 + DY, 0.8, S)

    # ---------------------------------------------------------------- connector legends (right edge)
    add_text(board, "J2 POT", 80.5, 35.2, 1.0, S, bold=True)
    add_text(board, "1 GND", 80.6, 37.0, 0.8, S)
    add_text(board, "2 WIPER", 80.6, 38.5, 0.8, S)
    add_text(board, "3 +5V", 80.6, 40.0, 0.8, S)
    add_text(board, "J3 CLK", 80.5, 43.0, 1.0, S, bold=True)
    add_text(board, "1 R791", 80.6, 44.8, 0.8, S)
    add_text(board, "2 GND", 80.6, 46.3, 0.8, S)

    # ---------------------------------------------------------------- back side
    B = pcbnew.B_SilkS
    cx = 31.7
    add_text(board, "DX TimeShift rev A (snare)", cx, 37.6 + DY, 1.5, B, bold=True)
    add_text(board, "Oberheim DX 1721A / U701 only - NOT DXa", cx, 39.9 + DY, 1.0, B)
    add_text(board, "J1 hdr->DIP: 1-1 2-16 3-2 4-15 5-3 6-14 7-4 8-13", cx, 41.9 + DY, 0.9, B)
    add_text(board, "9-5 10-12 11-6 12-11 13-7 14-10 15-8 16-9", cx, 43.5 + DY, 0.9, B)
    add_text(board, "verify with a meter before power-up", cx, 45.1 + DY, 0.9, B)
