# my-opencode-ntfy 设计文档

OpenCode 插件，通过 ntfy 服务发送推送通知。

## 概述

监控 OpenCode 会话事件（任务完成、权限请求、API 超时、连续失败），向 ntfy 服务器发送推送通知。用户在后台运行 OpenCode 时，通过手机/桌面实时获知状态变化。

## 用例

| # | 用例 | 触发事件 | 配置键 |
|---|------|---------|--------|
| 1 | 配置加载 | 插件初始化 | 全局 |
| 2 | 任务完成通知 | `session.idle` | `notify.taskComplete` |
| 3 | 权限/确认通知 | `permission.asked` | `notify.permissionAsked` |
| 4 | API 无活动超时 | `message.part.updated` 心跳 | `notify.apiTimeout` |
| 5 | 连续 LLM 失败 | `session.error` | `notify.consecutiveFailure` |

## 配置

文件路径：`~/.config/opencode/my-opencode-ntfy.jsonc`

```jsonc
{
  // 必填
  "baseUrl": "https://ntfy.sh",
  "topic": "opencode",

  // 可选认证
  "auth": {
    "token": "",       // Bearer token
    "username": "",    // Basic auth 用户名
    "password": ""     // Basic auth 密码
  },

  // 可选全局
  "priority": "default",

  // 按能力开关，每个内聚自己的参数
  "notify": {
    "taskComplete": {
      "enabled": true
    },
    "permissionAsked": {
      "enabled": true
    },
    "apiTimeout": {
      "timeout": 120,  // 秒，无活动超时阈值
      "enabled": true
    },
    "consecutiveFailure": {
      "threshold": 3,  // 连续失败次数
      "enabled": true
    }
  }
}
```

**加载规则：**
- 支持 JSONC（带注释）
- `baseUrl` 和 `topic` 必填，其余有默认值
- 配置文件不存在 → 打印警告，插件静默不启用
- 校验失败 → 打印具体错误字段，插件静默不启用

## 文件结构

```
src/
  plugin.ts              — 入口，导出插件函数，注册事件处理器
  config.ts              — Zod schema + 配置加载
  ntfy.ts                — ntfy HTTP 客户端
  heartbeat.ts           — API 无活动超时检测
  failure-tracker.ts     — 连续失败计数
  handlers/
    session-idle.ts      — 任务完成
    permission-asked.ts  — 权限/确认请求
    session-error.ts     — LLM 失败
    message-activity.ts  — 消息活动追踪（驱动心跳）
  types.ts               — 共享类型
```

## 模块设计

### config.ts

Zod schema 定义配置结构。导出 `loadConfig()` 函数，读取 JSONC 文件、去掉注释、解析、校验，返回类型安全的配置对象或 `null`（加载失败时）。

### ntfy.ts

封装 ntfy HTTP POST 请求。接收配置和结构化 payload（标题、消息、优先级、标签），根据 `auth` 配置添加认证头。发送失败只打日志，不抛错。

### heartbeat.ts

管理一个定时器。`reset()` 重置倒计时，倒计时归零时调用回调（发送超时通知）。插件初始化时启动，`message.part.updated` 事件触发 `reset()`。

### failure-tracker.ts

计数器。`recordFailure()` 递增，`recordSuccess()` 归零。达到 `threshold` 时触发一次通知并重置计数（避免重复通知）。

### handlers/session-idle.ts

监听 `session.idle`。通知内容：项目名、会话 ID、时间戳。标签：`white_check_mark`。

### handlers/permission-asked.ts

监听 `permission.asked`。通知内容：请求的工具名、项目名、时间戳。标签：`lock`。

### handlers/session-error.ts

监听 `session.error`。调用 `failure-tracker.recordFailure()`，达到阈值时发送通知。通知内容：连续失败次数、最近错误信息。标签：`x`。`session.idle` 事件触发时调用 `recordSuccess()` 重置计数器（任务完成说明 API 恢复正常）。

### handlers/message-activity.ts

监听 `message.part.updated`。每次触发时调用 `heartbeat.reset()`，保持心跳活跃。

### plugin.ts

入口文件。导出插件函数，接收 OpenCode 上下文。加载配置，初始化 ntfy 客户端、心跳、失败追踪器，注册所有事件处理器。配置加载失败时不注册任何处理器。

## 依赖

- `@opencode-ai/plugin` — OpenCode 插件类型
- `zod` — 配置校验

## 发布

npm 包 `my-opencode-ntfy`。Bun + TypeScript 构建，输出到 `dist/`。用户通过 `opencode.json` 的 `"plugin": ["my-opencode-ntfy"]` 安装使用。

## 通知格式

每条通知包含：
- **标题**：通知类型（如"任务完成"、"权限请求"）
- **内容**：项目名、会话 ID（截取前8位）、时间戳、相关上下文
- **优先级**：使用全局 `priority` 配置
- **标签**：按通知类型使用不同 emoji 标签，便于视觉区分
