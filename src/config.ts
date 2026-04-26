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
}).default({ token: "", username: "", password: "" })

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
  }).default({
    taskComplete: { enabled: true },
    permissionAsked: { enabled: true },
    apiTimeout: { enabled: true, timeout: 120 },
    consecutiveFailure: { enabled: true, threshold: 3 },
  }),
})

function stripJsonc(raw: string): string {
  return raw
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\/.*$/gm, "$1")
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\*[\s\S]*?\*\//g, "$1")
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
