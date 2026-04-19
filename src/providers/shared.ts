import type { LocalModel, LocalProviderKind } from "../types"

export type ProviderImpl = {
  detect(url: string): Promise<boolean>
  probe(url: string): Promise<LocalModel[]>
}

export type ProviderMap = Record<LocalProviderKind, ProviderImpl>
