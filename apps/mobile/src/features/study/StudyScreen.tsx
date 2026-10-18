import {
  buildQuestion,
  configFromFields,
  eligibleCards,
  noEligibleCardsMessage,
  type Card,
  type Question,
  type StudyConfig,
  type StudySet,
  type StudySettings,
} from '@escritorio/core'
import { Image } from 'expo-image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SymbolView } from 'expo-symbols'
import { KeyboardAvoidingView, PlatformColor, Pressable, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useCards, useSignedImageUrl, useStudySet } from '@/features/sets/hooks'
import { useStudySettings } from '@/features/sets/studySettings'
import { newId } from '@/lib/ids'
import type { StudyWriter } from './createStudyWriter'
import { QuizCard, type AnswerResult } from './QuizCard'

type Run = { sessionId: string | null; config: StudyConfig; questions: Question[] }

const now = () => new Date().toISOString()

function imagePathFor(question: Question | undefined): string | null {
  return question?.showImage ? question.card.image_path : null
}

/** Fills as cards are answered; VoiceOver reads it as "Card i of n". */
function ProgressBar({
  answered,
  current,
  total,
}: {
  answered: number
  current: number
  total: number
}) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progress"
      accessibilityValue={{
        min: 0,
        max: total,
        now: answered,
        text: `Card ${current} of ${total}`,
      }}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <View
        className="h-full rounded-full bg-accent"
        style={{ width: `${(answered / total) * 100}%` }}
      />
    </View>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 items-center justify-center gap-4 px-6">{children}</View>
}

export function StudyScreen({
  id,
  writer,
  onClose,
}: {
  id: string
  writer: StudyWriter
  onClose: () => void
}) {
  const { data: studySet, isError: setFailed } = useStudySet(id)
  const { data: cards, isError: cardsFailed } = useCards(id)
  const { settings } = useStudySettings(id)
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(0)
  const startedRef = useRef(false)

  function start(set: StudySet, deckCards: Card[], chosen: StudySettings) {
    const config = configFromFields(chosen)
    // Built once per run: rebuilding on a refetch would restart the deck
    // and re-roll 'random' directions mid-session.
    const questions = eligibleCards(deckCards, config).map((card) => buildQuestion(card, config))
    let sessionId: string | null = null
    if (questions.length > 0) {
      sessionId = newId()
      writer.startSession({
        id: sessionId,
        started_at: now(),
        study_set_id: set.id,
        mode: config.mode,
        direction: config.mode === 'conversion' ? config.direction : null,
        visibility: config.mode === 'meaning' ? config.visibility : null,
        deck_size: questions.length,
      })
    }
    setRun({ sessionId, config, questions })
    setIndex(0)
    setCorrect(0)
    setAnswered(0)
  }

  useEffect(() => {
    if (startedRef.current || !studySet || !cards || !settings) return
    startedRef.current = true
    start(studySet, cards, settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the set, cards and settings first load
  }, [studySet, cards, settings])

  const question = run?.questions[index]
  const { data: imageUrl } = useSignedImageUrl(imagePathFor(question))
  const { data: nextImageUrl } = useSignedImageUrl(imagePathFor(run?.questions[index + 1]))
  useEffect(() => {
    if (nextImageUrl) Image.prefetch(nextImageUrl).catch(() => {})
  }, [nextImageUrl])

  function handleAnswered(result: AnswerResult) {
    if (!run || !question) return
    writer.recordAttempt({
      id: newId(),
      answered_at: now(),
      card_id: question.card.id,
      is_correct: result.isCorrect,
      attempt_count: result.attemptCount,
      session_id: run.sessionId,
      resolved_direction: question.resolvedDirection,
    })
    setAnswered((n) => n + 1)
    if (result.isCorrect) setCorrect((c) => c + 1)
  }

  function handleNext() {
    if (!run) return
    const nextIndex = index + 1
    if (nextIndex >= run.questions.length && run.sessionId) {
      writer.completeSession(run.sessionId, { completed_at: now(), cards_correct: correct })
    }
    setIndex(nextIndex)
  }

  const total = run?.questions.length ?? 0
  const finished = run != null && total > 0 && index >= total

  let body: ReactNode
  // Only before the run starts: a failed background refetch keeps the cached
  // data, so a quiz in progress carries on.
  if (!run && (setFailed || cardsFailed)) {
    body = (
      <Centered>
        <Text className="text-center text-muted-foreground">
          Couldn't load this set. Check your connection.
        </Text>
      </Centered>
    )
  } else if (!run) {
    body = (
      <Centered>
        <Text className="text-muted-foreground">Loading…</Text>
      </Centered>
    )
  } else if (total === 0) {
    body = (
      <Centered>
        <Text className="text-center text-foreground">{noEligibleCardsMessage(run.config)}</Text>
        <Text className="text-center text-muted-foreground">
          You can change the study mode on the set's page.
        </Text>
      </Centered>
    )
  } else if (finished) {
    body = (
      <Centered>
        <Text className="text-2xl font-semibold text-foreground">Nice work!</Text>
        <Text className="text-center text-muted-foreground">
          {`You got ${correct} of ${total} right in "${studySet?.title ?? ''}".`}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => studySet && cards && settings && start(studySet, cards, settings)}
          className="w-full items-center rounded-lg border border-border bg-background py-3"
        >
          <Text className="text-base font-semibold text-foreground">Study again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="w-full items-center rounded-lg bg-primary py-3"
        >
          <Text className="text-base font-semibold text-primary-foreground">Done</Text>
        </Pressable>
      </Centered>
    )
  } else if (question) {
    body = (
      <QuizCard
        key={`${run.sessionId}:${question.card.id}`}
        question={question}
        imageUrl={imageUrl}
        onAnswered={handleAnswered}
        onNext={handleNext}
      />
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        {/* Equal-width sides keep the progress bar centred on the screen. */}
        <View className="h-11 flex-row items-center px-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center"
          >
            <SymbolView
              name="chevron.left"
              size={22}
              weight="semibold"
              tintColor={PlatformColor('secondaryLabel')}
            />
          </Pressable>
          <View className="mx-4 flex-1 items-center">
            {total > 0 && !finished ? (
              <ProgressBar answered={answered} current={index + 1} total={total} />
            ) : null}
          </View>
          <View className="w-11" />
        </View>
        {body}
      </KeyboardAvoidingView>
    </Screen>
  )
}
