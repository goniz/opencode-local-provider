import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const HealthSchema = z.object({
  status: z.string().optional(),
  loaded_model: z.string().nullable().optional(),
  loaded_context_size: z.number().optional(),
  loaded_tool_parser: z.string().nullable().optional(),
})

async function runtimeHealth(url: string, timeout = 3000) {
  const res = await fetch(url + "/health", {
    signal: AbortSignal.timeout(timeout),
  })

  if (!res.ok) {
    return null
  }
  
  return HealthSchema.parse(await res.json())
}

async function detect(url: string) {
  try {
    const res = await fetch(url + "/health", {
      signal: AbortSignal.timeout(2000),
    })

    if (!res.ok) {
      return false
    }

    return res.headers.get("Server")?.toLowerCase().includes("mlx_vlm") ?? false
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const health = await runtimeHealth(url)
  if (!health) {
    throw new Error("MLX-VLM probe failed: health endpoint unavailable")
  }
  
  const loadedModel = health.loaded_model ?? undefined
  if (!loadedModel) {
    return []
  }

  return [
    {
      id: loadedModel,
      context: health.loaded_context_size ?? 0,
      toolcall: health.loaded_tool_parser !== undefined && health.loaded_tool_parser !== null,
      // mlx-vlm is for VLMs by definition
      vision: true,
    },
  ]
}

const mlxvlm: ProviderImpl = {
  detect,
  probe,
}

export default mlxvlm
