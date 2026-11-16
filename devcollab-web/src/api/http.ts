import { auth } from '../auth'
import { config } from '../config'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Query = Record<string, string | undefined>

const buildUrl = (path: string, query?: Query) => {
  const url = new URL(config.apiUrl + path)
  Object.entries(query ?? {}).forEach(([k, v]) => v && url.searchParams.set(k, v))
  return url.toString()
}

export async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const token = await auth.getToken()
  const res = await fetch(buildUrl(path, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? `Erreur ${res.status}`
    throw new ApiError(res.status, message)
  }
  return (data?.data ?? data) as T
}
