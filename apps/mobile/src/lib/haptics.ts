import * as Haptics from 'expo-haptics'

export type AnswerFeedback = 'correct' | 'retry' | 'revealed'

const NOTIFICATION: Record<AnswerFeedback, Haptics.NotificationFeedbackType> = {
  correct: Haptics.NotificationFeedbackType.Success,
  retry: Haptics.NotificationFeedbackType.Warning,
  revealed: Haptics.NotificationFeedbackType.Error,
}

/** Fire-and-forget: a device without haptics must never break the quiz. */
export function feedbackHaptic(feedback: AnswerFeedback): void {
  Haptics.notificationAsync(NOTIFICATION[feedback]).catch(() => {})
}
