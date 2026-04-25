# Multi-stage Dockerfile for Exo
# Exo: https://github.com/exo-explore/exo
# Runs in CPU-only mode on Linux

# Stage 1: Builder
FROM python:3.13-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    build-essential \
    libssl-dev \
    pkg-config \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (much faster than npm)
RUN curl -fsSL https://bun.sh/install | bash

# Install Rust nightly toolchain
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && . "$HOME/.cargo/env" \
    && rustup toolchain install nightly

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone Exo repository
WORKDIR /src
RUN git clone --depth 1 https://github.com/exo-explore/exo.git .

# Build the dashboard using Bun (much faster than npm)
ENV PATH="/root/.bun/bin:/root/.cargo/bin:/root/.local/bin:$PATH"
RUN cd dashboard && bun install && bun run build && cd ..

# The only patch needed: ensure mflux is darwin-only to prevent it from
# pulling mlx[cuda13] on Linux. Everything else (version pinning for the
# mlx stack) is handled by uv pip install below.
RUN python - <<'PY'
import re
from pathlib import Path

path = Path('/src/pyproject.toml')
text = path.read_text()

text = re.sub(
    r'^\s+"mflux[^\n]*",\n',
    '  "mflux; sys_platform == \\"darwin\\"",\n',
    text,
    count=1,
    flags=re.MULTILINE,
)

# Bump the mlx override version so uv pip install can pin it to 0.31.2
# (the project's override-dependencies would otherwise block the bump).
text = text.replace("mlx==0.31.1; sys_platform=='linux'", "mlx==0.31.2; sys_platform=='linux'")

path.write_text(text)
PY

# Create venv at the same path we'll use in runtime.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
RUN uv venv /app/.venv

# --extra cpu: installs mlx-cpu (provides libmlx.so on Linux).
# The pip install pins the mlx stack to 0.31.2 — the latest CPU releases
# where mlx-lm has GenerationBatch but doesn't yet need new_thread_local_stream.
RUN uv sync --no-dev --extra cpu --python /app/.venv/bin/python && \
    . /app/.venv/bin/activate && \
    uv pip install mlx==0.31.2 mlx-cpu==0.31.2 mlx-lm==0.31.2
RUN . /app/.venv/bin/activate && python -c "import mlx.core as mx; print(mx.__file__)"

# Stage 2: Runtime
FROM python:3.13-slim-bookworm AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /src /app
COPY --from=builder /src /src

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV EXO_DEFAULT_MODELS_DIR=/app/models
ENV EXO_OFFLINE=false
ENV EXO_RESOURCES_DIR=/app/resources
ENV EXO_DASHBOARD_DIR=/app/dashboard/build

# Create models directory
RUN mkdir -p /app/models

# Expose the default Exo port
EXPOSE 52415

# Health check
HEALTHCHECK --interval=10s --timeout=10s --start-period=30s --retries=30 \
    CMD curl -fsS http://localhost:52415/models >/dev/null 2>&1 || exit 1

# Run exo
CMD ["exo"]
