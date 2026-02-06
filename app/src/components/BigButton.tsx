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
  default: 'bg-gray-200 text-gray-500 border-gray-300',
  start: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]',
  join: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]',
  claim: 'bg-amber-400 hover:bg-amber-500 text-gray-900 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.4)] animate-pulse',
}

const ringStyles: Record<ButtonVariant, string> = {
  default: '',
  start: 'border-emerald-400',
  join: 'border-blue-400',
  claim: 'border-amber-400',
}

const spinnerColors: Record<ButtonVariant, string> = {
  default: 'border-gray-400 border-t-transparent',
  start: 'border-white/40 border-t-white',
  join: 'border-white/40 border-t-white',
  claim: 'border-gray-900/30 border-t-gray-900',
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
