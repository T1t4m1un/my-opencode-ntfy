import { describe, test, expect } from "bun:test"
import { Heartbeat } from "./heartbeat.js"

describe("Heartbeat", () => {
  test("calls onTimeout after timeout elapses without reset", async () => {
    let called = false
    const hb = new Heartbeat(50, () => { called = true })
    hb.start()

    await Bun.sleep(100)
    expect(called).toBe(true)
    hb.stop()
  })

  test("does not call onTimeout if reset before timeout", async () => {
    let called = false
    const hb = new Heartbeat(100, () => { called = true })
    hb.start()

    await Bun.sleep(50)
    hb.reset()

    await Bun.sleep(60)
    expect(called).toBe(false)
    hb.stop()
  })

  test("stop prevents timeout callback", async () => {
    let called = false
    const hb = new Heartbeat(50, () => { called = true })
    hb.start()

    hb.stop()

    await Bun.sleep(100)
    expect(called).toBe(false)
  })

  test("reset after timeout fires again on next timeout", async () => {
    let count = 0
    const hb = new Heartbeat(50, () => { count++ })
    hb.start()

    await Bun.sleep(80)
    expect(count).toBe(1)

    hb.reset()
    await Bun.sleep(80)
    expect(count).toBe(2)

    hb.stop()
  })
})
