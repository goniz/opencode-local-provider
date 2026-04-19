import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

async function detect(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    return (await res.text()) === "Ollama is running"
  } catch {
    return false
  }
}

async function show(url: string, model: string) {
  try {
    const res = await fetch(url + "/api/show", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return {}
    return (await res.json()) as { capabilities?: string[] }
  } catch {
    return {}
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/api/ps", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Ollama probe failed: ${res.status}`)
  const body = (await res.json()) as {
    models?: Array<{
      name: string
      model: string
      context_length: number
    }>
  }
  if (!body.models) throw new Error("Ollama probe failed: no models field")

  return Promise.all(
    body.models.map(async (item) => {
      const extra = await show(url, item.model)
      return {
        id: item.name,
        context: item.context_length,
        toolcall: extra.capabilities?.includes("tools") ?? false,
        vision: extra.capabilities?.includes("vision") ?? false,
      }
    }),
  )
}

const ollama: ProviderImpl = {
  detect,
  probe,
}

export default ollama
