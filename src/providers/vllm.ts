import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        owned_by: z.string().optional(),
        max_model_len: z.number().optional(),
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
    if (res.headers.get("Server")?.toLowerCase() !== "uvicorn") return false
    const parsed = ModelsResponseSchema.safeParse(await res.json())
    if (!parsed.success) return false
    const data = parsed.data.data
    if (!data) return false
    return data.length === 0 || data[0]?.owned_by === "vllm"
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`vLLM probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  if (!body.data) throw new Error("vLLM probe failed: no data field")

  return body.data.map((item) => ({
    id: item.id,
    context: item.max_model_len ?? 0,
    toolcall: true,
    vision: item.id.toLowerCase().includes("vl"),
  }))
}

const vllm: ProviderImpl = {
  detect,
  probe,
}

export default vllm
