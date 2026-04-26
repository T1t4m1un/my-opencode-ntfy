# my-opencode-ntfy 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 OpenCode 插件，通过 ntfy 发送推送通知（任务完成、权限请求、API 超时、连续失败）。

**Architecture:** 多文件模块化架构。入口 `plugin.ts` 加载配置，初始化 ntfy 客户端、心跳、失败追踪器，注册事件处理器。每个处理器独立文件，通过共享类型和工具模块协作。

**Tech Stack:** TypeScript, Bun, `@opencode-ai/plugin`（含 zod）, `bun test`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `package.json` | 项目配置、依赖、脚本 |
| `tsconfig.json` | TypeScript 编译配置 |
| `.gitignore` | Git 忽略规则 |
| `src/types.ts` | 共享类型定义（PluginConfig, NtfyPayload 等） |
| `src/config.ts` | Zod schema + JSONC 配置加载 |
| `src/ntfy.ts` | ntfy HTTP POST 客户端 |
| `src/heartbeat.ts` | 定时器管理，超时检测 |
| `src/failure-tracker.ts` | 连续失败计数器 |
| `src/handlers/session-idle.ts` | session.idle → 任务完成通知 |
| `src/handlers/permission-asked.ts` | permission.asked → 权限请求通知 |
| `src/handlers/session-error.ts` | session.error → 失败计数 + 通知 |
| `src/handlers/message-activity.ts` | message.part.updated → 心跳重置 |
| `src/plugin.ts` | 插件入口，导出 plugin 函数 |

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "my-opencode-ntfy",
  "version": "0.1.0",
  "description": "OpenCode plugin that sends push notifications via ntfy",
  "main": "dist/plugin.js",
  "types": "dist/plugin.d.ts",
  "files": ["dist/"],
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["opencode", "plugin", "ntfy", "notifications"],
  "license": "MIT",
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.0.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.0.0",
    "typescript": "^5.7.0",
    "@types/bun": "^1.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

- [ ] **Step 4: 安装依赖**

Run: `bun install`
Expected: 成功创建 `bun.lock`

- [ ] **Step 5: 提交**

```bash
git add package.json tsconfig.json .gitignore bun.lock
git commit -m "chore: scaffold project with bun, typescript, opencode plugin deps"
```

---

### Task 2: 共享类型 types.ts

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: 创建 src/types.ts**

```typescript
export interface NtfyPayload {
  topic: string
  title: string
  message: string
  priority?: number
  tags?: string[]
}

export interface NtfyAuth {
  token?: string
  username?: string
  password?: string
}

export interface NotifyConfig<T = Record<string, unknown>> {
  enabled: boolean
} & T

export interface TaskCompleteConfig extends NotifyConfig {
}

export interface PermissionAskedConfig extends NotifyConfig {
}

export interface ApiTimeoutConfig extends NotifyConfig<{
  timeout: number
}> {
  timeout: number
}

export interface ConsecutiveFailureConfig extends NotifyConfig<{
  threshold: number
}> {
  threshold: number
}

export interface PluginConfig {
  baseUrl: string
  topic: string
  auth: NtfyAuth
  priority: string
  notify: {
    taskComplete: TaskCompleteConfig
    permissionAsked: PermissionAskedConfig
    apiTimeout: ApiTimeoutConfig
    consecutiveFailure: ConsecutiveFailureConfig
  }
}
```

- [ ] **Step 2: 运行 typecheck 验证**

Run: `bun run typecheck`
Expected: PASS（无编译错误）

- [ ] **Step 3: 提交**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: 配置加载 config.ts (TDD)

**Files:**
- Create: `src/config.ts`
- Create: `src/config.test.ts`

- [ ] **Step 1: 写测试 src/config.test.ts**

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { join } from "path"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs"
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/config.test.ts`
Expected: FAIL — `loadConfig` 不存在

- [ ] **Step 3: 实现 src/config.ts**

```typescript
import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { z } from "zod"
import type { PluginConfig } from "./types.js"

