"""Generate the small project-local libraries of the DX TimeShift KiCad project.

* timeshift.kicad_sym  : symbol DX_PLUG_2x08 (J1). Pin NUMBER = box-header pin (= ribbon
                         conductor), pin NAME = the DIP-16 pin it lands on at the IDC plug
                         (brief 3.5 mapping), drawn in DIP order so it reads like U701.
* timeshift.pretty/Arduino_Nano_Socketed.kicad_mod : Module:Arduino_Nano with identical pads,
                         plus 3D models of the two 1x15 female headers and the Nano itself.
* sym-lib-table / fp-lib-table pointing at both (${KIPRJMOD}).

Run inside the kicad/kicad:9.0 container (needs /usr/share/kicad/footprints).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from netlist import HDR2DIP, U701_FUNC, DIP2HDR  # noqa: E402

PRJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "timeshift")
FPDIR = os.environ.get("KICAD9_FOOTPRINT_DIR", "/usr/share/kicad/footprints")


def eff(size=1.27, hide=False, justify=None):
    j = " (justify %s)" % justify if justify else ""
    h = " (hide yes)" if hide else ""
    return "(effects (font (size %s %s))%s%s)" % (size, size, j, h)


def prop(name, val, x=0, y=0, ang=0, hide=False, justify=None):
    return '(property "%s" "%s" (at %s %s %s) %s)' % (name, val, x, y, ang, eff(hide=hide, justify=justify))


def dx_plug_symbol(name="DX_PLUG_2x08"):
    """Left column = DIP 1..8 (header pins 1,3,..15), right column = DIP 16..9 (2,4,..16)."""
    pins = []
    for k in range(8):
        y = 7.62 - 2.54 * k
        dl = k + 1          # DIP 1..8
        dr = 16 - k         # DIP 16..9
        for dip, x, ang in ((dl, -10.16, 0), (dr, 10.16, 180)):
            hdr = DIP2HDR[dip]
            pins.append('(pin passive line (at %s %s %s) (length 2.54) (name "DIP%d" %s) (number "%d" %s))'
                        % (x, round(y, 2), ang, dip, eff(), hdr, eff()))
    body = ('(symbol "%s_0_1" (rectangle (start -7.62 10.16) (end 7.62 -12.7) '
            '(stroke (width 0.254) (type default)) (fill (type background))))' % name)
    desc = ("2x8 shrouded box header 2.54 mm. 16-way ribbon with a DIP-16 IDC plug on the far end "
            "that plugs into the DX U701 socket. Pin number = header pin = ribbon conductor; "
            "pin name = DIP pin at the plug (1->1, 2->16, 3->2, 4->15, 5->3, 6->14, 7->4, 8->13, "
            "9->5, 10->12, 11->6, 12->11, 13->7, 14->10, 15->8, 16->9).")
    return ("(symbol \"%s\" (pin_names (offset 1.016)) (exclude_from_sim no) (in_bom yes) (on_board yes)\n"
            "  %s\n  %s\n  %s\n  %s\n  %s\n  %s\n  %s\n  %s\n  (symbol \"%s_1_1\"\n    %s)\n  (embedded_fonts no))"
            % (name,
               prop("Reference", "J", 0, 12.7),
               prop("Value", "DX PLUG", 0, -15.24),
               prop("Footprint", "Connector_IDC:IDC-Header_2x08_P2.54mm_Vertical", 0, -17.78, hide=True),
               prop("Datasheet", "~", 0, 0, hide=True),
               prop("Description", desc, 0, 0, hide=True),
               prop("ki_keywords", "IDC box header DIP plug ribbon U701", 0, 0, hide=True),
               prop("ki_fp_filters", "IDC?Header*2x08*", 0, 0, hide=True),
               body, name, "\n    ".join(pins)))


def write_symlib():
    txt = ('(kicad_symbol_lib (version 20241209) (generator "timeshift_gen_libs") (generator_version "9.0")\n'
           + dx_plug_symbol() + "\n)\n")
    open(os.path.join(PRJ, "timeshift.kicad_sym"), "w").write(txt)


def write_nano_fp():
    src = open(os.path.join(FPDIR, "Module.pretty", "Arduino_Nano.kicad_mod")).read()
    src = src.replace('(footprint "Arduino_Nano"', '(footprint "Arduino_Nano_Socketed"', 1)
    src = re.sub(r'\(descr "[^"]*"\)',
                 '(descr "Arduino Nano v3 plugged into 2 x 1x15 female headers (2.54 mm). Pads identical '
                 'to Module:Arduino_Nano; adds 3D models of the headers and of the Nano.")', src, count=1)
    i = src.index("\t(model ")
    models = []
    for (path, ox) in (("${KICAD9_3DMODEL_DIR}/Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x15_P2.54mm_Vertical.step", 0),
                       ("${KICAD9_3DMODEL_DIR}/Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x15_P2.54mm_Vertical.step", 15.24),
                       ("${KIPRJMOD}/3d/Arduino_Nano_v3_on_sockets.step", 0)):
        models.append('\t(model "%s"\n\t\t(offset (xyz %s 0 0))\n\t\t(scale (xyz 1 1 1))\n\t\t(rotate (xyz 0 0 0))\n\t)\n'
                      % (path, ox))
    src = src[:i] + "".join(models) + ")\n"
    os.makedirs(os.path.join(PRJ, "timeshift.pretty"), exist_ok=True)
    open(os.path.join(PRJ, "timeshift.pretty", "Arduino_Nano_Socketed.kicad_mod"), "w").write(src)


def write_tables():
    open(os.path.join(PRJ, "sym-lib-table"), "w").write(
        '(sym_lib_table\n  (version 7)\n  (lib (name "timeshift")(type "KiCad")(uri "${KIPRJMOD}/timeshift.kicad_sym")'
        '(options "")(descr "DX TimeShift project symbols"))\n)\n')
    open(os.path.join(PRJ, "fp-lib-table"), "w").write(
        '(fp_lib_table\n  (version 7)\n  (lib (name "timeshift")(type "KiCad")(uri "${KIPRJMOD}/timeshift.pretty")'
        '(options "")(descr "DX TimeShift project footprints"))\n)\n')


if __name__ == "__main__":
    os.makedirs(PRJ, exist_ok=True)
    write_symlib()
    write_nano_fp()
    write_tables()
    print("libraries written to", os.path.abspath(PRJ))
