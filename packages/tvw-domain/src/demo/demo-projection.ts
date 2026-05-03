import { z } from 'zod'
import { createProjection } from '@tk-dcb/framework'
import { DemoSchemas } from './schemas'

export const DemoFeedState = z.object({
  messageCount: z.number(),
  lastMessage: z.string().nullable(),
  lastRecordedAt: z.string().nullable(),
  /** Partition id from event tags (`demo:…`); persisted for list/subscription keys. */
  demo: z.string().optional(),
})

export type DemoFeedStateType = z.infer<typeof DemoFeedState>

function initialDemoFeedState(): DemoFeedStateType {
  return {
    messageCount: 0,
    lastMessage: null,
    lastRecordedAt: null,
  }
}

/** Persistent read model; partition = `tags.demo` (per-channel). */
export const DemoFeedProjection = createProjection({
  schemas: DemoSchemas,
  eventTypes: ['DemoEntityAdded', 'DemoMessageRecorded'] as const,
  name: 'DemoFeed',
  stateSchema: DemoFeedState,
  initialState: initialDemoFeedState,
  handlers: {
    DemoEntityAdded: (state, event) => {
      const prefix = 'demo:'
      const tag = event.tags?.find((t) => t.startsWith(prefix))
      const demo = tag ? tag.slice(prefix.length) : state.demo
      return {
        ...state,
        ...(demo !== undefined ? { demo } : {}),
      }
    },
    DemoMessageRecorded: (state, event) => {
      const prefix = 'demo:'
      const tag = event.tags?.find((t) => t.startsWith(prefix))
      const demo = tag ? tag.slice(prefix.length) : state.demo
      return {
        messageCount: state.messageCount + 1,
        lastMessage: event.data.message,
        lastRecordedAt: event.timestamp.toISOString(),
        ...(demo !== undefined ? { demo } : {}),
      }
    },
  },
  cache: {
    strategy: 'persistent',
    persistent: {
      tableName: 'tvw_demo_feed',
      partitionTagPrefix: 'demo',
    },
  },
})
