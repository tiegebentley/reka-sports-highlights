import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Video, User, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [demosOpen, setDemosOpen] = useState(false)

  useEffect(() => {
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setIsLoggedIn(!!session)
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <span className="font-heading text-xl font-semibold">
              Reka Sports Highlights
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/upload"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Upload
            </Link>
            <Link
              to="/library"
              className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
            >
              Library
            </Link>

            {/* Demos Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDemosOpen(!demosOpen)}
                className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1"
              >
                Demos
                <ChevronDown className={`w-4 h-4 transition-transform ${demosOpen ? 'rotate-180' : ''}`} />
              </button>

              {demosOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDemosOpen(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-background border rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      <Link
                        to="/stats-demo"
                        className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setDemosOpen(false)}
                      >
                        📊 Stats & Analytics
                      </Link>
                      <Link
                        to="/player-demo"
                        className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setDemosOpen(false)}
                      >
                        🎯 Player Tracking
                      </Link>
                      <Link
                        to="/commentary-demo"
                        className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setDemosOpen(false)}
                      >
                        🎙️ AI Commentary
                      </Link>
                      <Link
                        to="/export-demo"
                        className="block px-4 py-2 text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setDemosOpen(false)}
                      >
                        📤 Video Export
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            {isLoggedIn ? (
              <Link
                to="/profile"
                className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <User className="w-4 h-4" />
                My Profile
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
