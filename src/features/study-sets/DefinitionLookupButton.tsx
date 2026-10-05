import { ExternalLink, Loader2, Search } from 'lucide-react'
import { useRef, useState } from 'react'
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fetchEnglishDefinition, fetchSpanishDefinition, manualLookupLinks } from './dictionaryApi'

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
  const pendingReplacement = useRef<string | undefined>(undefined)

  async function handleClick() {
    const term = spanishTerm.trim()
    if (!term) return

    setStatus('loading')
    const [es, en] = await Promise.all([fetchSpanishDefinition(term), fetchEnglishDefinition(term)])
    setStatus('idle')

    if (!es && !en) {
      setStatus('error')
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
    <Popover
      open={status === 'error'}
      onOpenChange={(open) => {
        if (!open) setStatus('idle')
      }}
    >
      <PopoverAnchor className="shrink-0">
        <Tooltip>
          {/* Disabled buttons don't fire pointer events, so the tooltip hangs
            off a wrapper; preventDefault keeps the field from blurring. */}
          <TooltipTrigger asChild>
            <span className="inline-flex" onMouseDown={(e) => e.preventDefault()}>
              <Button
                type="button"
                variant="ghost"
                // icon-xs (24px) matches InlineText's line box, so revealing
                // this button on edit doesn't grow the row.
                size="icon-xs"
                aria-label={
                  term ? 'Look up definition' : 'Add a Spanish term to look up a definition'
                }
                disabled={!term || status === 'loading'}
                onClick={() => void handleClick()}
              >
                {status === 'loading' ? <Loader2 className="animate-spin" /> : <Search />}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {term ? 'Insert definition from web' : 'Add a Spanish term to look up a definition'}
          </TooltipContent>
        </Tooltip>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        role="status"
        // Keep focus in the definition field: moving it would blur-commit
        // and end editing, unmounting this popover with it.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <PopoverHeader>
          <PopoverTitle>No definition found for &quot;{term}&quot;</PopoverTitle>
          <PopoverDescription>
            {term.includes(' ')
              ? 'Lookups work best on single words. Try a dictionary directly:'
              : 'Try looking it up directly:'}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-wrap gap-1.5">
          {manualLookupLinks(term).map((link) => (
            <Button key={link.label} asChild variant="outline" size="xs">
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
                <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          ))}
        </div>
      </PopoverContent>
      <AlertDialog
        open={results !== null}
        onOpenChange={(open) => {
          if (open) return
          commitAndExit(pendingReplacement.current)
          pendingReplacement.current = undefined
          setResults(null)
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
                pendingReplacement.current = selectedDefinition ?? undefined
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Popover>
  )
}
