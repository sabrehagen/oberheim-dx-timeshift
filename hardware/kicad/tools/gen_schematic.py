"""Generate hardware/kicad/timeshift/timeshift.kicad_sch (KiCad 9) from netlist.py.

Every part, value, footprint and pin->net assignment comes from netlist.py (the single
source of truth, = PROJECT_BRIEF.md 3.5). This file only decides WHERE things are drawn.
Library symbols are copied from the KiCad standard libraries (and the project library
timeshift.kicad_sym for J1) and embedded in the schematic, as KiCad itself does.

Run inside the kicad/kicad:9.0 container:  python3 hardware/kicad/tools/gen_schematic.py
"""
import copy
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sexp import parse, dump, Sym, find, findall, q  # noqa: E402
import netlist as N  # noqa: E402

PRJ = os.path.normpath(os.path.join(HERE, "..", "timeshift"))
SYMDIR = os.environ.get("KICAD9_SYMBOL_DIR", "/usr/share/kicad/symbols")
OUT = os.path.join(PRJ, "timeshift.kicad_sch")
POWER = {"+5V", "GND"}
G = 2.54

# --------------------------------------------------------------------------- library
_libs = {}


def _lib(lib):
    if lib not in _libs:
        path = os.path.join(PRJ, "timeshift.kicad_sym") if lib == "timeshift" else os.path.join(SYMDIR, lib + ".kicad_sym")
        tree = parse(open(path).read())
        _libs[lib] = {s[1]: s for s in findall(tree, "symbol")}
    return _libs[lib]


_embedded = {}


def lib_symbol(lib_id):
    """Return the flattened library symbol, renamed to lib_id (as embedded in a schematic)."""
    if lib_id in _embedded:
        return _embedded[lib_id]
    lib, name = lib_id.split(":")
    syms = _lib(lib)
    s = copy.deepcopy(syms[name])
    ext = find(s, "extends")
    if ext:
        parent = copy.deepcopy(syms[ext[1]])
        props = findall(s, "property")
        head, subs, tail = [], [], []
        for item in parent[2:]:
            if isinstance(item, list) and item[0] == "property":
                continue
            if isinstance(item, list) and item[0] == "symbol":
                item[1] = name + item[1][len(ext[1]):]
                subs.append(item)
            elif isinstance(item, list) and item[0] == "embedded_fonts":
                tail.append(item)
            else:
                head.append(item)
        s = [Sym("symbol"), lib_id] + head + props + subs + (tail or [[Sym("embedded_fonts"), Sym("no")]])
    else:
        s[1] = lib_id
    _embedded[lib_id] = s
    return s


def lib_pins(lib_id, unit):
    """{number: (x, y, angle, length, name, etype)} for one unit (unit-0 pins included)."""
    s = lib_symbol(lib_id)
    out = {}
    for sub in findall(s, "symbol"):
        parts = sub[1].rsplit("_", 2)
        u, style = int(parts[1]), int(parts[2])
        if u not in (0, unit) or style not in (0, 1):
            continue
        for p in findall(sub, "pin"):
            at = find(p, "at")
            out[str(find(p, "number")[1])] = (float(at[1]), float(at[2]), float(at[3]),
                                              float(find(p, "length")[1]), str(find(p, "name")[1]), str(p[1]))
    return out


def lib_prop(lib_id, key):
    for p in findall(lib_symbol(lib_id), "property"):
        if p[1] == key:
            at = find(p, "at")
            return str(p[2]), (float(at[1]), float(at[2]), float(at[3]) if len(at) > 3 else 0.0)
    return "", (0.0, 0.0, 0.0)


# --------------------------------------------------------------------------- geometry
def r2(v):
    return round(v + 0.0, 4)


def xform(px, py, rot, mirror):
    """lib (y up) -> offset in schematic (y down)."""
    if mirror == "y":
        px = -px
    elif mirror == "x":
        py = -py
    a = math.radians(rot)
    x = px * math.cos(a) - py * math.sin(a)
    y = px * math.sin(a) + py * math.cos(a)
    return r2(x), r2(-y)


