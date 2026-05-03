import * as path from 'path'
import * as fs from 'fs'
import {
  createApp,
  InferDomainRouterType,
  type TypedApplication,
} from '@tk-dcb/framework'
import { DemoFeatureSlice } from './demo'
import type { DemoFeedStateType } from './demo'

/** Resolve tvw-domain SQL migrations dir (monorepo root → packages/tvw-domain/migrations). */
export function getTvwDomainMigrationsDir(): string {
  let dir = __dirname
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return path.join(dir, 'packages', 'tvw-domain', 'migrations')
    }
    dir = path.dirname(dir)
  }
  return path.join(dir, 'packages', 'tvw-domain', 'migrations')
}

type TvwFeatureSlices = [typeof DemoFeatureSlice]

/** Builder: Demo slice (command + persistent projection) + framework tRPC. */
export const appBuilder = createApp().with(DemoFeatureSlice)

export type TvwDomainRouter = InferDomainRouterType<typeof appBuilder>

export type TvwQueryCatalog = {
  GetDemoFeed: {
    input: { demo: string }
    output: DemoFeedStateType
  }
}

let tvwApp: TypedApplication<TvwFeatureSlices> | null = null
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
    migrationsDir: getTvwDomainMigrationsDir(),
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
      .with(DemoFeatureSlice)
      .withEventStore(buildEventStoreConfig(options.connectionString, tableName))
      .buildAndInitialize()

    if (typeof globalThis !== 'undefined') {
      ;(globalThis as unknown as { __tvwApp: TypedApplication<TvwFeatureSlices> | null }).__tvwApp =
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

export function getTvwApp(): TypedApplication<TvwFeatureSlices> {
  if (tvwApp) return tvwApp
  if (initializationPromise) {
    throw new Error('tvw-domain is initializing; use getTvwAppAsync()')
  }
  throw new Error('tvw-domain not initialized; call initializeTvwApp() first')
}

export async function getTvwAppAsync(): Promise<TypedApplication<TvwFeatureSlices>> {
  if (tvwApp) return tvwApp
  if (initializationPromise) {
    await initializationPromise
    if (tvwApp) return tvwApp
  }
  throw new Error(
    'tvw-domain not initialized — Nitro plugin should call initializeTvwApp first'
  )
}

export * from './demo'
