#!/usr/bin/env bash
# Download only the KiCad 9 3D models this board uses (the kicad/kicad:9.0 Docker image
# ships without 3D models). Usage: fetch_3dmodels.sh [DEST_DIR]   (default ./3dmodels-cache)
# Then run kicad-cli with -e KICAD9_3DMODEL_DIR=<DEST_DIR mounted path>.
set -euo pipefail
DEST="${1:-$(cd "$(dirname "$0")/.." && pwd)/3dmodels-cache}"
BASE="https://gitlab.com/kicad/libraries/kicad-packages3D/-/raw/9.0.0"
MODELS=(
  Package_DIP.3dshapes/DIP-16_W7.62mm_Socket.step
  Package_DIP.3dshapes/DIP-14_W7.62mm_Socket.step
  Package_DIP.3dshapes/DIP-16_W7.62mm.step
  Package_DIP.3dshapes/DIP-14_W7.62mm.step
  Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x15_P2.54mm_Vertical.step
  Connector_IDC.3dshapes/IDC-Header_2x08_P2.54mm_Vertical.step
  Connector_JST.3dshapes/JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical.step
  Connector_JST.3dshapes/JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical.step
  Connector_PinHeader_2.54mm.3dshapes/PinHeader_2x02_P2.54mm_Vertical.step
  Resistor_THT.3dshapes/R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal.step
  Capacitor_THT.3dshapes/CP_Radial_D5.0mm_P2.00mm.step
  Capacitor_THT.3dshapes/C_Disc_D5.0mm_W2.5mm_P5.00mm.step
  TestPoint.3dshapes/TestPoint_Keystone_5005-5009_Compact.step
  Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x15_P2.54mm_Vertical.step
)
for m in "${MODELS[@]}"; do
  mkdir -p "$DEST/$(dirname "$m")"
  [ -s "$DEST/$m" ] || curl -fsSL "$BASE/$m" -o "$DEST/$m" || echo "WARN: could not fetch $m"
done
echo "3D models in $DEST"
