import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCadText } from '../entities/entity-factory'
import { getCadTextLayout } from '../geometry/text-layout'
import { getCadEntityBounds } from '../spatial/bounds'
import { textBehavior } from './text.behavior'

const makeText = () => createCadText({ position: { x: 100, y: 50 }, content: 'Hello', fontSize: 20 })

test('nonempty text bounds include ascent and descent around baseline', () => {
  assert.deepEqual(textBehavior.getBounds(makeText()), { minX: 100, minY: 34, maxX: 162, maxY: 54 })
})
test('bounds scale with font size', () => {
  const a = textBehavior.getBounds(makeText())
  const b = textBehavior.getBounds({ ...makeText(), fontSize: 40 })
  assert.equal(b.maxX - b.minX, 2 * (a.maxX - a.minX))
  assert.equal(b.maxY - b.minY, 2 * (a.maxY - a.minY))
})
test('alignment uses the same baseline anchor for bounds and SVG', () => {
  for (const [alignment, minX, maxX, anchor] of [
    ['left', 100, 162, 'start'], ['center', 69, 131, 'middle'], ['right', 38, 100, 'end'],
  ] as const) {
    const layout = getCadTextLayout({ ...makeText(), alignment })
    assert.deepEqual(layout.bounds, { minX, minY: 34, maxX, maxY: 54 })
    assert.equal(layout.textAnchor, anchor)
  }
})
test('move translates position, preserves properties and updates timestamp', () => {
  const original = {
    ...makeText(), fontFamily: 'Arial', fontWeight: 'bold', rotation: 30,
    alignment: 'right' as const, color: '#ff0000', layerId: 'custom',
    visible: false, locked: true, selectable: false, zOrder: 12,
    metadata: { custom: { value: 3 } }, updatedAt: '2000-01-01T00:00:00.000Z',
  }
  const before = structuredClone(original)
  const start = Date.now()
  const moved = textBehavior.move!(original, -7, 9)
  assert.deepEqual(moved.position, { x: 93, y: 59 })
  assert.deepEqual({ ...moved, position: original.position, updatedAt: original.updatedAt }, original)
  assert.ok(Date.parse(moved.updatedAt) >= start && Date.parse(moved.updatedAt) <= Date.now())
  assert.deepEqual(original, before)
  assert.notEqual(moved, original)
  assert.notEqual(moved.position, original.position)
})
test('empty text has finite zero-width bounds and is not hit', () => {
  const entity = { ...makeText(), content: '' }
  const bounds = textBehavior.getBounds(entity)
  assert.ok(Object.values(bounds).every(Number.isFinite))
  assert.equal(bounds.minX, bounds.maxX)
  assert.equal(textBehavior.hitTest!(entity, entity.position, 10), false)
})
test('hit test inside, outside, boundaries and tolerance for all alignments', () => {
  for (const alignment of ['left', 'center', 'right'] as const) {
    const entity = { ...makeText(), alignment }
    const b = textBehavior.getBounds(entity)
    assert.equal(textBehavior.hitTest!(entity, { x: (b.minX + b.maxX) / 2, y: 50 }, 0), true)
    assert.equal(textBehavior.hitTest!(entity, { x: b.minX, y: b.minY }, 0), true)
    assert.equal(textBehavior.hitTest!(entity, { x: b.maxX + 2, y: 50 }, 1), false)
    assert.equal(textBehavior.hitTest!(entity, { x: b.maxX + 2, y: 50 }, 2), true)
    assert.equal(textBehavior.hitTest!(entity, { x: b.minX, y: b.maxY + 1 }, 0), false)
  }
})
test('spatial index and behavior use identical estimated bounds', () => {
  for (const alignment of ['left', 'center', 'right'] as const) {
    const entity = { ...makeText(), alignment }
    assert.deepEqual(getCadEntityBounds(entity), textBehavior.getBounds(entity))
  }
})
test('documented limitation: rotation does not change estimated bounds', () => {
  assert.deepEqual(textBehavior.getBounds({ ...makeText(), rotation: 45 }), textBehavior.getBounds(makeText()))
})


