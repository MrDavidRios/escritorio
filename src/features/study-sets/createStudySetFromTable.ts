import { createCards } from '@/api/cards'
import { createStudySet, deleteStudySet } from '@/api/studySets'
import type { StudySet } from '@/types/studySet'
import type { ParsedCardRow } from './parseCardTable'

export interface TableStudySetInput {
  title: string
  description: string | null
  cards: ParsedCardRow[]
}

export async function createStudySetFromTable(
  ownerId: string,
  { title, description, cards }: TableStudySetInput,
): Promise<StudySet> {
  if (cards.length === 0) throw new Error('A table needs at least one card')

  const studySet = await createStudySet(ownerId, { title, description })
  try {
    await createCards(
      studySet.id,
      cards.map((card, position) => ({ ...card, image_path: null, hint: null, position })),
    )
  } catch (err) {
    // Remove the set so a failed import doesn't leave an empty one behind.
    await deleteStudySet(studySet.id).catch(() => {})
    throw err
  }
  return studySet
}
