import { createQueryClient } from './queryClient'

test('cached data never expires and queries run offline-first', () => {
  const queries = createQueryClient().getDefaultOptions().queries
  expect(queries).toMatchObject({
    networkMode: 'offlineFirst',
    gcTime: Infinity,
    staleTime: Infinity,
  })
})
