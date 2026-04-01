import { z } from 'zod'
import argon2 from 'argon2'
import { getAuthSql } from '../../utils/auth-db'
import { signAuthToken } from '../../utils/auth-jwt'

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  }

  const sql = getAuthSql()
  const rows = await sql<{ id: string; username: string; password_hash: string }[]>`
    SELECT id, username, password_hash FROM tvw_users
    WHERE username = ${parsed.data.username}
  `

  const user = rows[0]
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const valid = await argon2.verify(user.password_hash, parsed.data.password)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const token = signAuthToken({ sub: user.id, username: user.username })
  return { token }
})
