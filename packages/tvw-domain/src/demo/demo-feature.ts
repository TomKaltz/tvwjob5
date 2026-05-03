import { createFeatureSlice } from '@tk-dcb/framework'
import { DemoSchemas } from './schemas'
import { DemoFeedProjection } from './demo-projection'

export const DemoFeatureSlice = createFeatureSlice({
  name: 'Demo',
  description: 'Smoke-test command + persistent projection',
  schemas: DemoSchemas,
  commandHandlers: {
    RecordDemoMessage: async (data, context) => {
      const demo = data.demo.trim()
      context.append({
        type: 'DemoMessageRecorded',
        data: { message: data.message.trim() },
        tags: { demo },
      })
    },
  },
  projections: {
    DemoFeed: DemoFeedProjection,
  },
})
