'use client'

import React, { FC } from 'react'

export type ButtonVariant = 'default' | 'start' | 'join' | 'claim'

interface BigButtonProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  variant: ButtonVariant
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-btn-default-bg text-btn-default-text border-btn-default-border',
  start: 'bg-primary hover:bg-primary-hover text-primary-fg border-primary',
  join: 'bg-btn-join hover:bg-btn-join-hover text-primary-fg border-btn-join',
  claim: 'bg-btn-claim hover:bg-btn-claim-hover text-btn-claim-fg border-btn-claim animate-pulse',
}

const ringStyles: Record<ButtonVariant, string> = {
  default: '',
  start: 'border-accent-border',
  join: 'border-btn-join',
  claim: 'border-btn-claim',
}

const spinnerColors: Record<ButtonVariant, string> = {
  default: 'border-btn-default-text border-t-transparent',
  start: 'border-primary-fg/40 border-t-primary-fg',
  join: 'border-primary-fg/40 border-t-primary-fg',
  claim: 'border-btn-claim-fg/30 border-t-btn-claim-fg',
}

export const BigButton: FC<BigButtonProps> = ({ label, onClick, disabled, variant, loading }) => {
  return (
    <div className="relative flex items-center justify-center py-6">
      <button
        className={`
          w-44 h-44 rounded-full border-4 text-base font-bold cursor-pointer
          relative z-10 transition-transform duration-150 uppercase tracking-wide
          flex items-center justify-center text-center leading-tight
          active:not-disabled:scale-95 hover:not-disabled:scale-105
          disabled:opacity-50 disabled:cursor-not-allowed
          [background-image:var(--bg-image-big-button)] bg-cover bg-center                    
          ${variantStyles[variant]}
        `}
        onClick={onClick}
        disabled={disabled || loading || !onClick}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 border-3 rounded-full animate-spin ${spinnerColors[variant]}`} />
            <span className="text-xs opacity-80">Confirming...</span>
          </div>
        ) : (
          <span className="whitespace-pre-line px-2">{label}</span>
        )}
      </button>
      {loading && (
        <div className={`absolute w-52 h-52 rounded-full border-2 z-0 animate-spin pointer-events-none opacity-20 border-dashed ${ringStyles[variant]}`} />
      )}
      {!loading && !disabled && variant !== 'default' && (
        <div className={`absolute w-44 h-44 rounded-full border-2 z-0 animate-ping pointer-events-none opacity-40 ${ringStyles[variant]}`} />
      )}
    </div>
  )
}
