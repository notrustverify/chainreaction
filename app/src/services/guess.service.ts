import {
  SignerProvider,
  MINIMAL_CONTRACT_DEPOSIT,
  DUST_AMOUNT,
  prettifyAttoAlphAmount,
  addressFromContractId,
  web3,
  NetworkId
} from '@alephium/web3'
import {
  GameHubFactory,
  GameHubFactoryInstance,
  GameHubFactoryTypes,
  GameRoom,
  GameRoomInstance,
  GameRoomTypes
} from 'my-contracts'

export const ROOM_STATE_OPEN = 0n
export const ROOM_STATE_LOCKED = 1n
export const ROOM_STATE_CLAIMABLE = 2n
export const ROOM_STATE_EXPIRED = 3n
export const ROOM_STATE_DESTROYED = 4n

export function roomStateLabel(state: bigint): string {
  if (state === ROOM_STATE_OPEN) return 'Open'
  if (state === ROOM_STATE_LOCKED) return 'Locked'
  if (state === ROOM_STATE_CLAIMABLE) return 'Claimable'
  if (state === ROOM_STATE_EXPIRED) return 'Expired'
  if (state === ROOM_STATE_DESTROYED) return 'Destroyed'
  return 'Unknown'
}

export interface RoomInfo {
  contractId: string
  address: string
  entryFee: bigint
  maxPlayers: bigint
  numberRangeMax: bigint
  expiresAt: bigint
  creator: string
  state: bigint
  playerCount: bigint
  pot: bigint
  target: bigint
  lockedAt: bigint
  finalizedAt: bigint
}

// Must match the `RANDOMNESS_DELAY_MS` constant in GameRoom.ral.
export const RANDOMNESS_DELAY_MS = 90_000n

// Alephium map-entry deposit: players pay it at joinRoom alongside the entry
// fee, the VM holds it until remove!() and refunds it to the player on claim
// or refund (or to the caller on forceClaim as a cleanup bounty).
export const MAP_ENTRY_DEPOSIT = 100_000_000_000_000_000n // 0.1 ALPH

// Must match the `LOCKED_TIMEOUT_MS` constant in GameRoom.ral (24h emergency
// exit for LOCKED rooms whose oracle round never resolved).
export const LOCKED_TIMEOUT_MS = 86_400_000n

// Must match the `FORCE_CLAIM_GRACE_MS` constant in GameRoom.ral. Grace
// period after a room enters a terminal state (CLAIMABLE or EXPIRED) during
// which only the player themselves can claim/refund their entry. Past this
// window, any third party can forceClaim on their behalf and pocket both
// the band payout and the 0.1 ALPH map deposit as a cleanup bounty.
export const FORCE_CLAIM_GRACE_MS = 259_200_000n // 3 days

export interface GuessConfig {
  network: NetworkId
  factoryAddress: string
  factoryInstance: GameHubFactoryInstance
}

export function getGuessConfig(): GuessConfig | null {
  const network = (process.env.NEXT_PUBLIC_NETWORK ?? 'devnet') as NetworkId

  const factoryAddress = process.env.NEXT_PUBLIC_GAME_HUB_ADDRESS
  if (!factoryAddress) return null

  web3.setCurrentNodeProvider(
    process.env.NEXT_PUBLIC_NODE_URL ??
      (network === 'mainnet'
        ? 'https://node.mainnet.alephium.org'
        : network === 'testnet'
        ? 'https://node.testnet.alephium.org'
        : 'http://127.0.0.1:22973')
  )

  return { network, factoryAddress, factoryInstance: GameHubFactory.at(factoryAddress) }
}

export async function createRoom(
  factory: GameHubFactoryInstance,
  signer: SignerProvider,
  entryFee: bigint,
  maxPlayers: bigint,
  numberRangeMax: bigint,
  expiresAt: bigint
): Promise<{ txId: string; roomContractId?: string }> {
  const result = await factory.transact.createRoom({
    signer,
    args: { entryFee, maxPlayers, numberRangeMax, expiresAt },
    attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT + DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function joinRoom(
  room: GameRoomInstance,
  signer: SignerProvider,
  number: bigint,
  entryFee: bigint
): Promise<{ txId: string }> {
  const result = await room.transact.joinRoom({
    signer,
    args: { number },
    // entryFee → pot, MAP_ENTRY_DEPOSIT → map-entry deposit (refunded on claim)
    attoAlphAmount: entryFee + MAP_ENTRY_DEPOSIT + DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function resolveRandomness(
  room: GameRoomInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await room.transact.resolveRandomness({
    signer,
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function claim(
  room: GameRoomInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await room.transact.claim({
    signer,
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function refund(
  room: GameRoomInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await room.transact.refund({
    signer,
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function expireRoom(
  room: GameRoomInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await room.transact.expireRoom({
    signer,
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function forceClaim(
  room: GameRoomInstance,
  signer: SignerProvider,
  player: string
): Promise<{ txId: string }> {
  const result = await room.transact.forceClaim({
    signer,
    args: { player },
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function boostPot(
  room: GameRoomInstance,
  signer: SignerProvider,
  amount: bigint
): Promise<{ txId: string }> {
  const result = await room.transact.boostPot({
    signer,
    args: { amount },
    attoAlphAmount: amount + DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function destroyRoom(
  room: GameRoomInstance,
  signer: SignerProvider
): Promise<{ txId: string }> {
  const result = await room.transact.destroy({
    signer,
    attoAlphAmount: DUST_AMOUNT
  })
  return { txId: result.txId }
}

export async function fetchRoomState(room: GameRoomInstance): Promise<RoomInfo> {
  const state = await room.fetchState()
  const f = state.fields
  return {
    contractId: room.contractId,
    address: room.address,
    entryFee: f.entryFee,
    maxPlayers: f.maxPlayers,
    numberRangeMax: f.numberRangeMax,
    expiresAt: f.expiresAt,
    creator: f.creator,
    state: f.state,
    playerCount: f.playerCount,
    pot: f.pot,
    target: f.target,
    lockedAt: f.lockedAt,
    finalizedAt: f.finalizedAt
  }
}

export async function getPlayerPayout(room: GameRoomInstance, player: string): Promise<bigint> {
  const result = await room.view.getPlayerPayout({ args: { player } })
  return result.returns
}

export async function hasPlayerJoined(room: GameRoomInstance, player: string): Promise<boolean> {
  const map = room.maps.playerNumber
  return map.contains(player)
}

export async function getPlayerNumber(room: GameRoomInstance, player: string): Promise<bigint | null> {
  const map = room.maps.playerNumber
  const has = await map.contains(player)
  if (!has) return null
  return (await map.get(player)) ?? null
}

export function formatAlph(attoAlph: bigint): string {
  return prettifyAttoAlphAmount(attoAlph) ?? '0'
}

export async function pollTxConfirmed(txId: string): Promise<void> {
  const provider = web3.getCurrentNodeProvider()
  while (true) {
    try {
      const status = await provider.transactions.getTransactionsStatus({ txId })
      if (status.type === 'Confirmed') return
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 2000))
  }
}
