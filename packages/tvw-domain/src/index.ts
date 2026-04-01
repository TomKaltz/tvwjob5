import {
  createApp,
  InferDomainRouterType,
  type TypedApplication,
} from '@tk-dcb/framework'

/** Builder with zero feature slices — only framework base tRPC (health, command, query, …). */
export const appBuilder = createApp()

export type TvwDomainRouter = InferDomainRouterType<typeof appBuilder>

let tvwApp: TypedApplication<readonly []> | null = null
let initializationPromise: Promise<void> | null = null

export interface TvwAppInitOptions {
  connectionString: string
  /** Event store table name (default tvw_events). */
  tableName?: string
}

function buildEventStoreConfig(connectionString: string, tableName: string) {
  return {
    connectionString,
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    tableName,
  }
}

/**
 * Initialize the tvw DCB application (Postgres + migrations + projections startup).
 */
export async function initializeTvwApp(options: TvwAppInitOptions): Promise<void> {
  if (tvwApp) return
  if (initializationPromise) return initializationPromise

  const tableName = options.tableName || 'tvw_events'

  initializationPromise = (async () => {
    tvwApp = await createApp()
      .withEventStore(buildEventStoreConfig(options.connectionString, tableName))
      .buildAndInitialize()

    if (typeof globalThis !== 'undefined') {
      ;(globalThis as unknown as { __tvwApp: TypedApplication<readonly []> | null }).__tvwApp =
        tvwApp
    }
  })()

  await initializationPromise
}

export async function closeTvwApp(): Promise<void> {
  if (tvwApp) {
    await tvwApp.close()
    tvwApp = null
    initializationPromise = null
  }
}

export function getTvwApp(): TypedApplication<readonly []> {
  if (tvwApp) return tvwApp
  if (initializationPromise) {
    throw new Error('tvw-domain is initializing; use getTvwAppAsync()')
  }
  throw new Error('tvw-domain not initialized; call initializeTvwApp() first')
}

export async function getTvwAppAsync(): Promise<TypedApplication<readonly []>> {
  if (tvwApp) return tvwApp
  if (initializationPromise) {
    await initializationPromise
    if (tvwApp) return tvwApp
  }
  throw new Error(
    'tvw-domain not initialized — Nitro plugin should call initializeTvwApp first'
  )
}
