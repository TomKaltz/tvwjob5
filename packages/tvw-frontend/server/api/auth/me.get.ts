import { verifyAuthToken } from '../../utils/auth-jwt'

export default defineEventHandler((event) => {
  const auth = getHeader(event, 'authorization')
  const token =
    auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  try {
    const { sub, username } = verifyAuthToken(token)
    return { userId: sub, username }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
