'use client'

import { FC, useMemo, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { formatTokenAmount } from '@/services/tokenList'
import { PlayerEntry } from '@/hooks/useChainReaction'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

/** Read theme color from CSS variable (client-only). */
function getThemeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

/** Return rgba string with new alpha. Handles rgb(...) and rgba(...). */
function withAlpha(cssColor: string, alpha: number): string {
  const match = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/)
  if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`
  const hex = cssColor.match(/^#([0-9a-fA-F]{6})$/)
  if (hex) {
    const r = parseInt(hex[1].slice(0, 2), 16)
    const g = parseInt(hex[1].slice(2, 4), 16)
    const b = parseInt(hex[1].slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return cssColor
}

function getChartThemeColors() {
  return {
    past: getThemeColor('--color-chart-past', '#9ca3af'),
    future: getThemeColor('--color-chart-future', '#93c5fd'),
    current: getThemeColor('--color-chart-current', '#10b981'),
    milestone: getThemeColor('--color-chart-milestone', '#3b82f6'),
    tick: getThemeColor('--color-chart-tick', '#9ca3af'),
  }
}

interface PriceChartProps {
  baseEntry: bigint
  multiplierBps: bigint
  playerCount: bigint
  tokenSymbol: string
  tokenDecimals: number
  preview?: boolean
  players?: PlayerEntry[]
}

function computePrices(baseEntry: bigint, multiplierBps: bigint, count: number): bigint[] {
  const prices: bigint[] = [baseEntry]
  for (let i = 1; i < count; i++) {
    const prev = prices[i - 1]
    prices.push(prev + (prev * multiplierBps) / 10000n)
  }
  return prices
}

const PREVIEW_MILESTONES = new Set([1, 10, 20, 50, 100])

export const PriceChart: FC<PriceChartProps> = ({ baseEntry, multiplierBps, playerCount, tokenSymbol, tokenDecimals, preview, players }) => {
  const playerMapRef = useRef<Map<number, string>>(new Map())
  const startIdxRef = useRef(0)

  const chartData = useMemo(() => {
    const colors = getChartThemeColors()
    const pc = Number(playerCount)

    if (preview) {
      const totalPlayers = 100
      const allPrices = computePrices(baseEntry, multiplierBps, totalPlayers)

      const labels = allPrices.map((_, i) => {
        const num = i + 1
        return PREVIEW_MILESTONES.has(num) ? `#${num}` : ''
      })

      const values = allPrices.map(p => Number(p) / 10 ** tokenDecimals)

      return {
        labels,
        datasets: [
          {
            label: 'Price',
            data: values,
            borderColor: colors.future,
            borderDash: [4, 4],
            backgroundColor: withAlpha(colors.future, 0.08),
            pointBackgroundColor: allPrices.map((_, i) => PREVIEW_MILESTONES.has(i + 1) ? colors.milestone : 'transparent'),
            pointRadius: allPrices.map((_, i) => PREVIEW_MILESTONES.has(i + 1) ? 4 : 0),
            pointHoverRadius: 4,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      }
    }

    // Active game mode: 10 past + 40 future
    const totalPlayers = pc + 40
    const allPrices = computePrices(baseEntry, multiplierBps, totalPlayers)

    const pMap = new Map<number, string>()
    if (players) {
      for (const p of players) pMap.set(p.position, p.address)
    }
    playerMapRef.current = pMap

    const startIdx = Math.max(0, pc - 10)
    startIdxRef.current = startIdx
    const endIdx = Math.min(totalPlayers, pc + 40)
    const slice = allPrices.slice(startIdx, endIdx)

    const labels = slice.map((_, i) => `#${startIdx + i + 1}`)
    const nextLocalIdx = pc - startIdx

    const pastData = slice.map((p, i) => i <= nextLocalIdx ? Number(p) / 10 ** tokenDecimals : null)
    const futureData = slice.map((p, i) => i >= nextLocalIdx ? Number(p) / 10 ** tokenDecimals : null)

    const pointColors = slice.map((_, i) => {
      if (i === nextLocalIdx) return colors.current
      if (i < nextLocalIdx) return colors.past
      return colors.future
    })

    const pointRadii = slice.map((_, i) => i === nextLocalIdx ? 6 : 3)

    return {
      labels,
      datasets: [
        {
          label: 'Past',
          data: pastData,
          borderColor: colors.past,
          backgroundColor: withAlpha(colors.past, 0.1),
          pointBackgroundColor: pointColors,
          pointRadius: pointRadii,
          pointHoverRadius: 6,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: 'Future',
          data: futureData,
          borderColor: colors.future,
          borderDash: [4, 4],
          backgroundColor: withAlpha(colors.future, 0.08),
          pointBackgroundColor: pointColors,
          pointRadius: pointRadii,
          pointHoverRadius: 6,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          spanGaps: false,
        },
      ],
    }
  }, [baseEntry, multiplierBps, playerCount, tokenDecimals, preview, players])

  const options = useMemo(() => {
    const colors = getChartThemeColors()
    const formatTick = (value: number | string) => {
      const num = typeof value === 'string' ? parseFloat(value) : value
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
      return String(num)
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx: { raw: unknown }) => {
              const val = ctx.raw as number | null
              if (val == null) return ''
              const bigVal = BigInt(Math.round(val * 10 ** tokenDecimals))
              return `${formatTokenAmount(bigVal, tokenDecimals)} ${tokenSymbol}`
            },
            title: (items: { label: string }[]) => {
              const label = items[0]?.label
              const idx = (items[0] as { dataIndex?: number })?.dataIndex
              const pos = idx != null ? startIdxRef.current + idx + 1 : 0
              const addr = playerMapRef.current.get(pos)
              const playerLabel = label || (idx != null ? `#${idx + 1}` : '')
              if (addr) return `Player ${playerLabel} — ${addr.slice(0, 3)}...${addr.slice(-3)}`
              return `Player ${playerLabel}`
            },
          },
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 9 },
            color: colors.tick,
            maxRotation: preview ? 0 : 45,
            autoSkip: !preview,
            maxTicksLimit: preview ? undefined : 15,
          },
        },
        y: {
          grid: { color: withAlpha(colors.tick, 0.12) },
          ticks: {
            font: { size: 10 },
            color: colors.tick,
            callback: formatTick,
          },
        },
      },
    }
  }, [tokenDecimals, tokenSymbol, preview])

  return (
    <div className={preview ? 'w-full flex-1 min-h-[300px]' : 'w-full aspect-[2/1] min-h-[180px] max-h-[300px]'}>
      <Line data={chartData} options={options} />
    </div>
  )
}
