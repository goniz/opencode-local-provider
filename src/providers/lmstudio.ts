import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

async function detect(url: string) {
  try {
    const res = await fetch(url + "/lmstudio-greeting", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { lmstudio?: boolean }
    return body.lmstudio === true
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/api/v0/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`LM Studio probe failed: ${res.status}`)
  const body = (await res.json()) as {
    data?: Array<{
      id: string
      type: "llm" | "vlm" | "embeddings"
      state: "loaded" | "loading" | "not-loaded"
      loaded_context_length?: number
      capabilities?: string[]
    }>
  }
  if (!body.data) throw new Error("LM Studio probe failed: no data field")

  return body.data
    .filter((item) => item.state === "loaded")
    .filter((item) => item.type === "llm" || item.type === "vlm")
    .filter((item) => Boolean(item.loaded_context_length && item.loaded_context_length > 0))
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
