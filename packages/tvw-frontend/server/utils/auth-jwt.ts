import jwt from 'jsonwebtoken'

export function getAuthSecret(): string {
  const s = (process.env.AUTH_SECRET || process.env.TVW_AUTH_SECRET || '').trim()
  if (!s) {
    throw new Error('AUTH_SECRET (or TVW_AUTH_SECRET) must be set')
  }
  return s
}

export function signAuthToken(payload: { sub: string; username: string }): string {
  return jwt.sign(
    { sub: payload.sub, username: payload.username },
    getAuthSecret(),
    { algorithm: 'HS256', expiresIn: '7d' }
  )
}

export function verifyAuthToken(token: string): { sub: string; username: string } {
  const decoded = jwt.verify(token, getAuthSecret(), {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload

  const sub = typeof decoded.sub === 'string' ? decoded.sub : ''
  const username = typeof decoded.username === 'string' ? decoded.username : ''
  if (!sub || !username) {
    throw new Error('Invalid token payload')
  }
  return { sub, username }
}
