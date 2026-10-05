import { describe, expect, it } from 'vitest'
import { isAcceptedImage, isHeic } from './imageFormats'

describe('isHeic', () => {
  it('detects HEIC/HEIF MIME types', () => {
    expect(isHeic({ type: 'image/heic' })).toBe(true)
    expect(isHeic({ type: 'image/heif' })).toBe(true)
    expect(isHeic({ type: 'image/heic-sequence' })).toBe(true)
    expect(isHeic({ type: 'IMAGE/HEIC' })).toBe(true)
  })

  it('falls back to the extension when the type is empty', () => {
    expect(isHeic({ type: '', name: 'IMG_0001.HEIC' })).toBe(true)
    expect(isHeic({ type: '', name: 'photo.heif' })).toBe(true)
  })

  it('does not flag other images or a mismatched extension', () => {
    expect(isHeic({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false)
    expect(isHeic({ type: 'image/jpeg', name: 'photo.heic' })).toBe(false)
    expect(isHeic({ type: '', name: 'photo.png' })).toBe(false)
  })
})

describe('isAcceptedImage', () => {
  it('accepts common images', () => {
    expect(isAcceptedImage({ type: 'image/jpeg' })).toBe(true)
    expect(isAcceptedImage({ type: 'image/png' })).toBe(true)
    expect(isAcceptedImage({ type: 'image/gif' })).toBe(true)
  })

  it('rejects HEIC and non-images', () => {
    expect(isAcceptedImage({ type: 'image/heic' })).toBe(false)
    expect(isAcceptedImage({ type: '', name: 'a.heic' })).toBe(false)
    expect(isAcceptedImage({ type: 'application/pdf' })).toBe(false)
  })
})
