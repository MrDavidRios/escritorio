import { Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fetchEnglishDefinition, fetchSpanishDefinition } from './dictionaryApi'

type Language = 'es' | 'en'

export function DefinitionLookupButton({
  spanishTerm,
  draft,
  onResult,
  preventNextBlurCommit,
  commitAndExit,
}: {
  spanishTerm: string
  draft: string
  onResult: (definition: string) => void
  preventNextBlurCommit: () => void
  commitAndExit: (value?: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [results, setResults] = useState<Record<Language, string | null> | null>(null)
  const [language, setLanguage] = useState<Language>('es')

  async function handleClick() {
    const term = spanishTerm.trim()
    if (!term) return

    setStatus('loading')
    const [es, en] = await Promise.all([fetchSpanishDefinition(term), fetchEnglishDefinition(term)])
    setStatus('idle')

    if (!es && !en) {
      setStatus('error')
      setTimeout(() => setStatus((s) => (s === 'error' ? 'idle' : s)), 3000)
      return
    }

    setLanguage(es ? 'es' : 'en')
    if (draft.trim()) {
      preventNextBlurCommit()
      setResults({ es, en })
    } else {
      onResult(es ?? en ?? '')
    }
  }

  const term = spanishTerm.trim()
  const selectedDefinition = results?.[language] ?? null

  return (
    <div className="relative shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Look up definition"
            disabled={!term || status === 'loading'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleClick()}
          >
            {status === 'loading' ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Insert definition from web</TooltipContent>
      </Tooltip>
      {status === 'error' && (
        <span className="text-destructive absolute top-full right-0 mt-1 text-xs whitespace-nowrap">
          No definition found
        </span>
      )}
      <AlertDialog
        open={results !== null}
        onOpenChange={(open) => {
          if (!open) setResults(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing definition?</AlertDialogTitle>
            <AlertDialogDescription>
              A definition was found for &quot;{term}&quot;. Replacing will overwrite what
              you&apos;ve typed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {results && (
            <div className="flex flex-col gap-3">
              <div className="inline-flex self-start rounded-md border p-0.5">
                {(['es', 'en'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    disabled={!results[lang]}
                    onClick={() => setLanguage(lang)}
                    className={cn(
                      'rounded-sm px-2.5 py-1 text-sm font-medium transition-colors',
                      language === lang
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      !results[lang] && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {lang === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <span className="text-muted-foreground font-medium">Current</span>
                <span className="text-muted-foreground line-through">{draft}</span>
                <span className="font-medium">New</span>
                <span>{selectedDefinition}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedDefinition) commitAndExit(selectedDefinition)
                setResults(null)
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
