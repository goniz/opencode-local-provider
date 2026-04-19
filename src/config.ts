import type { PluginInput } from "@opencode-ai/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import type { Provider } from "@opencode-ai/sdk/v2"

import { LEGACY_TARGET_ID, LOCAL_PROVIDER_ID } from "./constants"
import { supportedProviderDefaultURLs } from "./providers"
import { KINDS, type LocalTarget } from "./types"
import { baseURL } from "./url"

type HarnessClientConfig = {
  fetch?: typeof fetch
  headers?: Record<string, string>
}

function getV1OpencodeClientConfig(input: PluginInput["client"]): HarnessClientConfig {
  return (((input as unknown) as {
    _client?: { getConfig?: () => HarnessClientConfig }
  })._client?.getConfig?.() ?? {}) as HarnessClientConfig
}

// The plugin harness already gives us a configured v1 client. Reuse that
// fetch implementation and headers when creating the v2 client so config
// requests keep the same transport/auth behavior.
function createV2OpencodeClient(url: URL, input: PluginInput["client"]) {
  const v1ClientConfig = getV1OpencodeClientConfig(input)

  return createOpencodeClient({
    baseUrl: url.toString(),
    fetch: v1ClientConfig.fetch,
    headers: v1ClientConfig.headers,
    throwOnError: true,
  })
}

export function getAuthApiKey(auth?: { type: string; key?: string }) {
  if (!auth || auth.type !== "api") return ""
  return auth.key ?? ""
}

function parseTargetConfig(item: unknown) {
  if (typeof item === "string" && item) return { url: baseURL(item) }
  if (item && typeof item === "object") {
    const url = "url" in item ? item.url : undefined
    const kind = "kind" in item ? item.kind : undefined
    if (typeof url === "string" && url) {
      return {
        url: baseURL(url),
        ...(typeof kind === "string" && KINDS.includes(kind as (typeof KINDS)[number]) ? { kind } : {}),
      }
    }
  }
}

const defaults = Object.fromEntries(
  Object.entries(supportedProviderDefaultURLs).map(([id, url]) => [
    id,
    {
      url: baseURL(url),
      kind: id as LocalTarget["kind"],
    },
  ]),
) as Record<string, LocalTarget>

export function getConfiguredTargets(provider?: Pick<Provider, "options">) {
  const raw = provider?.options?.targets
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const next = Object.fromEntries(
      Object.entries(raw)
        .map(([id, item]) => {
          const val = parseTargetConfig(item)
          if (!val) return
          return [id, val] as const
        })
        .filter((item): item is readonly [string, LocalTarget] => Boolean(item)),
    )
    if (Object.keys(next).length) return next
  }

  const url = provider?.options?.baseURL
  if (typeof url === "string" && url) {
    return {
      [LEGACY_TARGET_ID]: {
        url: baseURL(url),
      },
    }
  }

  return {}
}

export function getProviderTargets(provider?: Pick<Provider, "options">) {
  const configured = getConfiguredTargets(provider)
  if (provider?.options?.includeDefaults === false) return configured

  const urls = new Set(Object.values(configured).map((item) => item.url))
  const builtin = Object.fromEntries(
    Object.entries(defaults).filter(([id, item]) => !configured[id] && !urls.has(item.url)),
  ) as Record<string, LocalTarget>

  return {
    ...builtin,
    ...configured,
  }
}

export function getProviderApiKey(provider?: Pick<Provider, "options">, auth?: { type: string; key?: string }) {
  const val = provider?.options?.apiKey
  if (typeof val === "string" && val) return val
  return getAuthApiKey(auth)
}

export async function getCurrentProviderConfig(url: URL, input: PluginInput["client"]) {
  const cfg = await createV2OpencodeClient(url, input).global.config.get()
  const provider = cfg.data?.provider?.[LOCAL_PROVIDER_ID]
  return {
    targets: getConfiguredTargets(provider as Pick<Provider, "options"> | undefined),
    key: typeof provider?.options?.apiKey === "string" ? provider.options.apiKey : "",
  }
}

export async function saveProviderTarget(
  server: URL,
  input: PluginInput["client"],
  id: string,
  url: string,
  kind?: LocalTarget["kind"],
  key?: string,
) {
  const cur = await getCurrentProviderConfig(server, input)
  const options: Record<string, unknown> = {
    targets: {
      ...cur.targets,
      [id]: {
        url: baseURL(url),
        ...(kind ? { kind } : {}),
      },
    },
  }

  if (key !== undefined) options.apiKey = key

  await createV2OpencodeClient(server, input).global.config.update({
    config: {
      provider: {
        [LOCAL_PROVIDER_ID]: {
          options,
        },
      },
    },
  })
}
