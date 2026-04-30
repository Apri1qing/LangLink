import { describe, it, expect } from 'vitest'
import { locationToPercent } from './bboxMap'

describe('locationToPercent', () => {
  it('maps axis-aligned bbox to percentages', () => {
    // 1000×1000 图，区域 (100,200) ~ (500,400)
    const loc = [100, 200, 500, 200, 500, 400, 100, 400]
    expect(locationToPercent(loc, 1000, 1000)).toEqual({
      left: 10,
      top: 20,
      width: 40,
      height: 20,
    })
  })

  it('handles rotated rectangles via bounding box', () => {
    // 旋转的四边形外接矩形
    const loc = [100, 250, 550, 200, 500, 400, 50, 450]
    const r = locationToPercent(loc, 1000, 1000)!
    expect(r.left).toBe(5)
    expect(r.top).toBe(20)
    expect(r.width).toBe(50) // 550-50=500 → 50%
    expect(r.height).toBe(25) // 450-200=250 → 25%
  })

  it('returns null on malformed input', () => {
    expect(locationToPercent([1, 2, 3], 100, 100)).toBeNull()
    expect(locationToPercent([1, 2, 3, 4, 5, 6, 7, 8], 0, 100)).toBeNull()
  })

  it('clamps values within 0-100', () => {
    const loc = [-100, -100, 2000, -100, 2000, 2000, -100, 2000]
    const r = locationToPercent(loc, 1000, 1000)!
    expect(r.left).toBe(0)
    expect(r.top).toBe(0)
    expect(r.width).toBeLessThanOrEqual(100)
    expect(r.height).toBeLessThanOrEqual(100)
  })
})
