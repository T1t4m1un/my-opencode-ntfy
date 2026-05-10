export class FailureTracker {
    threshold;
    onThreshold;
    _count = 0;
    _lastError = null;
    _justTriggered = false;
    constructor(threshold, onThreshold) {
        this.threshold = threshold;
        this.onThreshold = onThreshold;
    }
    get count() {
        return this._count;
    }
    get lastError() {
        return this._lastError;
    }
    get justTriggered() {
        return this._justTriggered;
    }
    recordFailure(error) {
        this._justTriggered = false;
        this._count++;
        this._lastError = error;
        if (this._count >= this.threshold) {
            this._justTriggered = true;
            this._count = 0;
            this._lastError = null;
            this.onThreshold();
        }
    }
    recordSuccess() {
        this._count = 0;
        this._lastError = null;
        this._justTriggered = false;
    }
}
