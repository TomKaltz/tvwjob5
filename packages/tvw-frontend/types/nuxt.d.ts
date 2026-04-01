import type { TvwDomainRouter } from 'tvw-domain'
import type { createTRPCClient } from '@trpc/client'

type TrpcClient = ReturnType<typeof createTRPCClient<TvwDomainRouter>>

declare module '#app' {
  interface NuxtApp {
    $trpc: TrpcClient
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $trpc: TrpcClient
  }
}

export {}
