# *opencode-local-provider* OpenCode Plugin

OpenCode plugin that adds a single `local` provider with runtime model detection for local OpenAI-compatible servers.

It currently supports the following local backends:
- Ollama
- LM Studio
- llama.cpp server
- vLLM
- Exo

Instead of creating one provider per server, this plugin keeps one `local` provider and lets you register multiple named targets. Each target is probed at runtime, and its currently loaded models are exposed automatically.

## Features

- Adds a `local` provider to OpenCode
- Supports multiple local URLs under one provider
- Detects loaded models at runtime
- Routes each model to the correct target URL
- Supports optional shared API key auth
- Uses OpenCode global config, not project-local config

## Example

https://github.com/user-attachments/assets/8693fd22-c311-4cb4-913b-93d5a531b23c

## Install

```bash
opencode plugin --global opencode-local-provider
```

OpenCode will install the package and update the config for you.

## Provider Setup

Run:

```bash
opencode auth login
```

Choose `local`, then enter:
- a target ID, like `ollama` or `studio`
- the local server URL
- an optional shared API key

The target ID can be any valid provider ID string. It is used as the prefix for discovered model IDs.

You can repeat this flow to add more targets. (target IDs should be unique)

## Resulting Config

The plugin stores targets in OpenCode global config under the `local` provider:

```json
{
  "provider": {
    "local": {
      "name": "Local Provider",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "targets": {
          "ollama": {
            "url": "http://localhost:11434/v1",
            "kind": "ollama"
          },
          "studio": {
            "url": "http://127.0.0.1:1234/v1",
            "kind": "lmstudio"
          }
        }
      }
    }
  }
}
```

If you set a shared API key, it is stored through OpenCode auth for the `local` provider.

## How Models Appear

Models are discovered dynamically from each configured target. (Only **loaded** models)

To avoid collisions, model IDs are prefixed with the target ID:

- `ollama/llama3.2`
- `studio/qwen2.5-coder`

Each generated model keeps its own target URL internally, so requests go to the correct backend.

## Notes

- Model detection is runtime-based, not static
- If loaded models change in your local server, OpenCode will see the updated list on the next provider refresh
- Targets use one shared API key for the `local` provider
- Enter `none` in the auth prompt to clear the shared API key

## Development

Build the plugin:

```bash
bun run build
```

Run the real provider integration suite in Docker Compose:

```bash
bun run test:providers
```

Run a single provider suite:

```bash
bun run test:providers ollama
```

Notes:

- The suite starts real provider containers for `ollama`, `lmstudio`, `llamacpp`, `vllm`, and `exo` from `tests/docker/compose.providers.yml`.
- The runner talks to each service over the Docker Compose network using each container's internal IP. It does not require publishing ports to the host.
- The first run can be slow because the containers may need to download model assets, LM Studio bootstraps its headless runtime at startup, and Exo warms models to a real ready state before the suite proceeds.
- CI runs the same suite per provider via `.github/workflows/provider-tests.yml`.
- If you change provider models or startup behavior, update `tests/docker/compose.providers.yml` and the related health checks instead of duplicating those details here.

Install it locally in OpenCode with a file path plugin entry, for example:

```bash
opencode plugin $PWD
```

## License

MIT
