export class Heartbeat {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly timeoutMs: number
  private readonly onTimeout: () => void

  constructor(timeoutMs: number, onTimeout: () => void) {
    this.timeoutMs = timeoutMs
    this.onTimeout = onTimeout
  }

  start(): void {
    this.reset()
  }

  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      this.onTimeout()
    }, this.timeoutMs)
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
