#!/usr/bin/env bash
set -euo pipefail

ollama serve &
server_pid=$!

cleanup() {
  kill "$server_pid" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

until ollama list >/dev/null 2>&1; do
  sleep 1
done

ollama pull "$OLLAMA_MODEL"

ollama run "$OLLAMA_MODEL" "hello" >/dev/null 2>&1 || true

wait "$server_pid"
