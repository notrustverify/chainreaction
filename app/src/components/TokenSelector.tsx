'use client'

import React, { FC, useState, useRef, useEffect } from 'react'
import { TokenInfo } from '@/services/tokenList'

interface TokenSelectorProps {
  tokens: TokenInfo[]
  selected: TokenInfo
  onChange: (token: TokenInfo) => void
  disabled?: boolean
}

export const TokenSelector: FC<TokenSelectorProps> = ({ tokens, selected, onChange, disabled }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search
    ? tokens.filter(t =>
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : tokens

  useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open])

  useEffect(() => {
    if (open) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-[11px] text-label uppercase tracking-wider">Token</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`w-full flex items-center gap-2 pl-3 pr-3 py-2 text-base rounded-lg border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring text-left ${disabled ? 'cursor-default opacity-90' : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.logoURI} alt={selected.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
          <span className="flex-1 truncate">{selected.symbol} — {selected.name}</span>
          {!disabled && (
            <svg className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-card-bg border border-card-border-strong rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-card-border">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tokens..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-input-border bg-input-bg text-input-fg focus:outline-none focus:ring-2 focus:ring-input-focus-ring/30 focus:border-input-focus-ring"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted text-center">No tokens found</li>
              )}
              {filtered.map(t => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(t); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left ${t.id === selected.id ? 'bg-accent font-medium' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.logoURI} alt={t.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
                    <span className="font-medium">{t.symbol}</span>
                    <span className="text-muted truncate">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
