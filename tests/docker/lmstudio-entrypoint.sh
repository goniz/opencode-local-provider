#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends bash ca-certificates curl libatomic1 libgomp1 procps tar util-linux-extra python3
rm -rf /var/lib/apt/lists/*

curl -fsSL https://lmstudio.ai/install.sh | bash -s -- --no-modify-path

export PATH="/root/.lmstudio/bin:${PATH}"

lms daemon up
lms server start --bind 0.0.0.0

until curl -fsS http://127.0.0.1:1234/lmstudio-greeting >/dev/null 2>&1; do
  sleep 2
done

lms get "$LMSTUDIO_MODEL"
lms load "$LMSTUDIO_MODEL" --identifier="$LMSTUDIO_MODEL_ID" --context-length="$LMSTUDIO_CONTEXT" --gpu=0

waitpid $(pidof llmster)