"""Import the Freerouting session into timeshift.kicad_pcb, add the GND pours, fill, save.
Run inside the kicad/kicad:9.0 container after route.sh.

GND is not autorouted: it is carried by the two GND pours (bottom = main plane, top =
ties the bottom islands together). Any GND pad that the pours can only reach with ONE
thermal spoke (because signal tracks pass close by) is switched to a solid zone connection,
so every GND pad has a robust connection (DRC 'starved_thermal' fixed, not suppressed).
"""
import os
import re
import sys

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_pcb as G  # noqa: E402

board = pcbnew.LoadBoard(G.PCB)
assert len(board.Zones()) == 0, "run gen_pcb.py first (fresh, unrouted board)"
ok = pcbnew.ImportSpecctraSES(board, os.path.join(G.PRJ, "timeshift.ses"))
print("SES import:", ok)
G.zone_gnd(board)                                   # main GND plane (brief: pour on bottom)
G.zone_gnd(board, pcbnew.F_Cu, "GND_top")           # top pour: ties the bottom islands together


def fill():
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())


fill()
for _ in range(3):
    rpt = "/tmp/_finish_drc.rpt"
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MM, False)
    txt = open(rpt).read()
    fixed = 0
    for blk in re.split(r"\n(?=\[)", txt):
        if not blk.startswith("[starved_thermal]"):
            continue
        m = re.search(r"PTH pad (\S+) \[GND\] of (\S+)", blk)
        if not m:
            continue
        fp = board.FindFootprintByReference(m.group(2))
        for pad in fp.Pads():
            if pad.GetNumber() == m.group(1):
                pad.SetLocalZoneConnection(pcbnew.ZONE_CONNECTION_FULL)
                print("solid zone connection:", m.group(2), "pad", m.group(1))
                fixed += 1
    if not fixed:
        break
    fill()
pcbnew.SaveBoard(G.PCB, board)
print("saved", G.PCB)
