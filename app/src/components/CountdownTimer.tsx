'use client'

import React, { FC, useState, useEffect } from 'react'

interface CountdownTimerProps {
  endTimestamp: bigint
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
  const isUrgent = totalSeconds <= 10 && totalSeconds > 0

  const timeDisplay = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-widest">Time Remaining</span>
      {remainingMs > 0 ? (
        <span className={`text-4xl font-bold tabular-nums transition-colors ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-900'}`}>
          {timeDisplay}
        </span>
      ) : (
        <span className="text-xl font-bold text-amber-500 uppercase">EXPIRED</span>
      )}
    </div>
  )
}
