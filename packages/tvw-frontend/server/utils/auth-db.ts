import postgres from 'postgres'
import { getDatabaseUrl } from './db-url'

let _sql: ReturnType<typeof postgres> | null = null

export function getAuthSql() {
  if (!_sql) {
    _sql = postgres(getDatabaseUrl(), { max: 8 })
  }
  return _sql
}
