import { SignerProvider, ALPH_TOKEN_ID, prettifyAttoAlphAmount, DUST_AMOUNT, MINIMAL_CONTRACT_DEPOSIT, web3 } from '@alephium/web3'
import { ChainReactionInstance, ChainReactionV1Instance, ChainReactionV3Instance, ChainReactionV3 } from 'my-contracts'

export type GameContractInstance = ChainReactionInstance | ChainReactionV1Instance | ChainReactionV3Instance

export interface GameState {
  chainId: bigint
  currentEntry: bigint
  lastPlayer: string
  lastEntryTimestamp: bigint
  pot: bigint
  boostAmount: bigint
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
  burnBps: bigint
  burnedAmount: bigint
  decayPeriodMs: bigint
  isFixedTokenId: boolean
  isV3: boolean
}

function isAlph(tokenId: string): boolean {
  return !tokenId || tokenId === ALPH_TOKEN_ID || /^0+$/.test(tokenId)
}

function buildTxParams(tokenId: string, payment: bigint) {
  if (isAlph(tokenId)) {
    return { attoAlphAmount: payment + 5n*DUST_AMOUNT }
  }
  return {
    attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT + DUST_AMOUNT,
    tokens: [{ id: tokenId, amount: payment }],
  }
}

export async function fetchGameState(contract: GameContractInstance): Promise<GameState> {
  try {
    const state = await contract.fetchState()
    const fields = state.fields as Record<string, any>

    const nextEntryPriceResult = await contract.view.getNextEntryPrice()
    const canEndResult = await contract.view.canEnd()

    const isV3 = 'decayPeriodMs' in fields

    return {
      chainId: fields.chainId,
      currentEntry: fields.currentEntry,
      lastPlayer: fields.lastPlayer,
      lastEntryTimestamp: fields.lastEntryTimestamp,
      pot: fields.pot,
      boostAmount: fields.boostAmount,
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
      burnBps: fields.burnBps,
      burnedAmount: fields.burnedAmount,
      decayPeriodMs: fields.decayPeriodMs ?? 0n,
      isFixedTokenId: fields.isFixedTokenId ?? false,
      isV3,
    }
  } catch {
    // fetchState failed (code hash mismatch) - detect version from raw fields
    return fetchRawGameState(contract.address)
  }
}

// Fetch state via raw node API, auto-detecting V1 vs V3 from field counts
// V1: 2 immutable, 15 mutable
// V2: 3 immutable, 15 mutable (handled by typed fetchState above)
// V3: 5 immutable, 17 mutable
export async function fetchRawGameState(address: string): Promise<GameState> {
  const provider = web3.getCurrentNodeProvider()
  const state = await provider.contracts.getContractsAddressState(address)
  const mut = state.mutFields
  const imm = state.immFields

  if (imm.length >= 5 && mut.length >= 17) {
    return parseV3RawState(mut, imm)
  }
  return parseV1RawState(mut, imm)
}

// V3 mutable fields: chainId, currentEntry, lastPlayer, lastEntryTimestamp,
// pot, boostAmount, playerCount, isActive, baseEntry, endTimestamp,
// durationMs, multiplierBps, tokenId, burnBps, burnedAmount, feesBps, decayPeriodMs
// V3 immutable fields: factoryId, durationDecreaseMs, minDuration, addrFees, isFixedTokenId
function parseV3RawState(mut: any[], imm: any[]): GameState {
  const durationDecreaseMs = BigInt(imm[1].value as string)
  const minDuration = BigInt(imm[2].value as string)
  const isFixedTokenId = imm.length >= 5 ? (imm[4].value as boolean) : false

  const chainId = BigInt(mut[0].value as string)
  const currentEntry = BigInt(mut[1].value as string)
  const lastPlayer = mut[2].value as string
  const lastEntryTimestamp = BigInt(mut[3].value as string)
  const pot = BigInt(mut[4].value as string)
  const boostAmount = BigInt(mut[5].value as string)
  const playerCount = BigInt(mut[6].value as string)
  const isActive = mut[7].value as boolean
  const baseEntry = BigInt(mut[8].value as string)
  const endTimestamp = BigInt(mut[9].value as string)
  const durationMs = BigInt(mut[10].value as string)
  const multiplierBps = BigInt(mut[11].value as string)
  const tokenId = mut[12].value as string
  const burnBps = BigInt(mut[13].value as string)
  const burnedAmount = BigInt(mut[14].value as string)
  const decayPeriodMs = BigInt(mut[16].value as string)

  // Approximate getNextEntryPrice with decay logic (uses Date.now() instead of blockTimeStamp)
  let effectiveEntry = currentEntry
  if (isActive && decayPeriodMs > 0n && currentEntry > baseEntry) {
    const elapsed = BigInt(Date.now()) - lastEntryTimestamp
    const excess = currentEntry - baseEntry
    if (elapsed >= decayPeriodMs) {
      effectiveEntry = baseEntry
    } else {
      effectiveEntry = currentEntry - (excess * elapsed / decayPeriodMs)
    }
  }
  const nextEntryPrice = !isActive ? baseEntry : effectiveEntry + (effectiveEntry * multiplierBps / 10000n)
  const canEnd = isActive && BigInt(Date.now()) >= endTimestamp

  return {
    chainId, currentEntry, lastPlayer, lastEntryTimestamp,
    pot, boostAmount, isActive, playerCount, nextEntryPrice,
    canEnd, endTimestamp, baseEntry, multiplierBps,
    durationMs, durationDecreaseMs, minDuration, tokenId,
    burnBps, burnedAmount, decayPeriodMs,
    isFixedTokenId,
    isV3: true,
  }
}

