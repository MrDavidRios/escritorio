import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { createGoogleSignIn } from '@/features/auth/googleSignIn'
import { SignInScreen } from '@/features/auth/SignInScreen'
import { supabase } from '@/lib/supabase'

// The auth sheet returns the redirect to us by matching its scheme alone, so
// it never has to reach Metro. Not Linking.createURL: in Expo Go that's
// exp://<LAN IP>:8081/..., and Supabase rejects redirects to raw IP hosts
// (falling back to the Site URL, i.e. the web app). Both must be in
// Supabase's redirect allow list (exp://**, escritorio://**).
const scheme =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? 'exp' : 'escritorio'
const redirectTo = `${scheme}://auth/callback`

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
