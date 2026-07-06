import { z } from "zod"
import type { LocalModel } from "../types"
import type { ProviderImpl } from "./shared"

const PropsSchema = z.object({
  default_generation_settings: z
    .object({ n_ctx: z.number().optional() })
    .optional(),
})

const SlotsSchema = z.array(z.object({ n_ctx: z.number().optional() }))

const PropsModelSchema = z.object({
  default_generation_settings: z
    .object({ n_ctx: z.number().optional() })
    .optional(),
  modalities: z.object({ vision: z.boolean().optional(), audio: z.boolean().optional(), video: z.boolean().optional() }).optional(),
  chat_template_caps: z
    .object({
      supports_tool_calls: z.boolean().optional(),
      supports_tools: z.boolean().optional(),
    })
    .optional(),
})

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        meta: z.record(z.string(), z.unknown()).nullable().optional(),
        architecture: z
          .object({
            input_modalities: z.array(z.string()).optional(),
            output_modalities: z.array(z.string()).optional(),
          })
          .optional(),
        status: z
          .object({
            args: z.array(z.string()).optional(),
            preset: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
})

export async function runtimeContext(url: string) {
  try {
    const propsRes = await fetch(url + "/props", {
      signal: AbortSignal.timeout(1000),
    })
    if (propsRes.ok) {
      const parsed = PropsSchema.parse(await propsRes.json())
      if (parsed.default_generation_settings?.n_ctx) {
        return parsed.default_generation_settings.n_ctx
      }
    }
  } catch {}

  try {
    const slotsRes = await fetch(url + "/slots", {
      signal: AbortSignal.timeout(1000),
    })
    if (slotsRes.ok) {
      const parsed = SlotsSchema.parse(await slotsRes.json())
      const loaded = parsed.find(
        (slot) => slot.n_ctx && slot.n_ctx > 0,
      )?.n_ctx
      if (loaded) return loaded
    }
  } catch {}

  return null
}

function extractContextFromArgs(args?: string[]): number | null {
  if (!args) return null
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "--ctx-size" && !isNaN(Number(args[i + 1]))) {
      return Number(args[i + 1])
    }
  }
  return null
}

function extractContextFromPreset(preset?: string): number | null {
  if (!preset) return null
  const match = preset.match(/ctx-size\s*=\s*(\d+)/)
  return match ? Number(match[1]) : null
}

async function probeModelProps(url: string, id: string): Promise<LocalModel> {
  try {
    const res = await fetch(url + "/props?model=" + encodeURIComponent(id), {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const parsed = PropsModelSchema.parse(await res.json())
      const context = parsed.default_generation_settings?.n_ctx ?? 0
      const modalities = parsed.modalities ?? {}
      const caps = parsed.chat_template_caps ?? {}

      return {
        id,
        context,
        toolcall: caps.supports_tool_calls ?? caps.supports_tools ?? false,
        vision: modalities.vision ?? false,
      }
    }
  } catch {}

  const modelsRes = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(10_000),
  })
  if (!modelsRes.ok) {
    return { id, context: 0, toolcall: false, vision: false }
  }
  const body = ModelsResponseSchema.parse(await modelsRes.json())
  const item = body.data?.find((m) => m.id === id)

  const context =
    extractContextFromArgs(item?.status?.args) ??
    extractContextFromPreset(item?.status?.preset) ??
    0

  const inputModalities = item?.architecture?.input_modalities ?? []
  const vision = inputModalities.includes("image")

  return {
    id,
    context: Number(context),
    toolcall: false,
    vision,
  }
}

async function probe(url: string): Promise<LocalModel[]> {
  const res = await fetch(url + "/v1/models", {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`llama.cpp probe failed: ${res.status}`)
  const body = ModelsResponseSchema.parse(await res.json())
  const ids = (body.data ?? []).map((item) => item.id)

  const results: LocalModel[] = []
  for (const id of ids) {
    const result = await probeModelProps(url, id)
    results.push(result)
  }
  return results
}

const llamacpp: ProviderImpl = {
  detect,
  probe,
}

export default llamacpp
