import { supabase } from '@/lib/supabase'
import type { Idiom } from '@/types/idiom'
import type { Phrase, PhraseInput } from '@/types/phrase'

const UNIQUE_VIOLATION = '23505'

// PostgREST may return numeric columns as strings; ease is numeric(4,2).
function toPhrase(row: Phrase): Phrase {
  return { ...row, ease: Number(row.ease) }
}

export async function listPhrases(): Promise<Phrase[]> {
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data.map(toPhrase)
}

export async function createPhrase(id: string, input: PhraseInput): Promise<Phrase> {
  const { data, error } = await supabase
    .from('phrases')
    .insert({ id, ...input })
    .select('*')
    .single()
  if (error) throw error
  return toPhrase(data)
}

export async function updatePhrase(id: string, input: Partial<PhraseInput>): Promise<Phrase> {
  const { data, error } = await supabase
    .from('phrases')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return toPhrase(data)
}

export async function deletePhrase(id: string): Promise<void> {
  const { error } = await supabase.from('phrases').delete().eq('id', id)
  if (error) throw error
}

/** Copies an idiom into the collection. Adding one that's already there is a no-op. */
export async function addIdiomAsPhrase(idiom: Idiom): Promise<void> {
  const { error } = await supabase.from('phrases').insert({
    spanish: idiom.spanish,
    english: idiom.english,
    example: idiom.example,
    idiom_id: idiom.id,
  })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}
