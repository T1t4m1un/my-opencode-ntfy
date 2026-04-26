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
