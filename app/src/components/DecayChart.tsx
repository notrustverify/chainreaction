'use client'

import { FC, useMemo, useState, useEffect } from 'react'
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

function getThemeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value || fallback
}

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

interface DecayChartProps {
  currentEntry: bigint
  baseEntry: bigint
  multiplierBps: bigint
  lastEntryTimestamp: bigint
  decayPeriodMs: bigint
  tokenSymbol: string
  tokenDecimals: number
}

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}m`
  return `${s}s`
}

export const DecayChart: FC<DecayChartProps> = ({
  currentEntry, baseEntry, multiplierBps,
  lastEntryTimestamp, decayPeriodMs, tokenSymbol, tokenDecimals,
}) => {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const chartData = useMemo(() => {
    const colors = {
      line: getThemeColor('--color-chart-current', '#10b981'),
      tick: getThemeColor('--color-chart-tick', '#9ca3af'),
      current: getThemeColor('--color-chart-current', '#10b981'),
      base: getThemeColor('--color-chart-past', '#9ca3af'),
    }

    const decayMs = Number(decayPeriodMs)
    const elapsed = now - Number(lastEntryTimestamp)
    const remaining = Math.max(0, decayMs - elapsed)
    const excess = currentEntry - baseEntry

    // Generate points from now until full decay
    const steps = 40
    const stepMs = remaining > 0 ? remaining / steps : decayMs / steps
    const points: { time: number; price: number }[] = []

    for (let i = 0; i <= steps; i++) {
      const t = elapsed + i * stepMs
      let effective: bigint
      if (t >= decayMs) {
        effective = baseEntry
      } else {
        effective = currentEntry - (excess * BigInt(Math.round(t)) / decayPeriodMs)
        if (effective < baseEntry) effective = baseEntry
      }
      const nextEntry = effective + (effective * multiplierBps / 10000n)
      points.push({
        time: i * stepMs,
        price: Number(nextEntry) / 10 ** tokenDecimals,
      })
    }

    // Labels: show "Now", midpoint, and end
    const labels = points.map((p, i) => {
      if (i === 0) return 'Now'
      if (i === steps) return formatTime(remaining)
      if (i === Math.round(steps / 2)) return formatTime(remaining / 2)
      return ''
    })

    const values = points.map(p => p.price)

    // Highlight the current position (first point)
    const pointColors = points.map((_, i) =>
      i === 0 ? colors.current : 'transparent'
    )
    const pointRadii = points.map((_, i) =>
      i === 0 ? 6 : 0
    )

    return {
      labels,
      datasets: [
        {
          label: 'Next Entry Price',
          data: values,
          borderColor: colors.line,
          backgroundColor: withAlpha(colors.line, 0.08),
          pointBackgroundColor: pointColors,
          pointRadius: pointRadii,
          pointHoverRadius: 4,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
        },
      ],
    }
  }, [currentEntry, baseEntry, multiplierBps, lastEntryTimestamp, decayPeriodMs, tokenDecimals, now])

  const options = useMemo(() => {
    const colors = {
      tick: getThemeColor('--color-chart-tick', '#9ca3af'),
    }

    const formatTick = (value: number | string) => {
      const num = typeof value === 'string' ? parseFloat(value) : value
      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
      return num.toFixed(2)
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
            maxRotation: 0,
            autoSkip: false,
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
  }, [tokenDecimals, tokenSymbol])

  return (
    <div className="w-full flex-1 min-h-[300px]">
      <Line data={chartData} options={options} />
    </div>
  )
}
