#!/usr/bin/env bash
# Autoroute timeshift.dsn with Freerouting (Docker image ghcr.io/freerouting/freerouting)
# and write timeshift.ses next to it. The DSN is piped in and the SES piped out, so this
# works even when the Docker daemon cannot bind-mount the repository.
# Neck-down is disabled so every track keeps its net-class width (0.5 / 0.8 mm).
# Freerouting is not fully deterministic: the run is repeated (up to 5 times) until the
# autorouter reports 0 unrouted connections.
set -euo pipefail
PRJ="$(cd "$(dirname "$0")/../timeshift" && pwd)"
PASSES="${PASSES:-100}"
for attempt in 1 2 3 4 5; do
  LOG="$(mktemp)"
  docker run --rm -i -e HOME=/tmp --entrypoint sh ghcr.io/freerouting/freerouting:latest -c \
    "cd /tmp && cat > in.dsn && java -jar /app/freerouting-executable.jar --gui.enabled=false --router.automatic_neckdown=false -de in.dsn -do out.ses -mp $PASSES > log.txt 2>&1; \
     grep -E 'stage completed' log.txt >&2 || true; cat out.ses" \
    < "$PRJ/timeshift.dsn" > "$PRJ/timeshift.ses" 2> "$LOG"
  cat "$LOG" >&2
  if grep -q "Auto-routing stage completed.*(0 unrouted" "$LOG"; then
    rm -f "$LOG"
    echo "routed (attempt $attempt) -> $PRJ/timeshift.ses"
    exit 0
  fi
  rm -f "$LOG"
  echo "attempt $attempt left unrouted connections, retrying" >&2
done
echo "Freerouting did not complete the board" >&2
exit 1
