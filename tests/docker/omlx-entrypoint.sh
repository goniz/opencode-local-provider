#!/usr/bin/env bash
set -euo pipefail

OMLX_MODEL="${OMLX_MODEL:-mlx-community/Qwen3-0.6B-4bit}"
OMLX_MODEL_ID="${OMLX_MODEL_ID:-qwen3-0.6b}"
OMLX_PORT="${OMLX_PORT:-8000}"
MODEL_DIR="/app/models"
MODEL_PATH="${MODEL_DIR}/${OMLX_MODEL_ID}"

mkdir -p "${MODEL_DIR}"

# Download model from HuggingFace
echo "Downloading model ${OMLX_MODEL}..."
python -c "
from huggingface_hub import snapshot_download
snapshot_download('${OMLX_MODEL}', local_dir='${MODEL_PATH}')
"
echo "Model downloaded to ${MODEL_PATH}"

# Start oMLX
echo "Starting oMLX..."
omlx serve --model-dir "${MODEL_DIR}" --host 0.0.0.0 --port "${OMLX_PORT}" --no-cache &
omlx_pid=$!

cleanup() {
  kill "$omlx_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Wait for server to be ready
echo "Waiting for oMLX to start..."
until curl -fsS "http://127.0.0.1:${OMLX_PORT}/health" >/dev/null 2>&1; do
  sleep 2
done
echo "oMLX server is ready"

# Trigger model loading with a chat completion request
echo "Loading model ${OMLX_MODEL_ID}..."
curl -fsS "http://127.0.0.1:${OMLX_PORT}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d "{\"model\": \"${OMLX_MODEL_ID}\", \"messages\": [{\"role\": \"user\", \"content\": \"hi\"}], \"max_tokens\": 1}" \
  >/dev/null 2>&1 || echo "Model loading triggered (first request may fail while loading)"

echo "oMLX ready with model ${OMLX_MODEL_ID}"
wait "$omlx_pid"
