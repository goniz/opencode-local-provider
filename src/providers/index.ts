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

export const supportedProviderDefaultURLs: Record<LocalProviderKind, string> = {
  ollama: "http://127.0.0.1:11434",
  lmstudio: "http://127.0.0.1:1234",
  llamacpp: "http://127.0.0.1:8080",
  vllm: "http://127.0.0.1:8000",
  exo: "http://127.0.0.1:52415",
}

export const supportedProviderKinds = Object.keys(supportedProviders) as LocalProviderKind[]
