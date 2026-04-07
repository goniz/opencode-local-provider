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

# Patch exo's manifest for Linux CPU-only builds.
# Keep exo's custom MLX sources and only disable mflux on Linux, since mflux
# is what pulls mlx[cuda13].
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

path.write_text(text)
PY

# Create venv at the same path we'll use in runtime and install using exo's
# uv project resolution so the custom MLX sources are honored.
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
RUN uv venv /app/.venv
RUN uv sync --no-dev --python /app/.venv/bin/python
RUN . /app/.venv/bin/activate && python -c "import mlx.core as mx; print(mx.__file__)"

# Stage 2: Runtime
FROM python:3.13-slim-bookworm AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
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
