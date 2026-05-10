import type { PluginConfig } from "../types.js"
import { sendNtfy } from "../ntfy.js"

export async function handlePermissionAsked(
  config: PluginConfig,
  properties: Record<string, unknown>,
  projectName: string,
  timestamp?: string,
): Promise<void> {
  if (!config.notify.permissionAsked.enabled) return

  const toolName = typeof properties.tool === "string"
    ? properties.tool
    : typeof properties.type === "string"
      ? String(properties.type)
      : "unknown"

  await sendNtfy(config, {
    topic: config.topic,
    title: "🔒 权限请求",
    message: `工具: ${toolName}\n项目: ${projectName}\n时间: ${timestamp ?? new Date().toISOString()}`,
    priority: 4,
    tags: ["lock"],
  })
}
