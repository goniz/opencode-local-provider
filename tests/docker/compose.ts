import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
const composeFile = fileURLToPath(new URL("./compose.providers.yml", import.meta.url))

export function run(command: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  })

  if (result.status === 0) return result.stdout

  throw new Error(
    [`Command failed: ${command} ${args.join(" ")}`, result.stdout.trim(), result.stderr.trim()]
      .filter(Boolean)
      .join("\n\n"),
  )
}

export class ComposeEnvironment {
  readonly env = {
    COMPOSE_PROJECT_NAME: `provider-tests-${randomUUID().slice(0, 8)}`,
  }

  up(services?: string[]) {
    run(
      "docker",
      ["compose", "-f", composeFile, "up", "-d", "--wait", ...(services?.length ? services : [])],
      this.env,
    )
  }

  down() {
    spawnSync("docker", ["compose", "-f", composeFile, "down", "-v"], {
      cwd: root,
      env: {
        ...process.env,
        ...this.env,
      },
      encoding: "utf8",
    })
  }

  serviceIP(service: string) {
    const containerID = run(
      "docker",
      [
        "ps",
        "--filter",
        `label=com.docker.compose.project=${this.env.COMPOSE_PROJECT_NAME}`,
        "--filter",
        `label=com.docker.compose.service=${service}`,
        "--format",
        "{{.ID}}",
      ],
      this.env,
    )
      .trim()
      .split("\n")[0]

    if (!containerID) throw new Error(`No running container found for service: ${service}`)

    return run(
      "docker",
      ["inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", containerID],
      this.env,
    ).trim()
  }

  serviceURL(service: string, port: number) {
    return `http://${this.serviceIP(service)}:${port}`
  }

  exec(service: string, script: string) {
    return run(
      "docker",
      ["compose", "-f", composeFile, "exec", "-T", service, "sh", "-lc", script],
      this.env,
    )
  }
}
