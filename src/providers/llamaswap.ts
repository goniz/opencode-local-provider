import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        owned_by: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
})

async function detect(url: string) {
  try {
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

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`llama-swap probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  if (!body.data) throw new Error("llama-swap probe failed: no data field")

  return body.data.map((item) => ({
    id: item.id,
    context: Number(item.meta?.llamaswap?.n_ctx ?? 0),
    toolcall: false,
    vision: false,
  }))
}

const llamaswap: ProviderImpl = {
  detect,
  probe,
}

export default llamaswap
