import { describe, test, expect } from "bun:test"
import { FailureTracker } from "./failure-tracker.js"

describe("FailureTracker", () => {
  test("does not trigger below threshold", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")

    expect(notifications).toBe(0)
    expect(tracker.count).toBe(2)
  })

  test("triggers at threshold and resets count", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")
    tracker.recordFailure("err3")

    expect(notifications).toBe(1)
    expect(tracker.count).toBe(0)
  })

  test("recordSuccess resets count", () => {
    let notifications = 0
    const tracker = new FailureTracker(3, () => { notifications++ })

    tracker.recordFailure("err1")
    tracker.recordFailure("err2")
    tracker.recordSuccess()

    expect(tracker.count).toBe(0)

    tracker.recordFailure("err3")
    expect(notifications).toBe(0)
  })

  test("can trigger multiple times", () => {
    let notifications = 0
    const tracker = new FailureTracker(2, () => { notifications++ })

    tracker.recordFailure("e1")
    tracker.recordFailure("e2")
    tracker.recordFailure("e3")
    tracker.recordFailure("e4")

    expect(notifications).toBe(2)
  })

  test("lastError is tracked", () => {
    const tracker = new FailureTracker(3, () => {})
    tracker.recordFailure("first")
    tracker.recordFailure("second")

    expect(tracker.lastError).toBe("second")
  })

  test("justTriggered is true only on the trigger call", () => {
    const tracker = new FailureTracker(2, () => {})

    tracker.recordFailure("e1")
    expect(tracker.justTriggered).toBe(false)

    tracker.recordFailure("e2")
    expect(tracker.justTriggered).toBe(true)

    tracker.recordFailure("e3")
    expect(tracker.justTriggered).toBe(false)
  })
})
