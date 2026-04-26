import type { Heartbeat } from "../heartbeat.js"

export function handleMessageActivity(
  heartbeat: Heartbeat,
): void {
  heartbeat.reset()
}
