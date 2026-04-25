'use client'

import React, { FC, useState } from 'react'
import { useWallet } from '@alephium/web3-react'
import { GameHubFactoryInstance } from 'my-contracts'
import { createRoom, pollTxConfirmed } from '@/services/guess.service'
import { getTxExplorerUrl } from '@/services/utils'
import { shortenAddress } from '@/services/game.service'

const ONE_ALPH = 1_000_000_000_000_000_000n
const MIN_ENTRY_FEE = ONE_ALPH / 10n  // 0.1 ALPH

// Converts "21.1" → 21_100_000_000_000_000_000n (attoALPH) without float precision loss
function alphToAtto(value: string): bigint | null {
  const trimmed = value.trim()
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = frac.slice(0, 18).padEnd(18, '0')
  return BigInt(whole) * ONE_ALPH + BigInt(fracPadded)
}

type Step = 'idle' | 'signing' | 'confirming' | 'done'

interface Props {
  factory: GameHubFactoryInstance
  onConnectRequest: () => void
  onCreated?: () => void
  onClose?: () => void
}

export const CreateRoom: FC<Props> = ({ factory, onConnectRequest, onCreated, onClose }) => {
  const { signer, account } = useWallet()

  const [step, setStep] = useState<Step>('idle')
  const [txError, setTxError] = useState<string>()
  const [pendingTxId, setPendingTxId] = useState<string | null>(null)

  const [entryFeeAlph, setEntryFeeAlph] = useState('10')
  const [maxPlayers, setMaxPlayers] = useState(42)
  const [numberRangeMax, setNumberRangeMax] = useState(1000)
  const [expiresInHours, setExpiresInHours] = useState(72)

  const busy = step === 'signing' || step === 'confirming'

  const handleCreate = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)

    const entryFeeAtto = alphToAtto(entryFeeAlph)
    if (entryFeeAtto === null || entryFeeAtto <= 0n) {
      setTxError('Entry fee must be a positive number (e.g. 1 or 21.5)')
      return
    }
    if (entryFeeAtto < MIN_ENTRY_FEE) {
      setTxError('Minimum entry fee is 0.1 ALPH')
      return
    }

    try {
      setStep('signing')
      setPendingTxId(null)
      const expiresAt = BigInt(Date.now() + expiresInHours * 3_600_000)
      const { txId } = await createRoom(
        factory,
        signer,
        entryFeeAtto,
        BigInt(maxPlayers),
        BigInt(numberRangeMax),
        expiresAt
      )
      setPendingTxId(txId)
      setStep('confirming')
      await pollTxConfirmed(txId)
      setStep('done')
      onCreated?.()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
      setStep('idle')
    } finally {
      setPendingTxId(null)
    }
  }

  const handleReset = () => {
    setStep('idle')
    setTxError(undefined)
    onClose?.()
  }

  return (
    <div className="w-full p-5 bg-stat-card-bg rounded-2xl border border-card-border flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-page-heading">Create Room</h3>
        <button
          onClick={handleReset}
          disabled={busy}
          className="text-xs text-muted hover:text-muted-hover disabled:opacity-30"
        >
          {step === 'done' ? 'Close' : 'Cancel'}
        </button>
      </div>

      {step === 'done' ? (
        <p className="text-xs text-status-success-text bg-status-success-bg border border-stat-card-accent-border rounded-lg px-3 py-2">
          Room created! It will appear in the list shortly.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-label uppercase tracking-wider">Entry Fee (ALPH)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={entryFeeAlph}
              onChange={e => setEntryFeeAlph(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Each player pays this to join</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-label uppercase tracking-wider">Max Players</label>
            <input
              type="number"
              min="2"
              max="50"
              value={maxPlayers}
              onChange={e => setMaxPlayers(Math.max(2, Number(e.target.value)))}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Room locks and resolves when full</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-label uppercase tracking-wider">Number Range (1 – N)</label>
            <input
              type="number"
              min="2"
              max="1000000"
              value={numberRangeMax}
              onChange={e => setNumberRangeMax(Math.max(20, Number(e.target.value)))}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Players pick a number between 1 and N</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-label uppercase tracking-wider">Room Expires In (hours)</label>
            <input
              type="number"
              min="1"
              max="720"
              value={expiresInHours}
              onChange={e => setExpiresInHours(Math.max(1, Number(e.target.value)))}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Unfilled rooms expire and players get refunded</p>
          </div>

          {txError && (
            <p className="text-xs text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-lg px-3 py-2 break-all line-clamp-3">
              {txError}
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={busy}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {step === 'signing' ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Waiting for signature...
              </>
            ) : step === 'confirming' ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirming on chain...
              </>
            ) : (
              'Deploy Room'
            )}
          </button>

          {step === 'confirming' && pendingTxId && (() => {
            const explorerUrl = getTxExplorerUrl(pendingTxId)
            return (
              <p className="text-[10px] text-muted text-center">
                Tx:{' '}
                {explorerUrl ? (
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
                  <span className="font-mono" title={pendingTxId}>{shortenAddress(pendingTxId)}</span>
                )}
              </p>
            )
          })()}

          <p className="text-[10px] text-muted text-center">
            Costs 0.1 ALPH for contract deposit (returned when room is destroyed)
          </p>
        </>
      )}
    </div>
  )
}
