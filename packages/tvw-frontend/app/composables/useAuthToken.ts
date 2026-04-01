const STORAGE_KEY = 'tvw_auth_token'

export function useAuthToken() {
  const token = useState<string | null>('tvw-auth-token', () => null)

  function setToken(t: string) {
    token.value = t
    if (import.meta.client) {
      sessionStorage.setItem(STORAGE_KEY, t)
    }
  }

  function clearToken() {
    token.value = null
    if (import.meta.client) {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }

  return { token, setToken, clearToken }
}
