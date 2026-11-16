export interface SessionUser {
  id: string
  username: string
  email: string
}

export interface AuthService {
  signIn(username: string, password: string): Promise<SessionUser>
  signUp(username: string, email: string, password: string): Promise<void>
  confirm(username: string, code: string): Promise<void>
  resendCode(username: string): Promise<void>
  signOut(): void
  restore(): Promise<SessionUser | null>
  getToken(): Promise<string | null>
}
