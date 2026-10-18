import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { WEB_SIGN_UP_URL } from '@/config'
import { SignInScreen } from './SignInScreen'

type Result = { error: { message: string } | null }

async function setup(result: Result = { error: null }, googleResult: Result = { error: null }) {
  const signIn = jest.fn().mockResolvedValue(result)
  const signInWithGoogle = jest.fn().mockResolvedValue(googleResult)
  await render(<SignInScreen signIn={signIn} signInWithGoogle={signInWithGoogle} />)
  return { signIn, signInWithGoogle }
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email)
  await fireEvent.changeText(screen.getByLabelText('Password'), password)
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
}

test('signs in with the entered email and password', async () => {
  const { signIn } = await setup()
  await fill('learner@example.com', 'secret123')
  expect(signIn).toHaveBeenCalledWith({ email: 'learner@example.com', password: 'secret123' })
})

test('shows validation errors from the shared auth schema without calling Supabase', async () => {
  const { signIn } = await setup()
  await fill('not-an-email', '123')
  expect(await screen.findByText('Enter a valid email address')).toBeOnTheScreen()
  expect(screen.getByText('Password must be at least 6 characters')).toBeOnTheScreen()
  expect(signIn).not.toHaveBeenCalled()
})

test('shows the Supabase error when sign-in fails', async () => {
  await setup({ error: { message: 'Invalid login credentials' } })
  await fill('learner@example.com', 'wrongpass')
  expect(await screen.findByText('Invalid login credentials')).toBeOnTheScreen()
})

test('"Sign up" opens the web app', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  await setup()
  await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }))
  expect(open).toHaveBeenCalledWith(WEB_SIGN_UP_URL)
})

test('"Continue with Google" starts Google sign-in', async () => {
  const { signIn, signInWithGoogle } = await setup()
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  expect(signIn).not.toHaveBeenCalled()
})

test('shows the error when Google sign-in fails, and lets you retry', async () => {
  await setup({ error: null }, { error: { message: 'Provider is not enabled' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(await screen.findByText('Provider is not enabled')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
})
