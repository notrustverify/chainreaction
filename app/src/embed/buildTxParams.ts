'use client'

/**
 * Builds serialized SignExecuteScriptTxParams in the iframe (using contract + game service).
 * Uses a capture signer so no real signing happens; params are sent to parent for signing.
 */

import type { GameContractInstance } from '@/services/game.service'
import { startChain, joinChain, endChain, incentivize } from '@/services/game.service'
import { createNewGame } from '@/services/factory.service'
import type { FactoryChainReactionV2Instance } from 'my-contracts'
import { createCaptureSigner, serializeTxParams, EmbedTxParamsCapture } from './captureSigner'
import type { SerializedSignExecuteScriptTxParams } from './captureSigner'

async function buildParams(
  signerAddress: string,
  publicKey: string,
  run: (signer: import('@alephium/web3').SignerProvider) => Promise<unknown>
): Promise<SerializedSignExecuteScriptTxParams> {
  const captureSigner = createCaptureSigner(signerAddress, publicKey)
  try {
    await run(captureSigner)
  } catch (err) {
    if (err instanceof EmbedTxParamsCapture) {
      return serializeTxParams(err.params)
    }
    throw err
  }
  throw new Error('Expected EmbedTxParamsCapture')
}

export async function buildStartChainTxParams(
  signerAddress: string,
  publicKey: string,
  contract: GameContractInstance,
  payment: bigint,
  durationMs: bigint,
  multiplierBps: bigint,
  tokenId: string,
  burnRate: bigint,
  isV3: boolean = false,
  decayPeriodMs: bigint = 0n,
  feesBps: bigint = 0n,
): Promise<SerializedSignExecuteScriptTxParams> {
  return buildParams(signerAddress, publicKey, (signer) =>
    startChain(contract, signer, payment, durationMs, multiplierBps, tokenId, burnRate, isV3, decayPeriodMs, feesBps)
  )
}

export async function buildJoinChainTxParams(
  signerAddress: string,
  publicKey: string,
  contract: GameContractInstance,
  payment: bigint,
  tokenId: string,
  isV3: boolean = false,
): Promise<SerializedSignExecuteScriptTxParams> {
  return buildParams(signerAddress, publicKey, (signer) =>
    joinChain(contract, signer, payment, tokenId, isV3)
  )
}

export async function buildEndChainTxParams(
  signerAddress: string,
  publicKey: string,
  contract: GameContractInstance,
  tokenId: string
): Promise<SerializedSignExecuteScriptTxParams> {
  return buildParams(signerAddress, publicKey, (signer) =>
    endChain(contract, signer, tokenId)
  )
}

export async function buildIncentivizeTxParams(
  signerAddress: string,
  publicKey: string,
  contract: GameContractInstance,
  amount: bigint,
  tokenId: string,
  isV3: boolean = false,
): Promise<SerializedSignExecuteScriptTxParams> {
  return buildParams(signerAddress, publicKey, (signer) =>
    incentivize(contract, signer, amount, tokenId, isV3)
  )
}

export async function buildCreateNewGameTxParams(
  signerAddress: string,
  publicKey: string,
  factory: FactoryChainReactionV2Instance,
  durationDecreaseMs: bigint,
  minDuration: bigint,
  addrFees: string,
  isFixedTokenId: boolean,
  tokenId: string
): Promise<SerializedSignExecuteScriptTxParams> {
  return buildParams(signerAddress, publicKey, (signer) =>
    createNewGame(factory, signer, durationDecreaseMs, minDuration, addrFees, isFixedTokenId, tokenId)
  )
}
