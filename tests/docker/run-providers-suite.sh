#!/usr/bin/env bash
set -euo pipefail

ROOT="$(dirname "$0")/../.."
COMPOSE_FILE="$ROOT/tests/docker/compose.providers.yml"
export COMPOSE_PROJECT_NAME="provider-tests"

SUITE="${1:-all}"
SERVICES=(ollama lmstudio llamacpp vllm exo)

is_valid_suite() {
  local candidate="$1"

  if [[ "$candidate" == "all" ]]; then
    return 0
  fi

  for service in "${SERVICES[@]}"; do
    if [[ "$service" == "$candidate" ]]; then
      return 0
    fi
  done

  return 1
}

if ! is_valid_suite "$SUITE"; then
  printf 'Unknown provider suite: %s\n' "$SUITE" >&2
  printf 'Expected one of: all, %s\n' "${SERVICES[*]}" >&2
  exit 1
fi

cleanup() {
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
}

service_ip() {
  local service="$1"
  local container_ids
  local container_id

  mapfile -t container_ids < <(
    docker ps \
      --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
      --filter "label=com.docker.compose.service=$service" \
      --format '{{.ID}}'
  )

  container_id="${container_ids[0]:-}"
  if [[ -z "$container_id" ]]; then
    printf 'No running container found for service: %s\n' "$service" >&2
    exit 1
  fi

  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container_id"
}

service_url() {
  local service="$1"
  local port="$2"

  if [[ "$SUITE" != "all" && "$SUITE" != "$service" ]]; then
    return 0
  fi

  printf 'http://%s:%s' "$(service_ip "$service")" "$port"
}

trap cleanup EXIT INT TERM

if [[ "$SUITE" == "all" ]]; then
  docker compose -f "$COMPOSE_FILE" up -d --wait
else
  docker compose -f "$COMPOSE_FILE" up -d --wait "$SUITE"
fi

OLLAMA_URL="$(service_url ollama 11434)"
LMSTUDIO_URL="$(service_url lmstudio 1234)"
LLAMACPP_URL="$(service_url llamacpp 8080)"
VLLM_URL="$(service_url vllm 8000)"
EXO_URL="$(service_url exo 52415)"

REAL_PROVIDER_SUITE=1 \
PROVIDER_SUITE="$([[ "$SUITE" == "all" ]] && printf '' || printf '%s' "$SUITE")" \
OLLAMA_URL="$OLLAMA_URL" \
LMSTUDIO_URL="$LMSTUDIO_URL" \
LLAMACPP_URL="$LLAMACPP_URL" \
VLLM_URL="$VLLM_URL" \
EXO_URL="$EXO_URL" \
  bun test "./tests/providers.real.test.ts"
