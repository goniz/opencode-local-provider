# opencode-local-provider

OpenCode plugin that adds a single `local` provider with runtime model detection for local OpenAI-compatible servers.

It is designed for setups like:
- Ollama
- LM Studio
- llama.cpp
- vLLM

Instead of creating one provider per server, this plugin keeps one `local` provider and lets you register multiple named targets. Each target is probed at runtime, and its currently loaded models are exposed automatically.

## Features

- Adds a `local` provider to OpenCode
- Supports multiple local URLs under one provider
- Detects loaded models at runtime
- Routes each model to the correct target URL
- Supports optional shared API key auth
- Uses OpenCode global config, not project-local config

## Install

```bash
opencode plugin opencode-local-provider
```

To install globally instead of per-project:

```bash
opencode plugin opencode-local-provider --global
```

OpenCode will install the package and update config for you.

## Setup

Run:

```bash
opencode auth login
```

Choose `local`, then enter:
- a target ID, like `ollama` or `studio`
- the local server URL
- an optional shared API key

You can repeat this flow to add more targets.

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
            "url": "http://localhost:11434/v1"
          },
          "studio": {
            "url": "http://127.0.0.1:1234/v1"
          }
        }
      }
    }
  }
}
```

If you set a shared API key, it is stored through OpenCode auth for the `local` provider.

## How Models Appear

Models are discovered dynamically from each configured target.

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

Install it locally in OpenCode with a file path plugin entry, for example:

```bash
opencode plugin file:///absolute/path/to/opencode-local-provider/
```

## License

MIT
