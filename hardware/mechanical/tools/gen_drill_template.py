#!/usr/bin/env python3
"""DX TimeShift rev A: parametric 1:1 rear-panel drill template for the SNARE DELAY pot.

Reads panel_measurements.json (same folder), draws the template and writes
    hardware/mechanical/rear-panel-drill-template.svg   (A4 landscape, 1:1)
    hardware/mechanical/rear-panel-drill-template.dxf   (1:1, mm, layered; needs ezdxf)
The PDF and PNG preview are made by build_all.py.

Usage:
    python3 gen_drill_template.py [--measurements FILE] [--set key=value ...] [--out-dir DIR]

Example after measuring:
    python3 gen_drill_template.py --set pitch_hihat_snare_mm=20.8 --set pitch_snare_bass_mm=20.6

Coordinates: origin = centre of the SNARE tuning shaft, +x = towards BASS (right, seen from
OUTSIDE the case), +y = down. Everything in millimetres.
"""
import argparse
import datetime
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import svgkit as K  # noqa: E402

MECH = os.path.dirname(HERE)
DWG_NO = "DXTS-MECH-001"
DATE = "2026-11-06"
REV = "A"

PAGE_W, PAGE_H = 297.0, 210.0          # A4 landscape
SAFE_L, SAFE_R = 15.0, 282.0           # keep inside US-Letter width too (279.4 mm)
SAFE_T, SAFE_B = 8.0, 202.0


# ---------------------------------------------------------------------------
def load(path, overrides):
    with open(path, encoding="utf-8") as f:
        m = json.load(f)
    for ov in overrides:
        k, v = ov.split("=", 1)
        k = k.strip()
        if k not in m:
            raise SystemExit("unknown measurement %r (see %s)" % (k, path))
        if isinstance(m[k], dict) and "value" in m[k]:
            if v.lower() in ("true", "false"):
                m[k]["value"] = v.lower() == "true"
            elif k == "lug_direction":
                m[k]["value"] = v
            else:
                m[k]["value"] = float(v)
                m[k]["measured"] = True
    return m


def val(m, k):
    return m[k]["value"]


def unmeasured(m):
    return [k for k, v in m.items()
            if isinstance(v, dict) and v.get("required") and not v.get("measured")]


LUG_ANGLE = {"right": 0.0, "down": 90.0, "left": 180.0, "up": 270.0}  # screen coords, y down


def geometry(m):
    """Return a dict of every feature position (mm, SNARE-centred coordinates)."""
    p = m["pot"]
    g = {}
    g["hihat"] = (-val(m, "pitch_hihat_snare_mm"), 0.0)
    g["snare"] = (0.0, 0.0)
    g["bass"] = (val(m, "pitch_snare_bass_mm"), 0.0)
    g["shaft_r"] = val(m, "shaft_dia_mm") / 2.0
    g["cut_r"] = g["shaft_r"] + 0.5
    g["hole"] = (val(m, "new_hole_right_of_snare_mm"), val(m, "new_hole_below_snare_mm"))
    g["hole_r"] = p["bushing_hole_dia_mm"] / 2.0
    lug = m["lug_direction"]["value"]
    if lug not in LUG_ANGLE:
        raise SystemExit("lug_direction must be right|left|down|up")
    g["lug_angle"] = LUG_ANGLE[lug]
    ta = math.radians(LUG_ANGLE[lug] + 90.0)       # tab is 90 deg clockwise from the lugs
    hx, hy = g["hole"]
    g["tab"] = (hx + p["tab_offset_mm"] * math.cos(ta), hy + p["tab_offset_mm"] * math.sin(ta))
    g["tab_r"] = p["tab_hole_dia_mm"] / 2.0
    g["screw"] = (val(m, "screw_right_of_snare_mm"), val(m, "screw_below_snare_mm"))
    g["screw_r"] = val(m, "screw_head_dia_mm") / 2.0
    g["label_y"] = val(m, "outputs_label_top_below_snare_mm")
    g["washer_r"] = p["washer_od_mm"] / 2.0
    g["body_r"] = p["body_dia_mm"] / 2.0
    g["keep_r"] = 12.0                               # findings Q6: >= 12 mm radius free
    return g


