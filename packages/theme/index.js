const tokens = require('./tokens')

const colorNames = Object.keys(tokens.light)

/** '#fb8b24' → '251 139 36', the form `rgb(var(--x) / <alpha>)` needs. */
function channels(hex) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

function cssVariables(mode) {
  return Object.fromEntries(
    Object.entries(tokens[mode]).map(([name, hex]) => [`--${name}`, channels(hex)]),
  )
}

/**
 * A Tailwind plugin (v3 and v4) that writes every theme color as a CSS
 * variable. `dark: 'class'` switches on a `.dark` ancestor (web);
 * `dark: 'media'` follows the system setting (mobile).
 */
function themePlugin({ dark }) {
  return {
    handler({ addBase }) {
      addBase({ ':root': cssVariables('light') })
      addBase(
        dark === 'class'
          ? { '.dark': cssVariables('dark') }
          : { '@media (prefers-color-scheme: dark)': { ':root': cssVariables('dark') } },
      )
    },
  }
}

/** Tailwind v3 / NativeWind color config, with opacity modifier support. */
const nativewindColors = Object.fromEntries(
  colorNames.map((name) => [name, `rgb(var(--${name}) / <alpha-value>)`]),
)

module.exports = { tokens, colorNames, themePlugin, nativewindColors }
