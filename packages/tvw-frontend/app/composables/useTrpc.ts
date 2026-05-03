import type { TvwDomainRouter } from 'tvw-domain'
import type { createTRPCClient } from '@trpc/client'

export type TrpcClient = ReturnType<typeof createTRPCClient<TvwDomainRouter>>

export function useTrpc(): TrpcClient {
  return useNuxtApp().$trpc as unknown as TrpcClient
}
