import { fork, type ChildProcess } from 'child_process'
import { resolve } from 'node:path'
import * as fs from 'node:fs'
import { createIpcEventBus, type IpcEventBus } from '@tk-dcb/framework'

/** Same pattern as trading-frontend: cwd is package root in dev/start; avoid bundled `__dirname` → `.nuxt/workers/`. */
const workerScriptPath = resolve(process.cwd(), 'server/workers/tvw-processor-worker.ts')

const log = (message: string) => {
  try {
    fs.writeSync(1, Buffer.from(`${message}\n`))
  } catch {
    console.log(message)
  }
}

let eventBus: IpcEventBus | null = null
const globalWorkerPids: number[] = []

export function getEventBus(): IpcEventBus {
  if (!eventBus) {
    eventBus = createIpcEventBus({ debug: false })
  }
  return eventBus
}

interface WorkerInfo {
  process: ChildProcess
}

const workers = new Map<string, WorkerInfo>()
let shuttingDown = false

export async function startTvwProcessorWorkers(): Promise<void> {
  const bus = getEventBus()
  await bus.start()
  log('✅ [tvw] EventBus started')

  const workerId = 'Demo'
  if (workers.has(workerId)) {
    log(`⚠️ [tvw] Worker ${workerId} already running`)
    return
  }

  const filteredEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      const k = key.toLowerCase()
      return (
        !k.startsWith('npm_') &&
        !k.startsWith('npm-') &&
        !k.startsWith('_jsr') &&
        !k.includes('jsr-registry') &&
        !k.includes('include-optional-dependencies') &&
        !k.includes('verify-deps-before-run') &&
        !k.includes('npm-globalconfig')
      )
    }),
  )

  const workerProcess = fork(workerScriptPath, [], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...filteredEnv,
      WORKER_NAME: 'TvwDemoWorker',
      WORKER_ID: workerId,
      FEATURE_SLICE_NAME: workerId,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    detached: false,
  })

  workers.set(workerId, { process: workerProcess })
  bus.registerWorker(workerId, workerProcess)

  workerProcess.stdout?.on('data', (data) => {
    log(`[${workerId}] ${data.toString().trim()}`)
  })
  workerProcess.stderr?.on('data', (data) => {
    log(`[${workerId}] ${data.toString().trim()}`)
  })

  workerProcess.on('exit', (code, signal) => {
    log(`[${workerId}] Worker exited code=${code} signal=${signal}`)
    const pid = workerProcess.pid
    if (pid) {
      const i = globalWorkerPids.indexOf(pid)
      if (i > -1) globalWorkerPids.splice(i, 1)
    }
    bus.unregisterWorker(workerId)
    workers.delete(workerId)
    if (!shuttingDown && code !== 0) {
      log(`⚠️ [tvw] Demo worker crashed; restart dev server to restore projection rebuilds`)
    }
  })

  const pid = workerProcess.pid
  if (pid) {
    globalWorkerPids.push(pid)
    log(`✅ [tvw] Demo processor worker started (PID ${pid})`)
  }
}

export async function stopTvwProcessorWorkers(): Promise<void> {
  shuttingDown = true
  const bus = eventBus

  for (const [workerId, info] of workers) {
    log(`🛑 [tvw] Stopping worker ${workerId}…`)
    try {
      if (!info.process.killed && info.process.exitCode === null) {
        info.process.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        try {
          if (!info.process.killed && info.process.exitCode === null) {
            info.process.kill('SIGKILL')
          }
        } catch {
          /* ignore */
        }
        resolve()
      }, 5000)
      info.process.once('exit', () => {
        clearTimeout(t)
        resolve()
      })
    })
    workers.delete(workerId)
  }

  if (bus) {
    await bus.stop()
  }
  log('✅ [tvw] Processor workers stopped')
}
