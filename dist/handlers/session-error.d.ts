import type { PluginConfig } from "../types.js";
import type { FailureTracker } from "../failure-tracker.js";
export declare function handleSessionError(config: PluginConfig, properties: Record<string, unknown>, projectName: string, tracker: FailureTracker, timestamp?: string): Promise<void>;
