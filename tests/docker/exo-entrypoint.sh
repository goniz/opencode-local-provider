#!/usr/bin/env bash
set -euo pipefail

# Exo entrypoint script
# Loads a small model for testing

EXO_MODEL="${EXO_MODEL:-mlx-community/Llama-3.2-1B-Instruct-4bit}"
EXO_PORT="${EXO_PORT:-52415}"

# Create models directory if needed
mkdir -p /app/models

# Start exo in the background with --no-worker for single-node operation
# The API will be available at http://0.0.0.0:52415
uv run exo --host 0.0.0.0 --port "${EXO_PORT}" --no-worker &
exo_pid=$!

cleanup() {
  kill "$exo_pid" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

# Wait for exo to be ready
echo "Waiting for Exo to start..."
until curl -fsS "http://127.0.0.1:${EXO_PORT}/models" >/dev/null 2>&1; do
  sleep 2
done

echo "Exo is ready. Loading model: ${EXO_MODEL}"

# Add the model (this will download it if not present)
curl -fsS -X POST "http://127.0.0.1:${EXO_PORT}/models/add" \
  -H 'Content-Type: application/json' \
  -d "{\"model_id\": \"${EXO_MODEL}\"}" || true

echo "Model ${EXO_MODEL} loaded successfully"

# Wait for exo process
wait "$exo_pid"
