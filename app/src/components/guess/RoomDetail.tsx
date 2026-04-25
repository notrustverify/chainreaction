'use client'

import React, { FC, useEffect, useState } from 'react'
import { useWallet } from '@alephium/web3-react'
import { GameRoom } from 'my-contracts'
import {
  joinRoom,
  claim,
  forceClaim,
  refund,
  resolveRandomness,
  expireRoom,
  destroyRoom,
  boostPot,
  pollTxConfirmed,
  formatAlph,
  roomStateLabel,
  RANDOMNESS_DELAY_MS,
  LOCKED_TIMEOUT_MS,
  FORCE_CLAIM_GRACE_MS,
  MAP_ENTRY_DEPOSIT,
  ROOM_STATE_OPEN,
  ROOM_STATE_LOCKED,
  ROOM_STATE_CLAIMABLE,
  ROOM_STATE_EXPIRED
} from '@/services/guess.service'
import { useGuessRoom } from '@/hooks/useGuessRoom'
import { useRoomPicks, bandPayout, distanceBand } from '@/hooks/useRoomPicks'
import { RoomPicksChart } from '@/components/guess/RoomPicksChart'
import { shortenAddress } from '@/services/game.service'
import { fetchTokenBalance, ALPH_TOKEN } from '@/services/tokenList'
import { getTxExplorerUrl } from '@/services/utils'

// Rough estimate of the gas + dust overhead on top of the entry fee for a
// joinRoom transaction. Gas fees on Alephium are typically a few mΞ of ALPH;
// 0.02 ALPH leaves comfortable headroom.
const JOIN_GAS_BUFFER = 20_000_000_000_000_000n // 0.02 ALPH

type TxStep = 'idle' | 'signing' | 'confirming'

