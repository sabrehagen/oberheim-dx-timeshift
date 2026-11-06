"""Build hardware/kicad/timeshift/timeshift.kicad_pcb (unrouted) with the pcbnew API.

Inputs:  netlist.py (parts, footprints, nets)  +  the netlist KiCad exports from the schematic
         (hardware/kicad/timeshift/reports/timeshift.net) which supplies the symbol UUIDs so
         the PCB is linked to the schematic exactly as "Update PCB from Schematic" would do.
Output:  timeshift.kicad_pcb with footprints placed, nets assigned, board outline, silkscreen,
         GND pour on B.Cu, and timeshift.dsn for the autorouter (route.sh).

Run inside the kicad/kicad:9.0 container:  python3 hardware/kicad/tools/gen_pcb.py
"""
import os
import sys

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import netlist as N  # noqa: E402
from sexp import parse, find, findall  # noqa: E402

PRJ = os.path.normpath(os.path.join(HERE, "..", "timeshift"))
PCB = os.path.join(PRJ, "timeshift.kicad_pcb")
DSN = os.path.join(PRJ, "timeshift.dsn")
NETFILE = os.path.join(PRJ, "reports", "timeshift.net")
FPDIR = os.environ.get("KICAD9_FOOTPRINT_DIR", "/usr/share/kicad/footprints")

MM = pcbnew.FromMM
OX, OY = 100.0, 100.0          # board top-left corner on the KiCad canvas
W, H = 84.0, 63.0
YOFF = 2.0                     # everything except the corner holes moves down: wider channel above J1
DY = 3.0                       # extra routing channel between the IC row and the Nano row              # board size (mm)

# ---------------------------------------------------------------------------- placement
# ref: (x, y, rotation_deg, side)  -- x/y = footprint anchor (pad 1) relative to board top-left
PLACE = {
    # DX interface: J1 plug header (top row = DIP16..9, bottom row = DIP1..8) and U1 below it
    "J1": (46.0, 9.0, 90),
    "U1": (47.27, 27.5, 90),
    "C1": (35.0, 5.0, 0),       # bulk 10uF next to J1 +5V / GND
    "C2": (44.0, 19.0, 270),    # U1 decoupling
    # mux, left of U1, above the Nano's D6..D9
    "U3": (12.7, 26.0, 90),
    "C3": (14.0, 12.5, 0),
    "R5": (9.0, 13.0, 270),
    # series resistors U1 chip side -> Nano inputs
    "R1": (34.3, 15.0, 270),
    "R2": (37.6, 15.0, 270),
    "R3": (40.9, 15.0, 270),
    # Nano, digital row on top, USB end to the left
    "U2": (50.8, 34.0 + DY, 270),
    "C5": (43.18, 52.4 + DY, 0),    # just below Nano pin 27 (+5V) / pin 29 (GND)
    # clock input: J3 -> R6 -> R7/C7 -> U4
    "J3": (81.0, 10.5, 270),
    "R6": (72.0, 9.0, 270),
    "R7": (75.3, 12.0, 270),
    "C7": (68.9, 15.0, 270),
    "U4": (60.2, 45.84 + DY, 90),     # pin 1 bottom-left: notch left, like U1/U3
    "C4": (60.2, 34.2 + DY, 0),      # pad 1 (+5V) 4 mm above U4 pin 14
    # SNARE DELAY pot
    "J2": (81.0, 22.0, 270),
    "R4": (75.3, 25.0, 270),
    "C6": (72.0, 26.0, 270),
    # jumper + test points
    "JP1": (2.2, 17.5, 0),
    "TP1": (4.0, 25.5, 0),
    "TP2": (30.0, 9.5, 0),
    "TP3": (25.0, 9.5, 0),
    "TP4": (19.5, 6.5, 0),
    "TP5": (69.5, 33.5 + DY, 0),
    # M3 holes at the corners
    "H1": (3.5, 3.5, 0),
    "H2": (W - 3.5, 3.5, 0),
    "H3": (3.5, H - 3.5, 0),
    "H4": (W - 3.5, H - 3.5, 0),
}


PLACE = {k: (v[0], v[1] + (0 if k.startswith("H") else YOFF), v[2]) for k, v in PLACE.items()}


def P(x, y):
    return pcbnew.VECTOR2I(MM(OX + x), MM(OY + y))


def load_fp(fpid):
    lib, name = fpid.split(":")
    d = os.path.join(PRJ, "timeshift.pretty") if lib == "timeshift" else os.path.join(FPDIR, lib + ".pretty")
    fp = pcbnew.FootprintLoad(d, name)
    assert fp is not None, fpid
    fp.SetFPID(pcbnew.LIB_ID(lib, name))
    return fp


def symbol_uuids():
    """ref -> symbol UUID path from the KiCad-exported netlist (multi-unit: first unit)."""
    t = parse(open(NETFILE).read())
    out = {}
    for c in findall(find(t, "components"), "comp"):
        ref = str(find(c, "ref")[1])
        ts = find(c, "tstamps")
        out[ref] = str(ts[1])
    return out


