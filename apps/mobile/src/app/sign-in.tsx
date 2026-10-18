import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { createGoogleSignIn } from '@/features/auth/googleSignIn'
import { SignInScreen } from '@/features/auth/SignInScreen'
import { supabase } from '@/lib/supabase'

// escritorio://auth/callback in a dev or TestFlight build, exp://<host>/--/auth/callback
// in Expo Go. Must match Supabase's redirect allow list, or Supabase falls back
// to the Site URL (the web app).
const redirectTo = Linking.createURL('auth/callback')
if (__DEV__) console.log(`[auth] Google sign-in redirect: ${redirectTo}`)

const signInWithGoogle = createGoogleSignIn({
  auth: supabase.auth,
  openAuthSession: (url, redirect) => WebBrowser.openAuthSessionAsync(url, redirect),
  redirectTo,
})

export default function SignInRoute() {
  return (
    <SignInScreen
      signIn={(values) => supabase.auth.signInWithPassword(values)}
      signInWithGoogle={signInWithGoogle}
    />
  )
}
