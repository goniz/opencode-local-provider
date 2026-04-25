import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const GreetingResponseSchema = z.object({
  lmstudio: z.boolean().optional(),
})

const ModelItemSchema = z.object({
  id: z.string(),
  type: z.enum(["llm", "vlm", "embeddings"]),
  state: z.enum(["loaded", "loading", "not-loaded"]),
  loaded_context_length: z.number().optional(),
  capabilities: z.array(z.string()).optional(),
})

const ModelsResponseSchema = z.object({
  data: z.array(ModelItemSchema).optional(),
})

async function detect(url: string) {
  try {
    const res = await fetch(url + "/lmstudio-greeting", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const parsed = GreetingResponseSchema.safeParse(await res.json())
    if (!parsed.success) return false
    return parsed.data.lmstudio === true
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/api/v0/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`LM Studio probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  if (!body.data) throw new Error("LM Studio probe failed: no data field")

  return body.data
    .filter((item) => item.state === "loaded")
    .filter((item) => item.type === "llm" || item.type === "vlm")
    .filter(
      (item) =>
        Boolean(item.loaded_context_length && item.loaded_context_length > 0),
    )
    .map((item) => ({
      id: item.id,
      context: item.loaded_context_length ?? 0,
      toolcall: item.capabilities?.includes("tool_use") ?? false,
      vision: item.type === "vlm",
    }))
}

const lmstudio: ProviderImpl = {
  detect,
  probe,
}

export default lmstudio
