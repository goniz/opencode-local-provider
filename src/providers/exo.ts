import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const ExoStateSchema = z.object({
  instances: z
    .record(
      z.string(),
      z.object({
        MlxRingInstance: z
          .object({
            shardAssignments: z
              .object({
                modelId: z.string().optional(),
                nodeToRunner: z.record(z.string(), z.string()).optional(),
                runnerToShard: z
                  .record(
                    z.string(),
                    z.object({
                      PipelineShardMetadata: z
                        .object({
                          modelCard: z
                            .object({
                              contextLength: z.number().optional(),
                              capabilities: z.array(z.string()).optional(),
                              vision: z.unknown().optional(),
                            })
                            .optional(),
                        })
                        .optional(),
                    }),
                  )
                  .optional(),
              })
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  runners: z
    .record(
      z.string(),
      z.object({
        RunnerReady: z.unknown().optional(),
      }),
    )
    .optional(),
})

const ModelsResponseSchema = z.object({
  data: z
    .array(z.object({ owned_by: z.string().optional() }))
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
    return (
      data != null &&
      data.length > 0 &&
      data.every((item) => item.owned_by === "exo")
    )
  } catch {
    return false
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/state", {
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error(`Exo probe failed: ${res.status}`)

  const body = ExoStateSchema.parse(await res.json())
  const instances = Object.values(body.instances ?? {})
  const runners = body.runners ?? {}

  return instances.flatMap((entry) => {
    const instance = entry.MlxRingInstance
    const assignments = instance?.shardAssignments
    const modelId = assignments?.modelId
    if (!modelId) return []

    const runnerId = Object.values(assignments.nodeToRunner ?? {})[0]
    if (!runnerId || !("RunnerReady" in (runners[runnerId] ?? {}))) return []

    const modelCard =
      assignments.runnerToShard?.[runnerId]?.PipelineShardMetadata?.modelCard
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
