import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

type ExoState = {
  instances?: Record<
    string,
    {
      MlxRingInstance?: {
        shardAssignments?: {
          modelId?: string
          nodeToRunner?: Record<string, string>
          runnerToShard?: Record<
            string,
            {
              PipelineShardMetadata?: {
                modelCard?: {
                  contextLength?: number
                  capabilities?: string[]
                  vision?: unknown
                }
              }
            }
          >
        }
      }
    }
  >
  runners?: Record<string, { RunnerReady?: object }>
}

async function detect(url: string) {
  try {
    const res = await fetch(url + "/v1/models", {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { data?: Array<{ owned_by?: string }> }
    if (!Array.isArray(body.data)) return false
    return body.data.length > 0 && body.data.every((item) => item.owned_by === "exo")
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/state", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Exo probe failed: ${res.status}`)

  const body = (await res.json()) as ExoState
  const instances = Object.values(body.instances ?? {})
  const runners = body.runners ?? {}

  return instances.flatMap((entry) => {
    const instance = entry.MlxRingInstance
    const assignments = instance?.shardAssignments
    const modelId = assignments?.modelId
    if (!modelId) return []

    const runnerId = Object.values(assignments.nodeToRunner ?? {})[0]
    if (!runnerId || !("RunnerReady" in (runners[runnerId] ?? {}))) return []

    const modelCard = assignments.runnerToShard?.[runnerId]?.PipelineShardMetadata?.modelCard
    return [
      {
        id: modelId,
        context: modelCard?.contextLength ?? 0,
        toolcall: modelCard?.capabilities?.includes("tools") ?? false,
        vision:
          modelCard?.capabilities?.includes("vision") ??
          (modelCard?.vision != null),
      },
    ]
  })
}

const exo: ProviderImpl = {
  detect,
  probe,
}

export default exo
