import { LogOut, Moon, Sun } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useTheme } from '@/app/ThemeContext'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'

export function Layout() {
  const { signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-card text-card-foreground border-foreground/10 flex items-center justify-between border-b px-4 py-3">
        <Link to="/" className="font-semibold">
          Escritorio
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}
