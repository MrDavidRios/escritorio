import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStudySet,
  deleteStudySet,
  getStudySet,
  listStudySets,
  updateStudySet,
} from '@/api/studySets'
import { useAuth } from '@/features/auth/AuthContext'
import type { StudySetInput } from '@/types/studySet'

export function studySetsKey() {
  return ['study-sets'] as const
}

export function studySetKey(id: string) {
  return ['study-set', id] as const
}

export function useStudySets() {
  return useQuery({
    queryKey: studySetsKey(),
    queryFn: listStudySets,
  })
}

export function useStudySet(id: string | undefined) {
  return useQuery({
    queryKey: studySetKey(id ?? ''),
    queryFn: () => getStudySet(id!),
    enabled: !!id,
  })
}

export function useCreateStudySet() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: StudySetInput) => createStudySet(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
    },
  })
}

export function useUpdateStudySet(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: StudySetInput) => updateStudySet(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
      queryClient.setQueryData(studySetKey(id), data)
    },
  })
}

export function useDeleteStudySet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteStudySet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
    },
  })
}
