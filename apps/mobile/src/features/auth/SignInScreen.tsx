import { authSchema, type AuthFormValues } from '@escritorio/core'
import { Image } from 'expo-image'
import { useState } from 'react'
import { KeyboardAvoidingView, Linking, Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { WEB_SIGN_UP_URL } from '@/config'

type AuthResult = Promise<{ error: { message: string } | null }>
type SignIn = (values: AuthFormValues) => AuthResult
type FieldErrors = Partial<Record<keyof AuthFormValues, string>>

const logo = require('../../../assets/logo.png')

// Font size only: a line height on an iOS TextInput makes the caret taller
// than the text and pushes the text to the bottom.
const inputClassName =
  'rounded-lg border border-border bg-background px-3 py-3 text-[16px] text-foreground'

export function SignInScreen({
  signIn,
  signInWithGoogle,
}: {
  signIn: SignIn
  signInWithGoogle: () => AuthResult
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function submit() {
    const parsed = authSchema.safeParse({ email: email.trim(), password })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AuthFormValues
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)
    const { error } = await signIn(parsed.data)
    setSubmitting(false)
    if (error) setFormError(error.message)
  }

  async function continueWithGoogle() {
    setFormError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) setFormError(error.message)
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center gap-6 px-4">
        <View className="flex-row items-center justify-center gap-3">
          <Image source={logo} accessibilityIgnoresInvertColors style={{ width: 48, height: 48 }} />
          <Text className="text-3xl font-semibold text-foreground">Escritorio</Text>
        </View>

        <View className="gap-4 rounded-xl border border-border bg-card p-4">
          <Text className="text-lg font-semibold text-foreground">Sign in</Text>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Email</Text>
            <TextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              className={inputClassName}
            />
            {fieldErrors.email && (
              <Text className="text-sm text-destructive">{fieldErrors.email}</Text>
            )}
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Password</Text>
            <TextInput
              accessibilityLabel="Password"
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              value={password}
              onChangeText={setPassword}
              className={inputClassName}
            />
            {fieldErrors.password && (
              <Text className="text-sm text-destructive">{fieldErrors.password}</Text>
            )}
          </View>

          {formError && <Text className="text-sm text-destructive">{formError}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={submit}
            className="items-center rounded-lg bg-primary py-3 disabled:opacity-50"
          >
            <Text className="text-base font-semibold text-primary-foreground">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            <View className="h-px flex-1 bg-border" />
            <Text className="text-xs text-muted-foreground">or</Text>
            <View className="h-px flex-1 bg-border" />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={googleLoading}
            onPress={continueWithGoogle}
            className="items-center rounded-lg border border-border bg-background py-3 disabled:opacity-50"
          >
            <Text className="text-base font-semibold text-foreground">
              {googleLoading ? 'Opening Google…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View className="flex-row justify-center">
            <Text className="text-sm text-muted-foreground">Don't have an account? </Text>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(WEB_SIGN_UP_URL)}>
              <Text className="text-sm text-foreground underline">Sign up</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
