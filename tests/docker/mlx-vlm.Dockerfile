# Dockerfile for MLX-VLM
# MLX-VLM: https://github.com/Blaizzy/mlx-vlm
# Runs in CPU-only mode on Linux using mlx-cpu.

FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libgomp1 \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --upgrade 'mlx-vlm>=0.5.0' mlx-cpu torch torchvision \
    && python -c "import mlx.core as mx; print(f'mlx: {mx.__file__}')"

WORKDIR /app
RUN mkdir -p /app/models

EXPOSE 8080
