'use client'

/**
 * A signer that captures SignExecuteScriptTxParams instead of signing.
 * Used to build raw tx params in the iframe to send to the parent for signing.
 */

import type { SignerProvider, SignExecuteScriptTxParams, SignExecuteScriptTxResult } from '@alephium/web3'
import { groupOfAddress } from '@alephium/web3'

export class EmbedTxParamsCapture extends Error {
  readonly params: SignExecuteScriptTxParams
  constructor(params: SignExecuteScriptTxParams) {
    super('EmbedTxParamsCapture')
    this.name = 'EmbedTxParamsCapture'
    this.params = params
  }
}

/** Builds a signer that returns the given account and captures tx params when signAndSubmitExecuteScriptTx is called. */
export function createCaptureSigner(signerAddress: string, publicKey: string): SignerProvider {
  const group = groupOfAddress(signerAddress)

  const account = {
    address: signerAddress,
    keyType: 'default' as const,
    group,
    publicKey,
  }
  return {
    get nodeProvider() {
      return undefined
    },
    get explorerProvider() {
      return undefined
    },
    async unsafeGetSelectedAccount() {
      return account
    },
    async getSelectedAccount() {
      return account
    },
    async signAndSubmitTransferTx() {
      throw new Error('Capture signer does not support transfer')
    },
    async signAndSubmitDeployContractTx() {
      throw new Error('Capture signer does not support deploy')
    },
    async signAndSubmitExecuteScriptTx(params: SignExecuteScriptTxParams): Promise<SignExecuteScriptTxResult> {
      throw new EmbedTxParamsCapture(params)
    },
    async signAndSubmitUnsignedTx() {
      throw new Error('Capture signer does not support unsigned tx')
    },
    async signAndSubmitChainedTx() {
      throw new Error('Capture signer does not support chained tx')
    },
    async signUnsignedTx() {
      throw new Error('Capture signer does not support signUnsignedTx')
    },
    async signMessage() {
      throw new Error('Capture signer does not support signMessage')
    },
  } as unknown as SignerProvider
}

/** JSON-serializable shape of SignExecuteScriptTxParams for postMessage. */
export interface SerializedSignExecuteScriptTxParams {
  signerAddress: string
  signerKeyType?: string
  bytecode: string
  attoAlphAmount?: string
  tokens?: { id: string; amount: string }[]
  gasAmount?: number
  gasPrice?: string
  group?: number
  dustAmount?: string
}

export function serializeTxParams(p: SignExecuteScriptTxParams): SerializedSignExecuteScriptTxParams {
  return {
    signerAddress: p.signerAddress,
    signerKeyType: p.signerKeyType,
    bytecode: p.bytecode,
    attoAlphAmount: p.attoAlphAmount != null ? String(p.attoAlphAmount) : undefined,
    tokens: p.tokens?.map(t => ({ id: t.id, amount: String(t.amount) })),
    gasAmount: p.gasAmount,
    gasPrice: p.gasPrice != null ? String(p.gasPrice) : undefined,
    group: p.group,
    dustAmount: p.dustAmount != null ? String(p.dustAmount) : undefined,
  }
}

export function deserializeTxParams(s: SerializedSignExecuteScriptTxParams): SignExecuteScriptTxParams {
  return {
    signerAddress: s.signerAddress,
    signerKeyType: s.signerKeyType as 'default' | 'bip340-schnorr' | undefined,
    bytecode: s.bytecode,
    attoAlphAmount: s.attoAlphAmount,
    tokens: s.tokens?.map(t => ({ id: t.id, amount: BigInt(t.amount) })),
    gasAmount: s.gasAmount,
    gasPrice: s.gasPrice,
    group: s.group,
    dustAmount: s.dustAmount,
  }
}
