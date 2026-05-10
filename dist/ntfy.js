const PRIORITY_MAP = {
    min: 1,
    low: 2,
    default: 3,
    high: 4,
    max: 5,
};
export async function sendNtfy(config, payload) {
    const url = config.baseUrl.replace(/\/+$/, "");
    const body = {
        topic: payload.topic,
        title: payload.title,
        message: payload.message,
        priority: payload.priority ?? PRIORITY_MAP[config.priority] ?? 3,
    };
    if (payload.tags && payload.tags.length > 0) {
        body.tags = payload.tags;
    }
    const headers = {
        "Content-Type": "application/json",
    };
    if (config.auth.token) {
        headers["Authorization"] = `Bearer ${config.auth.token}`;
    }
    else if (config.auth.username && config.auth.password) {
        const encoded = btoa(`${config.auth.username}:${config.auth.password}`);
        headers["Authorization"] = `Basic ${encoded}`;
    }
    try {
        await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
    }
    catch (e) {
        console.warn("[my-opencode-ntfy] Failed to send notification:", e);
    }
}
