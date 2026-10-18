import { isAnswerCorrect, type Question } from '@escritorio/core'
import { Image } from 'expo-image'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { feedbackHaptic, type AnswerFeedback } from '@/lib/haptics'
import { AccentPad } from './AccentPad'
import { insertAtSelection, type Selection } from './insertAtSelection'

export const MAX_ATTEMPTS = 3

export type AnswerResult = { isCorrect: boolean; attemptCount: number }

/**
 * One quiz question. A wrong answer gets up to MAX_ATTEMPTS tries; a
 * correct answer or the last wrong one ends the card (onAnswered, once),
 * then Check becomes Next. The parent keys this per run and card, so all
 * state resets between cards.
 */
export function QuizCard({
  question,
  imageUrl,
  onAnswered,
  onNext,
}: {
  question: Question
  imageUrl: string | null | undefined
  onAnswered: (result: AnswerResult) => void
  onNext: () => void
}) {
  const { card } = question
  const [value, setValue] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  // Passed to the field only right after an accent insert, to move the
  // caret; cleared on the next selection change so typing stays native.
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined)
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const advancedRef = useRef(false)
  // Set as the card ends, before the re-render: a second submit in the same
  // frame must not count the answer again.
  const endedRef = useRef(false)
  const ended = feedback === 'correct' || feedback === 'revealed'

  function show(next: AnswerFeedback) {
    setFeedback(next)
    feedbackHaptic(next)
  }

  function submit() {
    if (endedRef.current) {
      // A double tap (or return + tap) in one frame must advance one card.
      if (advancedRef.current) return
      advancedRef.current = true
      onNext()
      return
    }
    if (value.trim() === '') return

    const attemptCount = attempts + 1
    if (isAnswerCorrect(value, question.expectedAnswer)) {
      endedRef.current = true
      show('correct')
      onAnswered({ isCorrect: true, attemptCount })
      return
    }

    setAttempts(attemptCount)
    if (attemptCount >= MAX_ATTEMPTS) {
      endedRef.current = true
      show('revealed')
      onAnswered({ isCorrect: false, attemptCount })
    } else {
      show('retry')
      setValue('')
      setSelection(null)
    }
  }

  function insert(char: string) {
    const next = insertAtSelection(value, selection, char)
    setValue(next.value)
    setSelection(next.selection)
    setForcedSelection(next.selection)
  }

  const attemptsLeft = MAX_ATTEMPTS - attempts

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        keyboardShouldPersistTaps="handled"
      >
        {question.showImage && card.image_path ? (
          <View className="h-64 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                accessibilityLabel="Card image"
              />
            ) : (
              <Text className="text-sm text-muted-foreground">Loading image…</Text>
            )}
          </View>
        ) : null}

        {question.showDefinition && card.definition ? (
          <View className="rounded-xl border border-border bg-muted p-5">
            <Text className="text-base leading-relaxed text-foreground">{card.definition}</Text>
          </View>
        ) : null}

        {!question.showImage && !question.showDefinition ? (
          <View className="min-h-32 items-center justify-center rounded-xl border border-border bg-muted p-6">
            <Text className="text-center text-2xl font-medium text-foreground">
              {question.prompt}
            </Text>
          </View>
        ) : null}

        {card.hint ? (
          hintShown ? (
            <Text className="text-sm text-muted-foreground">Hint: {card.hint}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setHintShown(true)}>
              <Text className="text-sm text-muted-foreground underline">Show hint</Text>
            </Pressable>
          )
        ) : null}

        {feedback === 'correct' ? (
          <Text className="text-base font-semibold text-foreground">Correct!</Text>
        ) : null}
        {feedback === 'retry' ? (
          <Text className="text-base font-semibold text-destructive">
            {`Not quite. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`}
          </Text>
        ) : null}
        {feedback === 'revealed' ? (
          <Text className="text-base font-semibold text-destructive">
            {`Not quite. The answer was: ${question.expectedAnswer}`}
          </Text>
        ) : null}
      </ScrollView>

      <View className="gap-3 border-t border-border p-4">
        {question.answerLanguage === 'es' ? <AccentPad disabled={ended} onInsert={insert} /> : null}
        <TextInput
          accessibilityLabel="Your answer"
          placeholder="Your answer"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="go"
          // Keep the keyboard up across attempts and cards.
          submitBehavior="submit"
          value={value}
          onChangeText={(text) => {
            if (!ended) setValue(text)
          }}
          onSelectionChange={(e) => {
            setSelection(e.nativeEvent.selection)
            setForcedSelection(undefined)
          }}
          selection={forcedSelection}
          onSubmitEditing={submit}
          // Font size only: a line height on an iOS TextInput makes the caret
          // taller than the text and pushes the text to the bottom.
          className="rounded-lg border border-border bg-background px-3 py-3 text-[18px] text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          className="items-center rounded-lg bg-primary py-3"
        >
          <Text className="text-base font-semibold text-primary-foreground">
            {ended ? 'Next' : 'Check'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
