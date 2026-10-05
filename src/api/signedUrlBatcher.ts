type SignBatch = (paths: string[]) => Promise<Record<string, string>>

interface Waiter {
  resolve: (url: string | null) => void
  reject: (error: unknown) => void
}

/**
 * Turns many single-path sign requests made in the same tick into one
 * batched call, so per-image React Query entries don't mean one network
 * round trip per image. A path the batch has no URL for resolves to null.
 */
export function createSignedUrlBatcher(signBatch: SignBatch) {
  let waiters = new Map<string, Waiter[]>()
  let scheduled = false

  async function flush() {
    const batch = waiters
    waiters = new Map()
    scheduled = false

    try {
      const urls = await signBatch([...batch.keys()])
      for (const [path, list] of batch) {
        for (const waiter of list) waiter.resolve(urls[path] ?? null)
      }
    } catch (error) {
      for (const list of batch.values()) {
        for (const waiter of list) waiter.reject(error)
      }
    }
  }

  return function getSignedUrl(path: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const list = waiters.get(path) ?? []
      list.push({ resolve, reject })
      waiters.set(path, list)

      if (!scheduled) {
        scheduled = true
        setTimeout(flush, 0)
      }
    })
  }
}
