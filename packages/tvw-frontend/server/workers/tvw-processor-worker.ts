#!/usr/bin/env node
/**
 * Demo feature-slice worker: IPC EventBus + handles worker.Demo.rebuild.projection for blue/green rebuilds.
 */
import {
  createApp,
  createWorkerEventBus,
  discoverAndStartProcessors,
  stopAllProcessors,
  type TypedApplication,
  type WorkerEventBus,
} from '@tk-dcb/framework'
import { DemoFeatureSlice, getTvwDomainMigrationsDir } from 'tvw-domain'
import * as fs from 'node:fs'
import { getDatabaseUrl } from '../utils/db-url'

const workerName = process.env.WORKER_NAME || 'TvwDemoWorker'
const workerId = process.env.WORKER_ID || 'Demo'
const featureSliceName = process.env.FEATURE_SLICE_NAME || 'Demo'

const log = (message: string) => {
  try {
    fs.writeSync(1, Buffer.from(`${message}\n`))
  } catch {
    console.log(message)
  }
}

process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
})
process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
})

let shuttingDown = false
type TvwSlices = [typeof DemoFeatureSlice]
let app: TypedApplication<TvwSlices> | null = null
let eventBus: WorkerEventBus | null = null
const processors: Array<{
  name: string
  instance: { start: () => Promise<void>; stop: () => Promise<void>; wakeUp?: () => void }
}> = []

async function main() {
  const connectionString = getDatabaseUrl()
  const tableName = process.env.TVW_EVENTS_TABLE || 'tvw_events'

  eventBus = createWorkerEventBus({ workerId, debug: false })
  await eventBus.start()
  log(`✅ [${workerName}] WorkerEventBus started`)

  const onProjectionUpdated = (
    projectionName: string,
    projectionId: string,
    sequence: number,
    state?: unknown,
  ) => {
    if (!eventBus) return
    const updateData = {
      projectionName,
      projectionId,
      sequence,
      state,
      timestamp: new Date().toISOString(),
    }
    try {
      eventBus.publish(`projection.${projectionName}.${projectionId}`, updateData)
      eventBus.publish('projection.updated', updateData)
    } catch (err) {
      log(`❌ [${workerName}] projection publish failed: ${err}`)
    }
  }

  app = await createApp()
    .with(DemoFeatureSlice)
    .withEventStore({
      connectionString,
      maxConnections: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      tableName,
      migrationsDir: getTvwDomainMigrationsDir(),
      onProjectionUpdated,
    })
    .withSkipStaleRebuildAtStartup()
    .buildAndInitialize()

  log(`✅ [${workerName}] tvw app initialized in worker`)

  await discoverAndStartProcessors(
    [DemoFeatureSlice],
    app.getEventStore(),
    app.underlyingApp,
    processors,
    {
      onProjectionUpdated: (projectionName, streamKey, sequence) => {
        onProjectionUpdated(projectionName, streamKey, sequence)
      },
      eventBus,
    },
  )

  eventBus.subscribe('events.new', () => {
    for (const p of processors) {
      p.instance.wakeUp?.()
    }
  })

  const statusSubject = `worker.${workerId}.status`
  eventBus.subscribe(statusSubject, (msg) => {
    if (msg.replyTo) {
      eventBus!.reply(msg.replyTo, {
        workerId,
        workerName,
        featureSliceName,
        processorsCount: processors.length,
        healthy: true,
        uptime: process.uptime(),
      })
    }
  })

  const rebuildSubject = `worker.${workerId}.rebuild.projection`
  eventBus.subscribe(rebuildSubject, async (msg) => {
    const { projectionName } = (msg.data || {}) as { projectionName?: string }
    log(`🔨 [${workerName}] rebuild: ${projectionName}`)
    if (!projectionName) {
      if (msg.replyTo) eventBus!.reply(msg.replyTo, { success: false, error: 'projectionName required' })
      return
    }
    try {
      await Promise.all(
        processors.map((p) => p.instance.stop().catch((err) => log(`⚠️ stop ${p.name}: ${err}`))),
      )
      await app!.underlyingApp.executeProjectionRebuild(projectionName)
      await Promise.all(
        processors.map((p) => p.instance.start().catch((err) => log(`⚠️ start ${p.name}: ${err}`))),
      )
      if (msg.replyTo) eventBus!.reply(msg.replyTo, { success: true, projectionName })
    } catch (error) {
      await Promise.all(processors.map((p) => p.instance.start().catch(() => {})))
      if (msg.replyTo) {
        eventBus!.reply(msg.replyTo, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  })

  log(`✅ [${workerName}] listening: ${rebuildSubject}`)
}

async function handleShutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  log(`🛑 [${workerName}] ${signal}`)
  try {
    if (eventBus) await eventBus.stop()
    if (processors.length) {
      await Promise.race([
        stopAllProcessors(processors),
        new Promise((r) => setTimeout(r, 5000)),
      ]).catch(() => {})
    }
    if (app) await Promise.race([app.close(), new Promise((r) => setTimeout(r, 2000))]).catch(() => {})
  } finally {
    process.exit(0)
  }
}

process.on('uncaughtException', (e) => {
  log(`❌ uncaughtException: ${e}`)
  void handleShutdown('uncaughtException')
})
process.prependListener('SIGTERM', () => void handleShutdown('SIGTERM'))
process.prependListener('SIGINT', () => void handleShutdown('SIGINT'))

main().catch((e) => {
  log(`❌ worker failed: ${e}`)
  process.exit(1)
})