class Placed:
    def __init__(self, sch, ref, lib_id, x, y, rot, mirror, unit):
        self.sch, self.ref, self.lib_id, self.x, self.y, self.rot, self.mirror, self.unit = \
            sch, ref, lib_id, x, y, rot, mirror, unit
        self.pins = lib_pins(lib_id, unit)

    def pin(self, num):
        px, py, ang, _l, _n, _t = self.pins[str(num)]
        dx, dy = xform(px, py, self.rot, self.mirror)
        ox, oy = xform(-math.cos(math.radians(ang)), -math.sin(math.radians(ang)), self.rot, self.mirror)
        return (r2(self.x + dx), r2(self.y + dy)), (round(ox), round(oy))


class Schematic:
    def __init__(self):
        self.items = []
        self.symbols = []
        self.used_libs = []
        self.pwr_n = 0
        self.flg_n = 0
        self.uid_n = 0

    def uid(self, *k):
        self.uid_n += 1
        return N.uid("sch", self.uid_n, *k)

    # ----- primitives
    def wire(self, a, b):
        if a == b:
            return
        self.items.append('(wire (pts (xy %s %s) (xy %s %s)) (stroke (width 0) (type default)) (uuid "%s"))'
                          % (r2(a[0]), r2(a[1]), r2(b[0]), r2(b[1]), self.uid("w")))

    def poly(self, *pts):
        for a, b in zip(pts, pts[1:]):
            self.wire(a, b)

    def junction(self, p):
        self.items.append('(junction (at %s %s) (diameter 0) (color 0 0 0 0) (uuid "%s"))' % (r2(p[0]), r2(p[1]), self.uid("j")))

    def nc(self, p):
        self.items.append('(no_connect (at %s %s) (uuid "%s"))' % (r2(p[0]), r2(p[1]), self.uid("nc")))

    def label(self, name, p, d):
        ang = {(-1, 0): 180, (1, 0): 0, (0, -1): 90, (0, 1): 270}[d]
        just = "left bottom" if ang in (0, 90) else "right bottom"
        self.items.append('(label %s (at %s %s %d) (effects (font (size 1.27 1.27)) (justify %s)) (uuid "%s"))'
                          % (q(name), r2(p[0]), r2(p[1]), ang, just, self.uid("l")))

    def text(self, s, p, size=1.27, bold=False, just="left top"):
        b = " (bold yes)" if bold else ""
        self.items.append('(text %s (exclude_from_sim no) (at %s %s 0) (effects (font (size %s %s)%s) (justify %s)) (uuid "%s"))'
                          % (q(s), r2(p[0]), r2(p[1]), size, size, b, just, self.uid("t")))

    def rect(self, a, b, title=None):
        self.items.append('(rectangle (start %s %s) (end %s %s) (stroke (width 0.254) (type dash) (color 72 72 160 1)) '
                          '(fill (type none)) (uuid "%s"))' % (r2(a[0]), r2(a[1]), r2(b[0]), r2(b[1]), self.uid("r")))
        if title:
            self.text(title, (a[0] + 1.27, a[1] + 3.3), size=2.0, bold=True, just="left bottom")

    # ----- symbols
    def _use(self, lib_id):
        if lib_id not in self.used_libs:
            self.used_libs.append(lib_id)

    def _field(self, key, val, p, rot_sym, hide=False, just=None, size=1.27):
        # field angle is stored relative to the symbol: 90 on a 90/270 symbol = horizontal text
        ang = 90 if rot_sym in (90, 270) else 0
        j = " (justify %s)" % just if just else ""
        h = " (hide yes)" if hide else ""
        return '(property %s %s (at %s %s %d) (effects (font (size %s %s))%s%s))' % (
            q(key), q(val), r2(p[0]), r2(p[1]), ang, size, size, j, h)

    def place(self, comp, x, y, rot=0, mirror=None, unit=1, ref_at=None, val_at=None,
              ref_just=None, val_just=None, hide_value=False):
        lib_id = comp["lib_id"]
        self._use(lib_id)
        P = Placed(self, comp["ref"], lib_id, x, y, rot, mirror, unit)
        uuid = N.uid("sym", comp["ref"], unit)
        if ref_at is None:
            _, (px, py, _a) = lib_prop(lib_id, "Reference")
            ref_at = (x + xform(px, py, rot, mirror)[0], y + xform(px, py, rot, mirror)[1])
        if val_at is None:
            _, (px, py, _a) = lib_prop(lib_id, "Value")
            val_at = (x + xform(px, py, rot, mirror)[0], y + xform(px, py, rot, mirror)[1])
        fields = [self._field("Reference", comp["ref"], ref_at, rot, just=ref_just),
                  self._field("Value", comp["value"], val_at, rot, just=val_just, hide=hide_value),
                  self._field("Footprint", comp["footprint"], (x, y), rot, hide=True),
                  self._field("Datasheet", lib_prop(lib_id, "Datasheet")[0] or "~", (x, y), rot, hide=True),
                  self._field("Description", comp["desc"], (x, y), rot, hide=True)]
        for k, v in comp["fields"].items():
            fields.append(self._field(k, v, (x, y), rot, hide=True))
        pins = "".join('(pin %s (uuid "%s"))' % (q(n), N.uid("pin", comp["ref"], n)) for n in sorted(P.pins, key=lambda s: (len(s), s)))
        mir = " (mirror %s)" % mirror if mirror else ""
        in_bom = "no" if comp["ref"].startswith("H") else "yes"
        self.symbols.append(
            '(symbol (lib_id %s) (at %s %s %d)%s (unit %d) (exclude_from_sim no) (in_bom %s) (on_board yes) (dnp no) '
            '(uuid "%s") %s %s (instances (project "%s" (path "/%s" (reference %s) (unit %d)))))'
            % (q(lib_id), r2(x), r2(y), rot, mir, unit, in_bom, uuid, " ".join(fields), pins,
               N.PROJECT, N.ROOT_UUID, q(comp["ref"]), unit))
        return P

    def power(self, net, p, body_dir=None):
        """Place a power symbol whose connection point is p, body pointing body_dir."""
        lib_id = "power:" + net
        self._use(lib_id)
        self.pwr_n += 1
        ref = "#PWR%02d" % self.pwr_n
        default = (0, 1) if net == "GND" else (0, -1)
        body_dir = body_dir or default
        rot = {(0, 1): 0, (-1, 0): 270, (1, 0): 90, (0, -1): 180}[body_dir] if net == "GND" else \
            {(0, -1): 0, (-1, 0): 90, (1, 0): 270, (0, 1): 180}[body_dir]
        off = 3.81 if net == "GND" else 3.81
        vp = (p[0] + body_dir[0] * (off + (2.2 if body_dir[0] else 0)), p[1] + body_dir[1] * off)
        uuid = N.uid("pwr", self.pwr_n)
        f = [self._field("Reference", ref, p, rot, hide=True),
             self._field("Value", net, vp, rot),
             self._field("Footprint", "", p, rot, hide=True),
             self._field("Datasheet", "", p, rot, hide=True),
             self._field("Description", "Power symbol: %s" % net, p, rot, hide=True)]
        self.symbols.append(
            '(symbol (lib_id %s) (at %s %s %d) (unit 1) (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no) '
            '(uuid "%s") %s (pin "1" (uuid "%s")) (instances (project "%s" (path "/%s" (reference "%s") (unit 1)))))'
            % (q(lib_id), r2(p[0]), r2(p[1]), rot, uuid, " ".join(f), N.uid("pwrpin", self.pwr_n),
               N.PROJECT, N.ROOT_UUID, ref, ))

    def pwr_flag(self, p):
        lib_id = "power:PWR_FLAG"
        self._use(lib_id)
        self.flg_n += 1
        ref = "#FLG%02d" % self.flg_n
        f = [self._field("Reference", ref, (p[0], p[1] - 1.9), 0, hide=True),
             self._field("Value", "PWR_FLAG", (p[0], p[1] - 3.81), 0),
             self._field("Footprint", "", p, 0, hide=True),
             self._field("Datasheet", "~", p, 0, hide=True),
             self._field("Description", "Special symbol for telling ERC where power comes from", p, 0, hide=True)]
        self.symbols.append(
            '(symbol (lib_id %s) (at %s %s 0) (unit 1) (exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no) '
            '(uuid "%s") %s (pin "1" (uuid "%s")) (instances (project "%s" (path "/%s" (reference "%s") (unit 1)))))'
            % (q(lib_id), r2(p[0]), r2(p[1]), N.uid("flg", self.flg_n), " ".join(f), N.uid("flgpin", self.flg_n),
               N.PROJECT, N.ROOT_UUID, ref))

    # ----- composite helpers
    def term(self, P, pin, net=None, stub=G, style="dir"):
        """Terminate a pin: label / power symbol / no-connect, with a short stub wire.
        style for power on side pins: 'dir' = symbol points away, 'down'/'up' = elbow."""
        p, d = P.pin(pin)
        if net is None:
            net = N.BY_REF[P.ref]["pins"].get(int(pin)) if str(pin).isdigit() else None
        if not net:
            self.nc(p)
            return p
        e = (r2(p[0] + d[0] * stub), r2(p[1] + d[1] * stub))
        self.wire(p, e)
        if net in POWER:
            if style in ("down", "up") and d[1] == 0:
                v = 1 if style == "down" else -1
                e2 = (e[0], r2(e[1] + v * G))
                self.wire(e, e2)
                self.power(net, e2, (0, v))
            else:
                self.power(net, e, d)
        else:
            self.label(net, e, d)
        return e

    def check(self, P, pin, net):
        want = N.BY_REF[P.ref]["pins"].get(int(pin))
        assert want == net, "%s.%s drawn as %s but netlist says %s" % (P.ref, pin, net, want)

    # ----- output
    def save(self, path, paper="A3", title_block=""):
        libs = "\n".join(dump(lib_symbol(l), 1) for l in self.used_libs)
        body = "\n\t".join(self.items + self.symbols)
        txt = ('(kicad_sch (version 20250114) (generator "eeschema") (generator_version "9.0")\n'
               '\t(uuid "%s")\n\t(paper "%s")\n\t%s\n\t(lib_symbols\n%s\n\t)\n\t%s\n'
               '\t(sheet_instances (path "/" (page "1")))\n\t(embedded_fonts no)\n)\n'
               % (N.ROOT_UUID, paper, title_block, libs, body))
        open(path, "w").write(txt)


