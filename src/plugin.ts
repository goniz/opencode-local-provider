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
  getCurrentProviderConfig,
  getProviderApiKey,
  getProviderTargets,
  saveProviderTarget,
} from "./config"
import { build } from "./models"
import { supportedProviderDefaultURLs, supportedProviderKinds } from "./providers"
import { detect, probe } from "./probe"
import type { LocalProviderKind } from "./types"
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
              type: "select",
              key: "autoDetect",
              message: "Auto-detect supported local providers on their default ports?",
              options: [
                {
                  label: "Yes",
                  value: "yes",
                  hint: "Find and configure supported local providers automatically",
                },
                {
                  label: "No",
                  value: "no",
                  hint: "Configure a single target manually",
                },
              ],
            },
            {
              type: "text",
              key: "target",
              message: "Enter a target ID",
              placeholder: "ollama",
              when: { key: "autoDetect", op: "eq", value: "no" },
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
              when: { key: "autoDetect", op: "eq", value: "no" },
              validate(value) {
                if (!trimURL(value ?? "")) return "URL is required"
              },
            },
          ],
          async authorize(input = {}) {
            const cur = await getCurrentProviderConfig(ctx.serverUrl, ctx.client)
            const key = ctx.auth || cur.key

            if (input.autoDetect === "yes") {
              const detected = await Promise.all(
                Object.entries(supportedProviderDefaultURLs).map(async ([id, raw]) => {
                  try {
                    const kind = await detect(raw, key)
                    if (!kind) return
                    await probe(raw, key, kind)
                    return { id, raw, kind }
                  } catch {
                    return
                  }
                }),
              )

              const targets = detected.filter(
                (item): item is { id: string; raw: string; kind: LocalProviderKind } => Boolean(item),
              )
              if (!targets.length) return { type: "failed" as const }

              try {
                for (const item of targets) {
                  await saveProviderTarget(ctx.serverUrl, ctx.client, item.id, item.raw, item.kind)
                }
              } catch {
                return { type: "failed" as const }
              }

              return {
                type: "success" as const,
                provider: LOCAL_PROVIDER_ID,
              }
            }

            const id = input.target?.trim() ?? ""
            const raw = trimURL(input.baseURL ?? "")
            if (!id || !validID(id) || !raw) return { type: "failed" as const }

            try {
              const kind = await detect(raw, key)
              if (!kind) return { type: "failed" as const }
              await probe(raw, key, kind)
              await saveProviderTarget(ctx.serverUrl, ctx.client, id, raw, kind)
            } catch {
              return { type: "failed" as const }
            }

            return {
              type: "success" as const,
              provider: LOCAL_PROVIDER_ID,
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
