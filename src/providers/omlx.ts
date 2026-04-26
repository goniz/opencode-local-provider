import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const HealthSchema = z.object({
  status: z.string().optional(),
  engine_pool: z
    .object({
      model_count: z.number().optional(),
    })
    .optional(),
})

const StatusResponseSchema = z.object({
  models: z.array(
    z.object({
      id: z.string(),
      loaded: z.boolean().optional(),
      model_type: z.string().optional(),
      engine_type: z.string().optional(),
      max_context_window: z.number().optional(),
    }),
  ),
})

async function detect(url: string) {
  try {
    const res = await fetch(url + "/health", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const parsed = HealthSchema.safeParse(await res.json())
    return parsed.success && parsed.data.engine_pool !== undefined
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models/status", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`oMLX probe failed: ${res.status}`)
  const body = StatusResponseSchema.parse(await res.json())

  return body.models
    .filter((m) => {
      if (m.loaded !== true) return false
      const t = m.model_type ?? ""
      return t === "llm" || t === "vlm"
    })
    .map((m) => {
      const modelType = m.model_type ?? ""
      return {
        id: m.id,
        context: m.max_context_window ?? 0,
        toolcall: true,
        vision: modelType === "vlm",
      }
    })
}

const omlx: ProviderImpl = {
  detect,
  probe,
}

export default omlx
