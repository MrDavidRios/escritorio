import { SignInScreen } from '@/features/auth/SignInScreen'
import { supabase } from '@/lib/supabase'

export default function SignInRoute() {
  return <SignInScreen signIn={(values) => supabase.auth.signInWithPassword(values)} />
}
