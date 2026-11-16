import { config } from '../config'
import { cognitoAuth } from './cognito'
import { mockAuth } from './mockAuth'

export const auth = config.useMock ? mockAuth : cognitoAuth
export type { SessionUser } from './types'
