import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatusValue = 'idle' | 'saving' | 'saved' | 'error'

export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatusValue>('idle')
  const retryRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => clearPendingTimeout, [clearPendingTimeout])

  const setSaving = useCallback(() => {
    clearPendingTimeout()
    setStatus('saving')
  }, [clearPendingTimeout])

  const setSaved = useCallback(() => {
    clearPendingTimeout()
    setStatus('saved')
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      setStatus('idle')
    }, 2000)
  }, [clearPendingTimeout])

  const setError = useCallback(
    (retry: () => void) => {
      clearPendingTimeout()
      retryRef.current = retry
      setStatus('error')
    },
    [clearPendingTimeout],
  )

  const retry = useCallback(() => {
    retryRef.current?.()
  }, [])

  return { status, setSaving, setSaved, setError, retry }
}
