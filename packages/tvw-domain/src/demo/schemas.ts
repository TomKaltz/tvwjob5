import { z } from 'zod'
import { defineSchemas } from '@tk-dcb/framework'

export const RecordDemoMessage = z.object({
  /** Projection partition tag (prefix `demo` in persistent store). */
  demo: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
})

export const AddDemoEntity = z.object({
  /** Projection partition tag (prefix `demo` in persistent store). */
  demo: z.string().min(1).max(64),
})

export const DemoEntityAdded = z.object({})

export const DemoMessageRecorded = z.object({
  message: z.string(),
})

export const DemoSchemas = defineSchemas({
  commands: {
    AddDemoEntity,
    RecordDemoMessage,
  },
  events: {
    DemoEntityAdded: {
      data: DemoEntityAdded,
      tags: ['demo'] as const,
    },
    DemoMessageRecorded: {
      data: DemoMessageRecorded,
      tags: ['demo'] as const,
    },
  },
})
