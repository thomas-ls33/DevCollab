import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'
import { config } from '../config'
import type { AuthService, SessionUser } from './types'

const pool = () => new CognitoUserPool({ UserPoolId: config.userPoolId, ClientId: config.clientId })

const toUser = (session: CognitoUserSession): SessionUser => {
  const p = session.getIdToken().decodePayload()
  return { id: p.sub, username: p['cognito:username'] ?? p.username, email: p.email ?? '' }
}

const currentSession = (): Promise<CognitoUserSession | null> =>
  new Promise((resolve) => {
    const user = pool().getCurrentUser()
    if (!user) return resolve(null)
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      resolve(err || !session?.isValid() ? null : session)
    })
  })

export const cognitoAuth: AuthService = {
  signIn: (username, password) =>
    new Promise((resolve, reject) => {
      const user = new CognitoUser({ Username: username, Pool: pool() })
      user.authenticateUser(new AuthenticationDetails({ Username: username, Password: password }), {
        onSuccess: (session) => resolve(toUser(session)),
        onFailure: reject,
        newPasswordRequired: () => reject(new Error('Un nouveau mot de passe est requis pour ce compte.')),
      })
    }),

  signUp: (username, email, password) =>
    new Promise((resolve, reject) => {
      pool().signUp(username, password, [new CognitoUserAttribute({ Name: 'email', Value: email })], [], (err) =>
        err ? reject(err) : resolve(),
      )
    }),

  confirm: (username, code) =>
    new Promise((resolve, reject) => {
      new CognitoUser({ Username: username, Pool: pool() }).confirmRegistration(code, true, (err) =>
        err ? reject(err) : resolve(),
      )
    }),

  resendCode: (username) =>
    new Promise((resolve, reject) => {
      new CognitoUser({ Username: username, Pool: pool() }).resendConfirmationCode((err) =>
        err ? reject(err) : resolve(),
      )
    }),

  signOut: () => pool().getCurrentUser()?.signOut(),

  restore: async () => {
    const session = await currentSession()
    return session ? toUser(session) : null
  },

  getToken: async () => (await currentSession())?.getIdToken().getJwtToken() ?? null,
}
