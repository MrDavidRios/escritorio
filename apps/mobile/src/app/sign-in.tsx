import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { createGoogleSignIn } from '@/features/auth/googleSignIn'
import { SignInScreen } from '@/features/auth/SignInScreen'
import { supabase } from '@/lib/supabase'

const signInWithGoogle = createGoogleSignIn({
  auth: supabase.auth,
  openAuthSession: (url, redirectTo) => WebBrowser.openAuthSessionAsync(url, redirectTo),
  // escritorio://auth/callback in a dev or TestFlight build; must be in
  // Supabase's redirect allow list (escritorio://**).
  redirectTo: Linking.createURL('auth/callback'),
})

export default function SignInRoute() {
  return (
    <SignInScreen
      signIn={(values) => supabase.auth.signInWithPassword(values)}
      signInWithGoogle={signInWithGoogle}
    />
  )
}
