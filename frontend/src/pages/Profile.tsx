import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User, Mail, Lock, LogOut, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')

  // Change password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login')
        return
      }

      setUser(user)
      setEmail(user.email || '')
    } catch (err) {
      console.error('Error checking auth:', err)
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err: any) {
      console.error('Error logging out:', err)
      alert(`Failed to log out: ${err.message}`)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    try {
      setPasswordChanging(true)
      setPasswordError(null)
      setPasswordSuccess(false)

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Reset success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error changing password:', err)
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setPasswordChanging(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-lg border bg-card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading font-bold mb-6">My Profile</h1>

        <div className="space-y-6">
          {/* Account Information */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-primary/10">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Account Information</h2>
                <p className="text-sm text-muted-foreground">Your account details</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">User ID</label>
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono">
                  {user?.id}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm flex-1">
                    {email}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed at this time
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Account Created</label>
                <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  {user?.created_at && new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Change Password</h2>
                <p className="text-sm text-muted-foreground">Update your password</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                  minLength={6}
                />
              </div>

              {passwordError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-md bg-green-100 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>Password changed successfully!</p>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordChanging || !newPassword || !confirmPassword}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {passwordChanging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Change Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Logout */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-destructive mb-1">Sign Out</h3>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
