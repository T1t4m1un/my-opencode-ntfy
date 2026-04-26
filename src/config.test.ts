import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { mkdirSync, writeFileSync, rmSync } from "fs"
import { loadConfig } from "./config.js"

const TMP = join(import.meta.dir, "__test_tmp_config__")

beforeEach(() => {
  mkdirSync(TMP, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

function writeConfig(content: string) {
  writeFileSync(join(TMP, "my-opencode-ntfy.jsonc"), content)
}

describe("loadConfig", () => {
  test("returns null when config file does not exist", () => {
    const result = loadConfig(TMP)
    expect(result).toBeNull()
  })

  test("returns null for invalid JSON", () => {
    writeConfig("{ invalid json }")
    const result = loadConfig(TMP)
    expect(result).toBeNull()
  })

  test("returns null when topic is missing", () => {
    writeConfig(JSON.stringify({ baseUrl: "https://ntfy.sh" }))
    const result = loadConfig(TMP)
    expect(result).toBeNull()
  })

  test("loads minimal valid config with defaults", () => {
    writeConfig(JSON.stringify({
      topic: "test-topic",
    }))
    const result = loadConfig(TMP)
    expect(result).not.toBeNull()
    expect(result!.baseUrl).toBe("https://ntfy.sh")
    expect(result!.topic).toBe("test-topic")
    expect(result!.priority).toBe("default")
    expect(result!.notify.taskComplete.enabled).toBe(true)
    expect(result!.notify.permissionAsked.enabled).toBe(true)
    expect(result!.notify.apiTimeout.enabled).toBe(true)
    expect(result!.notify.apiTimeout.timeout).toBe(120)
    expect(result!.notify.consecutiveFailure.enabled).toBe(true)
    expect(result!.notify.consecutiveFailure.threshold).toBe(3)
  })

  test("loads full config with all overrides", () => {
    writeConfig(JSON.stringify({
      baseUrl: "https://custom.ntfy.local",
      topic: "my-topic",
      auth: { token: "tk_123", username: "user", password: "pass" },
      priority: "high",
      notify: {
        taskComplete: { enabled: false },
        permissionAsked: { enabled: true },
        apiTimeout: { timeout: 60, enabled: true },
        consecutiveFailure: { threshold: 5, enabled: false },
      },
    }))
    const result = loadConfig(TMP)
    expect(result).not.toBeNull()
    expect(result!.baseUrl).toBe("https://custom.ntfy.local")
    expect(result!.auth.token).toBe("tk_123")
    expect(result!.auth.username).toBe("user")
    expect(result!.auth.password).toBe("pass")
    expect(result!.priority).toBe("high")
    expect(result!.notify.taskComplete.enabled).toBe(false)
    expect(result!.notify.apiTimeout.timeout).toBe(60)
    expect(result!.notify.consecutiveFailure.threshold).toBe(5)
    expect(result!.notify.consecutiveFailure.enabled).toBe(false)
  })

  test("strips JSONC comments", () => {
    writeConfig(`{
  // comment
  "topic": "test"
}`)
    const result = loadConfig(TMP)
    expect(result).not.toBeNull()
    expect(result!.topic).toBe("test")
  })
})
