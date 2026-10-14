import type { DateKey, Phrase } from '@/types/phrase'
import { shortDate } from './dates'

function dueTag(phrase: Phrase, today: DateKey): string {
  if (phrase.due_on === null) return 'new'
  if (phrase.due_on <= today) return 'due'
  return `next: ${shortDate(phrase.due_on)}`
}

export function PhraseList({
  phrases,
  imageUrls,
  today,
  onEdit,
}: {
  phrases: Phrase[]
  imageUrls: Record<string, string>
  today: DateKey
  onEdit: (phrase: Phrase) => void
}) {
  if (phrases.length === 0) {
    return (
      <p className="text-muted-foreground">
        No phrases yet. Add your own, or add the idiom of the day from the dashboard.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {phrases.map((phrase) => {
        const imageUrl = phrase.image_path ? imageUrls[phrase.image_path] : undefined
        return (
          <li key={phrase.id}>
            <button
              type="button"
              onClick={() => onEdit(phrase)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 p-3 text-left"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
              ) : (
                <div className="bg-muted size-10 shrink-0 rounded" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p lang="es" className="truncate font-medium">
                  {phrase.spanish}
                </p>
                <p className="text-muted-foreground truncate text-sm">{phrase.english}</p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {dueTag(phrase, today)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
