import jwt from 'jsonwebtoken'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import {
  createTrpcContext,
  createTrpcRouter,
  type ActorMetadata,
  type CommandExecutionMetadata,
} from '@tk-dcb/framework'
import { getTvwAppAsync } from 'tvw-domain'
import { getAuthSecret } from '../utils/auth-jwt'

let attached = false

export default defineNitroPlugin(async (nitroApp) => {
  process.prependListener('unhandledRejection', (reason: unknown, promise) => {
    const msg = reason && typeof reason === 'object' && 'message' in reason
      ? String((reason as { message?: string }).message)
      : String(reason)
    const isConnectionError =
      msg.includes('ECONNRESET') ||
      msg.includes('EPIPE') ||
      (reason as { code?: string })?.code === 'ECONNRESET' ||
      (reason as { code?: string })?.code === 'EPIPE'
    if (isConnectionError) {
      promise.catch(() => {})
    }
  })

  const tryAttach = async (server: unknown) => {
    if (attached || !server) return
    attached = true

    try {
      const tvwApp = await getTvwAppAsync()
      const router = createTrpcRouter(tvwApp.underlyingApp)

      const wss = new WebSocketServer({
        server: server as import('http').Server,
        path: '/ws',
        noServer: false,
      })

      applyWSSHandler({
        wss,
        router,
        createContext: async (opts) => {
          const req = (opts as { req?: import('http').IncomingMessage }).req
          const rawParams =
            (opts as { info?: { connectionParams?: Record<string, unknown> } }).info
              ?.connectionParams ?? {}
          const params = (rawParams || {}) as Record<string, unknown>

          const rawToken =
            (typeof params.token === 'string' && params.token) ||
            (typeof params.accessToken === 'string' && params.accessToken) ||
            null

          if (!rawToken) {
            throw new Error('UNAUTHORIZED: Missing token')
          }

          let sub: string
          let username: string
          try {
            const decoded = jwt.verify(rawToken, getAuthSecret(), {
              algorithms: ['HS256'],
            }) as jwt.JwtPayload
            sub = typeof decoded.sub === 'string' ? decoded.sub : ''
            username =
              typeof decoded.username === 'string' ? decoded.username : ''
            if (!sub || !username) throw new Error('Invalid token')
          } catch {
            throw new Error('UNAUTHORIZED: Invalid or expired token')
          }

          const actor: ActorMetadata = {
            id: sub,
            name: username,
            ipAddress: req?.socket?.remoteAddress ?? undefined,
            userAgent: req?.headers?.['user-agent'] as string | undefined,
          }

          const metadata: CommandExecutionMetadata = { actor }
          return createTrpcContext(tvwApp.underlyingApp, metadata)
        },
        keepAlive: {
          enabled: true,
          pingMs: 30000,
          pongWaitMs: 5000,
        },
      })

      wss.on('connection', (ws, req) => {
        console.log('[tRPC WS] connection opened', {
          remoteAddress: req.socket?.remoteAddress,
        })
        ws.once('close', (code, reason) => {
          const reasonStr = Buffer.isBuffer(reason)
            ? reason.toString('utf8')
            : String(reason)
          console.log('[tRPC WS] connection closed', { code, reason: reasonStr })
        })
      })
    } catch (e) {
      console.error('[tvw] trpc-websocket attach failed:', e)
      attached = false
      throw e
    }
  }

  nitroApp.hooks.hookOnce('request', async (event) => {
    const server = (event.node.req.socket as { server?: unknown })?.server
    if (server) await tryAttach(server)
  })
})
