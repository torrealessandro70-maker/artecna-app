import assert from 'node:assert/strict'
import { test } from 'node:test'
import { segmentCapsuleInterval } from './erase'
import type { GeometryPoint } from './types'

type Case = {
  name: string
  stroke: [GeometryPoint, GeometryPoint]
  eraser: [GeometryPoint, GeometryPoint]
  radius: number
  expected: [number, number] | null
}
const p = (x: number, y: number): GeometryPoint => ({ x, y })
const cases: Case[] = [
  { name: 'A central crossing', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, -5), p(5, 5)], radius: 1, expected: [0.4, 0.6] },
  { name: 'B miss just outside radius', stroke: [p(0, 0), p(10, 0)], eraser: [p(2, 1.000001), p(8, 1.000001)], radius: 1, expected: null },
  { name: 'C endpoint disk tangency', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, 1), p(5, 4)], radius: 1, expected: [0.5, 0.5] },
  { name: 'D stationary eraser disk', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, 0), p(5, 0)], radius: 2, expected: [0.3, 0.7] },
  { name: 'E degenerate stroke inside rectangle', stroke: [p(5, 0), p(5, 0)], eraser: [p(0, 0), p(10, 0)], radius: 1, expected: [0, 1] },
  { name: 'E degenerate stroke outside capsule', stroke: [p(5, 2), p(5, 2)], eraser: [p(0, 0), p(10, 0)], radius: 1, expected: null },
  { name: 'E both degenerate on disk boundary', stroke: [p(1, 0), p(1, 0)], eraser: [p(0, 0), p(0, 0)], radius: 1, expected: [0, 1] },
  { name: 'F eraser wider than stroke', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, -1), p(5, 1)], radius: 20, expected: [0, 1] },
  { name: 'G partial near t=0', stroke: [p(0, 0), p(10, 0)], eraser: [p(0, -2), p(0, 2)], radius: 2, expected: [0, 0.2] },
  { name: 'H partial near t=1', stroke: [p(0, 0), p(10, 0)], eraser: [p(10, -2), p(10, 2)], radius: 2, expected: [0.8, 1] },
  { name: 'I inclined segments', stroke: [p(0, 0), p(6, 8)], eraser: [p(7, 1), p(-1, 7)], radius: 1, expected: [0.4, 0.6] },
  { name: 'parallel segments with rounded caps', stroke: [p(0, 0), p(10, 0)], eraser: [p(3, 0.6), p(7, 0.6)], radius: 1, expected: [0.22, 0.78] },
  { name: 'parallel tangent boundary interval', stroke: [p(0, 0), p(10, 0)], eraser: [p(3, 1), p(7, 1)], radius: 1, expected: [0.3, 0.7] },
  { name: 'very long stroke', stroke: [p(-1e12, 0), p(1e12, 0)], eraser: [p(0, -5), p(0, 5)], radius: 1, expected: [0.5 - 5e-13, 0.5 + 5e-13] },
  { name: 'very long eraser movement', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, -1e12), p(5, 1e12)], radius: 1, expected: [0.4, 0.6] },
  { name: 'touch stroke endpoint only', stroke: [p(0, 0), p(10, 0)], eraser: [p(-1, 0), p(-2, 0)], radius: 1, expected: [0, 0] },
  { name: 'zero radius crossing', stroke: [p(0, 0), p(10, 0)], eraser: [p(5, -1), p(5, 1)], radius: 0, expected: [0.5, 0.5] },
  { name: 'zero radius collinear overlap', stroke: [p(0, 0), p(10, 0)], eraser: [p(3, 0), p(7, 0)], radius: 0, expected: [0.3, 0.7] },
]

for (const c of cases) {
  test(c.name, () => {
    for (const reverseStroke of [false, true]) {
      for (const reverseEraser of [false, true]) {
        const [p0, p1] = reverseStroke ? [c.stroke[1], c.stroke[0]] : c.stroke
        const [e0, e1] = reverseEraser ? [c.eraser[1], c.eraser[0]] : c.eraser
        const actual = segmentCapsuleInterval(p0, p1, e0, e1, c.radius)
        if (c.expected === null) {
          assert.equal(actual, null)
          continue
        }
        const expected = reverseStroke ? [1 - c.expected[1], 1 - c.expected[0]] : c.expected
        assert.ok(actual)
        assert.ok(actual.t0 >= 0 && actual.t0 <= actual.t1 && actual.t1 <= 1)
        assert.ok(Math.abs(actual.t0 - expected[0]) <= 2e-15, JSON.stringify({ actual, expected }))
        assert.ok(Math.abs(actual.t1 - expected[1]) <= 2e-15, JSON.stringify({ actual, expected }))
      }
    }
  })
}

test('translation, rotation and scale preserve a central crossing interval', () => {
  for (const angle of [0.13, 0.71, 1.9, 2.7]) {
    for (const scale of [0.001, 1, 1e6]) {
      const transform = ({ x, y }: GeometryPoint) => p(
        scale * (x * Math.cos(angle) - y * Math.sin(angle) + 17),
        scale * (x * Math.sin(angle) + y * Math.cos(angle) - 23),
      )
      const actual = segmentCapsuleInterval(
        transform(p(0, 0)), transform(p(10, 0)),
        transform(p(5, -5)), transform(p(5, 5)), scale,
      )
      assert.ok(actual)
      assert.ok(Math.abs(actual.t0 - 0.4) < 1e-13)
      assert.ok(Math.abs(actual.t1 - 0.6) < 1e-13)
    }
  }
})

test('invalid radius or coordinates are rejected', () => {
  for (const radius of [-1, NaN, Infinity]) {
    assert.throws(() => segmentCapsuleInterval(p(0, 0), p(1, 0), p(0, 0), p(1, 0), radius), RangeError)
  }
  assert.throws(() => segmentCapsuleInterval(p(NaN, 0), p(1, 0), p(0, 0), p(1, 0), 1), RangeError)
})
