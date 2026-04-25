'use client'

import React, { FC, useMemo } from 'react'

/**
 * Max number of bars we render before we switch to bucketed histogram mode.
 * Anything above this and individual bars become too thin to read.
 */
const MAX_BARS = 40

interface Bucket {
  label: string          // e.g. "1" or "21–25"
  from: number
  to: number
  count: number
  containsTarget: boolean
  containsYourPick: boolean
}

interface Props {
  picks: Array<{ number: bigint; player: string }>
  numberRangeMax: bigint
  target: bigint | null       // null when the game hasn't been drawn yet
  yourPick: bigint | null
}

export const RoomPicksChart: FC<Props> = ({ picks, numberRangeMax, target, yourPick }) => {
  const rangeMax = Number(numberRangeMax)
  const yourNum = yourPick === null ? null : Number(yourPick)
  const targetNum = target === null ? null : Number(target)

  const buckets = useMemo<Bucket[]>(() => {
    if (rangeMax <= 0) return []

    // One bar per number if the range is small enough, otherwise bucket it.
    const bucketSize = rangeMax <= MAX_BARS ? 1 : Math.ceil(rangeMax / MAX_BARS)
    const numBuckets = Math.ceil(rangeMax / bucketSize)
    const out: Bucket[] = []

    for (let i = 0; i < numBuckets; i++) {
      const from = i * bucketSize + 1
      const to = Math.min(from + bucketSize - 1, rangeMax)
      out.push({
        label: from === to ? `${from}` : `${from}–${to}`,
        from,
        to,
        count: 0,
        containsTarget: false,
        containsYourPick: false
      })
    }

    for (const p of picks) {
      const n = Number(p.number)
      if (n < 1 || n > rangeMax) continue
      const idx = Math.floor((n - 1) / bucketSize)
      if (idx < out.length) out[idx].count += 1
    }

    if (targetNum !== null && targetNum >= 1 && targetNum <= rangeMax) {
      const idx = Math.floor((targetNum - 1) / bucketSize)
      if (idx < out.length) out[idx].containsTarget = true
    }
    if (yourNum !== null && yourNum >= 1 && yourNum <= rangeMax) {
      const idx = Math.floor((yourNum - 1) / bucketSize)
      if (idx < out.length) out[idx].containsYourPick = true
    }

    return out
  }, [picks, rangeMax, targetNum, yourNum])

  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0)

  if (buckets.length === 0) return null

  // 5 evenly-spaced x-axis labels with clean values, positioned proportionally.
  // Always anchors to 1 and rangeMax; middle values are rounded to integers.
  const TICK_COUNT = 5
  const xTicks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const value = i === 0 ? 1
      : i === TICK_COUNT - 1 ? rangeMax
      : Math.round(1 + (i / (TICK_COUNT - 1)) * (rangeMax - 1))
    const pct = ((value - 1) / Math.max(rangeMax - 1, 1)) * 100
    return { value, pct }
  })

  return (
    <div className="flex flex-col gap-0">
      {/* bars */}
      <div className="flex items-end gap-0.5 h-24 w-full">
        {buckets.map((b, i) => {
          const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0
          const isEmpty = b.count === 0
          const barColor = b.containsTarget
            ? 'bg-status-claimable'
            : b.containsYourPick
              ? 'bg-status-success-text'
              : isEmpty
                ? 'bg-card-border'
                : 'bg-primary'
          const title = `${b.label}: ${b.count} pick${b.count === 1 ? '' : 's'}${
            b.containsTarget ? ' · target' : ''
          }${b.containsYourPick ? ' · your pick' : ''}`
          return (
            <div
              key={i}
              className="flex-1 min-w-[2px] h-full flex items-end"
              title={title}
            >
              <div
                className={`relative w-full ${barColor} rounded-t transition-colors flex items-center justify-center`}
                style={{ height: isEmpty ? '1px' : `max(${heightPct}%, 18px)` }}
              >
                {b.count > 0 && (
                  <span className="text-[10px] font-bold text-white tabular-nums leading-none">
                    {b.count}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* proportional x-axis — labels sit at their true position in the range */}
      <div className="relative h-4 mt-0.5 w-full">
        {xTicks.map(({ value, pct }) => (
          <span
            key={value}
            className="absolute text-[9px] text-muted tabular-nums -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            {value}
          </span>
        ))}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted mt-0.5">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-primary inline-block" />
          picks
        </span>
        {yourNum !== null && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-status-success-text inline-block" />
            your pick
          </span>
        )}
        {targetNum !== null && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-status-claimable inline-block" />
            target ({targetNum})
          </span>
        )}
      </div>
    </div>
  )
}
