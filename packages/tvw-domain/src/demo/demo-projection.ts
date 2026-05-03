import { z } from 'zod'
import { createProjection } from '@tk-dcb/framework'
import { DemoSchemas } from './schemas'

export const DemoFeedState = z.object({
  messageCount: z.number(),
  lastMessage: z.string().nullable(),
  lastRecordedAt: z.string().nullable(),
})

type DemoFeedStateType = z.infer<typeof DemoFeedState>

/** Single-partition demo read model (`tags.demo === 'global'`). */
export const DemoFeedProjection = createProjection({
  schemas: DemoSchemas,
  eventTypes: ['DemoMessageRecorded'] as const,
  name: 'DemoFeed',
  stateSchema: DemoFeedState,
  initialState: (): DemoFeedStateType => ({
    messageCount: 0,
    lastMessage: null,
    lastRecordedAt: null,
  }),
  handlers: {
    DemoMessageRecorded: (state, event) => ({
      messageCount: state.messageCount + 1,
      lastMessage: event.data.message,
      lastRecordedAt: event.timestamp.toISOString(),
    }),
  },
  cache: {
    strategy: 'persistent',
    persistent: {
      tableName: 'tvw_demo_feed',
      partitionTagPrefix: 'demo',
    },
  },
})
