import { createFeatureSlice } from '@tk-dcb/framework'
import { DemoSchemas } from './schemas'
import { DemoFeedProjection } from './demo-projection'

export const DemoFeatureSlice = createFeatureSlice({
  name: 'Demo',
  description: 'Smoke-test command + persistent projection',
  schemas: DemoSchemas,
  commandHandlers: {
    RecordDemoMessage: async (data, context) => {
      context.append({
        type: 'DemoMessageRecorded',
        data: { message: data.message.trim() },
        tags: { demo: 'global' },
      })
    },
  },
  projections: {
    DemoFeed: DemoFeedProjection,
  },
})
