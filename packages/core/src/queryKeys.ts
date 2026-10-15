/**
 * TanStack Query keys shared by the web and mobile apps, so both
 * invalidate and persist the same cache entries. Values are pinned by
 * queryKeys.test.ts -- changing one orphans existing cached data.
 */
export const queryKeys = {
  studySets: () => ['study-sets'] as const,
  studySet: (id: string) => ['study-set', id] as const,
  cards: (studySetId: string) => ['cards', studySetId] as const,
  signedImageUrl: (path: string) => ['signed-image-url', path] as const,
}
