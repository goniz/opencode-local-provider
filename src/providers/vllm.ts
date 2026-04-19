import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

async function detect(url: string) {
  try {
    const res = await fetch(url + "/v1/models", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    if (res.headers.get("Server")?.toLowerCase() !== "uvicorn") return false
    const body = (await res.json()) as { data?: Array<{ owned_by?: string }> }
    if (!Array.isArray(body.data)) return false
    return body.data.length === 0 || body.data[0]?.owned_by === "vllm"
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`vLLM probe failed: ${res.status}`)
  const body = (await res.json()) as {
    data?: Array<{
      id: string
      max_model_len?: number
    }>
  }
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
