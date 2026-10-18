import type { Api } from '@escritorio/core'
import type { KeyValueStorage } from './outbox'

export type ManifestEntry = { updatedAt: string; file: string }
export type Manifest = Record<string, ManifestEntry>

/** The images folder, behind an interface so the store is testable without native code. */
export type ImageFiles = {
  download(url: string, name: string): Promise<void>
  remove(name: string): void
  list(): string[]
  uriFor(name: string): string
  removeAll(): void
}

export type ImageStore = {
  load(): Promise<void>
  sync(wanted: Iterable<string>, ownerId: string | null): Promise<void>
  uriFor(path: string | null): string | null
  subscribe(listener: () => void): () => void
  clear(): Promise<void>
}

const MANIFEST_KEY = 'escritorio-image-manifest'

/** What to fetch (missing locally, or a different version remotely) and what to delete. */
export function planImageSync(
  wanted: Iterable<string>,
  remote: Record<string, string>,
  manifest: Manifest,
): { download: string[]; remove: string[] } {
  const want = new Set(wanted)
  return {
    download: [...want].filter(
      (path) => remote[path] && manifest[path]?.updatedAt !== remote[path],
    ),
    remove: Object.keys(manifest).filter((path) => !want.has(path)),
  }
}

/** One name per version: a replaced image gets a new URI, so no image cache can show the old one. */
export function fileNameFor(path: string, updatedAt: string): string {
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  const hasExtension = dot > slash
  const base = (hasExtension ? path.slice(0, dot) : path).replace(/[^A-Za-z0-9_-]/g, '_')
  return `${base}-${Date.parse(updatedAt)}${hasExtension ? path.slice(dot) : ''}`
}

async function forEachLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++])
  })
  await Promise.all(workers)
}

/**
 * The on-device mirror of every image the user's sets use. Screens read
 * local file:// URIs from it and never fetch images over the network.
 */
export function createImageStore({
  files,
  api,
  storage,
  concurrency = 4,
  onError = (error) => console.warn('Image sync:', error),
}: {
  files: ImageFiles
  api: Pick<Api['cardImages'], 'listImageVersions' | 'getSignedImageUrls'>
  storage: KeyValueStorage
  concurrency?: number
  onError?: (error: unknown) => void
}): ImageStore {
  let manifest: Manifest = {}
  const listeners = new Set<() => void>()

  function set(next: Manifest) {
    manifest = next
    listeners.forEach((listener) => listener())
  }

  function removeFile(name: string) {
    try {
      files.remove(name)
    } catch (error) {
      onError(error)
    }
  }

  async function save() {
    try {
      await storage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
    } catch (error) {
      onError(error)
    }
  }

  return {
    async load() {
      try {
        const raw = await storage.getItem(MANIFEST_KEY)
        if (raw) set(JSON.parse(raw) as Manifest)
      } catch (error) {
        onError(error)
      }
    },

    async sync(wanted, ownerId) {
      const remote = ownerId ? await api.listImageVersions(ownerId) : {}
      const { download, remove } = planImageSync(wanted, remote, manifest)

      if (remove.length > 0) {
        const next = { ...manifest }
        for (const path of remove) {
          removeFile(next[path].file)
          delete next[path]
        }
        set(next)
      }

      if (download.length > 0) {
        const urls = await api.getSignedImageUrls(download)
        await forEachLimit(download, concurrency, async (path) => {
          const url = urls[path]
          if (!url) return
          const name = fileNameFor(path, remote[path])
          try {
            await files.download(url, name)
          } catch (error) {
            // Placeholder for now; the next sync tries again.
            onError(error)
            return
          }
          const previous = manifest[path]
          set({ ...manifest, [path]: { updatedAt: remote[path], file: name } })
          if (previous && previous.file !== name) removeFile(previous.file)
        })
      }

      // Anything the manifest doesn't name (an interrupted download) goes.
      const keep = new Set(Object.values(manifest).map((entry) => entry.file))
      for (const name of files.list()) if (!keep.has(name)) removeFile(name)

      await save()
    },

    uriFor(path) {
      const entry = path ? manifest[path] : undefined
      return entry ? files.uriFor(entry.file) : null
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async clear() {
      try {
        files.removeAll()
      } catch (error) {
        onError(error)
      }
      set({})
      await storage.removeItem(MANIFEST_KEY)
    },
  }
}
