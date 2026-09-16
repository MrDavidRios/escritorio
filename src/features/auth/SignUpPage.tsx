import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { authSchema, type AuthFormValues } from './authSchema'

export function SignUpPage() {
  const { user } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({ resolver: zodResolver(authSchema) })

  if (user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: AuthFormValues) {
    setFormError(null)
    const { data, error } = await supabase.auth.signUp(values)
    if (error) {
      setFormError(error.message)
      return
    }
    // If email confirmation is required, there's no session yet.
    if (!data.session) {
      setConfirmationSent(true)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {confirmationSent ? (
            <p className="text-sm text-muted-foreground">
              Check your email to confirm your account, then sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Sign up'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
