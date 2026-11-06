"""Labelled top-view assembly diagram of the DX TimeShift board (SVG), drawn from the real
board data (positions, courtyards, pads) so it can never disagree with the PCB.

Run inside the kicad/kicad:9.0 container:
    python3 hardware/kicad/tools/gen_diagram.py hardware/renders/assembly-diagram.svg
(build_all.sh converts it to PNG with rsvg-convert.)
"""
import os
import sys
from xml.sax.saxutils import escape

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import netlist as N  # noqa: E402
import gen_pcb as G  # noqa: E402

S = 12.0                 # px per mm
BX, BY = 430.0, 250.0    # board top-left in px
CW, CH = 1880, 1330


def X(mm):
    return BX + mm * S


def Y(mm):
    return BY + mm * S


def mm(v):
    return pcbnew.ToMM(v)


COL = {"U": ("#2b2b2b", "#ffffff"), "J": ("#e9e9e9", "#111111"), "R": ("#e8cf9c", "#3a2a00"),
       "C": ("#e8873a", "#ffffff"), "T": ("#4d8fd6", "#ffffff"), "H": ("#bbbbbb", "#000000")}

# (ref, anchor (board mm), label position (px), lines)
CALLOUTS = [
    ("J1", (55.0, 4.8), (980, 40), ["J1  “DX PLUG”  2x8 shrouded box header",
                                     "16-way ribbon → DIP-16 IDC plug → DX U701 socket",
                                     "pin 1 = ▲ mark; silk numbers = DIP pin at the plug"]),
    ("C1", (36.0, 4.5), (640, 40), ["C1  10 µF electrolytic", "long lead (+) to the ‘+’ pad"]),
    ("TP2", (30.0, 9.6), (395, 40), ["TP2  RST2 chip side", "(U1 pin 15)"]),
    ("TP3", (25.0, 9.6), (330, 140), ["TP3  RST2 plug side", "(mux out \u2192 J1 DIP15)"]),
    ("TP4", (17.6, 8.5), (20, 170), ["TP4  GND", "(scope ground clip)"]),
    ("JP1", (0.4, 19.5), (20, 420), ["JP1  PPQN jumper", "JP1 open = 96 (plain DX)",
                                      "JP1 1-2 = 48 (D10)", "JP1 3-4 = 24 (D11)"]),
    ("TP1", (2.0, 27.5), (20, 548), ["TP1  REPLAY", "pulses on each delayed hit"]),
    ("U3", (11.1, 24.2), (20, 300), ["U3  74HC157 in DIP-16 socket", "bypass/delay multiplexer",
                                      "notch = left end"]),
    ("U2", (8.6, 46.0), (20, 690), ["U2  Arduino Nano v3 (5 V)", "on 2 x 15-pin female headers",
                                     "USB end LEFT, parts side up", "UNPLUG NANO BEFORE USB !"]),
    ("J3", (83.9, 13.7), (1460, 120), ["J3  “CLK”  JST-XH 2-pin", "1 = DX CLOCK OUT (R791 lead)",
                                        "2 = GND"]),
    ("J2", (83.9, 26.5), (1460, 300), ["J2  “POT”  JST-XH 3-pin", "1 = GND (CCW lug)",
                                        "2 = wiper,  3 = +5 V (CW lug)"]),
    ("U1", (66.7, 25.7), (1460, 470), ["U1  DIP-16 socket for the", "ORIGINAL U701 chip (MC14174B)",
                                        "from the DX - notch = left end"]),
    ("TP5", (71.5, 38.5), (1460, 640), ["TP5  CLK_IN", "conditioned clock (Nano D3)"]),
    ("U4", (77.1, 47.0), (1460, 780), ["U4  74HC14 in DIP-14 socket", "clock Schmitt buffer",
                                        "notch = left end (like U1, U3)"]),
]


