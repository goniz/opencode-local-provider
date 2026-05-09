#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

builder="provider-tests"

if command -v gh >/dev/null 2>&1; then
  gh auth token | docker login ghcr.io -u "$(gh api user --jq .login)" --password-stdin >/dev/null
else
  cat >&2 <<'EOF'
The GitHub CLI is required to log in to ghcr.io.

Install gh or log in manually with a token that has package read/write access:
  gh auth login
EOF
  exit 1
fi

if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
  docker buildx create --name "$builder" --driver docker-container >/dev/null
fi

docker buildx use "$builder"
docker buildx inspect --bootstrap >/dev/null

docker compose -f tests/docker/compose.providers.yml build omlx mlxvlm exo
