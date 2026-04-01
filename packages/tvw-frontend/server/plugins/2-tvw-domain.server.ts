import { initializeTvwApp, closeTvwApp } from 'tvw-domain'
import { getDatabaseUrl } from '../utils/db-url'

export default defineNitroPlugin(async (nitroApp) => {
  const connectionString = getDatabaseUrl()
  const tableName = process.env.TVW_EVENTS_TABLE || 'tvw_events'
  await initializeTvwApp({ connectionString, tableName })

  nitroApp.hooks.hook('close', async () => {
    await closeTvwApp()
  })
})
