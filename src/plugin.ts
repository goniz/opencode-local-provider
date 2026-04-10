import type { Plugin, ProviderHookContext } from "@opencode-ai/plugin"
import type { Provider } from "@opencode-ai/sdk/v2"
import pkg from "../package.json" with { type: "json" }

import {
  LOCAL_PROVIDER_ID,
  LOCAL_PROVIDER_NAME,
  LOCAL_PLUGIN_SERVICE,
  OPENAI_COMPATIBLE_NPM,
} from "./constants"
import {
  getConfiguredTargets,
  getProviderApiKey,
  getProviderTargets,
  saveProviderTarget,
} from "./config"
import { build } from "./models"
import { supportedProviderKinds } from "./providers"
import { detect, probe } from "./probe"
import { trimURL } from "./url"

function validID(value: string) {
  return /^[a-z0-9][a-z0-9-_]*$/.test(value)
}

async function probeModels(provider: Provider, ctx: ProviderHookContext) {
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
      message: `Local Provider plugin loaded v${pkg.version}. Supported backends: ${supportedProviderKinds.join(", ")}`,
    },
  })

  return {
    config: async (cfg) => {
      cfg.provider ??= {}
      const provider = cfg.provider[LOCAL_PROVIDER_ID] ?? {}
      const list = getConfiguredTargets(provider as Provider)
      const options = {
        ...provider.options,
        includeDefaults: provider.options?.includeDefaults ?? true,
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
          label: "Set Shared API Key",
        },
        {
          type: "api",
          label: "Add Custom Target (CLI only)",
          prompts: [
            {
              type: "text",
              key: "target",
              message: "Enter a target ID",
              placeholder: "studio",
              validate(value) {
                if (!value) return "Target ID is required"
                if (!validID(value)) return "Use lowercase letters, numbers, - or _"
              },
            },
            {
              type: "text",
              key: "baseURL",
              message: "Enter your local provider URL",
              placeholder: "http://192.168.1.10:1234",
              validate(value) {
                if (!trimURL(value ?? "")) return "URL is required"
              },
            },
            {
              type: "text",
              key: "apiKey",
              message: "Re-enter the shared API key for this provider (enter none if unused)",
              placeholder: "none",
              validate(value) {
                if (!value?.trim()) return "API key is required; enter none if unused"
              },
            },
          ],
          async authorize(input = {}) {
            const id = input.target?.trim() ?? ""
            const raw = trimURL(input.baseURL ?? "")
            const next = input.apiKey?.trim() ?? ""
            const key = next === "none" ? "" : next
            if (!id || !validID(id) || !raw || !next) return { type: "failed" as const }

            const kind = await detect(raw, key).catch(() => undefined)
            if (!kind) return { type: "failed" as const }

            try {
              await probe(raw, key, kind)
              await saveProviderTarget(ctx.serverUrl, ctx.client, id, raw, kind)
            } catch {
              return { type: "failed" as const }
            }

            return {
              type: "success" as const,
              provider: LOCAL_PROVIDER_ID,
              key,
            }
          },
        },
      ],
    },
    provider: {
      id: LOCAL_PROVIDER_ID,
      models: probeModels,
    },
  }
}
