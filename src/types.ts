export const KINDS = ["ollama", "lmstudio", "llamacpp", "vllm", "exo"] as const

export type LocalProviderKind = (typeof KINDS)[number]

export type LocalModel = {
  id: string
  context: number
  toolcall: boolean
  vision: boolean
}

export type LocalTarget = {
  url: string
  kind?: LocalProviderKind
}
