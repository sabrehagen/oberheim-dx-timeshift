"""Tiny SVG drawing kit for the DX TimeShift mechanical drawings.

All coordinates are millimetres. The SVG is written with width/height in mm and a
viewBox in mm, so a 1:1 drawing prints at true size when the PDF is printed at 100 %.
No third-party packages are needed for SVG output.
"""
import math
from xml.sax.saxutils import escape

FONT = "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
MONO = "DejaVu Sans Mono, Liberation Mono, Courier New, monospace"

# Colour palette shared by all drawings (also used for the legend)
INK = "#111111"
GREY = "#7a7a7a"
LIGHT = "#d9d9d9"
RED = "#c8102e"        # +5 V, new hole, warnings
BLACK_WIRE = "#1a1a1a"  # GND
YELLOW = "#e0a800"      # pot wiper
BLUE = "#1f5fbf"        # clock
ORANGE = "#e06c00"      # intercepted snare lines / keep-out
GREEN = "#1d7a3a"       # PCB
RIBBON = "#9a9a9a"      # ribbon cable grey
PURPLE = "#6a3d9a"


def _fmt(v):
    if isinstance(v, float):
        s = "%.3f" % v
        s = s.rstrip("0").rstrip(".")
        return s if s not in ("-0", "") else "0"
    return str(v)


