import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        owned_by: z.string().optional(),
      }),
    )
    .optional(),
})

const PropsSchema = z.object({
  default_generation_settings: z
    .object({ n_ctx: z.number().optional() })
    .optional(),
})

const SlotsSchema = z.array(z.object({ n_ctx: z.number().optional() }))

async function detect(url: string) {
  try {
    // llama-swap exposes /v1/models for all configured models regardless of load state.
    // We check owned_by to distinguish it from other OpenAI-compatible proxies.
    const res = await fetch(url + "/v1/models", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const parsed = ModelsResponseSchema.safeParse(await res.json())
    if (!parsed.success) return false
    const data = parsed.data.data
    if (!data) return false
    return data.some((item) => item.owned_by === "llama-swap")
  } catch {
    return false
  }
}

async function upstreamContext(url: string, modelId: string) {
  // llama-swap proxies the underlying server under /upstream/:model_id.
  // For llama.cpp backends we can read n_ctx from /props or /slots.
  try {
    const propsRes = await fetch(`${url}/upstream/${modelId}/props`, {
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
    const slotsRes = await fetch(`${url}/upstream/${modelId}/slots`, {
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

  return 0
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`llama-swap probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  if (!body.data) throw new Error("llama-swap probe failed: no data field")

  return Promise.all(
    body.data.map(async (item) => {
      const context = await upstreamContext(url, item.id)

      return {
        id: item.id,
        context,
        toolcall: false,
        vision: false,
      }
    }),
  )
}

const llamaswap: ProviderImpl = {
  detect,
  probe,
}

export default llamaswap
