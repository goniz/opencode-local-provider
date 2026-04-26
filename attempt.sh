#!/bin/bash
# Attempt to detect loaded MLX model without triggering inference
# Strategy: Use max_tokens=0 to avoid actual token generation

curl -v http://192.168.1.252:8080/v1/chat/completions \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default_model",
    "messages": [{"role": "user", "content": "test"}],
    "max_tokens": 0
  }'
