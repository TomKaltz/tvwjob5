const STORAGE_KEY = 'tvw_auth_token'

function tvwAuthTokenPlugin() {
  const token = useState<string | null>('tvw-auth-token', () => null)
  if (token.value) return
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) token.value = stored
  } catch {
    /* sessionStorage unavailable */
  }
}

export default defineNuxtPlugin(
  Object.assign(tvwAuthTokenPlugin, { _name: 'tvw-auth-token' })
)
