import type { Plugin, ProviderHookContext } from "@opencode-ai/plugin"
import type { Provider } from "@opencode-ai/sdk/v2"

import {
  LOCAL_PROVIDER_ID,
  LOCAL_PROVIDER_NAME,
  LOCAL_PLUGIN_SERVICE,
  OPENAI_COMPATIBLE_NPM,
} from "./constants"
import {
  getCurrentProviderConfig,
  getProviderApiKey,
  getProviderTargets,
  saveProviderTarget,
} from "./config"
import { build } from "./models"
import { detect, probe } from "./probe"
import { trimURL } from "./url"

function validID(value: string) {
  return /^[a-z0-9][a-z0-9-_]*$/.test(value)
}

async function models(provider: Provider, ctx: ProviderHookContext) {
  const list = getProviderTargets(provider)
  if (!Object.keys(list).length) return {}

  const auth = getProviderApiKey(provider, ctx.auth)

  const all = await Promise.all(
    Object.entries(list).map(async ([id, item]) => {
      try {
        const found = await probe(item.url, auth, item.kind)
        return build(provider.id, id, item.url, found.models, provider.models)
      } catch {
        return {}
      }
    }),
  )

  return Object.assign({}, ...all)
}

export const LocalProviderPlugin: Plugin = async (ctx) => {
  await ctx.client.app.log({
    body: {
      service: LOCAL_PLUGIN_SERVICE,
      level: "info",
      message: "Local Provider plugin loaded",
    },
  })

  return {
    config: async (cfg) => {
      cfg.provider ??= {}
      const provider = cfg.provider[LOCAL_PROVIDER_ID] ?? {}
      const list = getProviderTargets(provider as Provider)
      const options = {
        ...provider.options,
        targets: list,
      }
      delete options.baseURL
      cfg.provider[LOCAL_PROVIDER_ID] = {
        ...provider,
        name: provider.name ?? LOCAL_PROVIDER_NAME,
        npm: provider.npm ?? OPENAI_COMPATIBLE_NPM,
        options,
      }
    },
    auth: {
      provider: LOCAL_PROVIDER_ID,
      methods: [
        {
          type: "api",
          label: "Connect to Local Provider",
          prompts: [
            {
              type: "text",
              key: "target",
              message: "Enter a target ID",
              placeholder: "ollama",
              validate(value) {
                if (!value) return "Target ID is required"
                if (!validID(value)) return "Use lowercase letters, numbers, - or _"
              },
            },
            {
              type: "text",
              key: "baseURL",
              message: "Enter your local provider URL",
              placeholder: "http://localhost:11434",
              validate(value) {
                if (!trimURL(value ?? "")) return "URL is required"
              },
            },
            {
              type: "text",
              key: "apiKey",
              message: "Shared API key (leave empty to keep current, enter none to clear)",
              placeholder: "Bearer token or empty",
            },
          ],
          async authorize(input = {}) {
            const id = input.target?.trim() ?? ""
            const raw = trimURL(input.baseURL ?? "")
            if (!id || !validID(id) || !raw) return { type: "failed" as const }

            const cur = await getCurrentProviderConfig(ctx.serverUrl, ctx.client)
            const prev = cur.key
            const next = input.apiKey?.trim()
            const key = next === "none" ? "" : next || prev
            const saveKey = next === "none" ? "" : next || undefined

            try {
              const kind = await detect(raw, key)
              if (!kind) return { type: "failed" as const }
              await probe(raw, key, kind)
              await saveProviderTarget(ctx.serverUrl, ctx.client, id, raw, kind, saveKey)
            } catch {
              return { type: "failed" as const }
            }

            return {
              type: "success" as const,
              key,
              provider: LOCAL_PROVIDER_ID,
            }
          },
        },
      ],
    },
    provider: {
      id: LOCAL_PROVIDER_ID,
      models,
    },
  }
}
