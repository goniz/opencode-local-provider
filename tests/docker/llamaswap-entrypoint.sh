#!/usr/bin/env bash
set -euo pipefail

cat > /app/config.yaml <<EOF
models:
  ${LLAMASWAP_MODEL}:
    cmd: llama-server -hf "${LLAMASWAP_MODEL_REPO}" --port \${PORT} --ctx-size "${LLAMASWAP_CONTEXT}"
    metadata:
      n_ctx: ${LLAMASWAP_CONTEXT}

hooks:
  onStartup:
    preload:
      - ${LLAMASWAP_MODEL}
EOF

exec /app/llama-swap --config /app/config.yaml --listen 0.0.0.0:8080
