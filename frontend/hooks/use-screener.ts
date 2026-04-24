'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchTickerList, runScan } from '@/services/screener.service'
import type { ScanRequest, TickerListResponse } from '@/types/screener'

// ---------------------------------------------------------------------------
// useTickerList
// ---------------------------------------------------------------------------

export function useTickerList(params?: { q?: string; sector?: string }) {
  return useQuery<TickerListResponse>({
    queryKey: ['screener-tickers', params?.q ?? '', params?.sector ?? ''],
    queryFn: () => fetchTickerList(params),
    staleTime: 1000 * 60 * 60, // 1 hour — sector data is static
    gcTime: 1000 * 60 * 60 * 2,
  })
}

// ---------------------------------------------------------------------------
// useScreenerScan
// ---------------------------------------------------------------------------

export function useScreenerScan() {
  return useMutation({
    mutationFn: (body: ScanRequest) => runScan(body),
  })
}
