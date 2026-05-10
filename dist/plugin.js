import { basename } from "path";
import { loadConfig } from "./config.js";
import { Heartbeat } from "./heartbeat.js";
import { FailureTracker } from "./failure-tracker.js";
import { handleSessionIdle } from "./handlers/session-idle.js";
import { handlePermissionAsked } from "./handlers/permission-asked.js";
import { handleSessionError } from "./handlers/session-error.js";
import { handleMessageActivity } from "./handlers/message-activity.js";
import { sendNtfy } from "./ntfy.js";
function formatTime(d) {
    return d.toLocaleString("zh-CN", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
    });
}
const plugin = async (input) => {
    const { project, directory } = input;
    const config = loadConfig();
    if (!config) {
        return {};
    }
    const projectName = basename(project.worktree || directory);
    let heartbeat;
    let tracker;
    const sessionTitles = new Map();
    let currentSessionID;
    if (config.notify.apiTimeout.enabled) {
        heartbeat = new Heartbeat(config.notify.apiTimeout.timeout * 1000, async () => {
            if (!config.notify.apiTimeout.enabled)
                return;
            const title = currentSessionID ? sessionTitles.get(currentSessionID) : undefined;
            const lines = [
                `项目: ${projectName}`,
            ];
            if (title)
                lines.push(`会话: ${title}`);
            lines.push(`已 ${config.notify.apiTimeout.timeout} 秒无活动`);
            lines.push(`时间: ${formatTime(new Date())}`);
            await sendNtfy(config, {
                topic: config.topic,
                title: "⏱️ API 无响应",
                message: lines.join("\n"),
                priority: 4,
                tags: ["hourglass"],
            });
        });
    }
    if (config.notify.consecutiveFailure.enabled) {
        tracker = new FailureTracker(config.notify.consecutiveFailure.threshold, () => { });
    }
    return {
        event: async ({ event }) => {
            if (event.type === "session.created" || event.type === "session.updated") {
                const info = event.properties.info;
                if (info?.id && info?.title) {
                    sessionTitles.set(String(info.id), String(info.title));
                }
            }
            if (event.type === "session.idle") {
                if (heartbeat)
                    heartbeat.stop();
                if (tracker)
                    tracker.recordSuccess();
                const sessionID = String(event.properties.sessionID ?? "");
                const sessionTitle = sessionTitles.get(sessionID);
                await handleSessionIdle(config, event.properties, projectName, sessionTitle, formatTime(new Date()));
            }
            if (event.type === "permission.updated") {
                await handlePermissionAsked(config, event.properties, projectName, formatTime(new Date()));
            }
            if (event.type === "session.error") {
                await handleSessionError(config, event.properties, projectName, tracker ?? new FailureTracker(Infinity, () => { }), formatTime(new Date()));
            }
            if (event.type === "message.part.updated") {
                const props = event.properties;
                const part = props.part;
                if (part?.sessionID)
                    currentSessionID = String(part.sessionID);
                if (heartbeat)
                    handleMessageActivity(heartbeat);
            }
        },
    };
};
export { plugin };
export default plugin;
