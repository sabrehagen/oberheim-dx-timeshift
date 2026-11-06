"""DX TimeShift rev A: single source of truth for parts and nets.

Implements PROJECT_BRIEF.md section 3.5 (LOCKED). Both gen_schematic.py and gen_pcb.py
import this file, so the schematic and the PCB can never disagree.

Pin numbers are the KiCad symbol/footprint pin numbers (= physical pin numbers).
"""
import uuid

PROJECT = "timeshift"
NS = uuid.UUID("6f1c2b8e-0d7a-4c55-9a51-d0e7a1c0ffee")  # fixed namespace -> stable UUIDs


def uid(*parts):
    return str(uuid.uuid5(NS, "/".join(str(p) for p in parts)))


ROOT_UUID = uid("root-sheet")

# ---------------------------------------------------------------------------
# J1 "DX PLUG": 2x8 box header. A 16-way ribbon with a DIP-16 IDC plug on the far end
# goes into the DX's U701 socket. Standard DIP IDC plug mapping (brief 3.5):
# ribbon conductor n -> header pin n -> DIP pin HDR2DIP[n]
HDR2DIP = {1: 1, 2: 16, 3: 2, 4: 15, 5: 3, 6: 14, 7: 4, 8: 13,
           9: 5, 10: 12, 11: 6, 12: 11, 13: 7, 14: 10, 15: 8, 16: 9}
DIP2HDR = {d: h for h, d in HDR2DIP.items()}

# U701 (MC14174B / 74C174) pin -> DX net (docs/research/dx-findings.md section b1)
U701_FUNC = {1: "CLR (tied +5V)", 2: "Q1 = RST1 (bass)", 3: "D1 = bus D0", 4: "D2 = bus D1",
             5: "Q2 = FFA1 (bass)", 6: "D3 = bus D2", 7: "Q3 = FFB1 (bass)", 8: "VSS = GND",
             9: "CLK = GEN0*", 10: "Q4 = FFB2 (SNARE)", 11: "D4 = bus D5", 12: "Q5 = FFA2 (SNARE)",
             13: "D5 = bus D4", 14: "D6 = bus D3", 15: "Q6 = RST2 (SNARE)", 16: "VDD = +5V"}

# Straight-through nets (U1 pin n <-> J1 DIP pin n)
# Net name = "U701_<DIP pin>_<DX signal>" (BUS_Dn = Z80 data bus bit n, see findings b1)
PASS_NET = {1: "U701_1_~{CLR}", 2: "U701_2_RST1", 3: "U701_3_BUS_D0", 4: "U701_4_BUS_D1",
            5: "U701_5_FFA1", 6: "U701_6_BUS_D2", 7: "U701_7_FFB1", 8: "GND",
            9: "U701_9_~{GEN0}", 11: "U701_11_BUS_D5", 13: "U701_13_BUS_D4", 14: "U701_14_BUS_D3",
            16: "+5V"}
# Intercepted pins: chip side (U1) and plug side (J1) are DIFFERENT nets
CHIP_NET = {15: "RST2_CHIP", 12: "FFA2_CHIP", 10: "FFB2_CHIP"}
PLUG_NET = {15: "RST2_PLUG", 12: "FFA2_PLUG", 10: "FFB2_PLUG"}


def u1_net(dip):
    return CHIP_NET.get(dip) or PASS_NET[dip]


def j1_net(hdr):
    dip = HDR2DIP[hdr]
    return PLUG_NET.get(dip) or PASS_NET[dip]


NC = None  # unconnected pin (gets a no-connect flag in the schematic)

FP_R = "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal"
FP_C = "Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm"
FP_CP = "Capacitor_THT:CP_Radial_D5.0mm_P2.00mm"
FP_TP = "TestPoint:TestPoint_Keystone_5005-5009_Compact"
FP_HOLE = "MountingHole:MountingHole_3.2mm_M3"


def comp(ref, lib_id, value, footprint, pins, desc="", fields=None, units=1):
    return dict(ref=ref, lib_id=lib_id, value=value, footprint=footprint, pins=pins,
                desc=desc, fields=fields or {}, units=units)


