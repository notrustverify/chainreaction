'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  EMBED_WALLET_MESSAGE_TYPES,
  type EmbedSignRequestMessage,
  isEmbedded,
} from './walletBridge'
import type { SerializedSignExecuteScriptTxParams } from './captureSigner'

interface EmbeddedWalletContextValue {
  /** Parent's wallet address when embedded and parent has sent it; null otherwise. */
  address: string | null
  /** Parent's account publicKey (required for building tx params when using embedded wallet). */
  publicKey: string | null
  /** True when we're in an iframe (bridge expected); hide connect button in NavBar. */
  isEmbedBridge: boolean
  /** True when we're in an iframe and parent has sent wallet state (address or explicit null). */
  isEmbeddedWallet: boolean
  /** Send raw tx params to parent to sign and submit. Parent only needs signer, no contract. */
  requestParentSignTxParams: (txParams: SerializedSignExecuteScriptTxParams) => Promise<{ txId: string }>
}

const EmbeddedWalletContext = createContext<EmbeddedWalletContextValue>({
  address: null,
  publicKey: null,
  isEmbedBridge: false,
  isEmbeddedWallet: false,
  requestParentSignTxParams: async () => {
    throw new Error('Embedded wallet not available')
  },
})

export function useEmbeddedWallet(): EmbeddedWalletContextValue {
  return useContext(EmbeddedWalletContext)
}

export function EmbeddedWalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [parentAcked, setParentAcked] = useState(false)
  const pendingRef = useRef<Map<string, { resolve: (v: { txId: string }) => void; reject: (e: Error) => void }>>(new Map())
  const idRef = useRef(0)

  useEffect(() => {
    if (!isEmbedded()) return

    try {
      window.parent.postMessage({ type: EMBED_WALLET_MESSAGE_TYPES.EMBED_READY }, '*')
    } catch {
      // cross-origin
    }

    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || typeof d !== 'object') return

      if (d.type === EMBED_WALLET_MESSAGE_TYPES.WALLET) {
        setParentAcked(true)
        setAddress(d.address ?? null)
        setPublicKey(d.publicKey ?? null)
      }

      if (d.type === EMBED_WALLET_MESSAGE_TYPES.SIGN_RESPONSE) {
        const { id, txId, error } = d
        const pending = pendingRef.current.get(id)
        if (pending) {
          pendingRef.current.delete(id)
          if (error) pending.reject(new Error(error))
          else if (txId) pending.resolve({ txId })
          else pending.reject(new Error('No txId in response'))
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const requestParentSignTxParams = useCallback((txParams: SerializedSignExecuteScriptTxParams): Promise<{ txId: string }> => {
    return new Promise((resolve, reject) => {
      const id = `cr-${++idRef.current}-${Date.now()}`
      pendingRef.current.set(id, { resolve, reject })

      const msg: EmbedSignRequestMessage = {
        type: EMBED_WALLET_MESSAGE_TYPES.SIGN_REQUEST,
        id,
        txParams,
      }
      try {
        window.parent.postMessage(msg, '*')
      } catch (err) {
        pendingRef.current.delete(id)
        reject(err)
      }

      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          reject(new Error('Parent sign request timed out'))
        }
      }, 120000)
    })
  }, [])

  const embedBridge = isEmbedded()
  const isEmbeddedWallet = embedBridge && parentAcked

  const value: EmbeddedWalletContextValue = {
    address: isEmbeddedWallet ? address : null,
    publicKey: isEmbeddedWallet ? publicKey : null,
    isEmbedBridge: embedBridge,
    isEmbeddedWallet,
    requestParentSignTxParams,
  }

  return (
    <EmbeddedWalletContext.Provider value={value}>
      {children}
    </EmbeddedWalletContext.Provider>
  )
}
