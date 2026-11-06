"""Build a simple, colour 3D STEP model of an Arduino Nano v3 sitting in 2 x 1x15 female
headers (the KiCad library has no Nano model). Coordinates = KiCad model space for the
footprint timeshift:Arduino_Nano_Socketed: origin = pad 1, x right, y UP (footprint y is
down), z up from the board surface, mm.

Run on any machine with CadQuery (pip install cadquery):
    python3 hardware/kicad/tools/make_nano_3d.py
Output: hardware/kicad/timeshift/3d/Arduino_Nano_v3_on_sockets.step
The female headers themselves come from the KiCad library model
PinSocket_1x15_P2.54mm_Vertical (added as separate models in the footprint).
"""
import os
import cadquery as cq

OUT = os.path.join(os.path.dirname(__file__), "..", "timeshift", "3d", "Arduino_Nano_v3_on_sockets.step")

P = 2.54
ROW = 15.24
SOCK_H = 8.5        # female header body height (KiCad PinSocket model)
SPACER = 2.5        # male header plastic spacer under the Nano PCB
PCB_T = 1.6
Z0 = SOCK_H + SPACER  # underside of the Nano PCB
L, W = 43.2, 18.0
CX, CY = ROW / 2, 7 * P            # footprint coords of the pin field centre
# footprint (x, y_down) -> model (x, y_up)


def box(sx, sy, sz, x, y_down, z0):
    """Box centred at footprint (x, y_down), bottom at z0."""
    return cq.Workplane("XY").box(sx, sy, sz, centered=(True, True, False)).translate((x, -y_down, z0))


assy = cq.Assembly(name="Arduino_Nano_v3")
blue = cq.Color(0.05, 0.30, 0.62)
black = cq.Color(0.08, 0.08, 0.08)
silver = cq.Color(0.80, 0.80, 0.82)
gold = cq.Color(0.85, 0.68, 0.20)
white = cq.Color(0.95, 0.95, 0.95)

# PCB (USB end = pin 15/16 end = +y_down)
pcb = box(W, L, PCB_T, CX, CY + 0.9, Z0)
# 30 plated holes so the pins are visible through it
for i in range(15):
    for x in (0, ROW):
        pcb = pcb.cut(box(1.0, 1.0, PCB_T, x, i * P, Z0))
assy.add(pcb, name="pcb", color=blue)

# male header spacers (black) + pins (gold)
for x in (0, ROW):
    assy.add(box(P, 15 * P, SPACER, x, CY, SOCK_H), name="spacer_%d" % int(x), color=black)
pins = None
for i in range(15):
    for x in (0, ROW):
        b = box(0.64, 0.64, SPACER + PCB_T + 1.0 + 3.0, x, i * P, SOCK_H - 3.0)
        pins = b if pins is None else pins.union(b)
assy.add(pins, name="pins", color=gold)

top = Z0 + PCB_T
# ATmega328P TQFP-32 (rotated 45 deg like on the real board)
mcu = cq.Workplane("XY").box(7.0, 7.0, 1.0, centered=(True, True, False)).rotate((0, 0, 0), (0, 0, 1), 45)
assy.add(mcu.translate((CX, -(CY + 2.0), top)), name="atmega328p", color=black)
# USB-to-serial chip on the underside
assy.add(box(4.0, 10.0, 1.5, CX, CY - 6.0, Z0 - 1.5), name="usb_uart", color=black)
# USB mini-B receptacle, overhanging the end
assy.add(box(7.7, 9.2, 4.0, CX, CY + 0.9 + L / 2 - 3.0, top), name="usb_miniB", color=silver)
# reset button
assy.add(box(3.2, 6.0, 1.5, CX, CY - 3.0, top), name="reset_body", color=silver)
assy.add(box(1.6, 3.0, 0.6, CX, CY - 3.0, top + 1.5), name="reset_cap", color=white)
# crystal / resonator + 4 LEDs + AMS1117 regulator (cosmetic)
assy.add(box(3.2, 1.6, 0.8, CX + 4.0, CY + 6.5, top), name="resonator", color=silver)
for k, c in enumerate([cq.Color(0.1, 0.9, 0.1), cq.Color(0.95, 0.5, 0.1),
                       cq.Color(0.95, 0.2, 0.1), cq.Color(0.95, 0.9, 0.2)]):
    assy.add(box(1.0, 1.6, 0.6, CX - 4.5 + 1.6 * k, CY + 11.5, top), name="led%d" % k, color=c)
assy.add(box(6.5, 3.5, 1.6, CX, CY - 12.0, Z0 - 1.6), name="regulator", color=black)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
assy.save(os.path.abspath(OUT), exportType="STEP")
print("wrote", os.path.abspath(OUT))
