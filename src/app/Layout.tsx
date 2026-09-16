import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'

export function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link to="/" className="font-semibold">
          Escritorio
        </Link>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
