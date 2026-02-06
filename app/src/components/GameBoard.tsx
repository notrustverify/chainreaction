'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { FC } from 'react'
import { BigButton } from './BigButton'
import { CountdownTimer } from './CountdownTimer'
import { GameStats } from './GameStats'
import { TokenSelector } from './TokenSelector'
import { useWallet } from '@alephium/web3-react'
import { web3 } from '@alephium/web3'
import { useChainReaction } from '@/hooks/useChainReaction'
import { GameConfig } from '@/services/utils'
import { startChain, joinChain, endChain, incentivize, GameState } from '@/services/game.service'
import { TokenInfo, ALPH_TOKEN, fetchWalletTokens, findTokenById, formatTokenAmount } from '@/services/tokenList'

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
  const [durationHours, setDurationHours] = useState(1)
  const [multiplierPct, setMultiplierPct] = useState(10)
  const [baseEntry, setBaseEntry] = useState('0.1')
  const [incentiveAmount, setIncentiveAmount] = useState('1')
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(ALPH_TOKEN)
  const [tokenList, setTokenList] = useState<TokenInfo[]>([ALPH_TOKEN])

  useEffect(() => {
    if (account?.address) {
      fetchWalletTokens(account.address).then(setTokenList)
    } else {
      setTokenList([ALPH_TOKEN])
    }
  }, [account?.address])

  const uiState = deriveUIState(gameState, isLoading, error)

  const isLastPlayer = !ongoingTxId && account && gameState
    ? account.address === gameState.lastPlayer
    : false

  // Resolve the active game's token info
  const activeToken = useMemo(() => {
    if (!gameState?.tokenId) return ALPH_TOKEN
    return findTokenById(tokenList, gameState.tokenId) ?? ALPH_TOKEN
  }, [gameState?.tokenId, tokenList])

  const handleStartChain = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      const payment = BigInt(Math.floor(parseFloat(baseEntry) * 10 ** selectedToken.decimals))
      const durationMs = BigInt(durationHours) * 3600n * 1000n
      const multiplierBps = BigInt(multiplierPct) * 100n
      const result = await startChain(config.contractInstance, signer, payment, durationMs, multiplierBps, selectedToken.id)
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
      const result = await joinChain(config.contractInstance, signer, payment, gameState.tokenId)
      setOngoingTxId(result.txId)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleEndChain = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      const result = await endChain(config.contractInstance, signer, gameState?.tokenId ?? '')
      setOngoingTxId(result.txId)
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleIncentivize = async () => {
    if (!signer || !gameState) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      const amount = BigInt(Math.floor(parseFloat(incentiveAmount) * 10 ** activeToken.decimals))
      const result = await incentivize(config.contractInstance, signer, amount, gameState.tokenId)
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
            await refresh()
            setOngoingTxId(undefined)
            return
          }
        } catch { /* ignore polling errors */ }
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    poll()
    return () => { cancelled = true }
  }, [ongoingTxId, refresh])

  const fmt = (amount: bigint) => formatTokenAmount(amount, activeToken.decimals)

  const getButtonProps = () => {
    switch (uiState) {
      case 'loading':
        return { label: 'Loading...', onClick: undefined, disabled: true, variant: 'default' as const }
      case 'no-chain':
        return { label: 'Start Chain', onClick: handleStartChain, disabled: !!ongoingTxId, variant: 'start' as const }
      case 'active':
        return {
          label: isLastPlayer ? 'You\'re in the lead!' : `Play\n${fmt(gameState!.nextEntryPrice)} ${activeToken.symbol}`,
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
        <>
          <GameStats
            pot={gameState.pot}
            entryPrice={gameState.nextEntryPrice}
            lastPlayer={gameState.lastPlayer}
            chainId={gameState.chainId}
            multiplierBps={gameState.multiplierBps}
            currentUserAddress={ongoingTxId ? undefined : account?.address}
            tokenSymbol={activeToken.symbol}
            tokenDecimals={activeToken.decimals}
          />
          <details className="w-full max-w-sm">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-emerald-500 transition-colors text-center select-none">
              Boost the pot
            </summary>
            <div className="mt-3 flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="incentive" className="text-[11px] text-gray-400 uppercase tracking-wider">
                  Amount ({activeToken.symbol})
                </label>
                <input
                  id="incentive"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={incentiveAmount}
                  onChange={(e) => setIncentiveAmount(e.target.value)}
                  className="w-full px-3 py-2 text-center text-base rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              <button
                onClick={handleIncentivize}
                disabled={!!ongoingTxId || !incentiveAmount || parseFloat(incentiveAmount) <= 0}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </details>
        </>
      )}

      {uiState === 'no-chain' && (
        <>
          <p className="text-gray-400 text-center text-sm">No active chain. Be the first to start one!</p>
          <div className="w-full max-w-xs flex flex-col gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
            <TokenSelector
              tokens={tokenList}
              selected={selectedToken}
              onChange={setSelectedToken}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="base-entry" className="text-[11px] text-gray-400 uppercase tracking-wider">
                Entry price ({selectedToken.symbol})
              </label>
              <input
                id="base-entry"
                type="number"
                min={0.1}
                step={0.1}
                value={baseEntry}
                onChange={(e) => setBaseEntry(e.target.value)}
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
                max={3}
                value={durationHours}
                onChange={(e) => setDurationHours(Math.max(1, Math.min(3, Number(e.target.value))))}
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
                  max={100}
                  step={1}
                  value={multiplierPct}
                  onChange={(e) => setMultiplierPct(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-base font-bold text-emerald-600 min-w-[4ch] text-right">{multiplierPct}%</span>
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

      <details className="w-full max-w-sm mt-2">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-emerald-500 transition-colors text-center select-none">
          How to play
        </summary>
        <div className="mt-3 text-sm text-gray-500 space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p><span className="font-semibold text-gray-700">1. Start a chain</span> — Pick a token, set the entry price, countdown duration, and price increase. You become the first player.</p>
          <p><span className="font-semibold text-gray-700">2. Enter the chain</span> — Each new player pays a higher entry fee (previous price + the % increase). Every play resets the countdown.</p>
          <p><span className="font-semibold text-gray-700">3. The clock tightens</span> — The countdown shrinks with each player, making the game more intense as it goes on.</p>
          <p><span className="font-semibold text-gray-700">4. Last player wins</span> — When the timer runs out, the last person who joined wins the entire pot. Anyone can trigger the payout.</p>
          <p className="text-gray-400 text-xs pt-1">You can also boost the pot at any time to make the prize more attractive without resetting the timer.</p>
        </div>
      </details>

      <p className="text-xs text-gray-400 mt-4">
        Built by{' '}
        <a href="https://notrustverify.ch" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600 underline">
          No Trust Verify
        </a>
      </p>
    </div>
  )
}
