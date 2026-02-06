'use client'

import React, { useEffect, useState } from 'react'
import { FC } from 'react'
import { BigButton } from './BigButton'
import { CountdownTimer } from './CountdownTimer'
import { GameStats } from './GameStats'
import { useWallet } from '@alephium/web3-react'
import { web3 } from '@alephium/web3'
import { useChainReaction } from '@/hooks/useChainReaction'
import { GameConfig } from '@/services/utils'
import { startChain, joinChain, endChain, formatAlph, GameState } from '@/services/game.service'

type UIState = 'loading' | 'no-chain' | 'active' | 'claimable' | 'error'

function deriveUIState(
  gameState: GameState | null,
  isLoading: boolean,
  error: string | null
): UIState {
  if (isLoading) return 'loading'
  if (error) return 'error'
  if (!gameState || !gameState.isActive) return 'no-chain'
  if (gameState.canEnd || Date.now() >= Number(gameState.endTimestamp)) return 'claimable'
  return 'active'
}

export const GameBoard: FC<{ config: GameConfig; onConnectRequest: () => void }> = ({ config, onConnectRequest }) => {
  const { signer, account } = useWallet()
  const { gameState, isLoading, error, refresh } = useChainReaction(config.contractInstance)
  const [ongoingTxId, setOngoingTxId] = useState<string>()
  const [txError, setTxError] = useState<string>()
  const [durationHours, setDurationHours] = useState(2)
  const [multiplierPct, setMultiplierPct] = useState(10)
  const [baseEntryAlph, setBaseEntryAlph] = useState('0.1')

  const uiState = deriveUIState(gameState, isLoading, error)

  const isLastPlayer = account && gameState
    ? account.address === gameState.lastPlayer
    : false

  const handleStartChain = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      const payment = BigInt(Math.floor(parseFloat(baseEntryAlph) * 1e18))
      const durationMs = BigInt(durationHours) * 3600n * 1000n
      const multiplierBps = BigInt(multiplierPct) * 100n
      const result = await startChain(config.contractInstance, signer, payment, durationMs, multiplierBps)
      setOngoingTxId(result.txId)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleJoinChain = async () => {
    if (!signer) { onConnectRequest(); return }
    if (!gameState) return
    setTxError(undefined)
    try {
      const payment = gameState.nextEntryPrice
      const result = await joinChain(config.contractInstance, signer, payment)
      setOngoingTxId(result.txId)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleEndChain = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      const result = await endChain(config.contractInstance, signer)
      setOngoingTxId(result.txId)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  useEffect(() => {
    if (!ongoingTxId) return
    const provider = web3.getCurrentNodeProvider()
    let cancelled = false

    const poll = async () => {
      while (!cancelled) {
        try {
          const result = await provider.transactions.getTransactionsStatus({ txId: ongoingTxId })
          if (!cancelled && result.type === 'Confirmed') {
            setOngoingTxId(undefined)
            await refresh()
            return
          }
        } catch { /* ignore polling errors */ }
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    poll()
    return () => { cancelled = true }
  }, [ongoingTxId, refresh])

  const getButtonProps = () => {
    switch (uiState) {
      case 'loading':
        return { label: 'Loading...', onClick: undefined, disabled: true, variant: 'default' as const }
      case 'no-chain':
        return { label: 'Start Chain', onClick: handleStartChain, disabled: !!ongoingTxId, variant: 'start' as const }
      case 'active':
        return {
          label: isLastPlayer ? 'Waiting...' : `Join\n${formatAlph(gameState!.nextEntryPrice)} ALPH`,
          onClick: isLastPlayer ? undefined : handleJoinChain,
          disabled: !!ongoingTxId || !!isLastPlayer,
          variant: 'join' as const,
        }
      case 'claimable':
        return { label: 'Claim Prize!', onClick: handleEndChain, disabled: !!ongoingTxId, variant: 'claim' as const }
      case 'error':
        return { label: 'Retry', onClick: () => { refresh() }, disabled: false, variant: 'default' as const }
    }
  }

  const buttonProps = getButtonProps()

  return (
    <div className="flex flex-col items-center w-full max-w-md px-4 py-8 gap-5">
      {txError && (
        <p className="w-full text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {txError}
        </p>
      )}

      {gameState && uiState === 'active' && (
        <CountdownTimer endTimestamp={gameState.endTimestamp} />
      )}

      {gameState && uiState === 'claimable' && (
        <p className="text-lg font-bold text-amber-500 text-center animate-pulse">
          {isLastPlayer ? 'You won! Claim your prize!' : 'Chain ended! Anyone can trigger the payout.'}
        </p>
      )}

      <BigButton
        label={buttonProps.label}
        onClick={buttonProps.onClick}
        disabled={buttonProps.disabled}
        variant={buttonProps.variant}
        loading={!!ongoingTxId}
      />

      {gameState && gameState.isActive && (
        <GameStats
          pot={gameState.pot}
          entryPrice={gameState.nextEntryPrice}
          playerCount={gameState.playerCount}
          lastPlayer={gameState.lastPlayer}
          chainId={gameState.chainId}
          multiplierBps={gameState.multiplierBps}
          currentUserAddress={account?.address}
        />
      )}

      {uiState === 'no-chain' && (
        <>
          <p className="text-gray-400 text-center text-sm">No active chain. Be the first to start one!</p>
          <div className="w-full max-w-xs flex flex-col gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex flex-col gap-1">
              <label htmlFor="base-entry" className="text-[11px] text-gray-400 uppercase tracking-wider">
                Entry price (ALPH)
              </label>
              <input
                id="base-entry"
                type="number"
                min={0.1}
                step={0.1}
                value={baseEntryAlph}
                onChange={(e) => setBaseEntryAlph(e.target.value)}
                className="w-full px-3 py-2 text-center text-base rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="duration" className="text-[11px] text-gray-400 uppercase tracking-wider">
                Duration (hours)
              </label>
              <input
                id="duration"
                type="number"
                min={1}
                max={72}
                value={durationHours}
                onChange={(e) => setDurationHours(Math.max(1, Math.min(72, Number(e.target.value))))}
                className="w-full px-3 py-2 text-center text-base rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="multiplier" className="text-[11px] text-gray-400 uppercase tracking-wider">
                Price increase (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="multiplier"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={multiplierPct}
                  onChange={(e) => setMultiplierPct(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-base font-bold text-emerald-600 min-w-[3ch] text-right">{multiplierPct}%</span>
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="w-full text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Built by{' '}
        <a href="https://notrustverify.ch" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600 underline">
          No Trust Verify
        </a>
      </p>
    </div>
  )
}
