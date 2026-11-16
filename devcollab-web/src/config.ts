export const config = {
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, ''),
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
}
