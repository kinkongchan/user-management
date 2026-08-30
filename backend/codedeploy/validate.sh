#!/bin/bash
set -euo pipefail

for _ in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then
    exit 0
  fi
  sleep 3
done

echo "FastAPI /health did not become ready"
exit 1
