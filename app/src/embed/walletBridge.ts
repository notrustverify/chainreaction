'use client'

/**
 * PostMessage protocol for using the parent frame's wallet when the game is embedded.
 * Iframe builds raw tx params (SignExecuteScriptTxParams); parent only signs and submits.
 * Parent does not need contract or game logic.
 */

import type { SerializedSignExecuteScriptTxParams } from './captureSigner'

export const EMBED_WALLET_MESSAGE_TYPES = {
  /** Parent → iframe: wallet state (address or null when disconnected). */
  WALLET: 'chainreaction-wallet',
  /** Iframe → parent: embed ready; parent should respond with WALLET. */
  EMBED_READY: 'chainreaction-embed-ready',
  /** Iframe → parent: request to sign and submit raw tx params. */
  SIGN_REQUEST: 'chainreaction-sign-request',
  /** Parent → iframe: result of the sign request. */
  SIGN_RESPONSE: 'chainreaction-sign-response',
} as const

export interface EmbedWalletMessage {
  type: typeof EMBED_WALLET_MESSAGE_TYPES.WALLET
  address: string | null
  /** Required when address is set, so the iframe can build valid tx params for the parent to sign. */
  publicKey?: string | null
}

/** Iframe sends serialized SignExecuteScriptTxParams; parent calls signer.signAndSubmitExecuteScriptTx and posts back. */
export interface EmbedSignRequestMessage {
  type: typeof EMBED_WALLET_MESSAGE_TYPES.SIGN_REQUEST
  id: string
  txParams: SerializedSignExecuteScriptTxParams
}

export interface EmbedSignResponseMessage {
  type: typeof EMBED_WALLET_MESSAGE_TYPES.SIGN_RESPONSE
  id: string
  txId?: string
  error?: string
}

export function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top
}
