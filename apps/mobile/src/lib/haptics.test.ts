import * as Haptics from 'expo-haptics'
import { feedbackHaptic } from './haptics'

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

test.each([
  ['correct', 'success'],
  ['retry', 'warning'],
  ['revealed', 'error'],
] as const)('%s plays the %s notification', (feedback, type) => {
  feedbackHaptic(feedback)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(type)
})

test('a haptics failure never reaches the quiz', async () => {
  jest.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error('no haptic engine'))
  expect(() => feedbackHaptic('correct')).not.toThrow()
  // Let the rejection settle; an unhandled rejection would fail the test run.
  await Promise.resolve()
})
