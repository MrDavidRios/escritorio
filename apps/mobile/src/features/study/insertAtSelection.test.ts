import { insertAtSelection } from './insertAtSelection'

test('inserts at the caret and moves the caret past the new letter', () => {
  expect(insertAtSelection('caa', { start: 2, end: 2 }, 'ñ')).toEqual({
    value: 'caña',
    selection: { start: 3, end: 3 },
  })
})

test('replaces a selected range', () => {
  expect(insertAtSelection('hola', { start: 1, end: 3 }, 'é')).toEqual({
    value: 'héa',
    selection: { start: 2, end: 2 },
  })
})

test('appends when the caret position is unknown', () => {
  expect(insertAtSelection('mama', null, 'á')).toEqual({
    value: 'mamaá',
    selection: { start: 5, end: 5 },
  })
})

test('clamps a stale selection that points past the end (e.g. after a retry cleared the field)', () => {
  expect(insertAtSelection('', { start: 4, end: 4 }, 'é')).toEqual({
    value: 'é',
    selection: { start: 1, end: 1 },
  })
})

test('handles a backwards selection', () => {
  expect(insertAtSelection('abc', { start: 3, end: 1 }, 'x')).toEqual({
    value: 'ax',
    selection: { start: 2, end: 2 },
  })
})
