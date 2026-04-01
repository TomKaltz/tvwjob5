import postgres from 'postgres'
import argon2 from 'argon2'
import { getDatabaseUrl } from '../utils/db-url'

export default defineNitroPlugin(async () => {
  const sql = postgres(getDatabaseUrl(), { max: 2 })
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS tvw_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text as count FROM tvw_users
    `
    const count = parseInt(rows[0]?.count ?? '0', 10)
    const bootstrapUser = process.env.TVW_BOOTSTRAP_USERNAME?.trim()
    const bootstrapPass = process.env.TVW_BOOTSTRAP_PASSWORD
    if (count === 0 && bootstrapUser && bootstrapPass) {
      const password_hash = await argon2.hash(bootstrapPass)
      await sql`
        INSERT INTO tvw_users (username, password_hash)
        VALUES (${bootstrapUser}, ${password_hash})
      `
      console.log(`[tvw] Bootstrap user created: ${bootstrapUser}`)
    }
  } catch (e) {
    console.error('[tvw] auth-schema plugin failed:', e)
    throw e
  } finally {
    await sql.end({ timeout: 5 })
  }
})
