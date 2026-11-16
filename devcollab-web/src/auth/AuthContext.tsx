import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, type SessionUser } from './index'

interface AuthState {
  user: SessionUser | null
  loading: boolean
  signIn(username: string, password: string): Promise<void>
  signOut(): void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.restore().then(setUser).finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    setUser(await auth.signIn(username, password))
  }, [])

  const signOut = useCallback(() => {
    auth.signOut()
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
