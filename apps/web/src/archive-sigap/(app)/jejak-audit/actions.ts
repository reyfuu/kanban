'use server'

import { apiFetch } from '@/lib/api'

export interface ChainResult {
  is_valid: boolean
  broken_at: string | null
  rows_checked: string
  verified_at: string
}

export async function verifyChain(): Promise<ChainResult> {
  return apiFetch<ChainResult>('/audit-logs/verify-chain', { method: 'POST' })
}
