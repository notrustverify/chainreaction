import { SignerProvider, ONE_ALPH, prettifyAttoAlphAmount, DUST_AMOUNT } from '@alephium/web3'
import { ChainReactionInstance } from 'my-contracts'

export interface GameState {
  chainId: bigint
  currentEntry: bigint
  lastPlayer: string
  lastEntryTimestamp: bigint
  pot: bigint
  isActive: boolean
  playerCount: bigint
  nextEntryPrice: bigint
  canEnd: boolean
  endTimestamp: bigint
  baseEntry: bigint
  multiplierBps: bigint
  durationMs: bigint
}

export async function fetchGameState(contract: ChainReactionInstance): Promise<GameState> {
  const state = await contract.fetchState()
  const fields = state.fields

  const nextEntryPriceResult = await contract.view.getNextEntryPrice()
  const canEndResult = await contract.view.canEnd()

  return {
    chainId: fields.chainId,
    currentEntry: fields.currentEntry,
    lastPlayer: fields.lastPlayer,
    lastEntryTimestamp: fields.lastEntryTimestamp,
    pot: fields.pot,
    isActive: fields.isActive,
    playerCount: fields.playerCount,
    nextEntryPrice: nextEntryPriceResult.returns,
    canEnd: canEndResult.returns,
    endTimestamp: fields.endTimestamp,
    baseEntry: fields.baseEntry,
    multiplierBps: fields.multiplierBps,
    durationMs: fields.durationMs,
  }
}

export async function startChain(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  paymentAttoAlph: bigint,
  durationMs: bigint,
  multiplierBps: bigint
): Promise<{ txId: string }> {
  const result = await contract.transact.startChain({
    signer,
    args: { payment: paymentAttoAlph, durationGameMs: durationMs, multiplierGameBps: multiplierBps },
    attoAlphAmount: paymentAttoAlph + 2n*DUST_AMOUNT,
  })
  return { txId: result.txId }
}

export async function joinChain(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  paymentAttoAlph: bigint
): Promise<{ txId: string }> {
  const result = await contract.transact.joinChain({
    signer,
    args: { payment: paymentAttoAlph },
    attoAlphAmount: paymentAttoAlph + 2n*DUST_AMOUNT,
  })
  return { txId: result.txId }
}

export async function endChain(
  contract: ChainReactionInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await contract.transact.endChain({
    signer,
    attoAlphAmount: 2n*DUST_AMOUNT,
  })
  return { txId: result.txId }
}

export function formatAlph(attoAlph: bigint): string {
  return prettifyAttoAlphAmount(attoAlph) ?? '0'
}

export function shortenAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