const NotifyEntrySchema = z.object({
  enabled: z.boolean().default(true),
})

const ApiTimeoutSchema = NotifyEntrySchema.extend({
  timeout: z.number().int().positive().default(120),
})

const ConsecutiveFailureSchema = NotifyEntrySchema.extend({
  threshold: z.number().int().positive().default(3),
})

const AuthSchema = z.object({
  token: z.string().optional().default(""),
  username: z.string().optional().default(""),
  password: z.string().optional().default(""),
}).optional().default({})

const ConfigSchema = z.object({
  baseUrl: z.string().url().default("https://ntfy.sh"),
  topic: z.string().min(1),
  auth: AuthSchema,
  priority: z.enum(["min", "low", "default", "high", "max"]).default("default"),
  notify: z.object({
    taskComplete: NotifyEntrySchema.default({ enabled: true }),
    permissionAsked: NotifyEntrySchema.default({ enabled: true }),
    apiTimeout: ApiTimeoutSchema.default({ enabled: true, timeout: 120 }),
    consecutiveFailure: ConsecutiveFailureSchema.default({ enabled: true, threshold: 3 }),
  }).optional().default({}),
})

function stripJsonc(raw: string): string {
  return raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
}

export function loadConfig(configDir?: string): PluginConfig | null {
  const dir = configDir ?? join(homedir(), ".config", "opencode")
  const configPath = join(dir, "my-opencode-ntfy.jsonc")

  let raw: string
  try {
    raw = readFileSync(configPath, "utf-8")
  } catch {
    console.warn("[my-opencode-ntfy] Config file not found:", configPath)
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonc(raw))
  } catch (e) {
    console.warn("[my-opencode-ntfy] Invalid JSON/JSONC in config:", configPath, e)
    return null
  }

  const result = ConfigSchema.safeParse(parsed)
  if (!result.success) {
    console.warn("[my-opencode-ntfy] Config validation failed:", result.error.flatten())
    return null
  }

  return result.data as PluginConfig
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/config.test.ts`
Expected: 所有 6 个测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat: add config loading with Zod schema and JSONC support"
```

---

### Task 4: ntfy HTTP 客户端 ntfy.ts (TDD)

**Files:**
- Create: `src/ntfy.ts`
- Create: `src/ntfy.test.ts`

- [ ] **Step 1: 写测试 src/ntfy.test.ts**

```typescript
import { describe, test, expect, mock, beforeEach } from "bun:test"
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
    expect(calls[0].url).toBe("https://ntfy.sh")
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
    const warnSpy = jest.fn()
    console.warn = warnSpy
    globalThis.fetch = async () => {
      throw new Error("network error")
    }

    await expect(sendNtfy(baseConfig, { topic: "test", title: "t", message: "m" })).resolves.toBeUndefined()

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

const originalWarn = console.warn
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/ntfy.test.ts`
Expected: FAIL — `sendNtfy` 不存在

- [ ] **Step 3: 实现 src/ntfy.ts**

