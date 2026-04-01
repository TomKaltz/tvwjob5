/**
 * Same resolution as tvw-domain / Nitro: DATABASE_URL or DB_* pieces.
 */
export function getDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) return direct

  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = process.env.DB_PORT || '5432'
  const dbName = process.env.DB_NAME || 'tvw'
  const dbUser = process.env.DB_USER || 'postgres'
  const dbPassword = process.env.DB_PASSWORD || 'postgres'
  const dbSsl = process.env.DB_SSL === 'true'

  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}${dbSsl ? '?sslmode=require' : ''}`
}
