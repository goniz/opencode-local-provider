import { expect, test } from "bun:test"

import { getConfiguredTargets, getProviderTargets } from "../src/config"
import { supportedProviderDefaultURLs } from "../src/providers"
import { baseURL } from "../src/url"

test("includes supported default targets by default", () => {
  const targets = getProviderTargets()

  expect(Object.keys(targets)).toEqual(Object.keys(supportedProviderDefaultURLs))
  for (const [id, url] of Object.entries(supportedProviderDefaultURLs)) {
    expect(targets[id]).toEqual({
      url: baseURL(url),
      kind: id,
    })
  }
})

test("keeps configured targets explicit-only", () => {
  const targets = getConfiguredTargets({
    options: {
      targets: {
        studio: {
          url: "http://192.168.1.10:1234",
          kind: "lmstudio",
        },
      },
    },
  })

  expect(targets).toEqual({
    studio: {
      url: "http://192.168.1.10:1234/v1",
      kind: "lmstudio",
    },
  })
})

test("configured targets override defaults and suppress duplicate urls", () => {
  const targets = getProviderTargets({
    options: {
      targets: {
        ollama: {
          url: "http://192.168.1.20:11434",
          kind: "ollama",
        },
        studio: {
          url: "http://127.0.0.1:1234",
          kind: "lmstudio",
        },
      },
    },
  })

  expect(targets.ollama).toEqual({
    url: "http://192.168.1.20:11434/v1",
    kind: "ollama",
  })
  expect(targets.studio).toEqual({
    url: "http://127.0.0.1:1234/v1",
    kind: "lmstudio",
  })
  expect(targets.lmstudio).toBeUndefined()
})

test("supports opting out of default targets", () => {
  const targets = getProviderTargets({
    options: {
      includeDefaults: false,
      targets: {
        studio: {
          url: "http://192.168.1.10:1234",
          kind: "lmstudio",
        },
      },
    },
  })

  expect(targets).toEqual({
    studio: {
      url: "http://192.168.1.10:1234/v1",
      kind: "lmstudio",
    },
  })
})
