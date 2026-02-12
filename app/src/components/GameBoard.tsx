'use client'

import React, { useEffect, useState, useRef } from 'react'
import { FC } from 'react'
import { BigButton } from './BigButton'
import { CountdownTimer } from './CountdownTimer'
import { GameStats } from './GameStats'
import { TokenSelector } from './TokenSelector'
import { PriceChart } from './PriceChart'
import { useWallet } from '@alephium/web3-react'
import { web3 } from '@alephium/web3'
import { useChainReaction } from '@/hooks/useChainReaction'
import { useEmbeddedWallet } from '@/embed/EmbeddedWalletContext'
import {
  buildStartChainTxParams,
  buildJoinChainTxParams,
  buildEndChainTxParams,
  buildIncentivizeTxParams,
} from '@/embed/buildTxParams'
import { GameContractInstance, startChain, joinChain, endChain, incentivize, GameState, normalizeAddress } from '@/services/game.service'
import { TokenInfo, ALPH_TOKEN, fetchWalletTokens, fetchTokenBalance, resolveTokenInfo, formatTokenAmount } from '@/services/tokenList'
import { ActivityFeed } from './ActivityFeed'

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

export const GameBoard: FC<{
  contractInstance: GameContractInstance
  onConnectRequest: () => void
  onBrowseGames?: () => void
  tokenIdsFromQuery?: string[] | null
  isV1?: boolean
}> = ({ contractInstance, onConnectRequest, onBrowseGames, tokenIdsFromQuery, isV1 = false }) => {
  const { signer, account: walletAccount } = useWallet()
  const { address: embeddedAddress, publicKey: embeddedPublicKey, isEmbeddedWallet, requestParentSignTxParams } = useEmbeddedWallet()
  const account = isEmbeddedWallet && embeddedAddress ? { address: embeddedAddress } : walletAccount
  const { gameState, isLoading, error, refresh, players } = useChainReaction(contractInstance)
  const [ongoingTxId, setOngoingTxId] = useState<string>()
  const [txError, setTxError] = useState<string>()
  const [durationHours, setDurationHours] = useState(1)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [multiplierPct, setMultiplierPct] = useState(5)
  const [burnPct, setBurnPct] = useState(5)
  const [baseEntry, setBaseEntry] = useState('0.1')
  const [incentiveAmount, setIncentiveAmount] = useState('1')
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(ALPH_TOKEN)
  const [tokenList, setTokenList] = useState<TokenInfo[]>([ALPH_TOKEN])
  const [tokenListFromQuery, setTokenListFromQuery] = useState(false)
  const [userBalance, setUserBalance] = useState<bigint | null>(null)
  const [copiedShare, setCopiedShare] = useState<'embed' | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const wasLastPlayerRef = useRef(false)
  const dingRef = useRef<HTMLAudioElement | null>(null)
  const notified5minRef = useRef(false)
  const notified1minRef = useRef(false)

  useEffect(() => {
    if (!tokenIdsFromQuery || tokenIdsFromQuery.length === 0) {
      setTokenListFromQuery(false)
      return
    }
    let cancelled = false
    Promise.all(tokenIdsFromQuery.map(id => resolveTokenInfo(id)))
      .then(resolved => {
        if (cancelled) return
        const list = resolved.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i)
        setTokenList(list)
        setTokenListFromQuery(true)
        if (list.length === 1) setSelectedToken(list[0])
      })
      .catch(() => {
        if (!cancelled) setTokenListFromQuery(false)
      })
    return () => { cancelled = true }
  }, [tokenIdsFromQuery?.join(',')])

  useEffect(() => {
    if (tokenIdsFromQuery != null && tokenIdsFromQuery.length > 0) return
    if (account?.address) {
      fetchWalletTokens(account.address).then(tokens => {
        setTokenList(tokens)
        setTokenListFromQuery(false)
      })
    } else {
      setTokenList([ALPH_TOKEN])
      setTokenListFromQuery(false)
    }
  }, [account?.address, tokenIdsFromQuery])

  useEffect(() => {
    if (account?.address && gameState?.tokenId && gameState.isActive) {
      fetchTokenBalance(account.address, gameState.tokenId).then(setUserBalance)
    } else {
      setUserBalance(null)
    }
  }, [account?.address, gameState?.tokenId, gameState?.isActive, gameState?.nextEntryPrice])

  const uiState = deriveUIState(gameState, isLoading, error)

  const isLastPlayer = !ongoingTxId && account && gameState
    ? normalizeAddress(account.address) === normalizeAddress(gameState.lastPlayer)
    : false

  const notify = (title: string, body: string) => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      }
    } catch (e) {
      console.warn('Notification failed:', e)
    }
  }

  useEffect(() => {
    if (wasLastPlayerRef.current && !isLastPlayer && soundEnabled) {
      if (dingRef.current) {
        dingRef.current.currentTime = 0
        dingRef.current.play().catch(() => {})
      }
      notify('You\'ve been overtaken!', 'Someone just took the lead in Chain Reaction. Play now to reclaim it!')
    }
    wasLastPlayerRef.current = isLastPlayer
  }, [isLastPlayer, soundEnabled])

  useEffect(() => {
    if (!soundEnabled || !gameState?.isActive) {
      notified5minRef.current = false
      notified1minRef.current = false
      return
    }
    const check = () => {
      const remaining = Number(gameState.endTimestamp) - Date.now()
      if (remaining <= 5 * 60 * 1000 && !notified5minRef.current) {
        notified5minRef.current = true
        notify('5 minutes left!', 'Chain Reaction is ending soon. Make your move!')
      }
      if (remaining <= 60 * 1000 && remaining > 0 && !notified1minRef.current) {
        notified1minRef.current = true
        notify('1 minute left!', 'Chain Reaction is about to end! Last chance to play!')
      }
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [soundEnabled, gameState?.isActive, gameState?.endTimestamp])

  const hasEnoughBalance = userBalance !== null && gameState
    ? userBalance >= gameState.nextEntryPrice
    : true

  // Resolve the active game's token info from the full token list (not just wallet)
  const [activeToken, setActiveToken] = useState<TokenInfo>(ALPH_TOKEN)
  useEffect(() => {
    if (!gameState?.tokenId) {
      setActiveToken(ALPH_TOKEN)
      return
    }
    resolveTokenInfo(gameState.tokenId).then(setActiveToken)
  }, [gameState?.tokenId])

  const handleStartChain = async () => {
    const canUseEmbedded = isEmbeddedWallet && embeddedAddress && embeddedPublicKey
    if (!signer && !canUseEmbedded) { onConnectRequest(); return }
    setTxError(undefined)

    const totalMinutes = durationHours * 60 + durationMinutes
    if (totalMinutes < 1) {
      setTxError('Duration must be at least 1 minute')
      return
    }

    const payment = BigInt(Math.floor(parseFloat(baseEntry) * 10 ** selectedToken.decimals))
    const durationMs = (BigInt(durationHours) * 3600n + BigInt(durationMinutes) * 60n) * 1000n
    const multiplierBps = BigInt(multiplierPct) * 100n
    const burnRate = BigInt(burnPct) * 100n

    try {
      if (canUseEmbedded) {
        const txParams = await buildStartChainTxParams(
          embeddedAddress!,
          embeddedPublicKey!,
          contractInstance,
          payment,
          durationMs,
          multiplierBps,
          selectedToken.id,
          burnRate
        )
        const result = await requestParentSignTxParams(txParams)
        setOngoingTxId(result.txId)
      } else {
        const result = await startChain(contractInstance, signer!, payment, durationMs, multiplierBps, selectedToken.id, burnRate)
        setOngoingTxId(result.txId)
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleJoinChain = async () => {
    const canUseEmbedded = isEmbeddedWallet && embeddedAddress && embeddedPublicKey
    if (!signer && !canUseEmbedded) { onConnectRequest(); return }
    if (!gameState) return
    setTxError(undefined)
    try {
      const payment = gameState.nextEntryPrice
      if (canUseEmbedded) {
        const txParams = await buildJoinChainTxParams(embeddedAddress!, embeddedPublicKey!, contractInstance, payment, gameState.tokenId)
        const result = await requestParentSignTxParams(txParams)
        setOngoingTxId(result.txId)
      } else {
        const result = await joinChain(contractInstance, signer!, payment, gameState.tokenId)
        setOngoingTxId(result.txId)
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleEndChain = async () => {
    const canUseEmbedded = isEmbeddedWallet && embeddedAddress && embeddedPublicKey
    if (!signer && !canUseEmbedded) { onConnectRequest(); return }
    setTxError(undefined)
    try {
      if (canUseEmbedded) {
        const txParams = await buildEndChainTxParams(embeddedAddress!, embeddedPublicKey!, contractInstance, gameState?.tokenId ?? '')
        const result = await requestParentSignTxParams(txParams)
        setOngoingTxId(result.txId)
      } else {
        const result = await endChain(contractInstance, signer!, gameState?.tokenId ?? '')
        setOngoingTxId(result.txId)
      }
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    }
  }

  const handleIncentivize = async () => {
    const canUseEmbedded = isEmbeddedWallet && embeddedAddress && embeddedPublicKey
    if ((!signer && !canUseEmbedded) || !gameState) { onConnectRequest(); return }
    setTxError(undefined)
    const amount = BigInt(Math.floor(parseFloat(incentiveAmount) * 10 ** activeToken.decimals))
    try {
      if (canUseEmbedded) {
        const txParams = await buildIncentivizeTxParams(embeddedAddress!, embeddedPublicKey!, contractInstance, amount, gameState.tokenId)
        const result = await requestParentSignTxParams(txParams)
        setOngoingTxId(result.txId)
      } else {
        const result = await incentivize(contractInstance, signer!, amount, gameState.tokenId)
        setOngoingTxId(result.txId)
      }
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
      case 'active': {
        const canPlay = !isLastPlayer && hasEnoughBalance
        let label = `Play\n${fmt(gameState!.nextEntryPrice)} ${activeToken.symbol}`
        if (isLastPlayer) label = 'You\'re in the lead!'
        else if (!hasEnoughBalance) label = `Not enough ${activeToken.symbol}`
        return {
          label,
          onClick: canPlay ? handleJoinChain : undefined,
          disabled: !!ongoingTxId || !canPlay,
          variant: 'join' as const,
        }
      }
      case 'claimable':
        return { label: 'Claim Prize!', onClick: handleEndChain, disabled: !!ongoingTxId, variant: 'claim' as const }
      case 'error':
        return { label: 'Retry', onClick: () => { refresh() }, disabled: false, variant: 'default' as const }
    }
  }

  const buttonProps = getButtonProps()

  return (
    <div className="flex flex-col items-center w-full px-4 py-8 gap-5">
      {txError && (
        <p className="w-full max-w-lg text-center text-sm text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-xl px-4 py-3 break-all line-clamp-3">
          {txError}
        </p>
      )}

      {gameState && gameState.isActive && (
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 items-center lg:items-start">
          {/* Left: game controls */}
          <div className="flex-1 flex flex-col items-center gap-5 min-w-0">
            {uiState === 'active' && (
              <>
                <CountdownTimer endTimestamp={gameState.endTimestamp} />
                <p className="text-xs text-muted -mt-3">
                  Next play resets to{' '}
                  {(() => {
                    const nextCount = gameState.playerCount + 1n
                    const decrease = nextCount * gameState.durationDecreaseMs
                    const next = gameState.durationMs > decrease
                      ? gameState.durationMs - decrease
                      : gameState.minDuration
                    const clamped = next < gameState.minDuration ? gameState.minDuration : next
                    const totalSec = Math.ceil(Number(clamped) / 1000)
                    const h = Math.floor(totalSec / 3600)
                    const m = Math.floor((totalSec % 3600) / 60)
                    const s = totalSec % 60
                    return h > 0
                      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                  })()}
                </p>
              </>
            )}

            {uiState === 'claimable' && (
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

            <button
              onClick={async () => {
                const enabling = !soundEnabled
                setSoundEnabled(enabling)
                if (enabling) {
                  if (!dingRef.current) dingRef.current = new Audio('/ding.mp3')
                  dingRef.current.play().catch(() => {})
                  if (typeof Notification !== 'undefined') {
                    let permission = Notification.permission
                    if (permission === 'default') {
                      permission = await Notification.requestPermission()
                    }
                    if (permission === 'granted') {
                      new Notification('Notifications enabled', { body: 'You\'ll be notified when overtaken or when time is running out.', icon: '/favicon.ico' })
                    }
                  }
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-colors -mt-2 ${
                soundEnabled
                  ? 'bg-notification-on-bg border-notification-on-border text-notification-on-text'
                  : 'bg-notification-off-bg border-notification-off-border text-notification-off-text hover:border-notification-off-hover-border hover:text-notification-off-hover-text'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${soundEnabled ? 'bg-notification-on-dot' : 'bg-notification-off-dot'}`} />
              {soundEnabled ? 'Notify when overtaken: on' : 'Notify when overtaken: off'}
            </button>

            <GameStats
              pot={gameState.pot}
              boostAmount={gameState.boostAmount}
              entryPrice={gameState.nextEntryPrice}
              lastPlayer={gameState.lastPlayer}
              playerCount={gameState.playerCount}
              multiplierBps={gameState.multiplierBps}
              burnedAmount={gameState.burnedAmount}
              burnBps={gameState.burnBps}
              currentUserAddress={ongoingTxId ? undefined : account?.address}
              tokenSymbol={activeToken.symbol}
              tokenDecimals={activeToken.decimals}
            />

            {onBrowseGames && (
              <button
                onClick={onBrowseGames}
                className="px-5 py-2.5 text-sm font-medium rounded-xl border border-card-border text-muted hover:border-primary hover:text-primary transition-colors flex items-center gap-2"
              >
                Browse all games
                <span className="text-lg leading-none">&darr;</span>
              </button>
            )}

            <details className="w-full max-w-sm">
              <summary className="text-sm text-muted cursor-pointer hover:text-primary transition-colors text-center select-none">
                Price curve
              </summary>
              <div className="mt-3">
                <PriceChart
                  baseEntry={gameState.baseEntry}
                  multiplierBps={gameState.multiplierBps}
                  playerCount={gameState.playerCount}
                  tokenSymbol={activeToken.symbol}
                  tokenDecimals={activeToken.decimals}
                  players={players}
                />
              </div>
            </details>
            <details className="w-full max-w-sm">
              <summary className="text-sm text-muted cursor-pointer hover:text-primary transition-colors text-center select-none">
                Boost the pot
              </summary>
              <div className="mt-3 flex gap-2 items-end">
                <div className="flex-1 flex flex-col gap-1">
                  <label htmlFor="incentive" className="text-[11px] text-label uppercase tracking-wider">
                    Amount ({activeToken.symbol})
                  </label>
                  <input
                    id="incentive"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={incentiveAmount}
                    onChange={(e) => setIncentiveAmount(e.target.value)}
                    className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring"
                  />
                </div>
                <button
                  onClick={handleIncentivize}
                  disabled={!!ongoingTxId || !incentiveAmount || parseFloat(incentiveAmount) <= 0}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </details>
          </div>

          {/* Right: activity feed */}
          <div className="w-full lg:w-72 lg:sticky lg:top-4 rounded-2xl border border-card-border bg-card-bg overflow-hidden lg:max-h-[calc(100vh-6rem)]">
            <ActivityFeed
              players={players}
              baseEntry={gameState.baseEntry}
              multiplierBps={gameState.multiplierBps}
              tokenSymbol={activeToken.symbol}
              tokenDecimals={activeToken.decimals}
              currentUserAddress={account?.address}
              playerCount={gameState.playerCount}
            />
          </div>
        </div>
      )}

      {(uiState === 'loading' || uiState === 'no-chain' || uiState === 'error') && (
        <BigButton
          label={buttonProps.label}
          onClick={buttonProps.onClick}
          disabled={buttonProps.disabled}
          variant={buttonProps.variant}
          loading={!!ongoingTxId}
        />
      )}

      {uiState === 'no-chain' && (
        <>
          <p className="text-muted text-center text-sm">No active chain. Be the first to start one!</p>
          <div className="w-full max-w-2xl flex flex-col md:flex-row gap-5 md:items-stretch items-center justify-center">
          <div className="w-full max-w-xs flex flex-col gap-4 p-5 bg-stat-card-bg rounded-2xl border border-card-border">
            <TokenSelector
              tokens={tokenList}
              selected={selectedToken}
              onChange={setSelectedToken}
              disabled={tokenListFromQuery && tokenList.length === 1}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="base-entry" className="text-[11px] text-label uppercase tracking-wider">
                Entry price ({selectedToken.symbol})
              </label>
              <input
                id="base-entry"
                type="number"
                min={0.1}
                step={0.1}
                value={baseEntry}
                onChange={(e) => setBaseEntry(e.target.value)}
                className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-label uppercase tracking-wider">
                Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="hours" className="text-[10px] text-label text-center">
                    Hours
                  </label>
                  <input
                    id="hours"
                    type="number"
                    min={0}
                    max={3}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.max(0, Math.min(3, Number(e.target.value))))}
                    className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="minutes" className="text-[10px] text-label text-center">
                    Minutes
                  </label>
                  <input
                    id="minutes"
                    type="number"
                    min={0}
                    max={59}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="multiplier" className="text-[11px] text-label uppercase tracking-wider">
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
                  className="flex-1 accent-primary"
                />
                <span className="text-base font-bold text-primary min-w-[4ch] text-right">{multiplierPct}%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="burn-rate" className="text-[11px] text-label uppercase tracking-wider">
                Burn rate (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="burn-rate"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={burnPct}
                  onChange={(e) => setBurnPct(Number(e.target.value))}
                  className="flex-1 burn-slider"
                />
                <span className="text-base font-bold text-burn-value min-w-[4ch] text-right">{burnPct}%</span>
              </div>
            </div>
          </div>
          {parseFloat(baseEntry) > 0 && (
            <div className="w-full flex-1 min-w-0 flex flex-col">
              <p className="text-[11px] text-label uppercase tracking-wider mb-2">Price curve preview</p>
              <PriceChart
                baseEntry={BigInt(Math.floor(parseFloat(baseEntry) * 10 ** selectedToken.decimals))}
                multiplierBps={BigInt(multiplierPct) * 100n}
                playerCount={0n}
                tokenSymbol={selectedToken.symbol}
                tokenDecimals={selectedToken.decimals}
                preview
              />
            </div>
          )}
          </div>
        </>
      )}

      {error && (
        <p className="w-full text-center text-sm text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={() => {
            const text = gameState?.isActive
              ? `Chain Reaction on @alephium — pot is ${fmt(gameState.pot + gameState.boostAmount)} \$${activeToken.symbol} and growing! Be the last player standing.`
              : 'Chain Reaction on @alephium — be the last player standing and win the pot!'
            const url = window.location.href
            window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
          }}
          className="text-xs text-muted hover:text-primary transition-colors"
        >
          Share on X
        </button>
        <span className="text-muted">|</span>
        <button
          onClick={() => {
            const code = `<iframe src="${window.location.href}" width="450" height="700" frameborder="0" style="border-radius:16px;"></iframe>`
            navigator.clipboard.writeText(code)
            setCopiedShare('embed')
            setTimeout(() => setCopiedShare(null), 2000)
          }}
          className="text-xs text-muted hover:text-primary transition-colors"
        >
          {copiedShare === 'embed' ? 'Copied!' : 'Embed'}
        </button>
      </div>


    </div>
  )
}