def checks(m, g):
    """Return list of (level, text). level in OK / WARN / STOP."""
    p = m["pot"]
    out = []
    hx, hy = g["hole"]
    sx, sy = g["screw"]
    d = math.hypot(hx - sx, hy - sy) - g["washer_r"] - g["screw_r"]
    out.append(("OK" if d >= 1.0 else "WARN",
                "Washer (Ø%.0f) to tuning-PCB screw head: %.1f mm gap" % (p["washer_od_mm"], d)))
    d = g["label_y"] - hy - g["washer_r"]
    out.append(("OK" if d >= 0.5 else "WARN",
                "Washer to top of OUTPUTS label text: %.1f mm gap" % d))
    t = val(m, "panel_thickness_mm")
    maxt = p["bushing_len_mm"] - p["nut_thk_mm"] - p["washer_thk_mm"]
    out.append(("OK" if t <= maxt else "STOP",
                "Panel %.1f mm vs. max %.1f mm for the M7 bushing" % (t, maxt)))
    # behind-panel envelope in the vertical direction
    la = g["lug_angle"]
    up = g["body_r"] if la != 270.0 else max(g["body_r"], p["lug_reach_mm"])
    dn = g["body_r"] if la != 90.0 else max(g["body_r"], p["lug_reach_mm"])
    top = hy - up
    bot = hy + dn
    pcb = val(m, "tuning_pcb_bottom_below_snare_mm")
    jack = val(m, "jack_body_top_below_snare_mm")
    depth = val(m, "free_depth_behind_panel_mm")
    if pcb is None:
        out.append(("STOP", "Tuning-PCB bottom edge NOT MEASURED (pot body top at %.1f mm)" % top))
    else:
        out.append(("OK" if top - pcb >= 1.0 else "STOP",
                    "Pot body top %.1f mm vs. tuning PCB %.1f mm: %.1f mm gap" % (top, pcb, top - pcb)))
    if jack is None:
        out.append(("STOP", "Jack-body top NOT MEASURED (pot body bottom at %.1f mm)" % bot))
    else:
        out.append(("OK" if jack - bot >= 1.0 else "STOP",
                    "Pot body bottom %.1f mm vs. jack top %.1f mm: %.1f mm gap" % (bot, jack, jack - bot)))
    if depth is None:
        out.append(("STOP", "Free depth behind panel NOT MEASURED (need >= 25 mm)"))
    else:
        out.append(("OK" if depth >= 25.0 else "STOP", "Free depth behind panel %.1f mm (need >= 25)" % depth))
    if m["drill_tab_hole"]["value"]:
        tx, ty = g["tab"]
        d = g["label_y"] - (ty + g["tab_r"])
        if d < 0.5 and abs(tx - hx) < 1.0:
            out.append(("WARN", "Tab hole touches the OUTPUTS label: change lug_direction"))
        d2 = math.hypot(tx - sx, ty - sy) - g["tab_r"] - g["screw_r"]
        out.append(("OK" if d2 >= 1.0 else "WARN", "Tab hole to tuning-PCB screw head: %.1f mm gap" % d2))
    return out


