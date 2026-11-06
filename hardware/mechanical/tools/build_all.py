#!/usr/bin/env python3
"""DX TimeShift rev A: rebuild every mechanical drawing.

    python3 hardware/mechanical/tools/build_all.py [--set key=value ...]

1. gen_drill_template.py  -> rear-panel-drill-template.svg + .dxf  (from panel_measurements.json)
2. gen_wiring.py          -> wiring-diagram.svg, dip-plug-mapping.svg
3. SVG -> PDF (true size) and SVG -> PNG previews in preview/

PDF/PNG conversion uses cairosvg if it is installed (pip install --user cairosvg),
otherwise rsvg-convert (sudo apt-get install librsvg2-bin). DXF needs ezdxf
(pip install --user ezdxf). Any --set options are passed to the drill template, e.g.
    python3 build_all.py --set pitch_hihat_snare_mm=20.8 --set pitch_snare_bass_mm=20.6
(editing panel_measurements.json is better: the values are then kept.)
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MECH = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import gen_drill_template  # noqa: E402
import gen_wiring  # noqa: E402

DRAWINGS = ["rear-panel-drill-template", "wiring-diagram", "dip-plug-mapping"]


def convert(svg, out, fmt, dpi=150):
    try:
        import cairosvg
        if fmt == "pdf":
            cairosvg.svg2pdf(url=svg, write_to=out)
        else:
            cairosvg.svg2png(url=svg, write_to=out, dpi=dpi, background_color="white")
        return "cairosvg"
    except ImportError:
        pass
    exe = shutil.which("rsvg-convert")
    if not exe:
        raise SystemExit("Need cairosvg (pip install --user cairosvg) or rsvg-convert "
                         "(sudo apt-get install librsvg2-bin) to make PDF/PNG")
    args = [exe, "-f", fmt, "-o", out]
    if fmt == "png":
        args += ["-d", str(dpi), "-p", str(dpi), "-b", "white"]
    subprocess.check_call(args + [svg])
    return "rsvg-convert"


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    gen_drill_template.main(argv)
    gen_wiring.main()
    os.makedirs(os.path.join(MECH, "preview"), exist_ok=True)
    for name in DRAWINGS:
        svg = os.path.join(MECH, name + ".svg")
        tool = convert(svg, os.path.join(MECH, name + ".pdf"), "pdf")
        convert(svg, os.path.join(MECH, "preview", name + ".png"), "png", dpi=150)
        print("%-28s -> .pdf + preview/%s.png  (%s)" % (name + ".svg", name, tool))


if __name__ == "__main__":
    main()
