import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"
import { runtimeContext } from "./llamacpp"

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

const RunningResponseSchema = z.object({
  running: z
    .array(
      z.object({
        model: z.string(),
        state: z.string().optional(),
      }),
    )
    .optional(),
})

export async function runningModels(url: string) {
  try {
    const res = await fetch(url + "/running", {
      signal: AbortSignal.timeout(1000),
    })
    if (!res.ok) return new Set<string>()
    const body = RunningResponseSchema.parse(await res.json())
    return new Set(
      (body.running ?? [])
        .filter((item) => !item.state || item.state === "ready")
        .map((item) => item.model),
    )
  } catch {
    return new Set<string>()
  }
}

async function detect(url: string) {
  try {
    // llama-swap exposes /v1/models for all configured models regardless of load state.
    // We check owned_by to distinguish it from other OpenAI-compatible proxies.
    const res = await fetch(url + "/v1/models", {
      signal: AbortSignal.timeout(1000),
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
    signal: AbortSignal.timeout(1000),
  })
  if (!res.ok) throw new Error(`llama-swap probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  if (!body.data) throw new Error("llama-swap probe failed: no data field")
  const loadedModels = await runningModels(url)

  return Promise.all(
    body.data.filter((item) => loadedModels.has(item.id)).map(async (item) => {
      const context = (await runtimeContext(`${url}/upstream/${item.id}`)) ?? 0

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
