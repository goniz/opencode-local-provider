#!/usr/bin/env bash
set -euo pipefail

# Exo entrypoint script
# Loads a small model for testing

EXO_MODEL="${EXO_MODEL:-mlx-community/Qwen3-0.6B-4bit}"
EXO_PORT="${EXO_PORT:-52415}"

# Create models directory if needed
mkdir -p /app/models

# Start exo with its API enabled on the requested port.
exo --api-port "${EXO_PORT}" &
exo_pid=$!

cleanup() {
  kill "$exo_pid" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

# Wait for exo to be ready.
echo "Waiting for Exo to start..."
until curl -fsS "http://127.0.0.1:${EXO_PORT}/models" >/dev/null 2>&1; do
  sleep 2
done

echo "Exo is ready. Creating placement for model: ${EXO_MODEL}"

# Ask exo for a valid single-node placement, then create the instance.
placement_payload="$({
  curl -fsS "http://127.0.0.1:${EXO_PORT}/instance/placement?model_id=${EXO_MODEL}" \
    | python -c 'import json, sys; print(json.dumps({"instance": json.load(sys.stdin)}))'
})"

curl -fsS -X POST "http://127.0.0.1:${EXO_PORT}/instance" \
  -H 'Content-Type: application/json' \
  -d "${placement_payload}" >/dev/null

echo "Waiting for model instance to become active..."
until EXO_MODEL="${EXO_MODEL}" EXO_PORT="${EXO_PORT}" python - <<'PY'
import json
import os
import urllib.request

model_id = os.environ["EXO_MODEL"]
port = os.environ["EXO_PORT"]

with urllib.request.urlopen(f"http://127.0.0.1:{port}/state") as response:
    state = json.load(response)

instances = state.get("instances", {})
active = any(
    instance.get("MlxRingInstance", {}).get("shardAssignments", {}).get("modelId") == model_id
    for instance in instances.values()
)

raise SystemExit(0 if active else 1)
PY
do
  sleep 2
done

echo "Model ${EXO_MODEL} loaded successfully"

# Wait for exo process
wait "$exo_pid"
