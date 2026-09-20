import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { authSchema, type AuthFormValues } from './authSchema'

export function SignInPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({ resolver: zodResolver(authSchema) })

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(values: AuthFormValues) {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) setFormError(error.message)
  }

  async function signInWithGoogle() {
    setFormError(null)
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setFormError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-3">
        <Logo className="size-12" />
        <span className="text-3xl font-semibold">Escritorio</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>
            {formError && <p className="text-destructive text-sm">{formError}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <div className="bg-border h-px flex-1" />
            or
            <div className="bg-border h-px flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={signInWithGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-foreground underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
