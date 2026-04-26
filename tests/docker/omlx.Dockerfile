# Multi-stage Dockerfile for oMLX
# oMLX: https://github.com/jundot/omlx
# Runs in CPU-only mode on Linux using mlx-cpu

# Stage 1: Builder
FROM python:3.11-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (needed for building git-sourced MLX packages)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Install uv for faster Python package resolution
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone oMLX repository
WORKDIR /src
RUN git clone --depth 1 https://github.com/jundot/omlx.git .

ENV PATH="/root/.cargo/bin:/root/.local/bin:$PATH"

# Create venv and install oMLX
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
RUN uv venv /app/.venv
RUN uv pip install .

# Replace mlx (Metal) with mlx-cpu (CPU) for Linux
RUN uv pip install mlx-cpu

# Verify mlx import works with CPU backend
RUN python -c "import mlx.core as mx; print(f'mlx: {mx.__file__}')"

# Stage 2: Runtime
FROM python:3.11-slim-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates libgomp1 g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /src /app

ENV PATH="/app/.venv/bin:$PATH"

RUN mkdir -p /app/models

EXPOSE 8000
