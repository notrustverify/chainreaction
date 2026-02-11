'use client'

import React, { FC, useState, useEffect } from 'react'

interface CountdownTimerProps {
  endTimestamp: bigint
}

function getUrgency(totalSeconds: number): { color: string; pulse: boolean } {
  if (totalSeconds <= 0) return { color: 'text-status-claimable', pulse: false }
  if (totalSeconds <= 10) return { color: 'text-countdown-urgent', pulse: true }
  if (totalSeconds <= 30) return { color: 'text-countdown-urgent', pulse: false }
  if (totalSeconds <= 60) return { color: 'text-countdown-warning', pulse: false }
  if (totalSeconds <= 300) return { color: 'text-countdown-warning', pulse: false }
  return { color: 'text-countdown-normal', pulse: false }
}

export const CountdownTimer: FC<CountdownTimerProps> = ({ endTimestamp }) => {
  const [remainingMs, setRemainingMs] = useState<number>(0)

  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const end = Number(endTimestamp)
      setRemainingMs(Math.max(0, end - now))
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endTimestamp])

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const { color, pulse } = getUrgency(totalSeconds)

  const timeDisplay = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted uppercase tracking-widest">Time Remaining</span>
      {remainingMs > 0 ? (
        <span className={`text-5xl font-bold tabular-nums transition-colors duration-500 ${color} ${pulse ? 'animate-pulse' : ''}`}>
          {timeDisplay}
        </span>
      ) : (
        <span className="text-2xl font-bold text-status-claimable uppercase">EXPIRED</span>
      )}
    </div>
  )
}
