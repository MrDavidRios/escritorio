import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCards } from '@/api/cards'
import { createStudySet, deleteStudySet } from '@/api/studySets'
import { createStudySetFromTable } from './createStudySetFromTable'

vi.mock('@/api/cards', () => ({ createCards: vi.fn() }))
vi.mock('@/api/studySets', () => ({ createStudySet: vi.fn(), deleteStudySet: vi.fn() }))

const set = { id: 'set-1' } as Awaited<ReturnType<typeof createStudySet>>
const input = {
  title: 'T',
  description: null,
  cards: [
    { spanish_term: 'a', english_equivalent: 'x', definition: null },
    { spanish_term: 'b', english_equivalent: null, definition: 'y' },
  ],
}

describe('createStudySetFromTable', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createStudySet).mockResolvedValue(set)
    vi.mocked(deleteStudySet).mockResolvedValue(undefined)
  })

  it('creates the set, then its cards in order', async () => {
    await expect(createStudySetFromTable('owner', input)).resolves.toBe(set)
    expect(createStudySet).toHaveBeenCalledWith('owner', { title: 'T', description: null })
    expect(createCards).toHaveBeenCalledWith('set-1', [
      { image_path: null, hint: null, position: 0, ...input.cards[0] },
      { image_path: null, hint: null, position: 1, ...input.cards[1] },
    ])
  })

  it('removes the set and rethrows when the cards fail', async () => {
    const failure = new Error('insert failed')
    vi.mocked(createCards).mockRejectedValue(failure)
    await expect(createStudySetFromTable('owner', input)).rejects.toBe(failure)
    expect(deleteStudySet).toHaveBeenCalledWith('set-1')
  })

  it('still reports the original failure when clean-up also fails', async () => {
    const failure = new Error('insert failed')
    vi.mocked(createCards).mockRejectedValue(failure)
    vi.mocked(deleteStudySet).mockRejectedValue(new Error('delete failed'))
    await expect(createStudySetFromTable('owner', input)).rejects.toBe(failure)
  })

  it('refuses to create a set with no cards', async () => {
    await expect(createStudySetFromTable('owner', { ...input, cards: [] })).rejects.toThrow()
    expect(createStudySet).not.toHaveBeenCalled()
  })
})
