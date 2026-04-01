export default defineEventHandler(async (event) => {
  const upgradeHeader = getHeader(event, 'upgrade')

  if (upgradeHeader?.toLowerCase() === 'websocket') {
    throw createError({
      statusCode: 426,
      statusMessage:
        'WebSocket upgrade not available. Ensure the tRPC WebSocket plugin attached to the server.',
    })
  }

  return {
    endpoint: '/ws',
    protocol: 'websocket',
    message: 'Use a WebSocket client to connect to /ws',
  }
})