test('single line and explicit newlines produce baseline-spaced rows', () => {
  assert.deepEqual(getCadTextLayout(makeText()).lines, ['Hello'])
  const layout = getCadTextLayout({ ...makeText(), content: 'Hello\nHi' })
  assert.deepEqual(layout.lines, ['Hello', 'Hi'])
  assert.equal(layout.lineHeight, 25)
  assert.deepEqual(layout.bounds, { minX: 100, minY: 34, maxX: 162, maxY: 79 })
})

test('blank rows, trailing newline and CRLF are preserved', () => {
  assert.deepEqual(getCadTextLayout({ ...makeText(), content: 'a\n\nb\n' }).lines, ['a', '', 'b', ''])
  assert.deepEqual(getCadTextLayout({ ...makeText(), content: 'a\r\nb\r' }).lines, ['a', 'b', ''])
  assert.deepEqual(getCadTextLayout({ ...makeText(), content: '' }).lines, [''])
})

test('box width wraps deterministically without dropping whitespace', () => {
  const layout = getCadTextLayout({ ...makeText(), content: 'ab cd!', metadata: { textBoxWidth: 37.2 } })
  assert.deepEqual(layout.lines, ['ab ', 'cd!'])
  assert.equal(layout.boxWidth, 37.2)
  assert.equal(layout.lines.join(''), 'ab cd!')
})

test('multiline alignment shares anchor, box and bounds', () => {
  for (const [alignment, factor] of [['left', 0], ['center', 0.5], ['right', 1]] as const) {
    const layout = getCadTextLayout({ ...makeText(), content: 'Hello\nx', alignment })
    assert.equal(layout.boxX, 100 - 240 * factor)
    assert.equal(layout.bounds.minX, 100 - 62 * factor)
    assert.equal(layout.bounds.maxY, 79)
  }
})

test('multiline hit test and spatial bounds include the final row', () => {
  const entity = { ...makeText(), content: 'Hello\nworld' }
  assert.equal(textBehavior.hitTest!(entity, { x: 120, y: 75 }, 0), true)
  assert.equal(textBehavior.hitTest!(entity, { x: 120, y: 80 }, 0), false)
  assert.deepEqual(getCadEntityBounds(entity), getCadTextLayout(entity).bounds)
})

test('invalid box widths fall back to 240 Workspace units', () => {
  for (const textBoxWidth of [undefined, null, '120', 0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(getCadTextLayout({ ...makeText(), metadata: { textBoxWidth } }).boxWidth, 240)
  }
  assert.equal(getCadTextLayout(makeText()).boxWidth, 240)
})

test('narrow boxes terminate and do not split surrogate pairs', () => {
  const layout = getCadTextLayout({ ...makeText(), content: '😀x', metadata: { textBoxWidth: 1 } })
  assert.deepEqual(layout.lines, ['😀', 'x'])
  assert.ok(Object.values(layout.bounds).every(Number.isFinite))
})


test('resized box reflows while preserving anchor and additional metadata', () => {
  const original = { ...makeText(), content: 'abcdefghij', metadata: { textBoxWidth: 240, custom: { tag: 'keep' } } }
  const resized = { ...original, metadata: { ...original.metadata, textBoxWidth: 62 } }
  assert.deepEqual(getCadTextLayout(original).lines, ['abcdefghij'])
  assert.deepEqual(getCadTextLayout(resized).lines, ['abcde', 'fghij'])
  assert.deepEqual(resized.position, original.position)
  assert.deepEqual(resized.metadata.custom, original.metadata.custom)
  for (const [alignment, x] of [['left', 100], ['center', 69], ['right', 38]] as const) {
    const layout = getCadTextLayout({ ...resized, alignment })
    assert.equal(layout.boxX, x)
    assert.equal(layout.boxWidth, 62)
    assert.equal(layout.height, 45)
  }
})
