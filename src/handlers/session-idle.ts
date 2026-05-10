import type { PluginConfig } from "../types.js"
import { sendNtfy } from "../ntfy.js"

export async function handleSessionIdle(
  config: PluginConfig,
  properties: Record<string, unknown>,
  projectName: string,
  sessionTitle?: string,
  timestamp?: string,
): Promise<void> {
  if (!config.notify.taskComplete.enabled) return

  const sessionID = typeof properties.sessionID === "string"
    ? properties.sessionID
    : "unknown"

  const lines = [
    `项目: ${projectName}`,
  ]
  if (sessionTitle) {
    lines.push(`会话: ${sessionTitle}`)
  }
  lines.push(`时间: ${timestamp ?? new Date().toISOString()}`)

  await sendNtfy(config, {
    topic: config.topic,
    title: "✅ 任务完成",
    message: lines.join("\n"),
    tags: ["white_check_mark"],
  })
}
