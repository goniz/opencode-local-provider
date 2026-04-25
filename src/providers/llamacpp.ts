import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const PropsSchema = z.object({
  default_generation_settings: z
    .object({ n_ctx: z.number().optional() })
    .optional(),
})

const SlotsSchema = z.array(z.object({ n_ctx: z.number().optional() }))

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        meta: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .optional(),
})

async function runtimeContext(url: string) {
  try {
    const propsRes = await fetch(url + "/props", {
      signal: AbortSignal.timeout(3000),
    })
    if (propsRes.ok) {
      const parsed = PropsSchema.parse(await propsRes.json())
      if (parsed.default_generation_settings?.n_ctx) {
        return parsed.default_generation_settings.n_ctx
      }
    }
  } catch {}

  try {
    const slotsRes = await fetch(url + "/slots", {
      signal: AbortSignal.timeout(3000),
    })
    if (slotsRes.ok) {
      const parsed = SlotsSchema.parse(await slotsRes.json())
      const loaded = parsed.find(
        (slot) => slot.n_ctx && slot.n_ctx > 0,
      )?.n_ctx
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
  const body = ModelsResponseSchema.parse(await res.json())

  return (body.data ?? []).map((item) => ({
    id: item.id,
    context: Number(
      loadedContext ??
        item.meta?.n_ctx ??
        item.meta?.n_ctx_train ??
        0,
    ),
    toolcall: false,
    vision: false,
  }))
}

const llamacpp: ProviderImpl = {
  detect,
  probe,
}

export default llamacpp