def exported_pin_nets():
    """(ref, pin) -> net name, from the schematic's exported netlist."""
    t = parse(open(NETFILE).read())
    out = {}
    for n in findall(find(t, "nets"), "net"):
        name = str(find(n, "name")[1])
        for node in findall(n, "node"):
            out[(str(find(node, "ref")[1]), str(find(node, "pin")[1]))] = name
    return out


def add_text(board, txt, x, y, size=1.0, layer=pcbnew.F_SilkS, angle=0, bold=False, just="center", thick=None):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(txt)
    t.SetPosition(P(x, y))
    t.SetLayer(layer)
    t.SetTextSize(pcbnew.VECTOR2I(MM(size), MM(size)))
    t.SetTextThickness(MM(thick or (size * 0.15 if not bold else size * 0.2)))
    t.SetTextAngleDegrees(angle)
    if layer in (pcbnew.B_SilkS, pcbnew.B_Cu):
        t.SetMirrored(True)
    t.SetHorizJustify({"left": pcbnew.GR_TEXT_H_ALIGN_LEFT, "center": pcbnew.GR_TEXT_H_ALIGN_CENTER,
                       "right": pcbnew.GR_TEXT_H_ALIGN_RIGHT}[just])
    board.Add(t)
    return t


def add_line(board, a, b, layer=pcbnew.F_SilkS, w=0.15):
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(P(*a))
    s.SetEnd(P(*b))
    s.SetLayer(layer)
    s.SetWidth(MM(w))
    board.Add(s)


def add_poly(board, pts, layer=pcbnew.F_SilkS, fill=True, w=0.1):
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_POLY)
    s.SetPolyPoints([P(*p) for p in pts])
    s.SetLayer(layer)
    s.SetFilled(fill)
    s.SetWidth(MM(w))
    board.Add(s)


def outline(board, r=2.0):
    """Rectangle with rounded corners on Edge.Cuts."""
    segs = [((r, 0), (W - r, 0)), ((W, r), (W, H - r)), ((W - r, H), (r, H)), ((0, H - r), (0, r))]
    for a, b in segs:
        add_line(board, a, b, pcbnew.Edge_Cuts, 0.1)
    k = r * (1 - 0.70710678)
    for (sx, sy), (mx, my), (ex, ey) in (((0, r), (k, k), (r, 0)), ((W - r, 0), (W - k, k), (W, r)),
                                         ((W, H - r), (W - k, H - k), (W - r, H)), ((r, H), (k, H - k), (0, H - r))):
        arc = pcbnew.PCB_SHAPE(board)
        arc.SetShape(pcbnew.SHAPE_T_ARC)
        arc.SetArcGeometry(P(sx, sy), P(mx, my), P(ex, ey))
        arc.SetLayer(pcbnew.Edge_Cuts)
        arc.SetWidth(MM(0.1))
        board.Add(arc)


def setup_rules(board):
    ds = board.GetDesignSettings()
    ds.m_TrackMinWidth = MM(0.25)
    ds.m_MinClearance = MM(0.2)
    ds.m_ViasMinSize = MM(0.6)
    ds.m_MinThroughDrill = MM(0.3)
    ds.m_CopperEdgeClearance = MM(0.5)
    ds.m_HoleClearance = MM(0.25)
    ds.m_HoleToHoleMin = MM(0.25)
    ds.m_SolderMaskExpansion = MM(0.05)
    ds.m_SolderMaskMinWidth = MM(0.0)
    ns = ds.m_NetSettings
    d = ns.GetDefaultNetclass()
    d.SetTrackWidth(MM(0.5))
    d.SetClearance(MM(0.2))
    d.SetViaDiameter(MM(1.0))
    d.SetViaDrill(MM(0.5))
    pw = pcbnew.NETCLASS("Power")
    pw.SetTrackWidth(MM(0.8))
    pw.SetClearance(MM(0.2))
    pw.SetViaDiameter(MM(1.0))
    pw.SetViaDrill(MM(0.5))
    pw.SetPriority(1)
    ns.SetNetclass("Power", pw)
    ns.SetNetclassPatternAssignment("+5V", "Power")
    ns.SetNetclassPatternAssignment("GND", "Power")
    ds.m_TrackWidthList.clear() if hasattr(ds.m_TrackWidthList, "clear") else None
    for w in (0.0, 0.5, 0.8):
        ds.m_TrackWidthList.append(MM(w))
    ds.SetBoardThickness(MM(1.6))


