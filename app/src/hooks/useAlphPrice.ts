'use client'

import { useState, useEffect } from 'react'

const PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=alephium&vs_currencies=usd'
const REFRESH_MS = 60_000

export function useAlphPrice(): number | null {
  const [price, setPrice] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetch_ = async () => {
      try {
        const res = await fetch(PRICE_URL)
        if (!res.ok) return
        const data = await res.json()
        const usd = data?.alephium?.usd
        if (typeof usd === 'number' && !cancelled) setPrice(usd)
      } catch { /* ignore — price is best-effort */ }
    }

    fetch_()
    const id = setInterval(fetch_, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return price
}

/** Format attoALPH as a USD string, e.g. "$4.20" or "$1,234.56" */
export function formatUsd(attoAlph: bigint, alphUsdPrice: number): string {
  const alph = Number(attoAlph) / 1e18
  const usd = alph * alphUsdPrice
  if (usd < 0.01) return '<$0.01'
  return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
