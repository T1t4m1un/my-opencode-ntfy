export class Heartbeat {
    timer = null;
    timeoutMs;
    onTimeout;
    constructor(timeoutMs, onTimeout) {
        this.timeoutMs = timeoutMs;
        this.onTimeout = onTimeout;
    }
    start() {
        this.reset();
    }
    reset() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            this.onTimeout();
        }, this.timeoutMs);
    }
    stop() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
