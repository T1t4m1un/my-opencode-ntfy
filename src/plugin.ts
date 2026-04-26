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
    heartbeat = new Heartbeat(config.notify.apiTimeout.timeout * 1000, async () => {
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

      if (event.type === "permission.updated") {
        await handlePermissionAsked(config, event.properties as Record<string, unknown>, projectName)
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