function getRoomLink(contractAddress: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/guess?address=${contractAddress}`
}

interface Props {
  contractAddress: string
  onConnectRequest: () => void
  onClose: () => void
}

const BAND_RULES = [
  { label: 'Exact hit', multiplier: '2.0×' },
  { label: 'Top 5% range', multiplier: '1.5×' },
  { label: 'Top 20% range', multiplier: '1.2×' },
  { label: 'Outside range', multiplier: '0×' }
]

/** Human-friendly short countdown like "2d 3h", "45m 10s". */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export const RoomDetail: FC<Props> = ({ contractAddress, onConnectRequest, onClose }) => {
  const { signer, account } = useWallet()
  const player = account?.address ?? null
  const { info, playerPayout, playerNumber, hasJoined, isLoading, error, refresh } = useGuessRoom(contractAddress, player)
  const { picks } = useRoomPicks(contractAddress)

  const [txStep, setTxStep] = useState<TxStep>('idle')
  const [txError, setTxError] = useState<string>()
  const [numberInput, setNumberInput] = useState('')
  const [boostInput, setBoostInput] = useState('')
  const [showBoost, setShowBoost] = useState(false)
  const [txSuccess, setTxSuccess] = useState<string>()
  const [pendingTxId, setPendingTxId] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showWaterfall, setShowWaterfall] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [alphBalance, setAlphBalance] = useState<bigint | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!player) {
      setAlphBalance(null)
      return
    }
    let cancelled = false
    const load = async () => {
      const bal = await fetchTokenBalance(player, ALPH_TOKEN.id)
      if (!cancelled) setAlphBalance(bal)
    }
    load()
    const id = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [player, txStep])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getRoomLink(contractAddress))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const busy = txStep !== 'idle'
  const room = GameRoom.at(contractAddress)

  const doTx = async (action: () => Promise<{ txId: string }>, successMsg: string) => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    setTxSuccess(undefined)
    setPendingTxId(null)
    try {
      setTxStep('signing')
      const { txId } = await action()
      setPendingTxId(txId)
      setTxStep('confirming')
      await pollTxConfirmed(txId)
      setTxSuccess(successMsg)
      await refresh()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setTxStep('idle')
      setPendingTxId(null)
    }
  }

  const handleJoin = () => {
    if (!info) return
    const n = parseInt(numberInput)
    if (isNaN(n) || n < 1 || n > Number(info.numberRangeMax)) {
      setTxError(`Pick a number between 1 and ${info.numberRangeMax}`)
      return
    }
    doTx(
      () => joinRoom(room, signer!, BigInt(n), info.entryFee),
      `Joined with number ${n}!`
    )
  }

  const handleClaim = () =>
    doTx(() => claim(room, signer!), 'Claimed successfully!')

  const handleRefund = () =>
    doTx(() => refund(room, signer!), 'Refunded!')

  const handleResolve = () =>
    doTx(() => resolveRandomness(room, signer!), 'Randomness resolved!')

  const handleExpire = () =>
    doTx(() => expireRoom(room, signer!), 'Room marked as expired.')

  const handleDestroy = () =>
    doTx(() => destroyRoom(room, signer!), 'Room destroyed.')

  const handleForceClaim = (playerAddress: string) =>
    doTx(
      () => forceClaim(room, signer!, playerAddress),
      `Force-claimed ${shortenAddress(playerAddress)}'s entry.`
    )

  const handleBoost = () => {
    const ONE_ALPH = 1_000_000_000_000_000_000n
    const parsed = parseFloat(boostInput)
    if (isNaN(parsed) || parsed <= 0) { setTxError('Enter a valid boost amount in ALPH'); return }
    const attoAmount = BigInt(Math.floor(parsed * 1e9)) * 1_000_000_000n
    if (attoAmount < ONE_ALPH / 10n) { setTxError('Minimum boost is 0.1 ALPH'); return }
    doTx(
      () => boostPot(room, signer!, attoAmount),
      `Boosted the pot by ${boostInput} ALPH!`
    )
  }

  if (isLoading && !info) {
    return (
      <div className="w-full rounded-2xl border border-card-border bg-card-bg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-stat-card-bg rounded animate-pulse" />
          <button onClick={onClose} className="text-xs text-muted hover:text-muted-hover">Close</button>
        </div>
        <div className="h-32 bg-stat-card-bg rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="w-full rounded-2xl border border-card-border bg-card-bg p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-page-heading">Room</span>
          <button onClick={onClose} className="text-xs text-muted hover:text-muted-hover">Close</button>
        </div>
        <p className="text-sm text-notification-error-text">{error ?? 'Room not found'}</p>
      </div>
    )
  }

  const isExpired = info.state === ROOM_STATE_EXPIRED
  const isClaimable = info.state === ROOM_STATE_CLAIMABLE
  const isLocked = info.state === ROOM_STATE_LOCKED
  const isOpen = info.state === ROOM_STATE_OPEN
  const isCreator = player === info.creator

  // Earliest block timestamp at which resolveRandomness() will succeed on-chain.
  const resolveReadyAtMs = isLocked && info.lockedAt > 0n
    ? Number(info.lockedAt + RANDOMNESS_DELAY_MS)
    : 0
  const resolveCountdownMs = Math.max(0, resolveReadyAtMs - nowMs)
  const resolveReady = isLocked && resolveReadyAtMs > 0 && resolveCountdownMs === 0

  // Earliest block timestamp at which forceClaim() will succeed on-chain.
  // Only meaningful once the room is in a terminal state (CLAIMABLE/EXPIRED).
  const forceClaimReadyAtMs = (isClaimable || isExpired) && info.finalizedAt > 0n
    ? Number(info.finalizedAt + FORCE_CLAIM_GRACE_MS)
    : 0
  const forceClaimReady = forceClaimReadyAtMs > 0 && forceClaimReadyAtMs <= nowMs

  // Joining costs entryFee + 0.1 ALPH refundable map-entry deposit + gas.
  // The 0.1 ALPH is returned when the player claims or refunds.
  const neededToJoin = info.entryFee + MAP_ENTRY_DEPOSIT + JOIN_GAS_BUFFER
  const hasEnoughAlph = alphBalance === null ? true : alphBalance >= neededToJoin
  const balanceKnown = alphBalance !== null

  // Bonus returned when claiming: the freed 0.1 ALPH map-entry deposit.
  const CLAIM_DEPOSIT_BONUS = MAP_ENTRY_DEPOSIT
  const canJoin = isOpen && !hasJoined
  const canClaim = isClaimable && hasJoined

  // snapshotPot: the pot frozen at resolveRandomness time. Since every player
  // pays exactly entryFee and the room locks only at maxPlayers, this equals
  // entryFee × maxPlayers — no extra field fetch needed.
  const snapshotPot = info.entryFee * info.maxPlayers

  // Active winners: unclaimed players in a paying band.
  const activeWinners = isClaimable
    ? picks.filter(p => {
        if (p.status !== 'active') return false
        const d = p.number >= info.target ? p.number - info.target : info.target - p.number
        return distanceBand(d, info.numberRangeMax) !== 'miss'
      })
    : []
  const activeWinnersCount = activeWinners.length

  // Combined payout all active winners expect (from snapshotPot, which is fixed).
  const combinedWinnerPayout = activeWinners.reduce(
    (sum, p) => sum + bandPayout(p.number, info.target, info.numberRangeMax, snapshotPot, info.maxPlayers),
    0n
  )
  // Real contention: combined expected payouts exceed the remaining live pot.
  const hasRealContention = combinedWinnerPayout > info.pot

  const totalClaimPayout = canClaim ? playerPayout + CLAIM_DEPOSIT_BONUS : 0n
  const canRefund = isExpired && hasJoined
  const canResolve = isLocked
  // Matches `expireRoom()` on-chain guards:
  //   OPEN:   now >= expiresAt
  //   LOCKED: now >= lockedAt + LOCKED_TIMEOUT_MS  (24h emergency exit)
  const canExpire =
    (isOpen && BigInt(nowMs) >= info.expiresAt) ||
    (isLocked && info.lockedAt > 0n && BigInt(nowMs) >= info.lockedAt + LOCKED_TIMEOUT_MS)
  const canDestroy = (isClaimable || isExpired) && info.playerCount === 0n

  const expireMs = Number(info.expiresAt) - nowMs
  const expireLabel = expireMs > 0
    ? `${Math.floor(expireMs / 3_600_000)}h ${Math.floor((expireMs % 3_600_000) / 60_000)}m`
    : 'Expired'

  const resolveCountdownLabel = (() => {
    const totalSec = Math.ceil(resolveCountdownMs / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  })()

  return (
    <div className="w-full rounded-2xl border border-card-border bg-card-bg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-page-heading shrink-0">Room</span>
          <span className="text-xs text-muted font-mono truncate">{contractAddress.slice(0, 10)}…</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="text-xs text-muted hover:text-muted-hover transition-colors"
            title="Copy shareable link"
          >
            {copied ? '✓ Copied' : '🔗 Share'}
          </button>
          <button onClick={onClose} className="text-xs text-muted hover:text-muted-hover">
            Close
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">State</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">{roomStateLabel(info.state)}</p>
        </div>
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">Pot</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">{formatAlph(info.pot)} ALPH</p>
        </div>
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">Entry Fee</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">{formatAlph(info.entryFee)} ALPH</p>
        </div>
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">Players</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">
            {info.playerCount.toString()} / {info.maxPlayers.toString()}
          </p>
        </div>
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">Number Range</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">1 – {info.numberRangeMax.toString()}</p>
        </div>
        <div className="rounded-xl bg-stat-card-bg p-3">
          <p className="text-[10px] text-label uppercase tracking-wider">Expires</p>
          <p className="text-sm font-bold text-page-heading mt-0.5">{expireLabel}</p>
        </div>
      </div>

      {/* Creator */}
      <p className="text-[10px] text-muted">
        Creator: <span className="font-mono">{shortenAddress(info.creator)}</span>
        {isCreator && <span className="ml-1 text-primary font-medium">(you)</span>}
      </p>

      {/* Winning number reveal */}
      {isClaimable && (
        <div className="rounded-2xl border-2 border-status-claimable bg-status-warning-bg px-4 py-4 flex flex-col items-center gap-1">
          <p className="text-[10px] text-label uppercase tracking-widest">
            Winning number
          </p>
          <p className="text-5xl font-extrabold text-status-claimable tabular-nums leading-none">
            {info.target.toString()}
          </p>
          <p className="text-[10px] text-muted mt-1">
            out of 1 – {info.numberRangeMax.toString()}
          </p>
          {player && hasJoined && playerNumber !== null && (() => {
            const pick = playerNumber
            const target = info.target
            const distance = pick >= target ? pick - target : target - pick
            return (
              <p className="text-xs text-page-heading mt-2">
                Your pick <strong className="tabular-nums">{pick.toString()}</strong>
                {' '}·{' '}
                distance <strong className="tabular-nums">{distance.toString()}</strong>
                {' '}·{' '}
                {playerPayout > 0n
                  ? <>payout <strong>{formatAlph(playerPayout)} ALPH</strong></>
                  : <span className="text-muted">no payout (outside range)</span>}
              </p>
            )
          })()}
        </div>
      )}

      {/* Option A — payout summary card */}
      {canClaim && playerPayout > 0n && playerNumber !== null && (() => {
        const d = playerNumber >= info.target ? playerNumber - info.target : info.target - playerNumber
        const band = distanceBand(d, info.numberRangeMax)
        const bandLabel =
          band === 'exact' ? 'Exact hit · 2.0×'
          : band === 'top5' ? 'Top 5% · 1.5×'
          : 'Top 20% · 1.2×'
        return (
          <div className="rounded-xl border border-card-border bg-card-bg p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] text-label uppercase tracking-wider mb-0.5">Your payout</p>
                <p className="text-2xl font-bold text-page-heading tabular-nums">
                  {formatAlph(playerPayout)}{' '}
                  <span className="text-base font-medium text-muted">ALPH</span>
                </p>
                <p className="text-xs text-muted mt-0.5">{bandLabel}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold text-status-success-text">✓ Fixed at draw time</p>
                <p className="text-[10px] text-muted mt-0.5">Won&apos;t change as others claim</p>
              </div>
            </div>
            {hasRealContention && (
              <div className="rounded-lg bg-status-warning-bg border border-status-claimable px-3 py-2">
                <p className="text-xs text-status-claimable leading-relaxed">
                  ⚠ {activeWinnersCount} winners&apos; combined payouts ({formatAlph(combinedWinnerPayout)} ALPH)
                  exceed the remaining pot ({formatAlph(info.pot)} ALPH).
                  Later claimers may receive less than expected — claim promptly.
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Player status (non-claimable states) */}
      {player && hasJoined && !isClaimable && (
        <div className="rounded-xl bg-accent border border-accent-border px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-status-success-text font-medium">
            You picked: <strong>{playerNumber?.toString()}</strong>
          </span>
        </div>
      )}

      {/* Payout bands info */}
      {(isOpen || isLocked) && (
        <div className="rounded-xl border border-card-border p-3">
          <p className="text-[10px] text-label uppercase tracking-wider mb-2">Payout bands</p>
          <div className="flex flex-col gap-1">
            {BAND_RULES.map(b => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <span className="text-muted">{b.label}</span>
                <span className="font-medium text-page-heading">{b.multiplier}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">
            Top 5% = distance ≤ N/20 &nbsp;|&nbsp; Top 20% = distance ≤ N/5
          </p>
        </div>
      )}

      {/* Stats / bar chart */}
      {picks.length > 0 && (
        <div className="rounded-xl border border-card-border p-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowStats(s => !s)}
            aria-expanded={showStats}
            className="w-full flex items-center justify-between text-[10px] text-label uppercase tracking-wider hover:text-page-heading transition-colors"
          >
            <span>
              Number distribution ({picks.length} pick{picks.length === 1 ? '' : 's'})
            </span>
            <span className="text-muted normal-case tracking-normal">
              {showStats ? 'Hide' : 'Show'} ▾
            </span>
          </button>
          {showStats && (
            <RoomPicksChart
              picks={picks}
              numberRangeMax={info.numberRangeMax}
              target={isClaimable ? info.target : null}
              yourPick={hasJoined ? playerNumber : null}
            />
          )}
        </div>
      )}

      {/* Picks list */}
      {picks.length > 0 && (() => {
        const target = isClaimable ? info.target : null
        const rangeMax = info.numberRangeMax
        const maxPlayers = info.maxPlayers
        const normalizedPlayer = player
        const rows = picks.map(p => {
          const isYou = normalizedPlayer !== null && p.player === normalizedPlayer
          if (target !== null) {
            const distance = p.number >= target ? p.number - target : target - p.number
            const payout = p.payout ?? bandPayout(p.number, target, rangeMax, snapshotPot, maxPlayers)
            const band = distanceBand(distance, rangeMax)
            return { ...p, isYou, distance, payout, band }
          }
          return {
            ...p,
            isYou,
            distance: null as bigint | null,
            payout: p.payout ?? null,
            band: null as ReturnType<typeof distanceBand> | null
          }
        })
        if (target !== null) {
          rows.sort((a, b) =>
            a.distance! < b.distance! ? -1 : a.distance! > b.distance! ? 1 : 0
          )
        }
        const bandLabel = (b: ReturnType<typeof distanceBand>) =>
          b === 'exact' ? 'Exact · 2.0×'
          : b === 'top5' ? 'Top 5% · 1.5×'
          : b === 'top20' ? 'Top 20% · 1.2×'
          : 'Miss · 0×'
        const bandClass = (b: ReturnType<typeof distanceBand>) =>
          b === 'exact' ? 'text-status-claimable bg-status-warning-bg'
          : b === 'top5' ? 'text-status-success-text bg-status-success-bg'
          : b === 'top20' ? 'text-status-success-text bg-status-success-bg'
          : 'text-muted bg-stat-card-bg'
        const statusLabel: Record<typeof rows[number]['status'], string> = {
          'active': '',
          'claimed': 'claimed',
          'force-claimed': 'force-claimed',
          'refunded': 'refunded'
        }
        return (
          <div className="rounded-xl border border-card-border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-label uppercase tracking-wider">
                Picks ({rows.length})
              </p>
              {target !== null && (
                <p className="text-[10px] text-muted">Sorted by distance to {target.toString()}</p>
              )}
            </div>
            {/* Option C — waterfall simulation toggle */}
            {isClaimable && activeWinnersCount > 0 && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setShowWaterfall(w => !w)}
                  className="flex items-center gap-1.5 text-[10px] text-label uppercase tracking-wider hover:text-page-heading transition-colors"
                >
                  <span>Payout simulation</span>
                  <span className="text-muted normal-case tracking-normal">{showWaterfall ? '▲' : '▼'}</span>
                </button>
                {showWaterfall && (() => {
                  const waterfallWinners = rows
                    .filter(r => r.status === 'active' && r.band !== null && r.band !== 'miss')
                    .sort((a, b) => (a.distance! < b.distance! ? -1 : a.distance! > b.distance! ? 1 : 0))
                  let rem = info.pot
                  const wfRows = waterfallWinners.map(r => {
                    const expected = bandPayout(r.number, info.target, info.numberRangeMax, snapshotPot, info.maxPlayers)
                    const actual = expected > rem ? rem : expected
                    rem = rem >= actual ? rem - actual : 0n
                    return { ...r, expected, actual }
                  })
                  return (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p className="text-[10px] text-muted italic">
                        Simulated in order of closeness to {info.target.toString()}. Actual claim order may differ.
                      </p>
                      <div className="rounded-lg border border-card-border overflow-hidden">
                        <div className="grid grid-cols-4 gap-1 px-2 py-1.5 bg-stat-card-bg text-[9px] uppercase tracking-wider text-label">
                          <span>Pick</span>
                          <span>Band</span>
                          <span>Expected</span>
                          <span className="text-right">If claimed here</span>
                        </div>
                        {wfRows.map(r => {
                          const short = r.actual < r.expected
                          const isYou = r.player === player
                          return (
                            <div
                              key={r.player}
                              className={`grid grid-cols-4 gap-1 px-2 py-1.5 text-xs items-center border-t border-card-border ${isYou ? 'bg-accent' : ''}`}
                            >
                              <div className="flex items-center gap-1 font-bold text-page-heading tabular-nums">
                                {r.number.toString()}
                                {isYou && (
                                  <span className="text-[8px] px-1 py-0.5 rounded-full bg-accent border border-accent-border text-status-success-text">
                                    you
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-medium ${
                                r.band === 'exact' ? 'text-status-claimable' : 'text-status-success-text'
                              }`}>
                                {r.band === 'exact' ? '2.0×' : r.band === 'top5' ? '1.5×' : '1.2×'}
                              </span>
                              <span className="text-muted tabular-nums">{formatAlph(r.expected)}</span>
                              <span className={`text-right font-semibold tabular-nums ${short ? 'text-status-claimable' : 'text-page-heading'}`}>
                                {formatAlph(r.actual)}{short && ' ⚠'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
            <div className="flex flex-col divide-y divide-card-border">
              {rows.map(r => {
                const showForceClaim =
                  (isClaimable || isExpired) &&
                  r.status === 'active' &&
                  !r.isYou &&
                  forceClaimReadyAtMs > 0
                const remainingMs = Math.max(0, forceClaimReadyAtMs - nowMs)
                return (
                <div
                  key={r.player}
                  className={`flex items-center justify-between gap-2 py-1.5 text-xs ${r.status !== 'active' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-10 text-center font-bold text-page-heading tabular-nums shrink-0">
                      {r.number.toString()}
                    </span>
                    <span className="font-mono text-muted truncate">
                      {shortenAddress(r.player)}
                    </span>
                    {r.isYou && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent border border-accent-border text-status-success-text font-medium shrink-0">
                        you
                      </span>
                    )}
                    {r.status !== 'active' && (
                      <span className="text-[9px] text-muted italic shrink-0">
                        {statusLabel[r.status]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {target !== null && r.band !== null && (
                      <>
                        <span className="text-muted tabular-nums">
                          Δ {r.distance!.toString()}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${bandClass(r.band)}`}>
                          {bandLabel(r.band)}
                        </span>
                        {r.payout !== null && r.payout > 0n && (
                          <span className="font-medium text-page-heading tabular-nums">
                            {formatAlph(r.payout)} ALPH
                          </span>
                        )}
                      </>
                    )}
                    {showForceClaim && (
                      forceClaimReady ? (
                        <button
                          onClick={() => handleForceClaim(r.player)}
                          disabled={busy}
                          title="Claim this entry on their behalf and collect their payout + 0.1 ALPH deposit as a cleanup bounty."
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Claim
                        </button>
                      ) : (
                        <span
                          title="After the 3-day grace period, anyone can claim this entry and collect the payout + 0.1 ALPH deposit as a cleanup bounty."
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stat-card-bg text-muted border border-card-border tabular-nums"
                        >
                          Claim in {formatCountdown(remainingMs)}
                        </span>
                      )
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Join form */}
      {canJoin && (
        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-label uppercase tracking-wider">
            Your number (1 – {info.numberRangeMax.toString()})
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={info.numberRangeMax.toString()}
              step="1"
              value={numberInput}
              onChange={e => setNumberInput(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={busy}
              placeholder={`1 – ${info.numberRangeMax}`}
              className="flex-1 px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <button
              onClick={handleJoin}
              disabled={busy || !numberInput || !hasEnoughAlph}
              title={
                !hasEnoughAlph && balanceKnown
                  ? `You need at least ${formatAlph(neededToJoin)} ALPH to join (${formatAlph(info.entryFee)} entry + ${formatAlph(MAP_ENTRY_DEPOSIT)} refundable deposit + gas).`
                  : undefined
              }
              className="px-4 py-2 text-sm font-medium rounded-lg bg-btn-join text-white hover:bg-btn-join-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : !hasEnoughAlph && balanceKnown ? (
                'Insufficient ALPH'
              ) : (
                `Join (${formatAlph(info.entryFee)} ALPH)`
              )}
            </button>
          </div>
          {balanceKnown && !hasEnoughAlph ? (
            <p className="text-[10px] text-notification-error-text">
              Balance {formatAlph(alphBalance!)} ALPH — you need at least{' '}
              {formatAlph(neededToJoin)} ALPH (entry + {formatAlph(MAP_ENTRY_DEPOSIT)} refundable deposit + gas) to join.
            </p>
          ) : balanceKnown ? (
            <p className="text-[10px] text-muted">
              Balance: {formatAlph(alphBalance!)} ALPH
              {isCreator && ' · You are the creator — you can still join.'}
            </p>
          ) : isCreator ? (
            <p className="text-[10px] text-muted">
              You are the creator — you can still join your own room.
            </p>
          ) : null}
        </div>
      )}

      {/* Claim button */}
      {canClaim && (
        <button
          onClick={handleClaim}
          disabled={busy}
          className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {busy ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            `Claim ${formatAlph(totalClaimPayout)} ALPH`
          )}
        </button>
      )}

      {/* Refund button */}
      {canRefund && (
        <button
          onClick={handleRefund}
          disabled={busy}
          className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {busy ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            `Refund ${formatAlph(info.entryFee)} ALPH`
          )}
        </button>
      )}

      {/* Draw countdown banner */}
      {isLocked && resolveReadyAtMs > 0 && !resolveReady && (
        <div className="rounded-xl border border-card-border bg-stat-card-bg px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">
            Room is locked. The draw opens in
          </span>
          <span className="text-xs font-mono font-semibold text-page-heading tabular-nums">
            {resolveCountdownLabel}
          </span>
        </div>
      )}

      {/* Anyone-can-call actions */}
      <div className="flex flex-wrap gap-2">
        {canResolve && (
          <button
            onClick={handleResolve}
            disabled={busy || !resolveReady}
            title={
              !resolveReady
                ? `The draw opens in ${resolveCountdownLabel}`
                : 'Draw the winning number for this room'
            }
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : resolveReady ? (
              'Draw the game'
            ) : (
              `Draw in ${resolveCountdownLabel}`
            )}
          </button>
        )}
        {canExpire && (
          <button
            onClick={handleExpire}
            disabled={busy}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-card-border text-muted hover:text-muted-hover hover:border-card-border-strong disabled:opacity-50 transition-colors"
          >
            Expire Room
          </button>
        )}
        {canDestroy && (
          <button
            onClick={handleDestroy}
            disabled={busy}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            Destroy Room
          </button>
        )}
      </div>

      {/* Boost pot — collapsed by default */}
      {(isOpen || isLocked || isClaimable) && (
        <div className="rounded-xl border border-card-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBoost(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-stat-card-bg transition-colors"
          >
            <span className="text-[10px] text-label uppercase tracking-wider">Boost the pot</span>
            <span className="text-muted text-xs">{showBoost ? '▲' : '▼'}</span>
          </button>
          {showBoost && (
            <div className="px-3 pb-3 flex flex-col gap-2 border-t border-card-border">
              <p className="text-[10px] text-muted pt-2">
                {isClaimable
                  ? 'Room is claimable — a boost helps late claimers but won\'t change displayed payouts.'
                  : 'Boosts before the draw increase everyone\'s payout proportionally.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={boostInput}
                  onChange={e => setBoostInput(e.target.value)}
                  disabled={busy}
                  placeholder="ALPH amount"
                  className="flex-1 px-3 py-2 text-center text-sm rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
                />
                <button
                  onClick={handleBoost}
                  disabled={busy || !boostInput}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Boost
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {txStep === 'signing' && (
        <p className="text-xs text-muted text-center animate-pulse">Waiting for signature…</p>
      )}
      {txStep === 'confirming' && (() => {
        const explorerUrl = pendingTxId ? getTxExplorerUrl(pendingTxId) : null
        return (
          <p className="text-xs text-muted text-center flex items-center justify-center flex-wrap gap-x-2">
            <span className="animate-pulse">Confirming on chain…</span>
            {pendingTxId && (
              explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-page-heading transition-colors font-mono"
                  title={pendingTxId}
                >
                  {shortenAddress(pendingTxId)} ↗
                </a>
              ) : (
                <span className="font-mono" title={pendingTxId}>
                  {shortenAddress(pendingTxId)}
                </span>
              )
            )}
          </p>
        )
      })()}
      {txSuccess && (
        <p className="text-xs text-status-success-text bg-status-success-bg border border-stat-card-accent-border rounded-lg px-3 py-2">
          {txSuccess}
        </p>
      )}
      {txError && (
        <p className="text-xs text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-lg px-3 py-2 break-all line-clamp-4">
          {txError}
        </p>
      )}
    </div>
  )
}