# ---------------------------------------------------------------------------
def draw_svg(m, g, chk, path):
    p = m["pot"]
    missing = unmeasured(m)
    stop = any(lv == "STOP" for lv, _ in chk)
    s = K.SVG(PAGE_W, PAGE_H, "DX TimeShift - rear-panel drill template (1:1)")
    K.frame(s, SAFE_L - 1, SAFE_T, PAGE_W - SAFE_R - 1, PAGE_H - SAFE_B)
    LX = SAFE_L + 4          # left text margin

    # ---------------- banner -------------------------------------------------
    s.rect(LX - 2, SAFE_T + 2, 168, 8.0, stroke=K.RED, sw=0.6, fill="#fff1f1")
    s.text(LX, SAFE_T + 7.9, "PRINT AT 100 % (ACTUAL SIZE, NOT 'FIT TO PAGE') — check the 50 mm scale bar",
           size=3.3, weight="bold", fill=K.RED)
    s.rect(LX - 2, SAFE_T + 11.5, 168, 8.0, stroke=K.ORANGE, sw=0.6, fill="#fff6ec")
    s.text(LX, SAFE_T + 17.4, "CONFIRM CLEARANCE BEHIND PANEL BEFORE DRILLING (findings Q6)",
           size=3.3, weight="bold", fill=K.ORANGE)
    if missing:
        st, col = "STATUS: ESTIMATES ONLY — DO NOT DRILL (%d values not measured yet)" % len(missing), K.RED
    elif stop:
        st, col = "STATUS: MEASURED, BUT A CHECK FAILED — DO NOT DRILL", K.RED
    else:
        st, col = "STATUS: generated from measured values — drill after the behind-panel check", K.GREEN
    s.text(LX, SAFE_T + 25.0, st, size=2.8, weight="bold", fill=col)

    # ---------------- template (1:1) ------------------------------------------
    OX, OY = 66.0, 66.0                     # page position of the SNARE shaft centre

    def P(x, y):
        return OX + x, OY + y

    hx, hy = g["hole"]
    cx, cy = P(hx, hy)
    xl = g["hihat"][0] - 17.0
    xr = g["bass"][0] + 30.0
    yt = -21.0
    yb = max(g["label_y"], hy + g["keep_r"]) + 6.0
    s.text(OX + xl, OY + yt - 2.2, "VIEW FROM OUTSIDE (REAR OF THE DX) · TOP OF PANEL ↑ · PERC, CYMBAL, TOMS are further left",
           size=2.2, weight="bold")
    s.rect(OX + xl, OY + yt, xr - xl, yb - yt, stroke=K.INK, sw=0.3, dash="2.5 1.2")

    # centre lines
    s.line(OX + xl + 2, OY, OX + xr - 2, OY, stroke=K.GREY, sw=0.13, dash="4 1 0.8 1")
    s.line(OX, OY + yt + 4, OX, OY + yb - 2, stroke=K.GREY, sw=0.13, dash="4 1 0.8 1")
    # existing pots
    for name, (x, y) in (("HI-HAT", g["hihat"]), ("SNARE", g["snare"]), ("BASS", g["bass"])):
        px, py = P(x, y)
        s.circle(px, py, g["cut_r"], stroke=K.INK, sw=0.35, fill="#f2f2f2", dash="1.2 0.6")
        s.crosshair(px, py, g["cut_r"] + 2.0, colour=K.GREY, sw=0.15)
        s.text(px, py - g["cut_r"] - 2.6, name, size=2.6, anchor="middle", weight="bold")
    # existing screw
    sx, sy = P(*g["screw"])
    s.circle(sx, sy, g["screw_r"], stroke=K.GREY, sw=0.3, dash="1 0.6")
    s.crosshair(sx, sy, 1.2, colour=K.GREY, sw=0.12)
    s.text(sx + g["screw_r"] + 0.8, sy - 0.3, "existing", size=1.8, fill=K.GREY)
    s.text(sx + g["screw_r"] + 0.8, sy + 2.0, "screw", size=1.8, fill=K.GREY)
    # OUTPUTS label top line
    s.line(OX + xl + 2, OY + g["label_y"], OX + xr - 2, OY + g["label_y"], stroke=K.GREY, sw=0.25,
           dash="1.2 0.8")
    s.text(OX + xl + 2, OY + g["label_y"] - 1.0, "top of OUTPUTS label text", size=1.8, fill=K.GREY)

    # behind-panel envelope
    s.circle(cx, cy, g["keep_r"], stroke=K.ORANGE, sw=0.25, dash="2 1")
    s.circle(cx, cy, g["body_r"], stroke=K.BLUE, sw=0.25, dash="1.2 0.8")
    la = math.radians(g["lug_angle"])
    reach, span = p["lug_reach_mm"], p["lug_span_mm"]
    ux, uy = math.cos(la), math.sin(la)
    vx, vy = -uy, ux
    a0 = math.sqrt(max(g["body_r"] ** 2 - (span / 2) ** 2, 0))
    s.polyline([(cx + ux * a0 + vx * span / 2, cy + uy * a0 + vy * span / 2),
                (cx + ux * reach + vx * span / 2, cy + uy * reach + vy * span / 2),
                (cx + ux * reach - vx * span / 2, cy + uy * reach - vy * span / 2),
                (cx + ux * a0 - vx * span / 2, cy + uy * a0 - vy * span / 2)],
               stroke=K.BLUE, sw=0.25, dash="1.2 0.8")
    s.circle(cx, cy, g["washer_r"], stroke=K.GREY, sw=0.15, dash="0.5 0.5")
    # new hole
    s.circle(cx, cy, g["hole_r"], stroke=K.RED, sw=0.45, fill="#ffe3e3")
    if p.get("bushing_hole_max_dia_mm", 0) > p["bushing_hole_dia_mm"]:
        s.circle(cx, cy, p["bushing_hole_max_dia_mm"] / 2.0, stroke=K.RED, sw=0.15, dash="0.6 0.4")
    s.crosshair(cx, cy, g["hole_r"] + 3.0, colour=K.RED, sw=0.2)
    s.circle(cx, cy, 0.35, stroke=K.RED, sw=0.1, fill=K.RED)
    tx, ty = P(*g["tab"])
    s.circle(tx, ty, g["tab_r"], stroke=K.RED, sw=0.35, dash=None if m["drill_tab_hole"]["value"] else "0.7 0.5")
    s.crosshair(tx, ty, g["tab_r"] + 1.0, colour=K.RED, sw=0.12)

    # suggested panel label (outside, left of the new pot)
    lw, lh = 25.0, 9.0
    lx, ly = cx - g["keep_r"] - 2.0 - lw, cy - lh / 2
    s.rect(lx, ly, lw, lh, stroke=K.PURPLE, sw=0.2, dash="1 0.6")
    s.text(lx + lw / 2, ly + 3.8, "SNARE DELAY", size=2.6, anchor="middle", weight="bold", fill=K.PURPLE)
    s.text(lx + lw / 2, ly + 7.5, "0 ◄──► 1 BEAT", size=2.4, anchor="middle", fill=K.PURPLE)

    # dimensions
    star = lambda k: "" if m[k]["measured"] else " *"  # noqa: E731
    yd = OY - 13.0
    s.dim_h(OX + g["hihat"][0], OX, yd, OY - g["cut_r"], OY - g["cut_r"],
            "%.1f%s" % (val(m, "pitch_hihat_snare_mm"), star("pitch_hihat_snare_mm")), size=2.5)
    s.dim_h(OX, OX + g["bass"][0], yd, OY - g["cut_r"], OY - g["cut_r"],
            "%.1f%s" % (val(m, "pitch_snare_bass_mm"), star("pitch_snare_bass_mm")), size=2.5)
    xd = OX + g["bass"][0] + 12.0
    s.dim_v(OY, cy, xd, OX + g["bass"][0] + g["cut_r"], cx + g["hole_r"],
            "%.1f%s" % (hy, star("new_hole_below_snare_mm")), size=2.5)
    s.dim_v(OY, OY + g["label_y"], xd + 8.0, xd + 1.5, OX + xr - 3,
            "%.1f%s" % (g["label_y"], star("outputs_label_top_below_snare_mm")), size=2.2,
            colour=K.GREY, gap=0.0)
    if abs(hx) > 0.05:
        s.dim_h(OX, cx, OY + yb - 3, OY + 2, cy + g["hole_r"], "%.1f" % hx, size=2.4)

    # callouts below the cut line
    c1y = OY + yb + 5.0
    s.line(cx + 0.6, cy + g["hole_r"], cx + 18, c1y - 1.0, stroke=K.RED, sw=0.15)
    s.arrow_head(cx + 0.6, cy + g["hole_r"], math.degrees(math.atan2(-(c1y - 1 - cy - g["hole_r"]), -(17.4))),
                 size=1.8, colour=K.RED)
    s.text(cx + 18.5, c1y, "NEW HOLE Ø%.1f–%.1f mm (pot %s)" % (
        p["bushing_hole_dia_mm"], p.get("bushing_hole_max_dia_mm", p["bushing_hole_dia_mm"]),
        p["model"].split("/")[-1].strip()), size=2.4, weight="bold", fill=K.RED)
    tab_txt = "tab hole Ø%.1f, %.1f mm from centre — %s" % (
        p["tab_hole_dia_mm"], p["tab_offset_mm"],
        "DRILL" if m["drill_tab_hole"]["value"] else "optional (or snap the tab off the pot)")
    s.line(tx - 0.6, ty + g["tab_r"], cx + 18, c1y + 3.0, stroke=K.RED, sw=0.12)
    s.text(cx + 18.5, c1y + 3.6, tab_txt, size=2.0, fill=K.RED)

    # ---------------- scale bars ------------------------------------------------
    vx0, vy0 = SAFE_L + 3.0, OY + yt + 4.0
    for i in range(5):
        s.rect(vx0 - 1.2, vy0 + i * 10, 2.4, 10, stroke=K.INK, sw=0.15,
               fill=K.INK if i % 2 == 0 else "#ffffff")
    for i in range(6):
        s.text(vx0 + 1.8, vy0 + i * 10 + 0.8, str(i * 10), size=1.8)
    s.text(vx0 - 1.2, vy0 + 54.0, "mm", size=1.8)
    bx, by = LX, c1y + 12.0
    s.text(bx, by - 3.6, "SCALE CHECK: both bars (this one and the vertical one on the left) must measure exactly 50.0 mm",
           size=2.3, weight="bold")
    for i in range(5):
        s.rect(bx + i * 10, by - 1.2, 10, 2.4, stroke=K.INK, sw=0.15, fill=K.INK if i % 2 == 0 else "#ffffff")
    for i in range(6):
        s.text(bx + i * 10, by + 4.2, str(i * 10), size=1.9, anchor="middle")
    s.text(bx + 52, by + 0.8, "mm", size=2.0)

    # ---------------- procedure --------------------------------------------------
    py0 = by + 10.5
    s.text(LX, py0, "HOW TO USE", size=2.6, weight="bold")
    steps = [
        ("1", "Measure the starred (*) values (README checklist), regenerate, print at 100 %, check both bars."),
        ("2", "Mains OFF and unplugged. Open the lid. Behind the SNARE pot, the blue pot body and the orange"),
        ("", "Ø24 keep-out must be clear of the tuning PCB, its screws, jack bodies and wires."),
        ("3", "Cut along the dashed line and cut out the three shaft circles. Slip the template over the"),
        ("", "HI-HAT, SNARE and BASS shafts; the screw circle and label line must line up too. Tape it."),
        ("4", "Cover the main board inside with paper and tape: steel swarf on the board causes shorts."),
        ("5", "Centre-punch the red cross. Pilot Ø3 mm, then Ø7.5 mm drill or step drill to 8 mm (7.5–8.0 OK)."),
        ("6", "Tab hole only if you chose to drill it. Deburr both sides. Vacuum up every bit of swarf."),
        ("7", "Fit the pot: washer + nut outside, lugs pointing as drawn. Tighten firmly, not hard."),
    ]
    yy = py0 + 3.6
    for n, t in steps:
        s.text(LX, yy, n, size=2.1, weight="bold")
        s.text(LX + 3.5, yy, t, size=2.1)
        yy += 2.85

    # legend + notes
    lg_y = 172.0
    K.legend(s, LX - 1, lg_y, [
        ("line", K.RED, "drill: new hole Ø7.5 (dashed: max Ø8.0)", None),
        ("line", K.INK, "cut line; existing-shaft cut-outs", "2.5 1.2"),
        ("line", K.BLUE, "pot body + lugs behind the panel", "1.2 0.8"),
        ("line", K.ORANGE, "Ø24 keep-out behind the panel (Q6)", "2 1"),
        ("line", K.GREY, "existing feature, use it to align", "1.2 0.8"),
        ("line", K.PURPLE, "suggested label (9 mm tape)", "1 0.6"),
    ], size=1.8, w=62)
    s.lines(LX + 65, lg_y + 3.5, [
        "Dimensions in mm. Origin = SNARE shaft centre.",
        "Seen from OUTSIDE: the BASS pot is on the right.",
        "* = estimated from a photo. Measure, then regenerate.",
        "Pot lugs: 1 (CCW) → J2-1 GND, 2 → J2-2 wiper,",
        "3 (CW) → J2-3 +5 V (see wiring-diagram.pdf).",
        "Regenerate: python3 tools/build_all.py (README.md).",
    ], size=1.8, lh=2.55)

    # ---------------- side view of the pot (scale 2:1) -------------------------
    ax, ay = 200.0, 66.0
    S2 = 2.0
    s.text(162.0, 37.0, "POT BEHIND THE PANEL — side view, scale 2:1", size=2.6, weight="bold")
    s.text(162.0, 40.2, p["model"] + " — " + p["description"].split(",")[0], size=1.9, fill=K.GREY)
    t = val(m, "panel_thickness_mm")
    br = g["body_r"] * S2
    bd = p["body_depth_mm"] * S2
    bl = p["bushing_len_mm"] * S2
    sl = p["shaft_len_mm"] * S2
    s.rect(ax - t * S2, ay - 21, t * S2, 42, stroke=K.INK, sw=0.2, fill="#bdbdbd")
    s.text(ax - t * S2 / 2, ay - 22.2, "panel %.1f%s" % (t, star("panel_thickness_mm")), size=1.9,
           anchor="middle")
    s.text(ax - 6, ay + 24.5, "◄ OUTSIDE", size=1.9, fill=K.GREY, anchor="end")
    s.text(ax + 2, ay + 24.5, "INSIDE (DX) ►", size=1.9, fill=K.GREY)
    s.rect(ax, ay - br, bd, 2 * br, stroke=K.BLUE, sw=0.35, fill="#e8f0fb")
    s.rect(ax + bd - 2.2, ay + br, 1.2, (p["lug_reach_mm"] - g["body_r"]) * S2, stroke=K.BLUE,
           sw=0.25, fill="#e8f0fb")
    s.text(ax + bd + 1.0, ay + br + 6.0, "lugs (drawn pointing", size=1.7, fill=K.BLUE)
    s.text(ax + bd + 1.0, ay + br + 8.2, "down in this view)", size=1.7, fill=K.BLUE)
    s.rect(ax - bl, ay - 3.5 * S2, bl - t * S2, 7.0 * S2, stroke=K.INK, sw=0.25, fill="#eeeeee")
    wt = p["washer_thk_mm"] * S2
    s.rect(ax - t * S2 - wt, ay - p["washer_od_mm"], wt, p["washer_od_mm"] * 2, stroke=K.INK, sw=0.15,
           fill="#cccccc")
    nt = p["nut_thk_mm"] * S2
    s.rect(ax - t * S2 - wt - nt, ay - p["nut_af_mm"], nt, p["nut_af_mm"] * 2, stroke=K.INK, sw=0.2,
           fill="#dddddd")
    s.rect(ax - sl, ay - 3.0 * S2, sl - bl, 6.0 * S2, stroke=K.INK, sw=0.25, fill="#f7f7f7")
    s.line(ax - sl, ay, ax - sl + 2.5, ay, stroke=K.INK, sw=0.35)
    s.line(ax - sl - 3, ay, ax + bd + 3, ay, stroke=K.GREY, sw=0.13, dash="4 1 0.8 1")
    s.dim_h(ax, ax + bd, ay - br - 3.5, ay - br, ay - br, "%.1f" % p["body_depth_mm"], size=2.1)
    s.dim_v(ay - br, ay + br, ax + bd + 5.0, ax + bd, ax + bd, "Ø%.0f" % p["body_dia_mm"], size=2.1,
            text_left=False)
    s.dim_h(ax - sl, ax, ay + 17.5, ay + 3.0 * S2, ay + 3.0 * S2, "%.0f shaft" % p["shaft_len_mm"], size=2.1)
    nx = ax + bd + 13.0
    s.lines(nx, ay - 12.0, ["needs ≥ 25 mm free", "depth behind panel"], size=2.1, fill=K.ORANGE,
            weight="bold", lh=2.7)
    s.lines(nx, ay - 6.4, ["(body + lugs + wires)", "",
                           "max panel %.1f mm" % (p["bushing_len_mm"] - p["nut_thk_mm"] - p["washer_thk_mm"]),
                           "nut M7×0.75, %.1f A/F" % p["nut_af_mm"],
                           "washer Ø%.0f (both supplied)" % p["washer_od_mm"]], size=1.9, lh=2.6)

    # ---------------- parameter table + checks ---------------------------------
    tx0, ty0 = 162.0, 101.0
    s.text(tx0, ty0, "VALUES USED  (* = estimate — measure it, see README)", size=2.4, weight="bold")
    rows = [
        ("pitch_hihat_snare_mm", "HI-HAT → SNARE shaft pitch"),
        ("pitch_snare_bass_mm", "SNARE → BASS shaft pitch"),
        ("shaft_dia_mm", "existing shaft Ø"),
        ("new_hole_below_snare_mm", "new hole below SNARE"),
        ("new_hole_right_of_snare_mm", "new hole right of SNARE"),
        ("screw_right_of_snare_mm", "screw right of SNARE"),
        ("screw_below_snare_mm", "screw below SNARE"),
        ("outputs_label_top_below_snare_mm", "OUTPUTS label top below SNARE"),
        ("panel_thickness_mm", "panel thickness"),
        ("tuning_pcb_bottom_below_snare_mm", "behind: tuning-PCB bottom below SNARE"),
        ("jack_body_top_below_snare_mm", "behind: jack-body top below SNARE"),
        ("free_depth_behind_panel_mm", "behind: free depth at the hole"),
    ]
    y = ty0 + 3.6
    for k, lab in rows:
        v = m[k]["value"]
        vs = "—" if v is None else "%.1f" % v
        ok = m[k].get("measured")
        s.text(tx0 + 1, y, lab, size=2.0)
        s.text(tx0 + 78, y, vs + ("  " if ok else " *"), size=2.0, anchor="end", family=K.MONO,
               fill=K.INK if ok else K.RED)
        s.line(tx0, y + 0.8, tx0 + 80, y + 0.8, stroke=K.LIGHT, sw=0.12)
        y += 2.65
    s.text(tx0 + 1, y, "lug direction (seen from outside): %s · tab hole: %s" % (
        m["lug_direction"]["value"], "drill" if m["drill_tab_hole"]["value"] else "optional"), size=2.0)
    y += 4.6
    s.text(tx0, y, "AUTOMATIC CHECKS (re-run after measuring)", size=2.4, weight="bold")
    y += 3.3
    colmap = {"OK": K.GREEN, "WARN": K.ORANGE, "STOP": K.RED}
    for lv, txt in chk:
        s.text(tx0 + 1, y, lv, size=1.9, weight="bold", fill=colmap[lv], family=K.MONO)
        s.text(tx0 + 9, y, txt, size=1.9)
        y += 2.6

    K.title_block(s, 182.0, 167.0, 100.0, 35.0, "Rear-panel drill template, SNARE DELAY pot",
                  DWG_NO, "1:1 (side view 2:1)", DATE, rev=REV, note="A4 landscape · fits US Letter")
    s.save(path)


