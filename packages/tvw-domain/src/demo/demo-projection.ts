import { z } from 'zod'
import { createProjection } from '@tk-dcb/framework'
import { DemoSchemas, GetDemoFeed } from './schemas'

export const DemoFeedState = z.object({
  messageCount: z.number(),
  lastMessage: z.string().nullable(),
  lastRecordedAt: z.string().nullable(),
})

export type DemoFeedStateType = z.infer<typeof DemoFeedState>

function initialDemoFeedState(): DemoFeedStateType {
  return {
    messageCount: 0,
    lastMessage: null,
    lastRecordedAt: null,
  }
}

/** Single-partition demo read model (`tags.demo === 'global'`). */
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
      subscriptionKeySelector: () => 'global',
      handler: async (input, ctx): Promise<DemoFeedStateType> => {
        try {
          const result = await ctx.query('DemoFeed.get', { demo: input.demo })
          return result.data as DemoFeedStateType
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('No DemoFeed found')) {
            return initialDemoFeedState()
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
