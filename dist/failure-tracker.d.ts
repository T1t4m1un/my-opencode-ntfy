export declare class FailureTracker {
    private readonly threshold;
    private readonly onThreshold;
    private _count;
    private _lastError;
    private _justTriggered;
    constructor(threshold: number, onThreshold: () => void);
    get count(): number;
    get lastError(): string | null;
    get justTriggered(): boolean;
    recordFailure(error: string): void;
    recordSuccess(): void;
}
