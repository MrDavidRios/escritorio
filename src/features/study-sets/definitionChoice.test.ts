import { describe, expect, it } from 'vitest'
import { describeDefinitionChoice } from './definitionChoice'

describe('describeDefinitionChoice', () => {
  it('asks to replace when the field already has text', () => {
    const copy = describeDefinitionChoice('typed', 'forzar')
    expect(copy.title).toBe('Replace existing definition?')
    expect(copy.showsCurrent).toBe(true)
    expect(copy.confirmLabel).toBe('Replace')
  })

  it('offers a choice, without a diff, when the field is empty', () => {
    const copy = describeDefinitionChoice('   ', 'forzar')
    expect(copy.title).toBe('Choose a definition')
    expect(copy.description).toContain('"forzar"')
    expect(copy.showsCurrent).toBe(false)
    expect(copy.confirmLabel).toBe('Insert')
  })
})
