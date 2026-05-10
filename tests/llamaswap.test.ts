import { describe, expect, mock, test } from "bun:test"

import { runningModels } from "../src/providers/llamaswap"
import { probe } from "../src/probe"

describe("llama-swap provider", () => {
  test("only probes upstream for loaded models", async () => {
    const calls: string[] = []
    const originalFetch = globalThis.fetch

    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      calls.push(url)

      if (url === "http://llamaswap.test/v1/models") {
        return new Response(
          JSON.stringify({
            data: [
              { id: "loaded", owned_by: "llama-swap" },
              { id: "idle", owned_by: "llama-swap" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }

      if (url === "http://llamaswap.test/running") {
        return new Response(
          JSON.stringify({
            running: [{ model: "loaded", state: "ready" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }

      if (url === "http://llamaswap.test/upstream/loaded/props") {
        return new Response(
          JSON.stringify({
            default_generation_settings: { n_ctx: 4096 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }

      if (url === "http://llamaswap.test/upstream/loaded/slots") {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`)
    }) as typeof fetch

    try {
      const result = await probe("http://llamaswap.test")

      expect(await runningModels("http://llamaswap.test")).toEqual(new Set(["loaded"]))
      expect(result.kind).toBe("llamaswap")
      expect(result.models).toEqual([
        { id: "loaded", context: 4096, toolcall: false, vision: false },
      ])
      expect(calls).toContain("http://llamaswap.test/upstream/loaded/props")
      expect(calls).not.toContain("http://llamaswap.test/upstream/idle/props")
      expect(calls).not.toContain("http://llamaswap.test/upstream/idle/slots")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
