'use client'

import React, { useRef, useCallback } from 'react'
import { GameBoard } from './GameBoard'
import { NavBar } from './NavBar'
import { gameConfig } from '@/services/utils'

export default function Home() {
  const connectRef = useRef<HTMLDivElement>(null)

  const openConnect = useCallback(() => {
    const btn = connectRef.current?.querySelector('button')
    btn?.click()
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center bg-white">
      <NavBar ref={connectRef} />
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        <GameBoard config={gameConfig} onConnectRequest={openConnect} />
      </main>
    </div>
  )
}
