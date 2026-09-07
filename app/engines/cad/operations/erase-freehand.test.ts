import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CadFreehandEntity, CadPoint } from '../entities/types'
import { eraseFreehand } from './erase-freehand'

const p = (x: number, y = 0): CadPoint => ({ x, y })
const entity = (points = [p(0), p(10)], width = 0): CadFreehandEntity => ({
  id: 'original', type: 'freehand', points,
  stroke: { color: '#123456', width, opacity: 0.32, dashArray: [2, 3] },
  layerId: 'layer', visible: false, locked: true, selectable: false, zOrder: 7,
  metadata: { title: 'stroke', custom: { value: 42 } },
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-02T00:00:00.000Z',
})
const timestamp = '2026-09-06T12:00:00.000Z'
const run = (input = entity(), e0 = p(5, -5), e1 = p(5, 5), radius = 1) => {
  let ids = 0
  let clocks = 0
  const before = structuredClone(input)
  const result = eraseFreehand(input, e0, e1, radius, {
    createId: () => 'new-' + ++ids,
    now: () => { clocks++; return timestamp },
  })
  assert.deepEqual(input, before, 'input must not be mutated')
  for (const fragment of result.entities) {
    if (!result.changed) continue
    assert.ok(fragment.points.length >= 2)
    for (let i = 1; i < fragment.points.length; i++) {
      assert.notDeepEqual(fragment.points[i - 1], fragment.points[i])
    }
  }
  return { ...result, ids, clocks }
}
const points = (result: ReturnType<typeof run>) => result.entities.map(e => e.points)

