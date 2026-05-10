import type { PluginConfig, NtfyPayload } from "./types.js";
export declare function sendNtfy(config: PluginConfig, payload: NtfyPayload): Promise<void>;
