import type { LocalProviderKind } from "../types"

import exo from "./exo"
import llamacpp from "./llamacpp"
import lmstudio from "./lmstudio"
import ollama from "./ollama"
import type { ProviderMap } from "./shared"
import vllm from "./vllm"

export const supportedProviders: ProviderMap = {
  ollama,
  lmstudio,
  llamacpp,
  vllm,
  exo,
}

export const supportedProviderKinds = Object.keys(supportedProviders) as LocalProviderKind[]