// V1 mutable fields: chainId, currentEntry, lastPlayer, lastEntryTimestamp,
// pot, boostAmount, playerCount, isActive, baseEntry, endTimestamp,
// durationMs, multiplierBps, tokenId, burnBps, burnedAmount
// V1 immutable fields: durationDecreaseMs, minDuration
function parseV1RawState(mut: any[], imm: any[]): GameState {
  const chainId = BigInt(mut[0].value as string)
  const currentEntry = BigInt(mut[1].value as string)
  const lastPlayer = mut[2].value as string
  const lastEntryTimestamp = BigInt(mut[3].value as string)
  const pot = BigInt(mut[4].value as string)
  const boostAmount = BigInt(mut[5].value as string)
  const playerCount = BigInt(mut[6].value as string)
  const isActive = mut[7].value as boolean
  const baseEntry = BigInt(mut[8].value as string)
  const endTimestamp = BigInt(mut[9].value as string)
  const durationMs = BigInt(mut[10].value as string)
  const multiplierBps = BigInt(mut[11].value as string)
  const tokenId = mut[12].value as string
  const burnBps = BigInt(mut[13].value as string)
  const burnedAmount = BigInt(mut[14].value as string)

  const durationDecreaseMs = BigInt(imm[0].value as string)
  const minDuration = BigInt(imm[1].value as string)

  const nextEntryPrice = !isActive ? baseEntry : currentEntry + (currentEntry * multiplierBps / 10000n)
  const canEnd = isActive && BigInt(Date.now()) >= endTimestamp

  return {
    chainId, currentEntry, lastPlayer, lastEntryTimestamp,
    pot, boostAmount, isActive, playerCount, nextEntryPrice,
    canEnd, endTimestamp, baseEntry, multiplierBps,
    durationMs, durationDecreaseMs, minDuration, tokenId,
    burnBps, burnedAmount,
    decayPeriodMs: 0n,
    isFixedTokenId: false,
    isV3: false,
  }
}

export async function startChain(
  contract: GameContractInstance,
  signer: SignerProvider,
  payment: bigint,
  durationMs: bigint,
  multiplierBps: bigint,
  tokenId: string,
  burnRate: bigint,
  isV3: boolean = false,
  decayPeriodMs: bigint = 0n,
  feesBps: bigint = 0n,
): Promise<{ txId: string }> {
  if (isV3) {
    // V3 has extra args: callerAddr, feesBpsGame, decayPeriodMsGame
    // callerAddr is ignored when not called through factory
    const v3 = ChainReactionV3.at(contract.address)
    const result = await v3.transact.startChain({
      signer,
      args: {
        callerAddr: contract.address,
        payment,
        durationGameMs: durationMs,
        multiplierGameBps: multiplierBps,
        tokenIdGame: tokenId,
        burnRate,
        feesBpsGame: feesBps,
        decayPeriodMsGame: decayPeriodMs,
      },
      ...buildTxParams(tokenId, payment),
    })
    return { txId: result.txId }
  }

  // V2/V1
  const v2 = contract as ChainReactionInstance
  const result = await v2.transact.startChain({
    signer,
    args: { payment, durationGameMs: durationMs, multiplierGameBps: multiplierBps, tokenIdGame: tokenId, burnRate },
    ...buildTxParams(tokenId, payment),
  })
  return { txId: result.txId }
}

export async function joinChain(
  contract: GameContractInstance,
  signer: SignerProvider,
  payment: bigint,
  tokenId: string,
  isV3: boolean = false,
): Promise<{ txId: string }> {
  if (isV3) {
    // V3 joinChain has callerAddr param (ignored when not called through factory)
    const v3 = ChainReactionV3.at(contract.address)
    const result = await v3.transact.joinChain({
      signer,
      args: { callerAddr: contract.address, payment },
      ...buildTxParams(tokenId, payment),
    })
    return { txId: result.txId }
  }

  // V2/V1
  const v2 = contract as ChainReactionInstance
  const result = await v2.transact.joinChain({
    signer,
    args: { payment },
    ...buildTxParams(tokenId, payment),
  })
  return { txId: result.txId }
}

export async function endChain(
  contract: GameContractInstance,
  signer: SignerProvider,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await contract.transact.endChain({
    signer,
    attoAlphAmount: isAlph(tokenId) ? 5n*DUST_AMOUNT : 5n*DUST_AMOUNT,
  })
  return { txId: result.txId }
}

export async function incentivize(
  contract: GameContractInstance,
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

export function normalizeAddress(address: string): string {
  const idx = address.indexOf(':')
  return idx >= 0 ? address.slice(0, idx) : address
}

export function shortenAddress(address: string): string {
  const clean = normalizeAddress(address)
  if (clean.length <= 12) return clean
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`
}