class SVG:
    def __init__(self, width_mm, height_mm, title=""):
        self.w = width_mm
        self.h = height_mm
        self.title = title
        self.items = []
        self.defs = []
        self._marker_ids = set()

    # ------------------------------------------------------------------ basics
    def add(self, s):
        self.items.append(s)

    def _style(self, stroke=INK, sw=0.25, fill="none", dash=None, opacity=None, cap="butt"):
        st = 'stroke="%s" stroke-width="%s" fill="%s"' % (stroke, _fmt(sw), fill)
        if dash:
            st += ' stroke-dasharray="%s"' % dash
        if opacity is not None:
            st += ' opacity="%s"' % _fmt(opacity)
        if cap != "butt":
            st += ' stroke-linecap="%s"' % cap
        return st

    def line(self, x1, y1, x2, y2, stroke=INK, sw=0.25, dash=None, cap="butt", marker_end=None,
             marker_start=None):
        m = ""
        if marker_end:
            m += ' marker-end="url(#%s)"' % self.marker(marker_end, stroke)
        if marker_start:
            m += ' marker-start="url(#%s)"' % self.marker(marker_start, stroke)
        self.add('<line x1="%s" y1="%s" x2="%s" y2="%s" %s%s/>' % (
            _fmt(x1), _fmt(y1), _fmt(x2), _fmt(y2), self._style(stroke, sw, "none", dash, cap=cap), m))

    def polyline(self, pts, stroke=INK, sw=0.25, dash=None, fill="none", cap="round", join="round"):
        p = " ".join("%s,%s" % (_fmt(x), _fmt(y)) for x, y in pts)
        self.add('<polyline points="%s" %s stroke-linejoin="%s"/>' % (
            p, self._style(stroke, sw, fill, dash, cap=cap), join))

    def polygon(self, pts, stroke=INK, sw=0.25, fill="none", dash=None):
        p = " ".join("%s,%s" % (_fmt(x), _fmt(y)) for x, y in pts)
        self.add('<polygon points="%s" %s/>' % (p, self._style(stroke, sw, fill, dash)))

    def path(self, d, stroke=INK, sw=0.25, fill="none", dash=None, cap="butt"):
        self.add('<path d="%s" %s/>' % (d, self._style(stroke, sw, fill, dash, cap=cap)))

    def rect(self, x, y, w, h, stroke=INK, sw=0.25, fill="none", rx=0, dash=None, opacity=None):
        self.add('<rect x="%s" y="%s" width="%s" height="%s" rx="%s" %s/>' % (
            _fmt(x), _fmt(y), _fmt(w), _fmt(h), _fmt(rx), self._style(stroke, sw, fill, dash, opacity)))

    def circle(self, cx, cy, r, stroke=INK, sw=0.25, fill="none", dash=None, opacity=None):
        self.add('<circle cx="%s" cy="%s" r="%s" %s/>' % (
            _fmt(cx), _fmt(cy), _fmt(r), self._style(stroke, sw, fill, dash, opacity)))

    def text(self, x, y, s, size=3.0, anchor="start", weight="normal", fill=INK, family=FONT,
             rotate=None, italic=False, baseline=None):
        tr = ' transform="rotate(%s %s %s)"' % (_fmt(rotate), _fmt(x), _fmt(y)) if rotate else ""
        it = ' font-style="italic"' if italic else ""
        bl = ' dominant-baseline="%s"' % baseline if baseline else ""
        self.add('<text x="%s" y="%s" font-family="%s" font-size="%s" text-anchor="%s" '
                 'font-weight="%s" fill="%s"%s%s%s>%s</text>' % (
                     _fmt(x), _fmt(y), family, _fmt(size), anchor, weight, fill, it, bl, tr,
                     escape(s)))

    def lines(self, x, y, rows, size=3.0, lh=None, **kw):
        """Multi-line text; returns the y below the last line."""
        lh = lh or size * 1.35
        for i, r in enumerate(rows):
            self.text(x, y + i * lh, r, size=size, **kw)
        return y + len(rows) * lh

    # ----------------------------------------------------------------- markers
    def marker(self, kind, colour):
        mid = "%s_%s" % (kind, colour.strip("#"))
        if mid not in self._marker_ids:
            self._marker_ids.add(mid)
            if kind == "arrow":
                self.defs.append(
                    '<marker id="%s" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" '
                    'markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">'
                    '<path d="M0,1.5 L10,5 L0,8.5 z" fill="%s"/></marker>' % (mid, colour))
            elif kind == "dot":
                self.defs.append(
                    '<marker id="%s" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="1.6" '
                    'markerHeight="1.6" markerUnits="userSpaceOnUse">'
                    '<circle cx="5" cy="5" r="5" fill="%s"/></marker>' % (mid, colour))
        return mid

    # -------------------------------------------------------------- drafting
    def arrow_head(self, x, y, angle_deg, size=2.2, colour=INK):
        a = math.radians(angle_deg)
        w = size * 0.32
        bx, by = x - size * math.cos(a), y - size * math.sin(a)
        px, py = -math.sin(a) * w, math.cos(a) * w
        self.polygon([(x, y), (bx + px, by + py), (bx - px, by - py)], stroke=colour, sw=0.05,
                     fill=colour)

    def centre_mark(self, cx, cy, half=4.0, colour=INK, sw=0.18):
        self.line(cx - half, cy, cx + half, cy, stroke=colour, sw=sw, dash="3 0.8 0.6 0.8")
        self.line(cx, cy - half, cx, cy + half, stroke=colour, sw=sw, dash="3 0.8 0.6 0.8")

    def crosshair(self, cx, cy, half=4.0, colour=INK, sw=0.18):
        self.line(cx - half, cy, cx + half, cy, stroke=colour, sw=sw)
        self.line(cx, cy - half, cx, cy + half, stroke=colour, sw=sw)

    def dim_h(self, x1, x2, y, ref_y1=None, ref_y2=None, label="", size=2.6, colour=INK,
              text_above=True, gap=1.0, overshoot=1.5):
        """Horizontal dimension between x1 and x2 drawn at height y. ref_y* = where the
        extension lines start (the feature)."""
        for x, ry in ((x1, ref_y1), (x2, ref_y2)):
            if ry is not None:
                s = 1 if y > ry else -1
                self.line(x, ry + s * gap, x, y + s * overshoot, stroke=colour, sw=0.13)
        self.line(x1, y, x2, y, stroke=colour, sw=0.18)
        self.arrow_head(x1, y, 180, colour=colour)
        self.arrow_head(x2, y, 0, colour=colour)
        ty = y - 0.9 if text_above else y + size + 0.4
        self.text((x1 + x2) / 2, ty, label, size=size, anchor="middle", fill=colour)

    def dim_v(self, y1, y2, x, ref_x1=None, ref_x2=None, label="", size=2.6, colour=INK,
              text_left=True, gap=1.0, overshoot=1.5):
        for yy, rx in ((y1, ref_x1), (y2, ref_x2)):
            if rx is not None:
                s = 1 if x > rx else -1
                self.line(rx + s * gap, yy, x + s * overshoot, yy, stroke=colour, sw=0.13)
        self.line(x, y1, x, y2, stroke=colour, sw=0.18)
        self.arrow_head(x, y1, -90, colour=colour)
        self.arrow_head(x, y2, 90, colour=colour)
        tx = x - 0.9 if text_left else x + 0.9 + size
        self.text(tx, (y1 + y2) / 2, label, size=size, anchor="middle", fill=colour, rotate=-90)

    def leader(self, x1, y1, x2, y2, label, size=2.6, colour=INK, anchor="start", shelf=4.0):
        """Leader from feature point (x1,y1) to text at (x2,y2)."""
        self.line(x2, y2, x1, y1, stroke=colour, sw=0.15)
        self.arrow_head(x1, y1, math.degrees(math.atan2(y1 - y2, x1 - x2)), size=1.8, colour=colour)
        sx = x2 + (shelf if anchor == "start" else -shelf)
        self.line(x2, y2, sx, y2, stroke=colour, sw=0.15)
        self.text(sx + (0.8 if anchor == "start" else -0.8), y2 + size * 0.35, label, size=size,
                  anchor=anchor, fill=colour)

    # ------------------------------------------------------------------ output
    def tostring(self):
        head = ('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'
                '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="%smm" height="%smm" '
                'viewBox="0 0 %s %s">\n' % (_fmt(self.w), _fmt(self.h), _fmt(self.w), _fmt(self.h)))
        t = "<title>%s</title>\n" % escape(self.title) if self.title else ""
        d = "<defs>\n%s\n</defs>\n" % "\n".join(self.defs) if self.defs else ""
        bg = '<rect x="0" y="0" width="%s" height="%s" fill="#ffffff"/>\n' % (_fmt(self.w), _fmt(self.h))
        return head + t + d + bg + "\n".join(self.items) + "\n</svg>\n"

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.tostring())


