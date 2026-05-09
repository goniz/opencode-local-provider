const provider = process.argv[2]
const args = ["test", "./tests/providers.test.ts"]

if (provider) args.push(`--test-name-pattern=${provider}`)

const result = Bun.spawnSync(["bun", ...args], {
  env: {
    ...process.env,
    ...(provider ? { PROVIDER_SUITE: provider } : {}),
  },
  stdout: "inherit",
  stderr: "inherit",
})

process.exit(result.exitCode)
