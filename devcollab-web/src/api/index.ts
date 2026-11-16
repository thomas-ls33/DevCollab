import { config } from '../config'
import { mockApi } from './mockApi'
import { restApi } from './restApi'

export const api = config.useMock ? mockApi : restApi
export * from './types'
export { ApiError } from './http'
