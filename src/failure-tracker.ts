export class FailureTracker {
  private readonly threshold: number
  private readonly onThreshold: () => void
  private _count = 0
  private _lastError: string | null = null
  private _justTriggered = false

  constructor(threshold: number, onThreshold: () => void) {
    this.threshold = threshold
    this.onThreshold = onThreshold
  }

  get count(): number {
    return this._count
  }

  get lastError(): string | null {
    return this._lastError
  }

  get justTriggered(): boolean {
    return this._justTriggered
  }

  recordFailure(error: string): void {
    this._justTriggered = false
    this._count++
    this._lastError = error

    if (this._count >= this.threshold) {
      this._justTriggered = true
      this._count = 0
      this._lastError = null
      this.onThreshold()
    }
  }

  recordSuccess(): void {
    this._count = 0
    this._lastError = null
    this._justTriggered = false
  }
}
