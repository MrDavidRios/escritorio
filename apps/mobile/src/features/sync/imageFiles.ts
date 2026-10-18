import { Directory, File, Paths } from 'expo-file-system'
import type { ImageFiles } from './imageStore'

// documentDirectory, not the cache directory: iOS may empty the cache when
// the phone needs space, and these files are what offline study shows.
const folder = new Directory(Paths.document, 'images')

export const imageFiles: ImageFiles = {
  async download(url, name) {
    folder.create({ intermediates: true, idempotent: true })
    await File.downloadFileAsync(url, new File(folder, name), { idempotent: true })
  },
  remove(name) {
    const file = new File(folder, name)
    if (file.exists) file.delete()
  },
  list() {
    return folder.exists ? folder.list().map((entry) => entry.name) : []
  },
  uriFor(name) {
    return new File(folder, name).uri
  },
  removeAll() {
    if (folder.exists) folder.delete()
  },
}