# ---------------------------------------------------------------------------
# Title block and legend shared by every drawing
# ---------------------------------------------------------------------------
PROJECT = "DX TimeShift (snare) for Oberheim DX, board 1721A"


def title_block(s, x, y, w, h, drawing, dwg_no, scale, date, rev="A", sheet="1 / 1",
                units="mm", note=""):
    s.rect(x, y, w, h, sw=0.5)
    r1 = y + h * 0.30
    r2 = y + h * 0.62
    s.line(x, r1, x + w, r1, sw=0.25)
    s.line(x, r2, x + w, r2, sw=0.25)
    c1 = x + w * 0.34
    c2 = x + w * 0.62
    c3 = x + w * 0.80
    s.line(c1, r2, c1, y + h, sw=0.25)
    s.line(c2, r2, c2, y + h, sw=0.25)
    s.line(c3, r2, c3, y + h, sw=0.25)
    lab = 1.7
    s.text(x + 1.2, y + 2.4, "PROJECT", size=lab, fill=GREY)
    s.text(x + 1.2, y + h * 0.30 - 1.6, PROJECT, size=min(3.0, w / 34.0), weight="bold")
    s.text(x + 1.2, r1 + 2.4, "DRAWING", size=lab, fill=GREY)
    s.text(x + 1.2, r2 - 1.6, drawing, size=min(3.4, w / 30.0), weight="bold")
    cells = [(x, "DWG NO.", dwg_no), (c1, "SCALE", scale), (c2, "REV", rev), (c3, "DATE", date)]
    for cx, k, v in cells:
        s.text(cx + 1.2, r2 + 2.4, k, size=lab, fill=GREY)
        s.text(cx + 1.2, y + h - 1.8, v, size=2.6 if k != "SCALE" else 2.4, weight="bold")
    s.text(x + w - 1.2, y + 2.4, "SHEET %s   UNITS %s" % (sheet, units), size=lab, fill=GREY,
           anchor="end")
    if note:
        s.text(x + w - 1.2, r1 + 2.4, note, size=lab, fill=GREY, anchor="end")


def legend(s, x, y, entries, title="LEGEND", size=2.4, w=None, sw_scale=1.0):
    """entries: list of (kind, colour, label, dash) where kind in line|circle|box|text."""
    lh = size * 1.75
    w = w or 70
    h = 4.5 + lh * len(entries) + 1.0
    s.rect(x, y, w, h, sw=0.3, fill="#ffffff")
    s.text(x + 1.5, y + 3.4, title, size=size, weight="bold")
    yy = y + 4.5 + lh * 0.6
    for kind, colour, label, dash in entries:
        if kind == "line":
            s.line(x + 2, yy, x + 12, yy, stroke=colour, sw=0.5 * sw_scale, dash=dash)
        elif kind == "thick":
            s.line(x + 2, yy, x + 12, yy, stroke=colour, sw=1.2 * sw_scale, dash=dash, cap="round")
        elif kind == "circle":
            s.circle(x + 7, yy, 1.5, stroke=colour, sw=0.4, dash=dash)
        elif kind == "box":
            s.rect(x + 2, yy - 1.4, 10, 2.8, stroke=colour, sw=0.3, fill=dash or "none")
        s.text(x + 14, yy + size * 0.35, label, size=size)
        yy += lh
    return y + h


def frame(s, margin_l, margin_t, margin_r, margin_b, zones=True):
    s.rect(margin_l, margin_t, s.w - margin_l - margin_r, s.h - margin_t - margin_b, sw=0.5)
