import type { LocalProviderKind } from "./types"

import { supportedProviders, supportedProviderKinds } from "./providers"
import { rootURL } from "./url"

export async function detect(url: string): Promise<LocalProviderKind | null> {
  const root = rootURL(url)

  for (const kind of supportedProviderKinds) {
    if (await supportedProviders[kind].detect(root)) return kind
  }

  return null
}

export async function probe(url: string, kind?: LocalProviderKind) {
  const root = rootURL(url)
  const detected = await detect(root)

  if (!detected) throw new Error(`No supported local provider detected at: ${url}`)

  if (kind && detected !== kind) {
    throw new Error(`Expected ${kind} at ${url} but detected ${detected}`)
  }

  return {
    kind: detected,
    models: await supportedProviders[detected].probe(root),
  }
}
