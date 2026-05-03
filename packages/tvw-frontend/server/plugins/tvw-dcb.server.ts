import postgres from 'postgres'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import {
  createTrpcContext,
  type ActorMetadata,
  type CommandExecutionMetadata,
} from '@tk-dcb/framework'
import {
  attachTkDcbTrpcWssToNitro,
} from '@tk-dcb/nuxt/runtime/server'
import { closeTvwApp, getTvwAppAsync, initializeTvwApp } from 'tvw-domain'
import { getAuthSecret } from '../utils/auth-jwt'
import { getDatabaseUrl } from '../utils/db-url'

const ANONYMOUS_ACTOR_ID = 'anonymous'

export default defineNitroPlugin(async (nitroApp) => {
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
  } finally {
    await sql.end({ timeout: 5 })
  }

  await initializeTvwApp({
    connectionString: getDatabaseUrl(),
    tableName: process.env.TVW_EVENTS_TABLE || 'tvw_events',
  })

  nitroApp.hooks.hook('close', async () => {
    await closeTvwApp()
  })

  attachTkDcbTrpcWssToNitro(nitroApp, {
    getApp: getTvwAppAsync,
    logPrefix: '[tRPC WS]',
    createTrpcContext: ({ app, req, connectionParams }) => {
      const rawToken =
        (typeof connectionParams.token === 'string' && connectionParams.token) ||
        (typeof connectionParams.accessToken === 'string' && connectionParams.accessToken) ||
        null

      const socketMeta = {
        ipAddress: req?.socket?.remoteAddress ?? undefined,
        userAgent: req?.headers?.['user-agent'] as string | undefined,
      }

      if (!rawToken) {
        const actor: ActorMetadata = {
          id: ANONYMOUS_ACTOR_ID,
          name: 'Anonymous',
          ...socketMeta,
        }
        return createTrpcContext(app, { actor })
      }

      let sub: string
      let username: string
      try {
        const decoded = jwt.verify(rawToken, getAuthSecret(), {
          algorithms: ['HS256'],
        }) as jwt.JwtPayload
        sub = typeof decoded.sub === 'string' ? decoded.sub : ''
        username = typeof decoded.username === 'string' ? decoded.username : ''
        if (!sub || !username) throw new Error('Invalid token')
      } catch {
        throw new Error('UNAUTHORIZED: Invalid or expired token')
      }

      const actor: ActorMetadata = {
        id: sub,
        name: username,
        ...socketMeta,
      }

      const metadata: CommandExecutionMetadata = { actor }
      return createTrpcContext(app, metadata)
    },
  })
})
