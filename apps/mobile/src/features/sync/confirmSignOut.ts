type AlertButton = { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }

/** Explicit sign-out clears the phone's copy of the user's data, after a warning if results are still queued. */
export function createConfirmSignOut({
  pendingCount,
  signOut,
  wipe,
  alert,
}: {
  pendingCount: () => number
  signOut: () => Promise<void>
  wipe: () => Promise<number>
  alert: (title: string, message: string, buttons: AlertButton[]) => void
}) {
  async function signOutAndWipe() {
    await signOut()
    await wipe()
  }

  return function confirmSignOut() {
    const pending = pendingCount()
    if (pending === 0) {
      void signOutAndWipe()
      return
    }
    alert(
      'Sign out?',
      `${pending} study result${pending === 1 ? '' : 's'} haven't synced yet. Signing out deletes them from this phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOutAndWipe() },
      ],
    )
  }
}