```typescript
import type { PluginConfig, NtfyPayload } from "./types.js"

const PRIORITY_MAP: Record<string, number> = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  max: 5,
}

export async function sendNtfy(config: PluginConfig, payload: NtfyPayload): Promise<void> {
  const url = config.baseUrl.replace(/\/+$/, "")

  const body: Record<string, unknown> = {
    topic: payload.topic,
    title: payload.title,
    message: payload.message,
    priority: payload.priority ?? PRIORITY_MAP[config.priority] ?? 3,
  }

  if (payload.tags && payload.tags.length > 0) {
    body.tags = payload.tags.join(",")
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (config.auth.token) {
    headers["Authorization"] = `Bearer ${config.auth.token}`
  } else if (config.auth.username && config.auth.password) {
    const encoded = btoa(`${config.auth.username}:${config.auth.password}`)
    headers["Authorization"] = `Basic ${encoded}`
  }

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.warn("[my-opencode-ntfy] Failed to send notification:", e)
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/ntfy.test.ts`
Expected: 所有 6 个测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/ntfy.ts src/ntfy.test.ts
git commit -m "feat: add ntfy HTTP client with auth and fire-and-forget"
```

---

### Task 5: 心跳超时检测 heartbeat.ts (TDD)

**Files:**
- Create: `src/heartbeat.ts`
- Create: `src/heartbeat.test.ts`

- [ ] **Step 1: 写测试 src/heartbeat.test.ts**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Heartbeat } from "./heartbeat.js"

describe("Heartbeat", () => {
  test("calls onTimeout after timeout elapses without reset", async () => {
    let called = false
    const hb = new Heartbeat(50, () => { called = true })
    hb.start()

    await Bun.sleep(100)
    expect(called).toBe(true)
    hb.stop()
  })

  test("does not call onTimeout if reset before timeout", async () => {
    let called = false
    const hb = new Heartbeat(100, () => { called = true })
    hb.start()

    await Bun.sleep(50)
    hb.reset()

    await Bun.sleep(60)
    expect(called).toBe(false)
    hb.stop()
  })

  test("stop prevents timeout callback", async () => {
    let called = false
    const hb = new Heartbeat(50, () => { called = true })
    hb.start()

    hb.stop()

    await Bun.sleep(100)
    expect(called).toBe(false)
  })

  test("reset after timeout fires again on next timeout", async () => {
    let count = 0
    const hb = new Heartbeat(50, () => { count++ })
    hb.start()

    await Bun.sleep(80)
    expect(count).toBe(1)

    hb.reset()
    await Bun.sleep(80)
    expect(count).toBe(2)

    hb.stop()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/heartbeat.test.ts`
Expected: FAIL — `Heartbeat` 不存在

- [ ] **Step 3: 实现 src/heartbeat.ts**

```typescript
export class Heartbeat {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly timeoutMs: number
  private readonly onTimeout: () => void

  constructor(timeoutSeconds: number, onTimeout: () => void) {
    this.timeoutMs = timeoutSeconds * 1000
    this.onTimeout = onTimeout
  }

  start(): void {
    this.reset()
  }

  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.onTimeout()
    }, this.timeoutMs)
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/heartbeat.test.ts`
Expected: 所有 4 个测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/heartbeat.ts src/heartbeat.test.ts
git commit -m "feat: add heartbeat timer for API timeout detection"
```

---

### Task 6: 连续失败追踪器 failure-tracker.ts (TDD)

**Files:**
- Create: `src/failure-tracker.ts`
- Create: `src/failure-tracker.test.ts`

- [ ] **Step 1: 写测试 src/failure-tracker.test.ts**

```typescript
import { describe, test, expect } from "bun:test"
import { FailureTracker } from "./failure-tracker.js"

