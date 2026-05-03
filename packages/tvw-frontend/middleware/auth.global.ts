export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  if (to.path === '/login') return

  const token = useState<string | null>('tvw-auth-token', () => null)
  if (!token.value && typeof sessionStorage !== 'undefined') {
    const s = sessionStorage.getItem('tvw_auth_token')
    if (s) token.value = s
  }
  if (!token.value) {
    return navigateTo('/login')
  }
})
