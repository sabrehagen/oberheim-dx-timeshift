#!/bin/sh
# All KiCad exports of the DX TimeShift board. Runs INSIDE the kicad/kicad:9.0 container
# from the repository root (see build_all.sh / kx.sh).
set -e
P=hardware/kicad/timeshift
mkdir -p hardware/exports hardware/gerbers hardware/renders
cd $P
X=../../exports
GB=../../gerbers
RN=../../renders

echo "== schematic"
kicad-cli sch export pdf -o $X/schematic.pdf timeshift.kicad_sch
rm -rf /tmp/schsvg && kicad-cli sch export svg -o /tmp/schsvg timeshift.kicad_sch && cp /tmp/schsvg/timeshift.svg $X/schematic.svg
kicad-cli sch export bom --group-by 'Value,Footprint' --ref-range-delimiter '' \
  --fields 'Reference,Value,Footprint,${QUANTITY},MPN,Socket,Cable,Description' \
  --labels 'References,Value,Footprint,Qty,Part / MPN,Socket,Cable,Description' \
  -o $X/bom.csv timeshift.kicad_sch

echo "== board files"
kicad-cli pcb export pos --format csv --units mm --side both -o $X/positions.csv timeshift.kicad_pcb
kicad-cli pcb export glb -f --subst-models --include-tracks --include-pads --include-zones \
  --include-silkscreen --include-soldermask -o $X/board.glb timeshift.kicad_pcb
kicad-cli pcb export step -f --subst-models -o $X/board.step timeshift.kicad_pcb
kicad-cli pcb export svg --layers F.Cu,F.Mask,F.Silkscreen,Edge.Cuts --mode-single --page-size-mode 2 \
  --exclude-drawing-sheet --drill-shape-opt 2 -o $X/pcb-top.svg timeshift.kicad_pcb
kicad-cli pcb export svg --layers B.Cu,B.Mask,B.Silkscreen,Edge.Cuts --mirror --mode-single --page-size-mode 2 \
  --exclude-drawing-sheet --drill-shape-opt 2 -o $X/pcb-bottom.svg timeshift.kicad_pcb
kicad-cli pcb export pdf --layers F.Fab,F.Silkscreen,Edge.Cuts --include-border-title --mode-single \
  -o $X/fab-assembly-top.pdf timeshift.kicad_pcb

echo "== gerbers + drills"
rm -rf $GB/*.g* $GB/*.drl $GB/*.zip
kicad-cli pcb export gerbers --layers F.Cu,B.Cu,F.Mask,B.Mask,F.Silkscreen,B.Silkscreen,Edge.Cuts \
  --subtract-soldermask -o $GB/ timeshift.kicad_pcb
kicad-cli pcb export drill --format excellon --excellon-units mm --excellon-separate-th \
  --generate-map --map-format gerberx2 -o $GB/ timeshift.kicad_pcb
python3 - <<'PY'
import glob, os, zipfile
os.chdir("../../gerbers")
files = sorted(f for f in glob.glob("timeshift*") if not f.endswith(".zip"))
with zipfile.ZipFile("timeshift-revA-gerbers.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f)
print("zipped", len(files), "files")
PY

echo "== 3D renders"
R="kicad-cli pcb render --quality high --background opaque -w 2400 -h 1700"
$R --side top -o $RN/top.png timeshift.kicad_pcb
$R --side bottom -o $RN/bottom.png timeshift.kicad_pcb
$R --perspective --rotate '-50,0,-30' --zoom 0.9 -o $RN/perspective.png timeshift.kicad_pcb
$R --perspective --rotate '-40,0,30' --zoom 0.9 -o $RN/perspective-2.png timeshift.kicad_pcb
python3 ../tools/bare_board.py timeshift.kicad_pcb /tmp/bare.kicad_pcb
cp timeshift.kicad_pro /tmp/bare.kicad_pro
$R --side top -o $RN/top-bare-board.png /tmp/bare.kicad_pcb
echo "exports done"
