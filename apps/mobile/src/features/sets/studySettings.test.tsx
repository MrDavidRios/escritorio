import { studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import { makeStudySet } from '@/test/fixtures'
import { useStudySettings } from './studySettings'

jest.mock('@/lib/api', () => ({
  api: { studySets: { getStudySet: jest.fn(), updateStudySet: jest.fn() } },
}))

// makeStudySet's own fields: conversion, es_en, image.
const fromSet = {
  study_mode: 'conversion',
  conversion_direction: 'es_en',
  meaning_visibility: 'image',
}
const stored = { study_mode: 'meaning', conversion_direction: 'en_es', meaning_visibility: 'both' }

async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useStudySettings('s1'), { wrapper })
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(makeStudySet())
})

test("falls back to the set's own fields when nothing is stored", async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test('a stored choice wins over the set', async () => {
  await AsyncStorage.setItem(studySettingsKey('s1'), JSON.stringify(stored))
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(stored))
})

test("a corrupt stored value falls back to the set's fields", async () => {
  await AsyncStorage.setItem(studySettingsKey('s1'), '{oops')
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test("a storage read that throws falls back to the set's fields", async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'))
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test('a change shows right away and is stored on the device, not in Supabase', async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toBeDefined())

  await act(async () => result.current.update({ conversion_direction: 'random' }))

  const expected = { ...fromSet, conversion_direction: 'random' }
  // Query cache updates reach subscribers on the next tick.
  await waitFor(() => expect(result.current.settings).toEqual(expected))
  expect(JSON.parse((await AsyncStorage.getItem(studySettingsKey('s1')))!)).toEqual(expected)
  expect(api.studySets.updateStudySet).not.toHaveBeenCalled()
})
