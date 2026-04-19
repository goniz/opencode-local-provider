import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

async function runtimeContext(url: string) {
  try {
    const propsRes = await fetch(url + "/props", {
      signal: AbortSignal.timeout(3000),
    })
    if (propsRes.ok) {
      const props = (await propsRes.json()) as {
        default_generation_settings?: { n_ctx?: number }
      }
      if (props.default_generation_settings?.n_ctx) {
        return props.default_generation_settings.n_ctx
      }
    }
  } catch {}

  try {
    const slotsRes = await fetch(url + "/slots", {
      signal: AbortSignal.timeout(3000),
    })
    if (slotsRes.ok) {
      const slots = (await slotsRes.json()) as Array<{ n_ctx?: number }>
      const loaded = slots.find((slot) => slot.n_ctx && slot.n_ctx > 0)?.n_ctx
      if (loaded) return loaded
    }
  } catch {}

  return null
}

async function detect(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    return res.headers.get("Server")?.toLowerCase() === "llama.cpp"
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const loadedContext = await runtimeContext(url)
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`llama.cpp probe failed: ${res.status}`)
  const body = (await res.json()) as {
    data?: Array<{
      id: string
      meta?: Record<string, unknown> | null
    }>
  }

  return (body.data ?? []).map((item) => ({
    id: item.id,
    context: Number(loadedContext ?? item.meta?.n_ctx ?? item.meta?.n_ctx_train ?? 0),
    toolcall: false,
    vision: false,
  }))
}

const llamacpp: ProviderImpl = {
  detect,
  probe,
}

export default llamacpp
