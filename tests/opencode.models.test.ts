import { describe, expect, test } from "bun:test"

import { ComposeEnvironment, run } from "./docker/compose"

describe("opencode docker integration", () => {
  test("lists the default llama.cpp model after plugin install", () => {
    const compose = new ComposeEnvironment()

    try {
      run("bun", ["run", "build"])
      compose.up(["llamacpp", "opencode"])

      const output = compose.exec(
        "opencode",
        [
          "export HOME=/tmp/opencode-home",
          "mkdir -p \"$HOME\" /tmp/opencode-test",
          "cd /tmp/opencode-test",
          "opencode plugin /workspace",
          "opencode models",
        ].join(" && "),
      )

      expect(output).toContain("llamacpp/")
      expect(output).toContain("LFM2.5-350M")
    } finally {
      compose.down()
    }
  }, 600_000)
})
