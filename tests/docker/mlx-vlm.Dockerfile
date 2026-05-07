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

# Install CPU-only torch wheels so pip does not pull Linux CUDA packages.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple --upgrade torch torchvision \
    && pip install --no-cache-dir --upgrade 'mlx-vlm>=0.5.0' mlx-cpu \
    && python -c "import mlx.core as mx; print(f'mlx: {mx.__file__}')"

WORKDIR /app
RUN mkdir -p /app/models

EXPOSE 8080
