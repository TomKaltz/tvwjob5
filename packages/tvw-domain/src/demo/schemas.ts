import { z } from 'zod'
import { defineSchemas } from '@tk-dcb/framework'

export const RecordDemoMessage = z.object({
  message: z.string().min(1).max(500),
})

export const DemoMessageRecorded = z.object({
  message: z.string(),
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
})
