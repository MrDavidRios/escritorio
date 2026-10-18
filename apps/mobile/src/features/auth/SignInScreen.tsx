import { authSchema, type AuthFormValues } from '@escritorio/core'
import { useState } from 'react'
import { KeyboardAvoidingView, Linking, Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { WEB_SIGN_UP_URL } from '@/config'

type SignIn = (values: AuthFormValues) => Promise<{ error: { message: string } | null }>
type FieldErrors = Partial<Record<keyof AuthFormValues, string>>

export function SignInScreen({ signIn }: { signIn: SignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center gap-4 px-6">
        <Text className="text-3xl font-bold text-foreground">Escritorio</Text>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            className="rounded-lg border border-border px-3 py-3 text-base text-foreground"
          />
          {fieldErrors.email && (
            <Text className="text-sm text-destructive">{fieldErrors.email}</Text>
          )}
        </View>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={password}
            onChangeText={setPassword}
            className="rounded-lg border border-border px-3 py-3 text-base text-foreground"
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

        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(WEB_SIGN_UP_URL)}>
          <Text className="text-center text-sm text-muted-foreground underline">
            Create an account
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  )
}
