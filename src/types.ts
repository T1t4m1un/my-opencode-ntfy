export interface NtfyPayload {
  topic: string
  title: string
  message: string
  priority?: number
  tags?: string[]
}

export interface NtfyAuth {
  token?: string
  username?: string
  password?: string
}

export type NotifyConfig<T = Record<string, unknown>> = {
  enabled: boolean
} & T

export interface TaskCompleteConfig extends NotifyConfig {
}

export interface PermissionAskedConfig extends NotifyConfig {
}

export interface ApiTimeoutConfig extends NotifyConfig<{
  timeout: number
}> {
  timeout: number
}

export interface ConsecutiveFailureConfig extends NotifyConfig<{
  threshold: number
}> {
  threshold: number
}

export interface PluginConfig {
  baseUrl: string
  topic: string
  auth: NtfyAuth
  priority: string
  notify: {
    taskComplete: TaskCompleteConfig
    permissionAsked: PermissionAskedConfig
    apiTimeout: ApiTimeoutConfig
    consecutiveFailure: ConsecutiveFailureConfig
  }
}
