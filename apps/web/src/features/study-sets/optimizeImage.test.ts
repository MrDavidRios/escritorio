import { describe, expect, it } from 'vitest'
import { fitWithin, isSmallerWebp, shouldOptimize } from './optimizeImage'

describe('fitWithin', () => {
  it('scales a landscape image so the width hits the max', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales a portrait image so the height hits the max', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('never upscales an image already within the max', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})

describe('shouldOptimize', () => {
  it('optimizes raster formats', () => {
    expect(shouldOptimize(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(shouldOptimize(new File(['x'], 'a.png', { type: 'image/png' }))).toBe(true)
  })

  it('passes GIF and SVG through untouched', () => {
    expect(shouldOptimize(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe(false)
    expect(shouldOptimize(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toBe(false)
  })

  it('ignores non-images', () => {
    expect(shouldOptimize(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe(false)
  })
})

describe('isSmallerWebp', () => {
  const original = new File(['x'.repeat(100)], 'a.png', { type: 'image/png' })

  it('accepts a smaller WebP', () => {
    expect(isSmallerWebp(original, new Blob(['x'.repeat(50)], { type: 'image/webp' }))).toBe(true)
  })

  it('rejects a larger result', () => {
    expect(isSmallerWebp(original, new Blob(['x'.repeat(150)], { type: 'image/webp' }))).toBe(false)
  })

  it('rejects a non-WebP fallback encoding', () => {
    expect(isSmallerWebp(original, new Blob(['x'.repeat(50)], { type: 'image/png' }))).toBe(false)
  })

  it('rejects a failed encode', () => {
    expect(isSmallerWebp(original, null)).toBe(false)
  })
})
