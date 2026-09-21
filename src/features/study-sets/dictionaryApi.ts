interface EnglishDictionaryResponse {
  entries?: {
    senses?: { definition?: string }[]
  }[]
}

/** Looks up a Spanish word via the free freedictionaryapi.com API, returning an English gloss. */
export async function fetchEnglishDefinition(word: string): Promise<string | null> {
  const trimmed = word.trim()
  if (!trimmed) return null

  let response: Response
  try {
    response = await fetch(
      `https://freedictionaryapi.com/api/v1/entries/es/${encodeURIComponent(trimmed)}`,
    )
  } catch {
    return null
  }

  if (!response.ok) return null

  let data: EnglishDictionaryResponse
  try {
    data = await response.json()
  } catch {
    return null
  }

  for (const entry of data.entries ?? []) {
    for (const sense of entry.senses ?? []) {
      const definition = sense.definition?.trim()
      if (definition) return definition
    }
  }
  return null
}

interface RaeResponse {
  data?: {
    meanings?: {
      senses?: { description?: string }[]
    }[]
  }
}

/** Looks up a Spanish word via the rae-api.com API, returning a Spanish-language definition. */
export async function fetchSpanishDefinition(word: string): Promise<string | null> {
  const trimmed = word.trim()
  if (!trimmed) return null

  let response: Response
  try {
    response = await fetch(`https://rae-api.com/api/words/${encodeURIComponent(trimmed)}`)
  } catch {
    return null
  }

  if (!response.ok) return null

  let data: RaeResponse
  try {
    data = await response.json()
  } catch {
    return null
  }

  for (const meaning of data.data?.meanings ?? []) {
    for (const sense of meaning.senses ?? []) {
      const description = sense.description?.trim()
      if (description) return description
    }
  }
  return null
}
