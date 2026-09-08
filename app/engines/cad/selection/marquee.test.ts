import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CadEntity, CadAreaEntity } from '../entities/types'
import { createCadLine, createCadRectangle, createCadFreehand, createCadText, createCadCircle, createCadPolyline, createCadDimension } from '../entities/entity-factory'
import { intersectsCadMarquee } from './marquee'

const stroke = { color: '#000', width: 2 }
const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
const line = (x: number) => createCadLine({ start: { x, y: 3 }, end: { x: x + 4, y: 7 }, stroke })
const rectangle = (x: number) => createCadRectangle({ transform: { x, y: 3, width: 4, height: 4, rotation: 0, scaleX: 1, scaleY: 1 }, stroke })
const freehand = (x: number) => createCadFreehand({ points: [{ x, y: 3 }, { x: x + 4, y: 7 }], stroke })
const text = (x: number) => createCadText({ position: { x, y: 5 }, content: 'abc', fontSize: 2 })
const area = (x: number): CadAreaEntity => ({ ...line(x), type: 'area', points: [
  { x, y: 3 }, { x: x + 4, y: 3 }, { x: x + 4, y: 7 }, { x, y: 7 },
], areaSquareMeters: 16, perimeterMeters: 16 })

for (const [name, make] of Object.entries({ line, rectangle, freehand, text, area })) {
  test(name + ': fully inside containment', () => assert.equal(intersectsCadMarquee(make(2), rect, 'containment'), true))
  test(name + ': partial containment is false', () => assert.equal(intersectsCadMarquee(make(8), rect, 'containment'), false))
  test(name + ': partial crossing is true', () => assert.equal(intersectsCadMarquee(make(8), rect, 'crossing'), true))
  test(name + ': outside is false in both modes', () => {
    assert.equal(intersectsCadMarquee(make(20), rect, 'containment'), false)
    assert.equal(intersectsCadMarquee(make(20), rect, 'crossing'), false)
  })
}

test('line crosses with both endpoints outside; bounds alone are not sufficient', () => {
  assert.equal(intersectsCadMarquee(createCadLine({ start: { x: -5, y: 5 }, end: { x: 15, y: 5 }, stroke }), rect, 'crossing'), true)
  assert.equal(intersectsCadMarquee(createCadLine({ start: { x: -5, y: 8 }, end: { x: 8, y: 15 }, stroke }), rect, 'crossing'), false)
})
test('area encloses marquee and rejects bounding-box-only overlap', () => {
  const enclosing = { ...area(0), points: [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }] }
  assert.equal(intersectsCadMarquee(enclosing, rect, 'crossing'), true)
  assert.equal(intersectsCadMarquee(enclosing, rect, 'containment'), false)
  const outside = { ...area(0), points: [{ x: -5, y: 8 }, { x: 8, y: 15 }, { x: -5, y: 15 }] }
  assert.equal(intersectsCadMarquee(outside, rect, 'crossing'), false)
})
test('boundary contact is included', () => {
  assert.equal(intersectsCadMarquee(line(10), rect, 'crossing'), true)
})
test('unsupported types are excluded', () => {
  const entities: CadEntity[] = [
    createCadCircle({ center: { x: 5, y: 5 }, radius: 1, stroke }),
    createCadPolyline({ points: [{ x: 2, y: 2 }, { x: 3, y: 3 }], stroke }),
    createCadDimension({ start: { x: 2, y: 2 }, end: { x: 3, y: 3 }, stroke }),
  ]
  for (const entity of entities) for (const mode of ['containment', 'crossing'] as const) assert.equal(intersectsCadMarquee(entity, rect, mode), false)
})
test('geometry is pure and ignores entity flags', () => {
  const entity = { ...line(2), visible: false, locked: true, selectable: false }
  const before = structuredClone(entity)
  assert.equal(intersectsCadMarquee(entity, rect, 'containment'), true)
  assert.deepEqual(entity, before)
})
