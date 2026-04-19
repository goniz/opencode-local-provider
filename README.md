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
- Includes supported default `127.0.0.1` targets automatically
- Detects loaded models at runtime
- Routes each model to the correct target URL
- API key auth currently unsupported
- Uses OpenCode global config, not project-local config

## Example

https://github.com/user-attachments/assets/8693fd22-c311-4cb4-913b-93d5a531b23c

## Install

```bash
opencode plugin --global opencode-local-provider
```

OpenCode will install the package and update the config for you.

## Provider Setup

Default targets are enabled automatically for these backends and ports:

- Ollama: `http://127.0.0.1:11434`
- LM Studio: `http://127.0.0.1:1234`
- llama.cpp: `http://127.0.0.1:8080`
- vLLM: `http://127.0.0.1:8000`
- Exo: `http://127.0.0.1:52415`

If your local providers do not need auth, you can start using the `local` provider immediately.

**Note: API key authentication is currently unsupported.**

## Custom Targets

If you need non-default hosts or ports, use the CLI auth flow to add an explicit target:

```bash
opencode auth login --provider local --method "Add Custom Target"
```

This will prompt for:

- a target ID, like `studio` or `remote-ollama`
- the local provider URL
- the API key (enter `none` since API keys are currently unsupported)

The target is then stored in OpenCode global config.

You can also add explicit targets manually in config if needed:

```json
{
  "provider": {
    "local": {
      "name": "Local Provider",
      "options": {
        "includeDefaults": true,
        "targets": {
          "studio": {
            "url": "http://192.168.1.10:1234/v1",
            "kind": "lmstudio"
          }
        }
      }
    }
  }
}
```

Explicit targets override the built-in defaults when they use the same ID.
The CLI custom-target method is the supported way to add explicit targets without editing config directly.

## Resulting Config

The plugin stores explicit targets in OpenCode global config under the `local` provider:

```json
{
  "provider": {
    "local": {
      "name": "Local Provider",
      "options": {
        "includeDefaults": true,
        "targets": {
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

With `includeDefaults: true`, the built-in default `127.0.0.1` targets are also checked at runtime even though they are not written into config.

**Note: API key authentication is currently unsupported.**

## How Models Appear

Models are discovered dynamically from each configured target. (Only **loaded** models)

To avoid collisions, model IDs are prefixed with the target ID:

- `ollama/llama3.2`
- `studio/qwen2.5-coder`

Each generated model keeps its own target URL internally, so requests go to the correct backend.

## Notes

- Model detection is runtime-based, not static
- If loaded models change in your local server, OpenCode will see the updated list on the next provider refresh
- Built-in default `127.0.0.1` targets are enabled unless you set `includeDefaults` to `false`
- **API key authentication is currently unsupported**

## Development

Build the plugin:

```bash
bun run build
```

Run the provider integration suite:

```bash
bun run test:providers
```

Run a single provider suite:

```bash
PROVIDER_SUITE=ollama bun run test:providers
```

Notes:

- The suite starts provider containers for `ollama`, `lmstudio`, `llamacpp`, `vllm`, and `exo` from `tests/docker/compose.providers.yml`.
- The Bun test runner talks to each service over the Docker Compose network using each container's internal IP. It does not require publishing ports to the host.
- The first run can be slow because the containers may need to download model assets, LM Studio bootstraps its headless runtime at startup, and Exo warms models to a real ready state before the suite proceeds.
- CI runs the same suite per provider via `.github/workflows/provider-tests.yml`.
- If you change provider models or startup behavior, update `tests/docker/compose.providers.yml` and the Bun orchestration helpers in `tests/docker/` instead of duplicating those details here.

Install it locally in OpenCode with a file path plugin entry, for example:

```bash
opencode plugin $PWD
```

## License

MIT
