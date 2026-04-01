export type WsConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

export function useWebSocketConnection() {
  const state = useState<WsConnectionState>('trpc-ws-connection', () => 'idle')
  const isConnected = computed(() => state.value === 'connected')
  const isDisconnected = computed(() => state.value === 'disconnected')
  const showSpinner = computed(
    () => state.value === 'connecting' || state.value === 'idle'
  )
  return { isConnected, showSpinner, isDisconnected, state }
}