# =========================================================================== drawing
def build():
    S = Schematic()
    C = N.BY_REF
    S.text("DX TimeShift rev A  -  snare delay interposer for the Oberheim DX", (20.32, 19.05), size=3.0, bold=True)
    S.text("Fits Oberheim DX processor board 1721A (U701).  NOT for DXa (board 1906, U715: snare lines are on U715 pins 7/5/2).\n"
           "UNPLUG NANO BEFORE USB: flash the Nano OUT of the board, or only with the DX switched on "
           "(the Nano 5V pin is the DX logic rail).\n"
           "Implements PROJECT_BRIEF.md 3.5 (LOCKED). Signal facts: docs/research/dx-findings.md sections b, c, d, h.",
           (20.32, 29.21), size=1.5)

    # ------------------------------------------------------------ block A: plug + socket
    S.rect((15.24, 40.64), (165.1, 129.54), "A. DX socket interface (J1 = plug to DX, U1 = original U701)")
    J1 = S.place(C["J1"], 50.8, 78.74, ref_at=(50.8, 66.04), val_at=(50.8, 93.98))
    for hdr in range(1, 17):
        net = N.j1_net(hdr)
        S.term(J1, hdr, net, style="up" if net == "+5V" else "down")
    S.text("J1 pin number = box-header pin = ribbon conductor.\n"
           "J1 pin NAME (DIPn) = DIP-16 plug pin = DX U701 socket pin.\n"
           "IDC mapping (header->DIP): 1->1 2->16 3->2 4->15 5->3 6->14\n"
           "7->4 8->13 9->5 10->12 11->6 12->11 13->7 14->10 15->8 16->9.\n"
           "TO BE CONFIRMED with a continuity meter before first power-up.\n"
           "DIP 10/12/15 (snare) come from the mux U3, never from U1.",
           (20.32, 106.68), size=1.27)

    U1 = S.place(C["U1"], 127.0, 78.74, ref_at=(129.54, 63.5), val_at=(129.54, 97.79),
                 ref_just="left", val_just="left")
    for pin in range(1, 17):
        S.term(U1, pin)
    S.text("U1 = DIP-16 SOCKET. Fit the ORIGINAL U701\n"
           "(MC14174B / 74C174) taken out of the DX.\n"
           "Notch/pin 1 as marked on the PCB.\n"
           "Pins 10/12/15 (FFB2/FFA2/RST2) are intercepted;\n"
           "all other pins go straight to J1 (same DIP pin).",
           (100.33, 109.22), size=1.27)

    # ------------------------------------------------------------ block B: mux
    S.rect((170.18, 40.64), (276.86, 129.54), "B. Bypass / delay multiplexer")
    U3 = S.place(C["U3"], 228.6, 78.74, ref_at=(231.14, 58.42), val_at=(231.14, 101.6),
                 ref_just="left", val_just="left")
    for pin in range(1, 17):
        S.term(U3, pin, style="dir")
    S.text("74HC157: I0x = input A (bypass), I1x = input B (delayed),\n"
           "Zx = output Y.  S LOW = A = bypass (R5 pulls S low when the Nano\n"
           "is off / in reset / unprogrammed), S HIGH = B = delayed replay.\n"
           "Channel 1 = RST2, 2 = FFA2, 3 = FFB2, 4 unused (inputs to GND).",
           (175.26, 116.84), size=1.27)

    # ------------------------------------------------------------ block C: jumper, pull-down, test points
    S.rect((281.94, 40.64), (403.86, 129.54), "C. PPQN jumper, mux pull-down, test points")
    JP1 = S.place(C["JP1"], 299.72, 63.5, ref_at=(300.99, 57.15), val_at=(300.99, 71.12))
    S.term(JP1, 1)
    S.term(JP1, 3)
    p2, _ = JP1.pin(2)
    p4, _ = JP1.pin(4)
    a, b = (p2[0] + G, p2[1]), (p4[0] + G, p4[1])
    S.poly(p2, a, b)
    S.wire(p4, b)
    S.junction(b)
    S.wire(b, (b[0], b[1] + G))
    S.power("GND", (b[0], b[1] + G))
    S.check(JP1, 2, "GND")
    S.check(JP1, 4, "GND")
    S.text("PPQN (Nano D10/D11, internal pull-ups):\n"
           "JP1 both open = 96 (default, plain DX)\n"
           "JP1 1-2 closed (D10) = 48\n"
           "JP1 3-4 closed (D11) = 24 (DXa/Stretch/MIDI slaved)",
           (287.02, 81.28), size=1.27)

    R5 = S.place(C["R5"], 304.8, 104.14, rot=90, ref_at=(304.8, 101.6), val_at=(304.8, 106.68))
    S.term(R5, 1)
    S.term(R5, 2, style="down")
    S.text("R5: MUX_SEL pull-down\n= bypass by default", (287.02, 119.38), size=1.27)

    for i, ref in enumerate(["TP1", "TP2", "TP3", "TP4", "TP5"]):
        y = 60.96 + 12.7 * i
        TP = S.place(C[ref], 375.92, y, ref_at=(378.46, y - 3.81), val_at=(378.46, y - 1.27),
                     ref_just="left", val_just="left")
        p, _ = TP.pin(1)
        net = C[ref]["pins"][1]
        e = (p[0] - 3 * G, p[1])
        S.wire(p, e)
        if net in POWER:
            S.power(net, e, (0, 1))
        else:
            S.label(net, e, (-1, 0))
    S.text("Test points (scope):\nTP1 replay pulse, TP2 RST2 chip side,\nTP3 RST2 plug side, TP4 GND, TP5 clock",
           (330.2, 119.38), size=1.27)

    # ------------------------------------------------------------ block D: Nano
    S.rect((15.24, 134.62), (140.97, 238.76), "D. Arduino Nano (U2) on 2 x 1x15 female headers")
    U2 = S.place(C["U2"], 101.6, 190.5, ref_at=(110.49, 161.29), val_at=(110.49, 163.83),
                 ref_just="left", val_just="left")
    for pin in range(1, 31):
        net = C["U2"]["pins"].get(pin)
        if pin == 29:   # second GND pin: joined to pin 4 below
            continue
        if pin == 4:
            p4, _ = U2.pin(4)
            p29, _ = U2.pin(29)
            a = (p4[0], p4[1] + G)
            b = (p29[0], p29[1] + G)
            S.poly(p4, a, b)
            S.wire(p29, b)
            S.junction(b)
            S.wire(b, (b[0], b[1] + G))
            S.power("GND", (b[0], b[1] + G))
            continue
        S.term(U2, pin, net, stub=G)
    S.text("D13 = LED_ACT: the Nano's own\n'L' LED (no external part)", (52.07, 214.63), size=1.27)
    S.text("U2 +5V is the DX logic rail (via J1 DIP16).\nUNPLUG NANO BEFORE USB.", (52.07, 229.87), size=1.27)
    S.text("Series protection 1k\n(U1 outputs -> Nano inputs)", (20.32, 152.4), size=1.27)
    for i, ref in enumerate(["R1", "R2", "R3"]):
        y = 162.56 + 10.16 * i
        R = S.place(C[ref], 40.64, y, rot=90, ref_at=(40.64, y - 2.54), val_at=(40.64, y + 2.54))
        S.term(R, 1)
        S.term(R, 2)

    # ------------------------------------------------------------ block E: clock conditioning
    S.rect((146.05, 134.62), (276.86, 238.76), "E. DX clock input (96 PPQN tick, rising edge)")
    J3 = S.place(C["J3"], 157.48, 167.64, mirror="y", ref_at=(156.21, 162.56), val_at=(156.21, 175.26))
    p1, _ = J3.pin(1)
    p2, _ = J3.pin(2)
    R6 = S.place(C["R6"], 175.26, p1[1], rot=90, ref_at=(175.26, p1[1] - 2.54), val_at=(175.26, p1[1] + 2.54))
    r6a, _ = R6.pin(1)
    r6b, _ = R6.pin(2)
    S.wire(p1, r6a)
    S.label("CLK_TAP", p1, (1, 0))
    S.check(J3, 1, "CLK_TAP")
    S.check(R6, 1, "CLK_TAP")
    e = (p2[0] + G, p2[1])
    S.wire(p2, e)
    S.wire(e, (e[0], e[1] + G))
    S.power("GND", (e[0], e[1] + G))
    nx = 185.42
    node = (nx, p1[1])
    S.wire(r6b, node)
    R7 = S.place(C["R7"], nx, p1[1] + 7.62, ref_at=(nx + 2.54, p1[1] + 6.35), val_at=(nx + 2.54, p1[1] + 8.89),
                 ref_just="left", val_just="left")
    C7 = S.place(C["C7"], nx + 12.7, p1[1] + 7.62, ref_at=(nx + 15.24, p1[1] + 6.35), val_at=(nx + 15.24, p1[1] + 8.89),
                 ref_just="left", val_just="left")
    r7t, _ = R7.pin(1)
    c7t, _ = C7.pin(1)
    S.wire(node, r7t)
    cnode = (c7t[0], p1[1])
    S.wire(node, cnode)
    S.wire(cnode, c7t)
    S.junction(node)
    S.junction(cnode)
    S.label("CLK_RC", cnode, (1, 0))
    S.term(R7, 2)
    S.term(C7, 2)
    for P, pin, net in ((R6, 2, "CLK_RC"), (R7, 1, "CLK_RC"), (C7, 1, "CLK_RC"), (R7, 2, "GND"), (C7, 2, "GND")):
        S.check(P, pin, net)
    U4A = S.place(C["U4"], 223.52, p1[1], unit=1, ref_at=(223.52, p1[1] - 5.08), val_at=(223.52, p1[1] + 5.08))
    ia, _ = U4A.pin(1)
    oa, _ = U4A.pin(2)
    S.wire(cnode, ia)
    U4B = S.place(C["U4"], 251.46, p1[1], unit=2, ref_at=(251.46, p1[1] - 5.08), val_at=(251.46, p1[1] + 5.08))
    ib, _ = U4B.pin(3)
    ob, _ = U4B.pin(4)
    S.wire(oa, ib)
    S.label("CLK_INV", oa, (1, 0))
    S.term(U4B, 4, "CLK_IN")
    S.check(U4A, 1, "CLK_RC")
    S.check(U4A, 2, "CLK_INV")
    S.check(U4B, 3, "CLK_INV")
    S.check(U4B, 4, "CLK_IN")
    S.text("J3 pin 1 -> DX CLOCK OUT node: R791 lead on the Q709-collector side\n"
           "(0/5 V, idles low, rising edge = tick). Clip-on grabber or tack solder.\n"
           "R6 10k series + R7 100k pull-down + C7 1nF -> two Schmitt inverters\n"
           "in series = non-inverting: rising edge at R791 = rising edge at D3.",
           (151.13, 151.13), size=1.27)
    # unused gates
    S.text("Unused 74HC14 gates: inputs to GND, outputs open", (151.13, 198.12), size=1.27)
    for i, (unit, pin_in, pin_out) in enumerate(((3, 5, 6), (4, 9, 8), (5, 11, 10), (6, 13, 12))):
        x = 160.02 + 22.86 * i
        U = S.place(C["U4"], x, 208.28, unit=unit, ref_at=(x, 203.2), val_at=(x, 213.36), hide_value=True)
        S.term(U, pin_in, style="down")
        S.term(U, pin_out)
    UP = S.place(C["U4"], 254.0, 218.44, unit=7, ref_at=(261.62, 215.9), val_at=(261.62, 220.98),
                 ref_just="left", val_just="left")
    S.term(UP, 14)
    S.term(UP, 7)

    # ------------------------------------------------------------ block F: pot + power
    S.rect((281.94, 134.62), (403.86, 238.76), "F. SNARE DELAY pot, power, decoupling, mounting")
    J2 = S.place(C["J2"], 294.64, 157.48, rot=180, ref_at=(292.1, 151.13), val_at=(292.1, 163.83))
    for pin in (1, 3):
        S.term(J2, pin, style="down" if pin == 1 else "up")
    w, _ = J2.pin(2)
    R4 = S.place(C["R4"], 317.5, w[1], rot=90, ref_at=(317.5, w[1] - 2.54), val_at=(317.5, w[1] + 2.54))
    r4a, _ = R4.pin(1)
    r4b, _ = R4.pin(2)
    S.wire(w, r4a)
    S.label("POT_WIPER", w, (1, 0))
    S.check(J2, 2, "POT_WIPER")
    S.check(R4, 1, "POT_WIPER")
    welb = 327.66
    cn = (welb, w[1])
    S.wire(r4b, cn)
    C6 = S.place(C["C6"], welb, w[1] + 7.62, ref_at=(welb + 2.54, w[1] + 6.35), val_at=(welb + 2.54, w[1] + 8.89),
                 ref_just="left", val_just="left")
    c6t, _ = C6.pin(1)
    S.wire(cn, c6t)
    S.junction(cn)
    S.term(C6, 2)
    lp = (cn[0] + 5.08, cn[1])
    S.wire(cn, lp)
    S.label("POT_W", lp, (1, 0))
    S.check(R4, 2, "POT_W")
    S.check(C6, 1, "POT_W")
    S.text("J2 -> rear-panel 10k lin pot \"SNARE DELAY 0 <-> 1 BEAT\":\n"
           "1 = CCW lug (GND), 2 = wiper, 3 = CW lug (+5V).\nR4 + C6 = RC filter into A0.",
           (287.02, 180.34), size=1.27)

    # decoupling row
    for i, ref in enumerate(["C1", "C2", "C3", "C4", "C5"]):
        x = 292.1 + 12.7 * i
        Cx = S.place(C[ref], x, 205.74, ref_at=(x + 2.54, 204.47), val_at=(x + 2.54, 207.01),
                     ref_just="left", val_just="left")
        S.term(Cx, 1)
        S.term(Cx, 2)
    S.text("C1 bulk at J1; C2 at U1, C3 at U3, C4 at U4 pin 14, C5 at Nano pins 27/29", (287.02, 220.98), size=1.27)
    # power flag on GND (+5V is driven by the Nano's +5V pin, a power output in its symbol)
    fp = (360.68, 203.2)
    S.pwr_flag(fp)
    S.wire(fp, (fp[0], fp[1] + 7.62))
    S.power("GND", (fp[0], fp[1] + 7.62))
    S.text("+5V and GND come from the DX\nthrough J1 (DIP16 / DIP8).\nNo +-12V on this socket.",
           (368.3, 200.66), size=1.27)

    for i, ref in enumerate(["H1", "H2", "H3", "H4"]):
        S.place(C[ref], 302.26 + 15.24 * i, 231.14, ref_at=(302.26 + 15.24 * i, 227.33),
                val_at=(302.26 + 15.24 * i, 234.95))

    tb = ('(title_block (title "DX TimeShift rev A - snare delay interposer") '
          '(date "2026-11-06") (rev "A") (company "DX TimeShift project") '
          '(comment 1 "Fits Oberheim DX board 1721A (U701). NOT for DXa (U715).") '
          '(comment 2 "UNPLUG NANO BEFORE USB (flash it out of the board)") '
          '(comment 3 "Generated: hardware/kicad/tools/gen_schematic.py"))')
    S.save(OUT, "A3", tb)
    return S


def verify_coverage(S):
    """Every component in netlist.py must have been placed (all units)."""
    txt = open(OUT).read()
    for c in N.COMPONENTS:
        assert '(reference "%s")' % c["ref"] in txt, "not placed: " + c["ref"]


if __name__ == "__main__":
    S = build()
    verify_coverage(S)
    print("wrote", OUT)