# ---------------------------------------------------------------------------
def write_dxf(m, g, path):
    try:
        import ezdxf
    except ImportError:
        print("ezdxf not installed: skipping DXF (pip install --user ezdxf)")
        return False
    p = m["pot"]
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    for name, col, lt in (("DRILL", 1, "CONTINUOUS"), ("EXISTING", 8, "CONTINUOUS"),
                          ("CUTLINE", 7, "DASHED"), ("CENTER", 8, "CENTER"),
                          ("BEHIND_PANEL", 5, "DASHED"), ("KEEPOUT", 30, "DASHED"),
                          ("DIMENSIONS", 7, "CONTINUOUS"), ("TEXT", 7, "CONTINUOUS"),
                          ("SCALEBAR", 7, "CONTINUOUS")):
        if name not in doc.layers:
            doc.layers.add(name, color=col, linetype=lt)
    msp = doc.modelspace()
    # DXF is y-up: flip our y (down) to -y
    F = lambda x, y: (x, -y)  # noqa: E731

    def txt(s, x, y, h=2.5, layer="TEXT", align=None):
        t = msp.add_text(s, dxfattribs={"layer": layer, "height": h})
        t.set_placement(F(x, y), align=align or ezdxf.enums.TextEntityAlignment.LEFT)

    for name, (x, y) in (("HI-HAT", g["hihat"]), ("SNARE", g["snare"]), ("BASS", g["bass"])):
        msp.add_circle(F(x, y), g["cut_r"], dxfattribs={"layer": "EXISTING"})
        msp.add_line(F(x - g["cut_r"] - 2, y), F(x + g["cut_r"] + 2, y), dxfattribs={"layer": "CENTER"})
        msp.add_line(F(x, y - g["cut_r"] - 2), F(x, y + g["cut_r"] + 2), dxfattribs={"layer": "CENTER"})
        txt(name, x, y - g["cut_r"] - 2, 2.2, align=ezdxf.enums.TextEntityAlignment.BOTTOM_CENTER)
    hx, hy = g["hole"]
    msp.add_circle(F(hx, hy), g["hole_r"], dxfattribs={"layer": "DRILL"})
    msp.add_line(F(hx - 6, hy), F(hx + 6, hy), dxfattribs={"layer": "DRILL"})
    msp.add_line(F(hx, hy - 6), F(hx, hy + 6), dxfattribs={"layer": "DRILL"})
    tx, ty = g["tab"]
    msp.add_circle(F(tx, ty), g["tab_r"], dxfattribs={"layer": "DRILL" if m["drill_tab_hole"]["value"] else "BEHIND_PANEL"})
    yb0 = max(g["label_y"], hy + g["keep_r"]) + 6.0
    txt("NEW HOLE D%.1f-%.1f mm (%s)" % (p["bushing_hole_dia_mm"], p.get("bushing_hole_max_dia_mm",
        p["bushing_hole_dia_mm"]), p["model"]), g["hihat"][0] - 15, yb0 - 4.5, 2.0)
    txt("TAB HOLE D%.1f at %.1f mm %s" % (p["tab_hole_dia_mm"], p["tab_offset_mm"],
        "" if m["drill_tab_hole"]["value"] else "(OPTIONAL)"), g["hihat"][0] - 15, yb0 - 1.5, 1.8)
    sx, sy = g["screw"]
    msp.add_circle(F(sx, sy), g["screw_r"], dxfattribs={"layer": "EXISTING"})
    xl, xr = g["hihat"][0] - 17.0, g["bass"][0] + 30.0
    msp.add_line(F(xl + 2, g["label_y"]), F(xr - 2, g["label_y"]), dxfattribs={"layer": "EXISTING"})
    txt("top of OUTPUTS label text", xr - 2, g["label_y"] + 3, 1.8,
        align=ezdxf.enums.TextEntityAlignment.RIGHT)
    msp.add_circle(F(hx, hy), g["body_r"], dxfattribs={"layer": "BEHIND_PANEL"})
    msp.add_circle(F(hx, hy), g["keep_r"], dxfattribs={"layer": "KEEPOUT"})
    yb = yb0
    msp.add_lwpolyline([F(xl, -21), F(xr, -21), F(xr, yb), F(xl, yb)], close=True,
                       dxfattribs={"layer": "CUTLINE"})
    # dimensions
    dimst = "EZDXF"
    d = msp.add_linear_dim(base=F(0, -14.5), p1=F(g["hihat"][0], 0), p2=F(0, 0), dimstyle=dimst,
                           override={"dimtxt": 2.5, "dimasz": 2.0, "dimdec": 1, "dimlfac": 1.0, "dimexo": 1.0, "dimgap": 0.8}, dxfattribs={"layer": "DIMENSIONS"})
    d.render()
    d = msp.add_linear_dim(base=F(0, -14.5), p1=F(0, 0), p2=F(g["bass"][0], 0), dimstyle=dimst,
                           override={"dimtxt": 2.5, "dimasz": 2.0, "dimdec": 1, "dimlfac": 1.0, "dimexo": 1.0, "dimgap": 0.8}, dxfattribs={"layer": "DIMENSIONS"})
    d.render()
    d = msp.add_linear_dim(base=F(g["bass"][0] + 13, 0), p1=F(0, 0), p2=F(hx, hy), angle=90, dimstyle=dimst,
                           override={"dimtxt": 2.5, "dimasz": 2.0, "dimdec": 1, "dimlfac": 1.0, "dimexo": 1.0, "dimgap": 0.8}, dxfattribs={"layer": "DIMENSIONS"})
    d.render()
    # 50 mm scale bar
    by = yb + 8
    msp.add_lwpolyline([F(xl, by), F(xl + 50, by), F(xl + 50, by + 2), F(xl, by + 2)], close=True,
                       dxfattribs={"layer": "SCALEBAR"})
    for i in range(6):
        msp.add_line(F(xl + 10 * i, by), F(xl + 10 * i, by + 3), dxfattribs={"layer": "SCALEBAR"})
    txt("50 mm SCALE BAR - PRINT/PLOT AT 1:1", xl + 52, by + 2, 2.2, layer="SCALEBAR")
    txt("DX TimeShift %s rev %s %s - rear-panel drill template - origin = SNARE shaft centre, "
        "view from OUTSIDE, units mm" % (DWG_NO, REV, DATE), xl, by + 8, 2.2)
    txt("CONFIRM CLEARANCE BEHIND PANEL BEFORE DRILLING (findings Q6)", xl, by + 12, 2.2)
    doc.saveas(path)
    return True


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--measurements", default=os.path.join(HERE, "panel_measurements.json"))
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help="override one measurement (marks it as measured)")
    ap.add_argument("--out-dir", default=MECH)
    a = ap.parse_args(argv)
    m = load(a.measurements, a.set)
    g = geometry(m)
    chk = checks(m, g)
    base = os.path.join(a.out_dir, "rear-panel-drill-template")
    draw_svg(m, g, chk, base + ".svg")
    write_dxf(m, g, base + ".dxf")
    print("wrote %s.svg / .dxf" % base)
    miss = unmeasured(m)
    if miss:
        print("NOT MEASURED YET (template says DO NOT DRILL): " + ", ".join(miss))
    for lv, t in chk:
        print("  %-4s %s" % (lv, t))


if __name__ == "__main__":
    main()
