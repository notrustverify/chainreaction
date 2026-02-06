import { SignerProvider, ALPH_TOKEN_ID, prettifyAttoAlphAmount, DUST_AMOUNT, ONE_ALPH, MINIMAL_CONTRACT_DEPOSIT } from '@alephium/web3'
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
  durationDecreaseMs: bigint
  minDuration: bigint
  tokenId: string
}

function isAlph(tokenId: string): boolean {
  return !tokenId || tokenId === ALPH_TOKEN_ID || /^0+$/.test(tokenId)
}

function buildTxParams(tokenId: string, payment: bigint) {
  if (isAlph(tokenId)) {
    return { attoAlphAmount: payment + ONE_ALPH }
  }
  return {
    attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT + DUST_AMOUNT,
    tokens: [{ id: tokenId, amount: payment }],
  }
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
    durationDecreaseMs: fields.durationDecreaseMs,
    minDuration: fields.minDuration,
    tokenId: fields.tokenId,
  }
}

export async function startChain(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  payment: bigint,
  durationMs: bigint,
  multiplierBps: bigint,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await contract.transact.startChain({
    signer,
    args: { payment, durationGameMs: durationMs, multiplierGameBps: multiplierBps, tokenIdGame: tokenId },
    ...buildTxParams(tokenId, payment),
  })
  return { txId: result.txId }
}

export async function joinChain(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  payment: bigint,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await contract.transact.joinChain({
    signer,
    args: { payment },
    ...buildTxParams(tokenId, payment),
  })
  return { txId: result.txId }
}

export async function endChain(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await contract.transact.endChain({
    signer,
    attoAlphAmount: isAlph(tokenId) ? ONE_ALPH : ONE_ALPH,
  })
  return { txId: result.txId }
}

export async function incentivize(
  contract: ChainReactionInstance,
  signer: SignerProvider,
  amount: bigint,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await contract.transact.incentive({
    signer,
    args: { amount },
    ...buildTxParams(tokenId, amount),
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
