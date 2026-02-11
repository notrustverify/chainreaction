'use client'

import React, { FC, useState } from 'react'
import { useWallet } from '@alephium/web3-react'
import { web3, addressFromContractId } from '@alephium/web3'
import { FactoryChainReactionInstance } from 'my-contracts'
import { createNewGame } from '@/services/factory.service'
import { useThemeForcedParam, useTokensParam, appendPreservedParamsToHref } from '@/theme/useThemeForcedParam'

type Step = 'idle' | 'signing' | 'confirming' | 'done'

export const CreateGame: FC<{
  factory: FactoryChainReactionInstance
  onConnectRequest: () => void
  onCreated?: () => void
}> = ({ factory, onConnectRequest, onCreated }) => {
  const { signer } = useWallet()
  const themeParam = useThemeForcedParam()
  const tokensParam = useTokensParam()
  const preserved = { theme: themeParam, tokens: tokensParam }
  const [decreaseSeconds, setDecreaseSeconds] = useState(60)
  const [minDurationSeconds, setMinDurationSeconds] = useState(60)
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [txError, setTxError] = useState<string>()
  const [gameAddress, setGameAddress] = useState<string>()
  const [copied, setCopied] = useState(false)

  const busy = step === 'signing' || step === 'confirming'

  const handleCreate = async () => {
    if (!signer) { onConnectRequest(); return }
    setTxError(undefined)
    setGameAddress(undefined)

    if (decreaseSeconds < 1) {
      setTxError('Duration decrease must be at least 1 second')
      return
    }
    if (minDurationSeconds < 1) {
      setTxError('Minimum duration must be at least 1 second')
      return
    }

    try {
      setStep('signing')
      const durationDecreaseMs = BigInt(decreaseSeconds) * 1000n
      const minDuration = BigInt(minDurationSeconds) * 1000n
      const result = await createNewGame(factory, signer, durationDecreaseMs, minDuration)

      setStep('confirming')
      const provider = web3.getCurrentNodeProvider()

      // Poll for confirmation
      while (true) {
        try {
          const status = await provider.transactions.getTransactionsStatus({ txId: result.txId })
          if (status.type === 'Confirmed') break
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 2000))
      }

      // Fetch events from the confirmed tx to get the new contract address
      try {
        const txEvents = await provider.events.getEventsTxIdTxid(result.txId)
        // NewGameCreated is eventIndex 0: fields = [contractId, gameId]
        const createEvent = txEvents.events.find(e => e.eventIndex === 0)
        if (createEvent && createEvent.fields.length >= 1) {
          const contractId = createEvent.fields[0].value as string
          setGameAddress(addressFromContractId(contractId))
        }
      } catch {
        // Events fetch failed, game was still created
      }

      setStep('done')
      onCreated?.()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Transaction failed')
      setStep('idle')
    }
  }

  const gameLink = gameAddress
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/game?address=${gameAddress}`
    : null

  const handleCopy = () => {
    if (!gameLink) return
    navigator.clipboard.writeText(gameLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setIsOpen(false)
    setStep('idle')
    setTxError(undefined)
    setGameAddress(undefined)
    setCopied(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-5 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
      >
        + Create New Game
      </button>
    )
  }

  return (
    <div className="w-full max-w-sm p-5 bg-stat-card-bg rounded-2xl border border-card-border flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-page-heading">Create New Game</h3>
        <button
          onClick={handleReset}
          disabled={busy}
          className="text-xs text-muted hover:text-muted-hover disabled:opacity-30"
        >
          {step === 'done' ? 'Close' : 'Cancel'}
        </button>
      </div>

      {/* Progress steps */}
      {step !== 'idle' && (
        <div className="flex items-center gap-1">
          {(['signing', 'confirming', 'done'] as const).map((s, i) => {
            const labels = ['Sign', 'Confirm', 'Done']
            const isActive = step === s
            const isPast = (['signing', 'confirming', 'done'] as const).indexOf(step) > i

            return (
              <React.Fragment key={s}>
                {i > 0 && (
                  <div className={`flex-1 h-px ${isPast ? 'bg-primary' : 'bg-btn-outline-border'}`} />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    isPast ? 'bg-primary text-primary-fg'
                      : isActive ? 'bg-accent text-primary ring-2 ring-accent-border'
                      : 'bg-btn-outline-border text-btn-outline-text'
                  }`}>
                    {isPast ? '\u2713' : i + 1}
                  </div>
                  <span className={`text-[10px] ${isActive ? 'text-primary font-medium' : 'text-muted'}`}>
                    {labels[i]}
                  </span>
                </div>
              </React.Fragment>
            )
          })}
        </div>
      )}

      {step === 'done' && gameLink ? (
        /* Success state with link */
        <div className="flex flex-col gap-3">
          <p className="text-xs text-status-success-text bg-status-success-bg border border-stat-card-accent-border rounded-lg px-3 py-2">
            Game created successfully!
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-label uppercase tracking-wider">Game link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={gameLink}
                className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-input-border bg-input-bg text-input-fg select-all"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-fg hover:bg-primary-hover transition-colors shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <a
            href={appendPreservedParamsToHref(`/game?address=${gameAddress}`, preserved)}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-btn-secondary-bg text-btn-secondary-fg hover:bg-btn-secondary-hover transition-colors text-center"
          >
            Go to game &rarr;
          </a>
        </div>
      ) : (
        /* Form state */
        <>
          <p className="text-xs text-muted">
            Deploy a new game contract. These settings are permanent for this game instance.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="decrease" className="text-[11px] text-label uppercase tracking-wider">
              Timer decrease per player (seconds)
            </label>
            <input
              id="decrease"
              type="number"
              min={1}
              max={3600}
              value={decreaseSeconds}
              onChange={(e) => setDecreaseSeconds(Math.max(1, Number(e.target.value)))}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Each new player reduces the countdown by this amount</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="minDuration" className="text-[11px] text-label uppercase tracking-wider">
              Minimum game duration (seconds)
            </label>
            <input
              id="minDuration"
              type="number"
              min={1}
              max={3600}
              value={minDurationSeconds}
              onChange={(e) => setMinDurationSeconds(Math.max(1, Number(e.target.value)))}
              disabled={busy}
              className="w-full px-3 py-2 text-center text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring disabled:opacity-50"
            />
            <p className="text-[10px] text-muted">Timer can never go below this value</p>
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
              'Deploy Game Contract'
            )}
          </button>

          <p className="text-[10px] text-muted text-center">
            Costs ~0.1 ALPH for contract deposit
          </p>
        </>
      )}
    </div>
  )
}
