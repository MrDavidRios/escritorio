/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConfigContext, ExpoConfig } from 'expo/config'

// Expo only auto-loads .env files from apps/mobile, so read the repo-root
// .env.local here. Only the two public Supabase values are passed to the app
// (via `extra`); the root file's other secrets never reach the bundle.
function readRootEnv(): Record<string, string> {
  const path = resolve(__dirname, '../../.env.local')
  if (!existsSync(path)) return {}
  const env: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const fileEnv = readRootEnv()

// The shell environment wins (e.g. EAS builds); the VITE_ names let the app
// share the web app's values without duplicating them.
function envValue(name: string): string | undefined {
  return process.env[name] ?? fileEnv[name] ?? fileEnv[`VITE_${name}`]
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Escritorio',
  slug: config.slug ?? 'escritorio',
  extra: {
    ...config.extra,
    supabaseUrl: envValue('SUPABASE_URL'),
    supabaseAnonKey: envValue('SUPABASE_ANON_KEY'),
  },
})
