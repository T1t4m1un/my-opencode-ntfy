import { describe, test, expect } from "bun:test"
import { sendNtfy } from "./ntfy.js"
import type { PluginConfig, NtfyPayload } from "./types.js"

const baseConfig: PluginConfig = {
  baseUrl: "https://ntfy.sh",
  topic: "test",
  auth: {},
  priority: "default",
  notify: {
    taskComplete: { enabled: true },
    permissionAsked: { enabled: true },
    apiTimeout: { enabled: true, timeout: 120 },
    consecutiveFailure: { enabled: true, threshold: 3 },
  },
}

describe("sendNtfy", () => {
  test("sends POST to correct URL with required headers", async () => {
    const calls: Request[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init))
      return new Response("", { status: 200 })
    }

    const payload: NtfyPayload = {
      topic: "test",
      title: "hello",
      message: "world",
    }
    await sendNtfy(baseConfig, payload)

    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe("https://ntfy.sh/")
    expect(calls[0].method).toBe("POST")

    const body = await calls[0].text()
    const parsed = JSON.parse(body)
    expect(parsed.topic).toBe("test")
    expect(parsed.title).toBe("hello")
    expect(parsed.message).toBe("world")

    globalThis.fetch = originalFetch
  })

  test("sends Bearer token auth when configured", async () => {
    const calls: Request[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init))
      return new Response("", { status: 200 })
    }

    const config = { ...baseConfig, auth: { token: "tk_secret" } }
    await sendNtfy(config, { topic: "test", title: "t", message: "m" })

    expect(calls[0].headers.get("Authorization")).toBe("Bearer tk_secret")
    globalThis.fetch = originalFetch
  })

  test("sends Basic auth when username/password configured", async () => {
    const calls: Request[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init))
      return new Response("", { status: 200 })
    }

    const config = { ...baseConfig, auth: { username: "u", password: "p" } }
    await sendNtfy(config, { topic: "test", title: "t", message: "m" })

    const authHeader = calls[0].headers.get("Authorization") ?? ""
    expect(authHeader.startsWith("Basic ")).toBe(true)
    globalThis.fetch = originalFetch
  })

  test("prefers Bearer over Basic when both configured", async () => {
    const calls: Request[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init))
      return new Response("", { status: 200 })
    }

    const config = { ...baseConfig, auth: { token: "tk_abc", username: "u", password: "p" } }
    await sendNtfy(config, { topic: "test", title: "t", message: "m" })

    expect(calls[0].headers.get("Authorization")).toBe("Bearer tk_abc")
    globalThis.fetch = originalFetch
  })

  test("does not throw on fetch failure, logs warning", async () => {
    const originalFetch = globalThis.fetch
    const warnCalls: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => { warnCalls.push(String(args[0])) }

    globalThis.fetch = async () => {
      throw new Error("network error")
    }

    await expect(sendNtfy(baseConfig, { topic: "test", title: "t", message: "m" })).resolves.toBeUndefined()
    expect(warnCalls.length).toBeGreaterThan(0)

    globalThis.fetch = originalFetch
    console.warn = originalWarn
  })

  test("includes priority and tags in body", async () => {
    const calls: Request[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init))
      return new Response("", { status: 200 })
    }

    await sendNtfy(baseConfig, {
      topic: "test",
      title: "t",
      message: "m",
      priority: 4,
      tags: ["white_check_mark", "computer"],
    })

    const body = JSON.parse(await calls[0].text())
    expect(body.priority).toBe(4)
    expect(body.tags).toBe("white_check_mark,computer")
    globalThis.fetch = originalFetch
  })
})
