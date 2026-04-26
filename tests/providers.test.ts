import { beforeAll, afterAll, describe, expect, test } from "bun:test"

import { detect, probe } from "../src/probe"
import { supportedProviderKinds } from "../src/providers"
import { ComposeEnvironment } from "./docker/compose"

const selectedKind = process.env.PROVIDER_SUITE

const providerURLs: Partial<Record<(typeof supportedProviderKinds)[number], string>> = {}

const suites = [
  {
    kind: "ollama",
    service: "ollama",
    port: 11434,
    url: () => providerURLs.ollama!,
    modelID: process.env.OLLAMA_MODEL,
    expectedContext: 128,
  },
  {
    kind: "lmstudio",
    service: "lmstudio",
    port: 1234,
    url: () => providerURLs.lmstudio!,
    modelID: process.env.LMSTUDIO_MODEL_ID,
    expectedContext: 128,
  },
  {
    kind: "llamacpp",
    service: "llamacpp",
    port: 8080,
    url: () => providerURLs.llamacpp!,
    modelID: process.env.LLAMACPP_MODEL_ID,
    expectedContext: 256,
  },
  {
    kind: "vllm",
    service: "vllm",
    port: 8000,
    url: () => providerURLs.vllm!,
    modelID: process.env.VLLM_MODEL,
    expectedContext: 128,
  },
  {
    kind: "exo",
    service: "exo",
    port: 52415,
    url: () => providerURLs.exo!,
    modelID: process.env.EXO_MODEL,
    expectedContext: 128000,
  },
  {
    kind: "llamaswap",
    service: "llamaswap",
    port: 8080,
    url: () => providerURLs.llamaswap!,
    modelID: process.env.LLAMASWAP_MODEL,
    expectedContext: 256,
  },
  {
    kind: "omlx",
    service: "omlx",
    port: 8000,
    url: () => providerURLs.omlx!,
    modelID: process.env.OMLX_MODEL_ID,
    expectedContext: 32768,
  },
] as const

const activeSuites = selectedKind ? suites.filter((item) => item.kind === selectedKind) : suites

let compose: ComposeEnvironment | undefined

beforeAll(() => {
  compose = new ComposeEnvironment()
  compose.up(activeSuites.map((item) => item.service))

  for (const item of activeSuites) {
    providerURLs[item.kind] = compose.serviceURL(item.service, item.port)
  }
}, 600_000)

afterAll(() => {
  compose?.down()
}, 120_000)

test("supported providers list stays in sync", () => {
  expect(supportedProviderKinds).toEqual(suites.map((item) => item.kind))
})

describe("provider integration", () => {
  for (const item of activeSuites) {
    test(`${item.kind} detects and probes from root url`, async () => {
      expect(await detect(item.url())).toBe(item.kind)

      const result = await probe(item.url())
      expect(result.kind).toBe(item.kind)

      const model = item.modelID ? result.models.find((entry) => entry.id === item.modelID) : result.models[0]

      expect(model).toBeDefined()
      expect(model!.context).toBeGreaterThan(0)
      expect(typeof model!.toolcall).toBe("boolean")
      expect(typeof model!.vision).toBe("boolean")
    }, 120_000)

    test(`${item.kind} reports the expected context length`, async () => {
      const result = await probe(item.url(), undefined, item.kind)

      const model = item.modelID ? result.models.find((entry) => entry.id === item.modelID) : result.models[0]

      expect(model).toBeDefined()
      expect(model!.context).toBe(item.expectedContext)
    }, 120_000)

    test(`${item.kind} detects and probes from /v1 url`, async () => {
      expect(await detect(`${item.url()}/v1`)).toBe(item.kind)

      const result = await probe(`${item.url()}/v1`)
      expect(result.kind).toBe(item.kind)
      if (item.modelID) {
        expect(result.models.some((entry) => entry.id === item.modelID)).toBe(true)
      } else {
        expect(result.models.length).toBeGreaterThan(0)
      }
    }, 120_000)

    test(`${item.kind} probes when kind is supplied`, async () => {
      const result = await probe(item.url(), undefined, item.kind)
      expect(result.kind).toBe(item.kind)
      if (item.modelID) {
        expect(result.models.some((entry) => entry.id === item.modelID)).toBe(true)
      } else {
        expect(result.models.length).toBeGreaterThan(0)
      }
    }, 120_000)
  }
})