def build():
    board = pcbnew.NewBoard(PCB)
    setup_rules(board)
    board.GetDesignSettings().SetCopperLayerCount(2)
    tb = board.GetTitleBlock()
    tb.SetTitle("DX TimeShift - snare delay interposer")
    tb.SetRevision("A")
    tb.SetDate("2026-11-06")
    tb.SetCompany("DX TimeShift project")
    tb.SetComment(0, "Fits Oberheim DX board 1721A (U701). NOT for DXa (U715).")
    tb.SetComment(1, "2 layers, 1.6 mm FR4, 1 oz Cu, all through-hole")

    uuids = symbol_uuids()
    # Pad nets come from the netlist KiCad exported from the schematic (check_netlist.py has
    # already proven it equal to netlist.py); this also carries KiCad's "unconnected-(...)"
    # nets for pins with a no-connect flag, so schematic parity is exact.
    pin_net = exported_pin_nets()
    nets = {}
    for full in sorted(set(pin_net.values())):
        ni = pcbnew.NETINFO_ITEM(board, full)
        board.Add(ni)
        nets[full] = ni
    for c in N.COMPONENTS:
        for pin, name in c["pins"].items():
            if name:
                full = pin_net[(c["ref"], str(pin))]
                assert full.lstrip("/") == name, (c["ref"], pin, full, name)

    fps = {}
    for c in N.COMPONENTS:
        fp = load_fp(c["footprint"])
        fp.SetReference(c["ref"])
        fp.SetValue(c["value"])
        fp.SetPath(pcbnew.KIID_PATH("/" + uuids[c["ref"]]))
        fp.SetSheetname("/")
        fp.SetSheetfile("timeshift.kicad_sch")
        for k, v in [("Description", c["desc"])] + list(c["fields"].items()):
            fp.SetField(k, v)
            f = fp.GetFieldByName(k)
            f.SetVisible(False)
            f.SetLayer(pcbnew.F_Fab)
        if c["ref"].startswith("H"):
            fp.SetExcludedFromBOM(True)
        x, y, rot = PLACE[c["ref"]]
        fp.SetPosition(P(x, y))
        fp.SetOrientationDegrees(rot)
        board.Add(fp)
        for pad in fp.Pads():
            full = pin_net.get((c["ref"], pad.GetNumber()))
            if full:
                pad.SetNet(nets[full])
        fps[c["ref"]] = fp
    outline(board)
    return board, fps


def zone_gnd(board, layer=pcbnew.B_Cu, name="GND_bottom"):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    z.SetNetCode(board.FindNet("GND").GetNetCode())
    z.SetAssignedPriority(0)
    z.SetLocalClearance(MM(0.3))
    z.SetMinThickness(MM(0.25))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(MM(0.5))
    z.SetThermalReliefSpokeWidth(MM(0.5))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    z.SetZoneName(name)
    ol = z.Outline()
    ol.NewOutline()
    m = 0.0
    for x, y in ((m, m), (W - m, m), (W - m, H - m), (m, H - m)):
        ol.Append(MM(OX + x), MM(OY + y))
    board.Add(z)
    return z


def export_dsn(board, strip_gnd=False):
    """DSN for the autorouter. With strip_gnd (default) the GND pads are presented to the
    router as plain obstacles: GND is carried by the copper pours (finish_pcb.py), which
    leaves room for 0.5/0.8 mm tracks everywhere without any neck-down."""
    gnd = board.FindNet("GND")
    stripped = []
    for pad in board.GetPads():
        if strip_gnd and pad.GetNetCode() == gnd.GetNetCode():
            pad.SetNetCode(0)
            stripped.append(pad)
    ok = pcbnew.ExportSpecctraDSN(board, DSN)
    for pad in stripped:
        pad.SetNet(gnd)
    inset_dsn_boundary(DSN, 0.4)
    return ok


def inset_dsn_boundary(path, d, r=2.0):
    """Freerouting only keeps its normal 0.2 mm clearance from the board outline; the board
    rule is 0.5 mm copper-to-edge. Replace the DSN boundary by the outline inset by d."""
    import math
    import re
    txt = open(path).read()
    pts = []
    rr = r - d
    corners = ((W - r, r, -90), (W - r, H - r, 0), (r, H - r, 90), (r, r, 180))  # board coords
    for cx, cy, a0 in corners:
        for k in range(9):
            a = math.radians(a0 + 90 * k / 8)
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            pts.append((round((OX + x) * 1000), round(-(OY + y) * 1000)))
    pts.append(pts[0])
    body = " ".join("%d %d" % p for p in pts)
    txt, n = re.subn(r"\(boundary\s*\(path pcb 0[^)]*\)\s*\)", "(boundary (path pcb 0 %s))" % body, txt, count=1)
    assert n == 1, "DSN boundary not found"
    open(path, "w").write(txt)


if __name__ == "__main__":
    board, fps = build()
    import silk  # noqa: E402  (silkscreen texts live in silk.py)
    silk.add_all(board, fps,
                 lambda b, t, x, y, *a, **k: add_text(b, t, x, y + YOFF, *a, **k),
                 add_line,
                 lambda b, pts, *a, **k: add_poly(b, [(x, y + YOFF) for x, y in pts], *a, **k),
                 W, H, DY, YOFF)
    pcbnew.SaveBoard(PCB, board)
    ok = export_dsn(board, strip_gnd=os.environ.get("STRIP_GND", "1") == "1")
    print("wrote", PCB, "and", DSN, ok)
