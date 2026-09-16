import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/app/Layout'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { SignInPage } from '@/features/auth/SignInPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { DashboardPage } from '@/features/study-sets/DashboardPage'
import { StudySetEditorPage } from '@/features/study-sets/StudySetEditorPage'
import { StudySessionPage } from '@/features/study/StudySessionPage'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sets/:setId/edit" element={<StudySetEditorPage />} />
            <Route path="/sets/:setId/study" element={<StudySessionPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  )
}
