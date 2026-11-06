#!/usr/bin/env bash
# Rebuild the whole DX TimeShift hardware package from netlist.py:
#   libraries -> project -> schematic -> ERC -> netlist check -> PCB -> autoroute ->
#   pours -> DRC (+ schematic parity) -> exports, gerbers, renders, diagram.
# Requirements: Docker (kicad/kicad:9.0 and ghcr.io/freerouting/freerouting images),
# curl, python3, rsvg-convert (librsvg2-bin) for the diagram PNG.
# If Docker cannot bind-mount this checkout (e.g. you are inside a container), run with
# KX_MODE=copy (needs: docker run -d --name kicadws kicad/kicad:9.0 sleep infinity).
set -euo pipefail
cd "$(dirname "$0")/../../.."
T=hardware/kicad/tools
P=hardware/kicad/timeshift
KX=$T/kx.sh

bash $T/fetch_3dmodels.sh >/dev/null
$KX python3 $T/gen_libs.py
$KX python3 $T/gen_project.py
$KX python3 $T/gen_schematic.py
$KX sh -c "cd $P && kicad-cli sch erc --severity-all --exit-code-violations -o reports/erc.rpt timeshift.kicad_sch \
           && kicad-cli sch export netlist -o reports/timeshift.net timeshift.kicad_sch"
python3 $T/check_netlist.py $P/reports/timeshift.net

$KX python3 $T/gen_pcb.py
$T/route.sh
$KX python3 $T/finish_pcb.py
rm -f $P/timeshift.dsn $P/timeshift.ses
$KX sh -c "cd $P && kicad-cli pcb drc --schematic-parity --severity-all --exit-code-violations -o reports/drc.rpt timeshift.kicad_pcb"

$KX sh $T/exports.sh
$KX python3 $T/gen_diagram.py hardware/renders/assembly-diagram.svg
rsvg-convert -w 1880 -b white hardware/renders/assembly-diagram.svg -o hardware/renders/assembly-diagram.png
rm -rf $P/timeshift-backups $P/fp-info-cache $P/_* 2>/dev/null || true
echo "BUILD OK: ERC and DRC clean, see $P/reports/"