test('A/O miss preserves reference and does not generate IDs or timestamps', () => {
  const original = entity()
  const result = run(original, p(20, -5), p(20, 5))
  assert.equal(result.changed, false)
  assert.equal(result.entities[0], original)
  assert.equal(result.ids, 0)
  assert.equal(result.clocks, 0)
})
test('B/P central cut interpolates both boundaries', () => {
  const result = run()
  assert.equal(result.changed, true)
  assert.deepEqual(points(result), [[p(0), p(4)], [p(6), p(10)]])
})
test('C initial cut', () => {
  assert.deepEqual(points(run(entity(), p(0, -5), p(0, 5))), [[p(1), p(10)]])
})
test('D final cut', () => {
  assert.deepEqual(points(run(entity(), p(10, -5), p(10, 5))), [[p(0), p(9)]])
})
test('E complete erasure creates no IDs', () => {
  const result = run(entity(), p(5), p(5), 20)
  assert.equal(result.changed, true)
  assert.deepEqual(result.entities, [])
  assert.equal(result.ids, 0)
})
test('F adjacent erased segments do not reconnect survivors', () => {
  const result = run(entity([p(0), p(4), p(5), p(6), p(10)]), p(5, -5), p(5, 5), 2)
  assert.deepEqual(points(result), [[p(0), p(3)], [p(7), p(10)]])
})
test('G multiple crossings produce four fragments in original order', () => {
  const result = run(entity([p(0), p(10), p(10, 4), p(0, 4), p(0, 8), p(10, 8)]), p(5, -1), p(5, 9))
  assert.deepEqual(points(result), [
    [p(0), p(4)], [p(6), p(10), p(10, 4), p(6, 4)],
    [p(4, 4), p(0, 4), p(0, 8), p(4, 8)], [p(6, 8), p(10, 8)],
  ])
})
test('H repeated points inside and outside erased area are handled', () => {
  const result = run(entity([p(0), p(0), p(5), p(5), p(10), p(10)]))
  assert.deepEqual(points(result), [[p(0), p(4)], [p(6), p(10)]])
})
test('H untouched degenerate input is returned without repair', () => {
  for (const input of [entity([]), entity([p(20)]), entity([p(20), p(20)])]) {
    const result = run(input)
    assert.equal(result.changed, false)
    assert.equal(result.entities[0], input)
  }
})
test('I tangent disk and repeated tangent vertex do not split', () => {
  for (const input of [entity(), entity([p(0), p(5), p(5), p(10)])]) {
    const result = run(input, p(5, 1), p(5, 4))
    assert.equal(result.changed, false)
    assert.equal(result.entities[0], input)
    assert.equal(result.ids, 0)
  }
})
test('I practically zero interval is ignored using coordinate roundoff', () => {
  const result = run(entity(), p(5, -5), p(5, 5), Number.EPSILON)
  assert.equal(result.changed, false)
})
test('J stationary disk', () => {
  const result = run(entity(), p(5), p(5), 2)
  assert.equal(result.entities.length, 2)
  assert.deepEqual(result.entities[0].points[0], p(0))
  assert.deepEqual(result.entities[1].points[1], p(10))
  assert.ok(Math.abs(result.entities[0].points[1].x - 3) < 1e-14)
  assert.ok(Math.abs(result.entities[1].points[0].x - 7) < 1e-14)
  assert.equal(result.entities[0].points[1].y, 0)
  assert.equal(result.entities[1].points[0].y, 0)
})
test('K effective radius includes half the stroke width', () => {
  assert.deepEqual(points(run(entity(undefined, 4))), [[p(0), p(2)], [p(8), p(10)]])
})
test('L/M/N preserve all properties, first ID, unique subsequent IDs and timestamp', () => {
  const original = { ...entity([p(0), p(10), p(0), p(10)]), extension: { key: 'value' } }
  const result = run(original)
  assert.equal(result.entities.length, 4)
  assert.equal(result.ids, 3)
  assert.equal(result.clocks, 1)
  assert.deepEqual(result.entities.map(e => e.id), ['original', 'new-1', 'new-2', 'new-3'])
  for (const fragment of result.entities) {
    assert.equal(fragment.updatedAt, timestamp)
    for (const key of Object.keys(original)) {
      if (['id', 'points', 'updatedAt'].includes(key)) continue
      assert.equal((fragment as unknown as Record<string, unknown>)[key], (original as unknown as Record<string, unknown>)[key])
    }
  }
})
test('P inclined interpolation', () => {
  const result = run(entity([p(0), p(6, 8)]), p(7, 1), p(-1, 7))
  const expected = [[p(0), p(2.4, 3.2)], [p(3.6, 4.8), p(6, 8)]]
  points(result).forEach((fragment, i) => fragment.forEach((point, j) => {
    assert.ok(Math.abs(point.x - expected[i][j].x) < 1e-14)
    assert.ok(Math.abs(point.y - expected[i][j].y) < 1e-14)
  }))
  assert.equal(result.entities.length, 2)
})
test('numerical endpoint sliver is discarded and first survivor retains ID', () => {
  const result = run(entity(), p(1 + Number.EPSILON), p(1 + Number.EPSILON))
  assert.equal(result.entities.length, 1)
  assert.equal(result.entities[0].id, 'original')
  assert.equal(result.ids, 0)
  assert.deepEqual(points(result), [[p(2), p(10)]])
})
test('long stroke still receives a narrow cut', () => {
  const result = run(entity([p(-1e12), p(1e12)]))
  assert.equal(result.entities.length, 2)
  assert.ok(Math.abs(result.entities[0].points[1].x - 4) < 0.001)
  assert.ok(Math.abs(result.entities[1].points[0].x - 6) < 0.001)
})
test('real small-scale cut is not suppressed by a graphic tolerance', () => {
  const result = run(entity([p(0), p(1e-8)]), p(5e-9, -1e-8), p(5e-9, 1e-8), 1e-10)
  assert.equal(result.entities.length, 2)
})
test('default ID generator produces distinct UUIDs', () => {
  const result = eraseFreehand(entity([p(0), p(10), p(0)]), p(5, -5), p(5, 5), 1)
  const ids = result.entities.slice(1).map(e => e.id)
  assert.equal(new Set(ids).size, 2)
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.ok(Number.isFinite(Date.parse(result.entities[0].updatedAt)))
})
test('negative radius and invalid width are rejected', () => {
  assert.throws(() => run(entity(), p(0), p(0), -1), RangeError)
  assert.throws(() => run(entity(undefined, NaN)), RangeError)
})
