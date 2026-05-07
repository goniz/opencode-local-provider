#!/usr/bin/env bash
set -euo pipefail

MLX_VLM_MODEL="${MLX_VLM_MODEL:-mlx-community/Qwen2-VL-2B-Instruct-4bit}"
MLX_VLM_PORT="${MLX_VLM_PORT:-8080}"

echo "Starting MLX-VLM with model ${MLX_VLM_MODEL}..."
mlx_vlm.server \
  --host 0.0.0.0 \
  --port "${MLX_VLM_PORT}" \
  --model "${MLX_VLM_MODEL}" &
mlx_vlm_pid=$!

cleanup() {
  kill "$mlx_vlm_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Waiting for MLX-VLM to load model..."
until MLX_VLM_MODEL="${MLX_VLM_MODEL}" MLX_VLM_PORT="${MLX_VLM_PORT}" python - <<'PY'
import json
import os
import urllib.request

model = os.environ["MLX_VLM_MODEL"]
port = os.environ["MLX_VLM_PORT"]

with urllib.request.urlopen(f"http://127.0.0.1:{port}/health") as response:
    health = json.load(response)

raise SystemExit(0 if health.get("loaded_model") == model else 1)
PY
do
  sleep 2
done

echo "MLX-VLM ready with model ${MLX_VLM_MODEL}"
wait "$mlx_vlm_pid"
