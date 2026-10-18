/**
 * The one list of theme colors for web and mobile. Neutral values came from
 * shadcn's neutral theme (web's original oklch values, converted to sRGB);
 * the brand colors are the Fiery palette. Colors are opaque so both apps can
 * apply opacity modifiers (`bg-primary/50`).
 */

const palette = {
  'crimson-violet': '#5f0f40',
  'deep-crimson': '#9a031e',
  'princeton-orange': '#fb8b24',
  'autumn-leaf': '#e36414',
  'dark-teal': '#0f4c5c',
}

const brand = {
  ...palette,
  brand: palette['princeton-orange'],
}

const light = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  card: '#ffffff',
  'card-foreground': '#0a0a0a',
  popover: '#ffffff',
  'popover-foreground': '#0a0a0a',
  primary: '#171717',
  'primary-foreground': '#fafafa',
  secondary: '#f5f5f5',
  'secondary-foreground': '#171717',
  muted: '#f5f5f5',
  'muted-foreground': '#737373',
  accent: '#f5f5f5',
  'accent-foreground': '#171717',
  destructive: '#e7000b',
  border: '#e5e5e5',
  input: '#e5e5e5',
  ring: '#a1a1a1',
  'chart-1': '#d4d4d4',
  'chart-2': '#737373',
  'chart-3': '#525252',
  'chart-4': '#404040',
  'chart-5': '#262626',
  sidebar: '#fafafa',
  'sidebar-foreground': '#0a0a0a',
  'sidebar-primary': '#171717',
  'sidebar-primary-foreground': '#fafafa',
  'sidebar-accent': '#f5f5f5',
  'sidebar-accent-foreground': '#171717',
  'sidebar-border': '#e5e5e5',
  'sidebar-ring': '#a1a1a1',
  ...brand,
}

const dark = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  card: '#171717',
  'card-foreground': '#fafafa',
  popover: '#171717',
  'popover-foreground': '#fafafa',
  primary: '#e5e5e5',
  'primary-foreground': '#171717',
  secondary: '#262626',
  'secondary-foreground': '#fafafa',
  muted: '#262626',
  'muted-foreground': '#a1a1a1',
  accent: '#262626',
  'accent-foreground': '#fafafa',
  destructive: '#ff6467',
  // Web used white at 10% (borders) and 15% (inputs); these are those
  // over the dark background, made opaque.
  border: '#262626',
  input: '#2f2f2f',
  ring: '#737373',
  'chart-1': '#d4d4d4',
  'chart-2': '#737373',
  'chart-3': '#525252',
  'chart-4': '#404040',
  'chart-5': '#262626',
  sidebar: '#171717',
  'sidebar-foreground': '#fafafa',
  'sidebar-primary': '#1447e6',
  'sidebar-primary-foreground': '#fafafa',
  'sidebar-accent': '#262626',
  'sidebar-accent-foreground': '#fafafa',
  'sidebar-border': '#262626',
  'sidebar-ring': '#737373',
  ...brand,
}

module.exports = { light, dark, palette }
