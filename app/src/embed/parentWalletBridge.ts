'use client'

/**
 * Top-frame (parent) implementation of the wallet bridge.
 * Parent only signs and submits raw tx params from the iframe – no contract or game logic needed.
 */

import type { SignerProvider } from '@alephium/web3'
import {
  EMBED_WALLET_MESSAGE_TYPES,
  type EmbedSignRequestMessage,
} from './walletBridge'
import { deserializeTxParams } from './captureSigner'

export interface ParentWalletBridgeOptions {
  /** Returns the parent's signer (e.g. from useWallet().signer). */
  getSigner: () => SignerProvider | null
  /** Returns the parent's wallet address when connected, null when disconnected. */
  getAddress: () => string | null
  /** Returns the parent's account publicKey (required for iframe to build tx params). From getSelectedAccount().publicKey. */
  getPublicKey: () => string | null
  /** Returns the iframe element that hosts the game (used to send wallet state when it changes). */
  getIframe: () => HTMLIFrameElement | null
  /** Optional: only accept messages from this origin (e.g. 'https://your-game.app'). */
  origin?: string
}

export interface ParentWalletBridge {
  /** Call this when the wallet connects or disconnects so the iframe stays in sync. */
  sendWalletState: () => void
  /** Remove the message listener. */
  cleanup: () => void
}

async function handleSignRequest(
  getSigner: () => SignerProvider | null,
  msg: EmbedSignRequestMessage
): Promise<{ id: string; txId?: string; error?: string }> {
  const { id, txParams } = msg
  const signer = getSigner()
  if (!signer) {
    return { id, error: 'Wallet not connected' }
  }

  try {
    const params = deserializeTxParams(txParams)
    const result = await signer.signAndSubmitExecuteScriptTx(params)
    const txId = typeof result === 'object' && result !== null && 'txId' in result ? result.txId : undefined
    if (!txId) {
      return { id, error: 'No txId in sign result' }
    }
    return { id, txId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { id, error: message }
  }
}

/**
 * Sets up the parent-frame side of the wallet bridge.
 * - Listens for `chainreaction-embed-ready` and `chainreaction-sign-request` from the iframe.
 * - On embed ready, sends current wallet state to the iframe.
 * - On sign request, deserializes the raw tx params, calls signer.signAndSubmitExecuteScriptTx, and posts the result back.
 * The parent does not need my-contracts or game.service – only a SignerProvider (e.g. from @alephium/web3-react).
 */
export function createParentWalletBridge(options: ParentWalletBridgeOptions): ParentWalletBridge {
  const { getSigner, getAddress, getPublicKey, getIframe, origin } = options

  const sendWalletStateTo = (target: MessageEventSource | null) => {
    if (!target || typeof (target as Window).postMessage !== 'function') return
    const address = getAddress()
    const publicKey = getPublicKey()
    try {
      ;(target as Window).postMessage(
        { type: EMBED_WALLET_MESSAGE_TYPES.WALLET, address, publicKey: publicKey ?? null },
        origin ?? '*'
      )
    } catch {
      // cross-origin
    }
  }

  const sendWalletState = () => {
    const iframe = getIframe()
    if (iframe?.contentWindow) sendWalletStateTo(iframe.contentWindow)
  }

  const handler = async (e: MessageEvent) => {
    const d = e.data
    if (!d || typeof d !== 'object' || !d.type) return
    if (origin && e.origin !== origin) return

    if (d.type === EMBED_WALLET_MESSAGE_TYPES.EMBED_READY) {
      sendWalletStateTo(e.source)
      return
    }

    if (d.type === EMBED_WALLET_MESSAGE_TYPES.SIGN_REQUEST) {
      const result = await handleSignRequest(getSigner, d as EmbedSignRequestMessage)
      try {
        ;(e.source as Window).postMessage(
          {
            type: EMBED_WALLET_MESSAGE_TYPES.SIGN_RESPONSE,
            id: result.id,
            ...(result.txId && { txId: result.txId }),
            ...(result.error && { error: result.error }),
          },
          e.origin
        )
      } catch {
        // iframe may be gone
      }
    }
  }

  window.addEventListener('message', handler)

  return {
    sendWalletState,
    cleanup: () => window.removeEventListener('message', handler),
  }
}
