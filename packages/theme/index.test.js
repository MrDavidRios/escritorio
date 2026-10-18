const { describe, expect, test } = require('bun:test')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { colorNames, nativewindColors, themePlugin, tokens } = require('./index')

function baseFor(options) {
  const added = []
  themePlugin(options).handler({ addBase: (styles) => added.push(styles) })
  return Object.assign({}, ...added)
}

describe('tokens', () => {
  test('every color has a light and a dark value', () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort())
  })

  test('every value is a 6-digit hex color', () => {
    for (const value of [...Object.values(tokens.light), ...Object.values(tokens.dark)]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  test('the brand color is Princeton Orange in both modes', () => {
    expect(tokens.light.brand).toBe('#fb8b24')
    expect(tokens.dark.brand).toBe('#fb8b24')
  })
})

describe('themePlugin', () => {
  test('writes light values to :root as space-separated RGB channels', () => {
    const base = baseFor({ dark: 'class' })
    expect(base[':root']['--background']).toBe('255 255 255')
    expect(base[':root']['--brand']).toBe('251 139 36')
  })

  test('web switches dark mode with a .dark class', () => {
    expect(baseFor({ dark: 'class' })['.dark']['--background']).toBe('10 10 10')
  })

  test("mobile follows the system's dark mode setting", () => {
    const base = baseFor({ dark: 'media' })
    expect(base['@media (prefers-color-scheme: dark)'][':root']['--background']).toBe('10 10 10')
  })
})

test('NativeWind colors support opacity modifiers', () => {
  expect(nativewindColors.primary).toBe('rgb(var(--primary) / <alpha-value>)')
  expect(Object.keys(nativewindColors)).toEqual(colorNames)
})

test("web's index.css maps every color to a Tailwind utility", () => {
  const css = readFileSync(resolve(__dirname, '../../apps/web/src/index.css'), 'utf8')
  for (const name of colorNames) {
    expect(css).toContain(`--color-${name}: rgb(var(--${name}));`)
  }
})