def main(out):
    board = pcbnew.LoadBoard(G.PCB)
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" '
             'font-family="DejaVu Sans, Arial, sans-serif">' % (CW, CH, CW, CH))
    o.append('<rect width="100%" height="100%" fill="#ffffff"/>')
    o.append('<text x="%d" y="1272" font-size="30" font-weight="bold" fill="#123">DX TimeShift rev A '
             '— assembly view (top side, all parts through-hole)</text>' % 20)
    o.append('<text x="%d" y="1310" font-size="19" fill="#333">Fits Oberheim DX board 1721A (U701). NOT for DXa '
             '(U715).  Board %g x %g mm, 2 layers.  Solder the lowest parts first: resistors, caps, sockets, '
             'headers, connectors.</text>' % (20, G.W, G.H))
    # board
    o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="#1f5a32" stroke="#0b2a16" stroke-width="3"/>'
             % (X(0), Y(0), G.W * S, G.H * S, 2 * S))
    fps = {fp.GetReference(): fp for fp in board.GetFootprints()}
    for ref, fp in sorted(fps.items()):
        cy = fp.GetCourtyard(pcbnew.F_CrtYd).BBox()
        x0, y0, x1, y1 = mm(cy.GetLeft()) - 100, mm(cy.GetTop()) - 100, mm(cy.GetRight()) - 100, mm(cy.GetBottom()) - 100
        k = ref[0]
        if ref.startswith("H"):
            p = fp.GetPosition()
            o.append('<circle cx="%g" cy="%g" r="%g" fill="#ffffff" stroke="#999"/>' % (X(mm(p.x) - 100), Y(mm(p.y) - 100), 1.6 * S))
            continue
        fill, txt = COL.get(k, ("#cccccc", "#000"))
        if ref == "U2":
            fill = "#1d5fc4"
        if ref.startswith("TP"):
            p = fp.GetPosition()
            o.append('<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#fff" stroke-width="2"/>'
                     % (X(mm(p.x) - 100), Y(mm(p.y) - 100), 1.7 * S, fill))
        else:
            pad = 0.25
            o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="4" fill="%s" fill-opacity="0.92" stroke="#000" stroke-width="1"/>'
                     % (X(x0 + pad), Y(y0 + pad), (x1 - x0 - 2 * pad) * S, (y1 - y0 - 2 * pad) * S, fill))
        for p in fp.Pads():
            if not p.GetNumber():
                continue
            c = p.GetPosition()
            col = "#e0b040"
            o.append('<circle cx="%g" cy="%g" r="%g" fill="%s"/>' % (X(mm(c.x) - 100), Y(mm(c.y) - 100), 0.55 * S, col))
            if p.GetNumber() == "1" and not ref.startswith("TP") and len(list(fp.Pads())) > 1:
                o.append('<rect x="%g" y="%g" width="%g" height="%g" fill="#ff2a2a"/>'
                         % (X(mm(c.x) - 100) - 0.6 * S, Y(mm(c.y) - 100) - 0.6 * S, 1.2 * S, 1.2 * S))
        # label inside the body
        cx, cyy = (x0 + x1) / 2, (y0 + y1) / 2
        val = N.BY_REF[ref]["value"]
        short = {"MC14174B (orig. U701)": "ORIGINAL U701", "Arduino Nano v3 (5V)": "ARDUINO NANO",
                 "DX PLUG": "DX PLUG", "POT": "POT", "CLK": "CLK", "PPQN": "PPQN"}.get(val, val)
        vertical = (y1 - y0) > (x1 - x0) * 1.6 and not ref.startswith("TP")
        if ref.startswith("TP"):
            continue
        rot = ' transform="rotate(-90 %g %g)"' % (X(cx), Y(cyy)) if vertical else ""
        fs = 17 if ref[0] in "UJ" else 12
        o.append('<text x="%g" y="%g" font-size="%d" font-weight="bold" fill="%s" text-anchor="middle"%s>%s</text>'
                 % (X(cx), Y(cyy) - (2 if ref[0] in "UJ" else -4), fs, txt, rot,
                    escape(ref if ref[0] in "UJ" else "%s %s" % (ref, short))))
        if ref[0] in "UJ":
            o.append('<text x="%g" y="%g" font-size="13" fill="%s" text-anchor="middle"%s>%s</text>'
                     % (X(cx), Y(cyy) + 16, txt, rot, escape(short)))
    # callouts
    for ref, (ax, ay), (lx, ly), lines in CALLOUTS:
        w = max(len(s) for s in lines) * 10.5 + 20
        h = 26 + 22 * (len(lines) - 1) + 12
        right = lx > X(G.W)
        top = ly < BY - 20
        tx = lx if not right else lx
        # leader
        if right:
            ex, ey = lx, ly + h / 2
        elif top:
            ex, ey = lx + w / 2, ly + h
        else:
            ex, ey = lx + w, ly + h / 2
        o.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#c0392b" stroke-width="2.5"/>' % (X(ax), Y(ay), ex, ey))
        o.append('<circle cx="%g" cy="%g" r="5" fill="#c0392b"/>' % (X(ax), Y(ay)))
        o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="8" fill="#fffbe6" stroke="#c0392b" stroke-width="2"/>'
                 % (tx, ly, w, h))
        for i, s in enumerate(lines):
            o.append('<text x="%g" y="%g" font-size="%d" %s fill="#111">%s</text>'
                     % (tx + 10, ly + 24 + 22 * i, 19 if i == 0 else 16, 'font-weight="bold"' if i == 0 else "", escape(s)))
    # passives legend
    leg = ["R1, R2, R3 = 1 kΩ   (series protection U1 → Nano)", "R4 = 1 kΩ   (pot filter)",
           "R5 = 10 kΩ  (mux select pull-down = bypass)", "R6 = 10 kΩ, R7 = 100 kΩ  (clock input)",
           "C2-C6 = 100 nF ceramic,  C7 = 1 nF ceramic", "C4 at U4 pin 14,  C5 just below the Nano 5V/GND pins", "red square = pin 1"]
    o.append('<rect x="%g" y="%g" width="560" height="%d" rx="8" fill="#f4f8ff" stroke="#36c" stroke-width="2"/>'
             % (X(0), Y(G.H) + 18, 22 * len(leg) + 16))
    for i, s in enumerate(leg):
        o.append('<text x="%g" y="%g" font-size="16" fill="#123">%s</text>' % (X(0) + 12, Y(G.H) + 42 + 22 * i, escape(s)))
    o.append("</svg>")
    open(out, "w").write("\n".join(o))
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1])
