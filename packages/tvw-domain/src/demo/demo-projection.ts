import { z } from 'zod'
import { createProjection } from '@tk-dcb/framework'
import { DemoSchemas, GetDemoFeed } from './schemas'

export const DemoFeedState = z.object({
  messageCount: z.number(),
  lastMessage: z.string().nullable(),
  lastRecordedAt: z.string().nullable(),
  /** Set on read path only; omitted in persisted reducer state. */
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
  eventTypes: ['DemoMessageRecorded'] as const,
  name: 'DemoFeed',
  stateSchema: DemoFeedState,
  initialState: initialDemoFeedState,
  handlers: {
    DemoMessageRecorded: (state, event) => ({
      messageCount: state.messageCount + 1,
      lastMessage: event.data.message,
      lastRecordedAt: event.timestamp.toISOString(),
    }),
  },
  queries: {
    GetDemoFeed: {
      input: GetDemoFeed,
      dependentProjectionNames: ['DemoFeed'],
      subscriptionKeySelector: (row) => row?.demo ?? 'global',
      handler: async (input, ctx): Promise<DemoFeedStateType> => {
        const id = input.demo
        try {
          const result = await ctx.query('DemoFeed.get', { demo: id })
          const base = result.data as DemoFeedStateType
          return { ...base, demo: id }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('No DemoFeed found')) {
            return { ...initialDemoFeedState(), demo: id }
          }
          throw e
        }
      },
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
