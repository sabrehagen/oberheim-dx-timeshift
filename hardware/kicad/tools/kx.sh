#!/usr/bin/env bash
# Run a command inside the KiCad 9 container with the repo's hardware/ directory at
# /work/hardware.  Two modes:
#   * default: docker run --rm -v <repo>:/work kicad/kicad:9.0 ...   (normal machines)
#   * KX_MODE=copy: the Docker daemon cannot see this filesystem (e.g. when running inside
#     another container). hardware/ is copied into a long-lived container "kicadws"
#     (docker run -d --name kicadws kicad/kicad:9.0 sleep infinity), the command runs in
#     /work there, and hardware/ is copied back.
# 3D models: run tools/fetch_3dmodels.sh once; KICAD9_3DMODEL_DIR is pointed at the cache.
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ENVS=(-e HOME=/tmp -e KICAD9_3DMODEL_DIR=/work/hardware/kicad/3dmodels-cache
      -e KICAD9_SYMBOL_DIR=/usr/share/kicad/symbols -e KICAD9_FOOTPRINT_DIR=/usr/share/kicad/footprints
      -e PYTHONDONTWRITEBYTECODE=1)
if [ "${KX_MODE:-run}" = "copy" ]; then
  docker exec kicadws sh -c 'rm -rf /work/hardware 2>/dev/null; mkdir -p /work' 2>/dev/null || \
    docker exec -u 0 kicadws sh -c 'mkdir -p /work && chown 1000:1000 /work && rm -rf /work/hardware'
  # Only the directories this toolchain owns are synced (never hardware/mechanical etc.).
  DIRS="hardware/kicad hardware/exports hardware/gerbers hardware/renders"
  mkdir -p $(for d in $DIRS; do echo "$ROOT/$d"; done)
  tar -C "$ROOT" --exclude=hardware/kicad/timeshift/timeshift-backups -cf - $DIRS | docker exec -i kicadws tar -C /work -xf -
  set +e
  docker exec "${ENVS[@]}" -w /work kicadws "$@"
  rc=$?
  docker exec kicadws tar -C /work -cf - $DIRS | tar -C "$ROOT" -xf -
  exit $rc
else
  exec docker run --rm --user "$(id -u):$(id -g)" "${ENVS[@]}" -v "$ROOT":/work -w /work kicad/kicad:9.0 "$@"
fi
