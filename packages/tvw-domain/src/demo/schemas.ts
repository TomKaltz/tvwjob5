import { z } from 'zod'
import { defineSchemas } from '@tk-dcb/framework'

export const RecordDemoMessage = z.object({
  /** Projection partition tag (prefix `demo` in persistent store). */
  demo: z.string().min(1).max(64).default('global'),
  message: z.string().min(1).max(500),
})

export const DemoMessageRecorded = z.object({
  message: z.string(),
})

export const GetDemoFeed = z.object({
  demo: z.string().min(1).default('global'),
})

export const DemoSchemas = defineSchemas({
  commands: {
    RecordDemoMessage,
  },
  events: {
    DemoMessageRecorded: {
      data: DemoMessageRecorded,
      tags: ['demo'] as const,
    },
  },
  queries: {
    GetDemoFeed,
  },
})