COMPONENTS = [
    # ---------------- ICs ----------------
    comp("U1", "74xx:74LS174", "MC14174B (orig. U701)", "Package_DIP:DIP-16_W7.62mm_Socket",
         {p: u1_net(p) for p in range(1, 17)},
         desc="DIP-16 socket that receives the ORIGINAL U701 chip removed from the DX "
              "(MC14174B / 74C174 hex D flip-flop). Only the socket is fitted at assembly.",
         fields={"MPN": "DIP-16 IC socket, 7.62 mm (e.g. TE 1-2199298-4); chip = original U701",
                 "Fit": "socket only"}),
    comp("U2", "MCU_Module:Arduino_Nano_v3.x", "Arduino Nano v3 (5V)",
         "timeshift:Arduino_Nano_Socketed",
         {1: NC, 2: NC, 3: NC, 4: "GND", 5: "RST2_IN", 6: "CLK_IN", 7: "FFA2_IN", 8: "FFB2_IN",
          9: "RST2_OUT", 10: "FFA2_OUT", 11: "FFB2_OUT", 12: "MUX_SEL", 13: "PPQN_J1",
          14: "PPQN_J2", 15: "TP_REPLAY", 16: NC, 17: NC, 18: NC, 19: "POT_W",
          20: NC, 21: NC, 22: NC, 23: NC, 24: NC, 25: NC, 26: NC, 27: "+5V", 28: NC,
          29: "GND", 30: NC},
         desc="Arduino Nano v3 (or clone), plugged into 2 x 1x15 female headers 2.54 mm. "
              "D13 = LED_ACT uses the Nano's own 'L' LED. Footprint = Module:Arduino_Nano "
              "(identical pads) plus 3D models of the Nano and the two female headers.",
         fields={"MPN": "Arduino Nano v3 (A000005) or ATmega328P clone",
                 "Socket": "2 x female header 1x15 P2.54 mm (e.g. Samtec SSW-115-01-T-S)"}),
    comp("U3", "74xx:74LS157", "74HC157", "Package_DIP:DIP-16_W7.62mm_Socket",
         {1: "MUX_SEL", 2: "RST2_CHIP", 3: "RST2_OUT", 4: "RST2_PLUG",
          5: "FFA2_CHIP", 6: "FFA2_OUT", 7: "FFA2_PLUG", 8: "GND",
          9: "FFB2_PLUG", 10: "FFB2_OUT", 11: "FFB2_CHIP", 12: NC,
          13: "GND", 14: "GND", 15: "GND", 16: "+5V"},
         desc="Quad 2:1 mux. S low = A = bypass (U701 direct), S high = B = delayed (Nano)",
         fields={"MPN": "74HC157N (DIP-16), e.g. TI SN74HC157N",
                 "Socket": "DIP-16 IC socket 7.62 mm"}),
    comp("U4", "74xx:74HC14", "74HC14", "Package_DIP:DIP-14_W7.62mm_Socket",
         {1: "CLK_RC", 2: "CLK_INV", 3: "CLK_INV", 4: "CLK_IN",
          5: "GND", 6: NC, 7: "GND", 8: NC, 9: "GND", 10: NC, 11: "GND", 12: NC,
          13: "GND", 14: "+5V"},
         desc="Hex Schmitt inverter, clock conditioning (2 gates in series = non-inverting)",
         fields={"MPN": "74HC14N (DIP-14), e.g. TI SN74HC14N",
                 "Socket": "DIP-14 IC socket 7.62 mm"}, units=7),
    # ---------------- connectors ----------------
    comp("J1", "timeshift:DX_PLUG_2x08", "DX PLUG", "Connector_IDC:IDC-Header_2x08_P2.54mm_Vertical",
         {h: j1_net(h) for h in range(1, 17)},
         desc="2x8 shrouded box header. 16-way ribbon -> DIP-16 IDC plug -> DX U701 socket. "
              "Pin names = DIP pin numbers at the plug end.",
         fields={"MPN": "2x8 shrouded box header 2.54 mm, e.g. Wurth 61201621621",
                 "Cable": "16-way 1.27 mm ribbon 10-15 cm + 2x8 IDC socket (3M 89116-0101) "
                          "+ DIP-16 IDC plug Adam Tech FDP-316-T (alt. HARTING 09181169622)"}),
    comp("J2", "Connector_Generic:Conn_01x03", "POT", "Connector_JST:JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical",
         {1: "GND", 2: "POT_WIPER", 3: "+5V"},
         desc="To rear-panel 10k lin pot: 1 = GND (CCW lug), 2 = wiper, 3 = +5V (CW lug)",
         fields={"MPN": "JST B3B-XH-A (housing XHP-3, crimps SXH-001T-P0.6)"}),
    comp("J3", "Connector_Generic:Conn_01x02", "CLK", "Connector_JST:JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical",
         {1: "CLK_TAP", 2: "GND"},
         desc="1 = DX CLOCK OUT node (R791 lead, Q709 collector side), 2 = GND",
         fields={"MPN": "JST B2B-XH-A (housing XHP-2, crimps SXH-001T-P0.6)"}),
    comp("JP1", "Connector_Generic:Conn_02x02_Odd_Even", "PPQN",
         "Connector_PinHeader_2.54mm:PinHeader_2x02_P2.54mm_Vertical",
         {1: "PPQN_J1", 2: "GND", 3: "PPQN_J2", 4: "GND"},
         desc="PPQN select (internal pull-ups): JP1 both open = 96, "
              "JP1 1-2 closed (D10) = 48, JP1 3-4 closed (D11) = 24",
         fields={"MPN": "2x2 pin header 2.54 mm + 1 jumper shunt"}),
    # ---------------- resistors ----------------
    comp("R1", "Device:R", "1k", FP_R, {1: "RST2_CHIP", 2: "RST2_IN"},
         desc="Series protection U1 pin 15 -> Nano D2"),
    comp("R2", "Device:R", "1k", FP_R, {1: "FFA2_CHIP", 2: "FFA2_IN"},
         desc="Series protection U1 pin 12 -> Nano D4"),
    comp("R3", "Device:R", "1k", FP_R, {1: "FFB2_CHIP", 2: "FFB2_IN"},
         desc="Series protection U1 pin 10 -> Nano D5"),
    comp("R4", "Device:R", "1k", FP_R, {1: "POT_WIPER", 2: "POT_W"},
         desc="Pot wiper series resistor (RC filter with C6)"),
    comp("R5", "Device:R", "10k", FP_R, {1: "MUX_SEL", 2: "GND"},
         desc="MUX_SEL pull-down: MCU off/reset/blank -> bypass"),
    comp("R6", "Device:R", "10k", FP_R, {1: "CLK_TAP", 2: "CLK_RC"},
         desc="R_CLK1: 10k series from the DX clock tap"),
    comp("R7", "Device:R", "100k", FP_R, {1: "CLK_RC", 2: "GND"},
         desc="R_CLK2: 100k pull-down (clock lead unplugged -> low)"),
    # ---------------- capacitors ----------------
    comp("C1", "Device:C_Polarized", "10uF", FP_CP, {1: "+5V", 2: "GND"},
         desc="Bulk, at J1. Electrolytic >= 16 V"),
    comp("C2", "Device:C", "100nF", FP_C, {1: "+5V", 2: "GND"}, desc="Decoupling U1"),
    comp("C3", "Device:C", "100nF", FP_C, {1: "+5V", 2: "GND"}, desc="Decoupling U3"),
    comp("C4", "Device:C", "100nF", FP_C, {1: "+5V", 2: "GND"}, desc="Decoupling U4"),
    comp("C5", "Device:C", "100nF", FP_C, {1: "+5V", 2: "GND"}, desc="Decoupling Nano"),
    comp("C6", "Device:C", "100nF", FP_C, {1: "POT_W", 2: "GND"}, desc="Pot RC filter"),
    comp("C7", "Device:C", "1nF", FP_C, {1: "CLK_RC", 2: "GND"}, desc="Clock RC filter"),
    # ---------------- test points ----------------
    comp("TP1", "Connector:TestPoint", "REPLAY", FP_TP, {1: "TP_REPLAY"},
         desc="TP_REPLAY (Nano D12): pulses high on every replayed hit",
         fields={"MPN": "Keystone 5005 (red)"}),
    comp("TP2", "Connector:TestPoint", "RST2 CHIP", FP_TP, {1: "RST2_CHIP"},
         desc="RST2 chip side (U1 pin 15)", fields={"MPN": "Keystone 5005 (red)"}),
    comp("TP3", "Connector:TestPoint", "RST2 PLUG", FP_TP, {1: "RST2_PLUG"},
         desc="RST2 plug side (mux 1Y -> J1 DIP 15)", fields={"MPN": "Keystone 5005 (red)"}),
    comp("TP4", "Connector:TestPoint", "GND", FP_TP, {1: "GND"},
         desc="Ground for scope probe", fields={"MPN": "Keystone 5006 (black)"}),
    comp("TP5", "Connector:TestPoint", "CLK_IN", FP_TP, {1: "CLK_IN"},
         desc="Conditioned clock at Nano D3", fields={"MPN": "Keystone 5005 (red)"}),
    # ---------------- mechanical ----------------
    comp("H1", "Mechanical:MountingHole", "M3", FP_HOLE, {}, desc="M3 mounting hole"),
    comp("H2", "Mechanical:MountingHole", "M3", FP_HOLE, {}, desc="M3 mounting hole"),
    comp("H3", "Mechanical:MountingHole", "M3", FP_HOLE, {}, desc="M3 mounting hole"),
    comp("H4", "Mechanical:MountingHole", "M3", FP_HOLE, {}, desc="M3 mounting hole"),
]

BY_REF = {c["ref"]: c for c in COMPONENTS}

POWER_NETS = ("+5V", "GND")


def all_nets():
    nets = set()
    for c in COMPONENTS:
        for n in c["pins"].values():
            if n:
                nets.add(n)
    return sorted(nets)


def net_members():
    m = {}
    for c in COMPONENTS:
        for p, n in c["pins"].items():
            if n:
                m.setdefault(n, []).append((c["ref"], p))
    return m


if __name__ == "__main__":
    for n, mem in sorted(net_members().items()):
        print("%-16s %s" % (n, " ".join("%s.%s" % rp for rp in mem)))
