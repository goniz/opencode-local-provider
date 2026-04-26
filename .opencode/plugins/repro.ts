import type { Plugin } from "@opencode-ai/plugin"

export const ReproPlugin: Plugin = async () => {
  return {
    auth: {
      provider: "repro",
      methods: [
        {
          type: "api",
          label: "API Key",
        },
        {
          type: "api",
          label: "API Key with authorize",
          async authorize(input = {}) {
            return {
              "type": "success"
            }
          },
        },
      ],
    },
  }
}
