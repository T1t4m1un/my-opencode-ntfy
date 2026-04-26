import type { PluginConfig } from "../types.js"
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
