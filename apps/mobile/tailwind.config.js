const { nativewindColors, themePlugin } = require('@escritorio/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: nativewindColors,
    },
  },
  // Theme colors come from packages/theme, shared with web. Dark mode
  // follows the system setting.
  plugins: [themePlugin({ dark: 'media' })],
}
