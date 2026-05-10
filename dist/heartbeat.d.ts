export declare class Heartbeat {
    private timer;
    private readonly timeoutMs;
    private readonly onTimeout;
    constructor(timeoutMs: number, onTimeout: () => void);
    start(): void;
    reset(): void;
    stop(): void;
}
