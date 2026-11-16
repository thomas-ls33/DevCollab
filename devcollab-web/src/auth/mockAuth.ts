import type { AuthService, SessionUser } from './types'
import { mockDb } from '../api/mockDb'

const SESSION_KEY = 'devcollab.mock.session'

export const mockAuth: AuthService = {
  signIn: async (username, password) => {
    const account = mockDb.accounts().find((a) => a.username === username || a.email === username)
    if (!account || account.password !== password) throw new Error('Identifiants incorrects.')
    if (!account.confirmed) throw Object.assign(new Error("Compte non confirmé."), { code: 'UserNotConfirmedException' })
    const user: SessionUser = { id: account.id, username: account.username, email: account.email }
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return user
  },

  signUp: async (username, email, password) => {
    if (mockDb.accounts().some((a) => a.username === username)) throw new Error("Ce nom d'utilisateur existe déjà.")
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
    mockDb.createAccount(username, email, password)
  },

  confirm: async (username, code) => {
    if (code !== '123456') throw new Error('Code invalide (en mode démo, utilisez 123456).')
    mockDb.confirmAccount(username)
  },

  resendCode: async () => {},

  signOut: () => localStorage.removeItem(SESSION_KEY),

  restore: async () => {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  },

  getToken: async () => localStorage.getItem(SESSION_KEY),
}