describe("FailureTracker", () => {
  test("does not trigger below threshold", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")

    expect(notifications).toBe(0)
    expect(tracker.count).toBe(2)
  })

  test("triggers at threshold and resets count", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")
    tracker.recordFailure("err3")

    expect(notifications).toBe(1)
    expect(tracker.count).toBe(0)
  })

  test("recordSuccess resets count", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")
    tracker.recordSuccess()

    expect(tracker.count).toBe(0)

    tracker.recordFailure("err3")
    expect(notifications).toBe(0)
  })

  test("can trigger multiple times", () => {
    let notifications = 0
    const tracker = new FailureTracker(2, () => { notifications++ })

    tracker.recordFailure("e1")
    tracker.recordFailure("e2")
    tracker.recordFailure("e3")
    tracker.recordFailure("e4")

    expect(notifications).toBe(2)
  })

  test("lastError is tracked", () => {
    const tracker = new FailureTracker(3, () => {})
    tracker.recordFailure("first")
    tracker.recordFailure("second")

    expect(tracker.lastError).toBe("second")
  })

  test("justTriggered is true only on the trigger call", () => {
    const tracker = new FailureTracker(2, () => {})

    tracker.recordFailure("e1")
    expect(tracker.justTriggered).toBe(false)

    tracker.recordFailure("e2")
    expect(tracker.justTriggered).toBe(true)

    tracker.recordFailure("e3")
    expect(tracker.justTriggered).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `bun test src/failure-tracker.test.ts`
Expected: FAIL — `FailureTracker` 不存在

- [ ] **Step 3: 实现 src/failure-tracker.ts**

```typescript
export class FailureTracker {
  private readonly threshold: number
  private readonly onThreshold: () => void
  private _count = 0
  private _lastError: string | null = null
  private _justTriggered = false

  constructor(threshold: number, onThreshold: () => void) {
    this.threshold = threshold
    this.onThreshold = onThreshold
  }

  get count(): number {
    return this._count
  }

  get lastError(): string | null {
    return this._lastError
  }

  get justTriggered(): boolean {
    return this._justTriggered
  }

  recordFailure(error: string): void {
    this._justTriggered = false
    this._count++
    this._lastError = error

    if (this._count >= this.threshold) {
      this._justTriggered = true
      this._count = 0
      this._lastError = null
    }
  }

  recordSuccess(): void {
    this._count = 0
    this._lastError = null
    this._justTriggered = false
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `bun test src/failure-tracker.test.ts`
Expected: 所有 5 个测试 PASS

- [ ] **Step 5: 提交**

```bash
git add src/failure-tracker.ts src/failure-tracker.test.ts
git commit -m "feat: add failure tracker for consecutive LLM API errors"
```

---

### Task 7: 事件处理器 handlers/

**Files:**
- Create: `src/handlers/session-idle.ts`
- Create: `src/handlers/permission-asked.ts`
- Create: `src/handlers/session-error.ts`
- Create: `src/handlers/message-activity.ts`

- [ ] **Step 1: 创建 src/handlers/session-idle.ts**

```typescript
import type { PluginConfig, NtfyPayload } from "../types.js"
import { sendNtfy } from "../ntfy.js"

export async function handleSessionIdle(
  config: PluginConfig,
  properties: Record<string, unknown>,
  projectName: string,
): Promise<void> {
  if (!config.notify.taskComplete.enabled) return

  const sessionID = typeof properties.sessionID === "string"
    ? properties.sessionID.slice(0, 8)
    : "unknown"
  const timestamp = new Date().toISOString()

  await sendNtfy(config, {
    topic: config.topic,
    title: "✅ 任务完成",
    message: `项目: ${projectName}\n会话: ${sessionID}\n时间: ${timestamp}`,
    tags: ["white_check_mark"],
  })
}
```

- [ ] **Step 2: 创建 src/handlers/permission-asked.ts**

```typescript
import type { PluginConfig } from "../types.js"
import { sendNtfy } from "../ntfy.js"

export async function handlePermissionAsked(
  config: PluginConfig,
  properties: Record<string, unknown>,
  projectName: string,
): Promise<void> {
  if (!config.notify.permissionAsked.enabled) return

  const toolName = typeof properties.tool === "string"
    ? properties.tool
    : typeof properties.type === "string"
      ? String(properties.type)
      : "unknown"
  const timestamp = new Date().toISOString()

  await sendNtfy(config, {
    topic: config.topic,
    title: "🔒 权限请求",
    message: `工具: ${toolName}\n项目: ${projectName}\n时间: ${timestamp}`,
    priority: 4,
    tags: ["lock"],
  })
}
```

- [ ] **Step 3: 创建 src/handlers/session-error.ts**

```typescript
import type { PluginConfig } from "../types.js"
import { sendNtfy } from "../ntfy.js"
import type { FailureTracker } from "../failure-tracker.js"

export async function handleSessionError(
  config: PluginConfig,
  properties: Record<string, unknown>,
  projectName: string,
  tracker: FailureTracker,
): Promise<void> {
  if (!config.notify.consecutiveFailure.enabled) return

  const error = properties.error
  let errorMsg = "unknown error"
  if (error && typeof error === "object" && "message" in error) {
    errorMsg = String((error as { message: unknown }).message)
  } else if (typeof error === "string") {
    errorMsg = error
  }

  tracker.recordFailure(errorMsg)

  if (tracker.justTriggered) {
    const threshold = config.notify.consecutiveFailure.threshold
    await sendNtfy(config, {
      topic: config.topic,
      title: "❌ 连续 API 失败",
      message: `连续失败: ${threshold} 次\n项目: ${projectName}\n最近错误: ${errorMsg}\n时间: ${new Date().toISOString()}`,
      priority: 5,
      tags: ["x"],
    })
  }
}
```

- [ ] **Step 4: 创建 src/handlers/message-activity.ts**

```typescript
import type { Heartbeat } from "../heartbeat.js"

export function handleMessageActivity(
  heartbeat: Heartbeat,
): void {
  heartbeat.reset()
}
```

- [ ] **Step 5: 运行 typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/handlers/
git commit -m "feat: add event handlers for session idle, permission, error, activity"
```

---

### Task 8: 插件入口 plugin.ts

**Files:**
- Create: `src/plugin.ts`

- [ ] **Step 1: 创建 src/plugin.ts**

```typescript
import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./config.js"
import { Heartbeat } from "./heartbeat.js"
import { FailureTracker } from "./failure-tracker.js"
import { handleSessionIdle } from "./handlers/session-idle.js"
import { handlePermissionAsked } from "./handlers/permission-asked.js"
import { handleSessionError } from "./handlers/session-error.js"
import { handleMessageActivity } from "./handlers/message-activity.js"
import { sendNtfy } from "./ntfy.js"

const plugin: Plugin = async (input: PluginInput) => {
  const { project, directory } = input

  const config = loadConfig(directory)
  if (!config) {
    console.warn("[my-opencode-ntfy] No valid config, plugin disabled")
    return {}
  }

  const projectName = project.id || project.worktree || "unknown"

  let heartbeat: Heartbeat | undefined
  let tracker: FailureTracker | undefined

  if (config.notify.apiTimeout.enabled) {
    heartbeat = new Heartbeat(config.notify.apiTimeout.timeout, async () => {
      if (!config.notify.apiTimeout.enabled) return
      await sendNtfy(config, {
        topic: config.topic,
        title: "⏱️ API 无响应",
        message: `项目: ${projectName}\n已 ${config.notify.apiTimeout.timeout} 秒无活动\n时间: ${new Date().toISOString()}`,
        priority: 4,
        tags: ["hourglass"],
      })
    })
    heartbeat.start()
  }

  if (config.notify.consecutiveFailure.enabled) {
    tracker = new FailureTracker(config.notify.consecutiveFailure.threshold, () => {})
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        if (tracker) tracker.recordSuccess()
        await handleSessionIdle(config, event.properties, projectName)
      }

      if (event.type === "permission.asked") {
        await handlePermissionAsked(config, event.properties, projectName)
      }

      if (event.type === "session.error") {
        await handleSessionError(config, event.properties, projectName, tracker ?? new FailureTracker(Infinity, () => {}))
      }

      if (event.type === "message.part.updated") {
        if (heartbeat) handleMessageActivity(heartbeat)
      }
    },
  }
}

export default plugin
```

- [ ] **Step 2: 运行 typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: 运行构建**

Run: `bun run build`
Expected: 成功生成 `dist/` 目录

- [ ] **Step 4: 提交**

```bash
git add src/plugin.ts
git commit -m "feat: add plugin entry point wiring all handlers together"
```

---

### Task 9: 全量测试与清理

**Files:**
- Modify: `src/ntfy.test.ts` (修复 jest.fn() → 手动 spy)

- [ ] **Step 1: 修复 ntfy.test.ts 中的测试 spy**

将 "does not throw on fetch failure" 测试中的 `jest.fn()` 替换为手动 spy：

```typescript
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
```

同时删除文件末尾的 `const originalWarn = console.warn` 行。

- [ ] **Step 2: 运行全量测试**

Run: `bun test`
Expected: 所有测试 PASS

- [ ] **Step 3: 运行 typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: 运行构建**

Run: `bun run build`
Expected: 成功

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "fix: correct test spy pattern and verify all tests pass"
```
