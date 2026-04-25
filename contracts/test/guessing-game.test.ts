import {
  web3,
  DUST_AMOUNT,
  ONE_ALPH,
  NULL_CONTRACT_ADDRESS,
  MINIMAL_CONTRACT_DEPOSIT,
  addressFromContractId,
  sleep
} from '@alephium/web3'
import { expectAssertionError, testNodeWallet } from '@alephium/web3-test'
import { GameHubFactory, GameRoom, MockDIAOracle } from '../artifacts/ts'
import { alphBalanceOf, getRandomSigner } from './utils'

// ─── constants ───────────────────────────────────────────────────────────────

const ENTRY_FEE         = ONE_ALPH                        // 1 ALPH per player
const NUMBER_RANGE_MAX  = 100n
const MAP_ENTRY_DEPOSIT = 100_000_000_000_000_000n        // 0.1 ALPH

// 32 zero bytes → u256From32Byte = 0 → target = 0 % R + 1 = 1 (any R ≥ 1)
const ZERO_RANDOMNESS = '0000000000000000000000000000000000000000000000000000000000000000'

// GameHubFactory ErrorCodes
const FACTORY_ERR = {
  InvalidMaxPlayers:  0,
  InvalidNumberRange: 1,
  InvalidExpiresAt:   2,
  InvalidEntryFee:    3,
} as const

// GameRoom ErrorCodes
const ERR = {
  RoomNotOpen:          0,
  RoomNotLocked:        1,
  RoomNotClaimable:     2,
  RoomFull:             4,
  NumberOutOfRange:     5,
  NotExpired:           7,
  NotPlayer:            9,
  AlreadyClaimed:       11,
  TooEarlyToResolve:    14,
  AlreadyExpired:       15,
  PlayersRemaining:     16,
  AlreadyJoined:        17,
  CannotForceSelf:      18,
  RoomNotDestroyable:   19,
  TooEarlyToForceClaim: 20,
} as const

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Default fields for a CLAIMABLE 3-player room, target = 1 */
function claimableFields(overrides: Record<string, unknown> = {}) {
  return {
    entryFee:          ENTRY_FEE,
    maxPlayers:        3n,
    numberRangeMax:    NUMBER_RANGE_MAX,
    expiresAt:         BigInt(Date.now() + 3_600_000),
    creator:           NULL_CONTRACT_ADDRESS,
    oracle:            '00',
    state:             2n,   // CLAIMABLE
    playerCount:       3n,
    pot:               3n * ENTRY_FEE,
    target:            1n,   // zero randomness → target = 1
    lockedAt:          0n,
    lockedAtRound:     0n,
    finalizedAt:       1n,   // 1 ms from epoch → satisfies forceClaim grace period
    creatorFeeEnabled: false,
    snapshotPot:       3n * ENTRY_FEE,
    ...overrides,
  } as const
}

/** ALPH the contract holds: pot + per-player map deposits + storage minimum */
function contractAlph(playerCount: bigint, pot: bigint) {
  return pot + playerCount * MAP_ENTRY_DEPOSIT + MINIMAL_CONTRACT_DEPOSIT
}

/** Minimal asset objects using the SDK's alphAmount field name */
function asset(alphAmount: bigint) { return { alphAmount } }
function inputAsset(address: string, alphAmount = DUST_AMOUNT) {
  return { address, asset: asset(alphAmount) }
}

/** Deploy a mock DIA oracle (lastRound=1, randomness=all-zeros → target=1) */
async function deployOracle(signer: any) {
  return MockDIAOracle.deploy(signer, {
    initialFields: { lastRound: 1n, randomBytes: ZERO_RANDOMNESS }
  })
}

/** Deploy template + factory backed by the given oracle contract id */
async function deployFactory(signer: any, oracleId: string) {
  const template = await GameRoom.deploy(signer, {
    initialFields: claimableFields({
      state: 0n, playerCount: 0n, pot: 0n, snapshotPot: 0n,
      expiresAt: 0n, oracle: oracleId, finalizedAt: 0n,
    })
  })
  const factory = await GameHubFactory.deploy(signer, {
    initialFields: {
      gameRoomTemplateId: template.contractInstance.contractId,
      oracleContractId:   oracleId,
      totalRooms:         0n,
    }
  })
  return factory.contractInstance
}

/** Create a room through the factory and return the GameRoom instance */
async function createRoom(
  factory: any, signer: any,
  opts: { maxPlayers?: bigint; numberRangeMax?: bigint; expiresOffsetMs?: number } = {}
) {
  const { maxPlayers = 3n, numberRangeMax = NUMBER_RANGE_MAX, expiresOffsetMs = 3_600_000 } = opts
  await factory.transact.createRoom({
    args: {
      entryFee: ENTRY_FEE, maxPlayers, numberRangeMax,
      expiresAt: BigInt(Date.now() + expiresOffsetMs),
    },
    signer,
    attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
  })
  const { events } = await web3.getCurrentNodeProvider()
    .events.getEventsContractContractaddress(factory.address, { start: 0 })
  const roomId = events[events.length - 1].fields[0].value as string
  return GameRoom.at(addressFromContractId(roomId))
}

// ─── Unit tests (testMethod — injected state, no blockchain tx) ───────────────

describe('GameRoom — unit tests', () => {
  beforeAll(() => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
  })

  let p1: any, p2: any, p3: any, p4: any
  beforeEach(async () => {
    p1 = await getRandomSigner(0)
    p2 = await getRandomSigner(0)
    p3 = await getRandomSigner(0)
    p4 = await getRandomSigner(0)
  }, 60_000)

  // ── bandPayout ─────────────────────────────────────────────────────────────

  it('bandPayout: exact hit → snapshotPot × 2 / maxPlayers', async () => {
    const r = await GameRoom.tests.bandPayout({
      initialFields: claimableFields({ snapshotPot: 3n * ENTRY_FEE, maxPlayers: 3n, target: 1n }),
      args: { num: 1n },
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(2n * ENTRY_FEE)           // 3 × 2 / 3 = 2 ALPH
  }, 30_000)

  it('bandPayout: top-5% boundary (distance = R/20) still pays 1.5×', async () => {
    const r = await GameRoom.tests.bandPayout({
      initialFields: claimableFields({ snapshotPot: 3n * ENTRY_FEE, maxPlayers: 3n, target: 1n }),
      args: { num: 6n },   // distance = 5 = 100/20 → boundary, still top-5%
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(1_500_000_000_000_000_000n) // 1.5 ALPH
  }, 30_000)

  it('bandPayout: top-20% boundary (distance = R/5) still pays 1.2×', async () => {
    const r = await GameRoom.tests.bandPayout({
      initialFields: claimableFields({ snapshotPot: 3n * ENTRY_FEE, maxPlayers: 3n, target: 1n }),
      args: { num: 21n },  // distance = 20 = 100/5 → boundary, still top-20%
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(1_200_000_000_000_000_000n) // 1.2 ALPH
  }, 30_000)

  it('bandPayout: one step outside top-20% → 0', async () => {
    const r = await GameRoom.tests.bandPayout({
      initialFields: claimableFields({ snapshotPot: 3n * ENTRY_FEE, maxPlayers: 3n, target: 1n }),
      args: { num: 22n },  // distance = 21 > R/5=20 → miss
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(0n)
  }, 30_000)

  it('bandPayout: uses snapshotPot — not the live pot', async () => {
    // pot is drained to 0.5 ALPH, snapshotPot still frozen at 3 ALPH
    const r = await GameRoom.tests.bandPayout({
      initialFields: claimableFields({
        pot:         500_000_000_000_000_000n,
        snapshotPot: 3n * ENTRY_FEE,
        maxPlayers: 3n, target: 1n,
      }),
      args: { num: 1n },
      initialAsset: asset(contractAlph(1n, 500_000_000_000_000_000n)),
    })
    // Must be 3 × 2 / 3 = 2 ALPH (snapshotPot), not 0.5 × 2 / 3 ≈ 0.33 ALPH (live pot)
    expect(r.returns).toEqual(2n * ENTRY_FEE)
  }, 30_000)

  // ── getPlayerPayout ────────────────────────────────────────────────────────

  it('getPlayerPayout: stable when live pot is partially drained', async () => {
    // 2 of 4 players already claimed — pot halved to 2 ALPH.
    // Without snapshotPot fix: 2 × 2 / 4 = 1 ALPH
    // With snapshotPot fix:    4 × 2 / 4 = 2 ALPH  ← correct
    const r = await GameRoom.tests.getPlayerPayout({
      initialFields: claimableFields({
        maxPlayers: 4n, playerCount: 2n,
        pot: 2n * ENTRY_FEE,        // half drained
        snapshotPot: 4n * ENTRY_FEE, // frozen at full pot
        target: 1n,
      }),
      args: { player: p1.address },
      initialMaps: { playerNumber: new Map([[p1.address, 1n]]) },
      initialAsset: asset(contractAlph(2n, 2n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(2n * ENTRY_FEE)
  }, 30_000)

  it('getPlayerPayout: returns 0 when state is not CLAIMABLE', async () => {
    const r = await GameRoom.tests.getPlayerPayout({
      initialFields: claimableFields({ state: 1n /* LOCKED */ }),
      args: { player: p1.address },
      initialMaps: { playerNumber: new Map([[p1.address, 1n]]) },
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(0n)
  }, 30_000)

  it('getPlayerPayout: returns 0 for a miss pick', async () => {
    const r = await GameRoom.tests.getPlayerPayout({
      initialFields: claimableFields({ target: 1n }),
      args: { player: p1.address },
      initialMaps: { playerNumber: new Map([[p1.address, 50n]]) }, // distance 49 → miss
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(0n)
  }, 30_000)

  it('getPlayerPayout: returns 0 for an address not in the room', async () => {
    const r = await GameRoom.tests.getPlayerPayout({
      initialFields: claimableFields({ target: 1n }),
      args: { player: p1.address },
      initialMaps: { playerNumber: new Map() }, // p1 never joined
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
    })
    expect(r.returns).toEqual(0n)
  }, 30_000)

  // ── claim ──────────────────────────────────────────────────────────────────

  it('claim: exact winner receives snapshotPot-based payout', async () => {
    const r = await GameRoom.tests.claim({
      initialFields: claimableFields({ target: 1n, snapshotPot: 3n * ENTRY_FEE, maxPlayers: 3n }),
      initialMaps: { playerNumber: new Map([
        [p1.address, 1n],   // exact hit
        [p2.address, 6n],   // top-5%
        [p3.address, 50n],  // miss
      ]) },
      initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
      inputAssets: [inputAsset(p1.address)],
    })
    // p1 removed from map after claim
    expect(r.maps?.playerNumber?.has(p1.address)).toBe(false)
    // pot decreased by exact-hit payout (3 ALPH → 1 ALPH)
    const updated = r.contracts.find((c: any) => c.address === r.contractAddress) as any
    expect(updated.fields.pot).toEqual(1n * ENTRY_FEE)
    const ev = r.events.find((e: any) => e.name === 'Claimed') as any
    expect(ev?.fields.payout).toEqual(2n * ENTRY_FEE)
  }, 30_000)

  it('claim: snapshotPot fairness — same band always produces same expected amount', async () => {
    // p1 claims with pot=4 ALPH; p2 claims with pot=2 ALPH (after p1).
    // snapshotPot=4 ALPH for both. Both exact hits. Both should yield the same expected payout.
    const fields4 = claimableFields({ maxPlayers: 4n, playerCount: 2n, pot: 4n * ENTRY_FEE, snapshotPot: 4n * ENTRY_FEE, target: 1n })
    const fields2 = claimableFields({ maxPlayers: 4n, playerCount: 2n, pot: 2n * ENTRY_FEE, snapshotPot: 4n * ENTRY_FEE, target: 1n })

    const [r1, r2] = await Promise.all([
      GameRoom.tests.bandPayout({ initialFields: fields4, args: { num: 1n }, initialAsset: asset(contractAlph(2n, 4n * ENTRY_FEE)) }),
      GameRoom.tests.bandPayout({ initialFields: fields2, args: { num: 1n }, initialAsset: asset(contractAlph(2n, 2n * ENTRY_FEE)) }),
    ])
    // snapshotPot × 2 / 4 = 4 × 2 / 4 = 2 ALPH in both cases
    expect(r1.returns).toEqual(2n * ENTRY_FEE)
    expect(r2.returns).toEqual(2n * ENTRY_FEE)
  }, 30_000)

  it('claim: solvency clamp — actual payout capped by live pot', async () => {
    // snapshotPot=4 ALPH → expected = 4×2/4 = 2 ALPH. But only 1 ALPH left.
    const r = await GameRoom.tests.claim({
      initialFields: claimableFields({
        maxPlayers: 4n, playerCount: 2n,
        pot: 1n * ENTRY_FEE,       // only 1 ALPH remains
        snapshotPot: 4n * ENTRY_FEE,
        target: 1n,
      }),
      initialMaps: { playerNumber: new Map([
        [p1.address, 1n], [p2.address, 1n],
      ]) },
      initialAsset: asset(contractAlph(2n, 1n * ENTRY_FEE)),
      inputAssets: [inputAsset(p1.address)],
    })
    const updated = r.contracts.find((c: any) => c.address === r.contractAddress) as any
    expect(updated.fields.pot).toEqual(0n)  // 1 ALPH paid out (clamped from expected 2)
    const ev = r.events.find((e: any) => e.name === 'Claimed') as any
    expect(ev?.fields.payout).toEqual(1n * ENTRY_FEE)
  }, 30_000)

  it('claim: fails when caller is not in the room', async () => {
    await expect(
      GameRoom.tests.claim({
        initialFields: claimableFields(),
        initialMaps: { playerNumber: new Map([[p2.address, 1n]]) }, // p1 not here
        initialAsset: asset(contractAlph(1n, 3n * ENTRY_FEE)),
        inputAssets: [inputAsset(p1.address)],
      })
    ).rejects.toThrow()
  }, 30_000)

  it('claim: fails when state is not CLAIMABLE', async () => {
    await expect(
      GameRoom.tests.claim({
        initialFields: claimableFields({ state: 0n /* OPEN */ }),
        initialMaps: { playerNumber: new Map([[p1.address, 1n]]) },
        initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
        inputAssets: [inputAsset(p1.address)],
      })
    ).rejects.toThrow()
  }, 30_000)

  // ── expireRoom ─────────────────────────────────────────────────────────────

  it('expireRoom: OPEN room past expiresAt → EXPIRED', async () => {
    const r = await GameRoom.tests.expireRoom({
      initialFields: claimableFields({
        state: 0n, expiresAt: 1n, // 1 ms from epoch — way in the past
        playerCount: 1n, pot: ENTRY_FEE, snapshotPot: 0n,
      }),
      initialAsset: asset(contractAlph(1n, ENTRY_FEE)),
      inputAssets: [inputAsset(p1.address)],
    })
    const updated = r.contracts.find((c: any) => c.address === r.contractAddress) as any
    expect(updated.fields.state).toEqual(3n) // EXPIRED
    expect(r.events.some((e: any) => e.name === 'RoomExpired')).toBe(true)
  }, 30_000)

  it('expireRoom: fails before expiresAt', async () => {
    await expect(
      GameRoom.tests.expireRoom({
        initialFields: claimableFields({
          state: 0n, expiresAt: BigInt(Date.now() + 3_600_000),
        }),
        initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
        inputAssets: [inputAsset(p1.address)],
      })
    ).rejects.toThrow()
  }, 30_000)

  // ── refund ─────────────────────────────────────────────────────────────────

  it('refund: EXPIRED player recovers entryFee, removed from map', async () => {
    const r = await GameRoom.tests.refund({
      initialFields: claimableFields({
        state: 3n, // EXPIRED
        playerCount: 1n, pot: ENTRY_FEE, snapshotPot: 0n,
      }),
      initialMaps: { playerNumber: new Map([[p1.address, 42n]]) },
      initialAsset: asset(contractAlph(1n, ENTRY_FEE)),
      inputAssets: [inputAsset(p1.address)],
    })
    expect(r.maps?.playerNumber?.has(p1.address)).toBe(false)
    expect(r.events.some((e: any) => e.name === 'Refunded')).toBe(true)
  }, 30_000)

  it('refund: fails when room is not EXPIRED', async () => {
    await expect(
      GameRoom.tests.refund({
        initialFields: claimableFields({ state: 0n /* OPEN */ }),
        initialMaps: { playerNumber: new Map([[p1.address, 1n]]) },
        initialAsset: asset(contractAlph(3n, 3n * ENTRY_FEE)),
        inputAssets: [inputAsset(p1.address)],
      })
    ).rejects.toThrow()
  }, 30_000)

  // ── destroy ────────────────────────────────────────────────────────────────

  it('destroy: pays 5% creator cut when creatorFeeEnabled and pot > 0', async () => {
    const residualPot = 500_000_000_000_000_000n // 0.5 ALPH left after claims
    const r = await GameRoom.tests.destroy({
      initialFields: claimableFields({
        state: 2n, playerCount: 0n,
        pot: residualPot, snapshotPot: 3n * ENTRY_FEE,
        creatorFeeEnabled: true, creator: p1.address,
      }),
      initialAsset: asset(residualPot + MINIMAL_CONTRACT_DEPOSIT),
      inputAssets: [inputAsset(p2.address)],
    })
    // 5% of 0.5 ALPH = 0.025 ALPH
    const ev = r.events.find((e: any) => e.name === 'RoomDestroyed') as any
    expect(ev?.fields.creatorCut).toEqual(25_000_000_000_000_000n)
  }, 30_000)

  it('destroy: no creator cut when creatorFeeEnabled is false', async () => {
    const r = await GameRoom.tests.destroy({
      initialFields: claimableFields({
        state: 2n, playerCount: 0n, pot: 0n,
        snapshotPot: 3n * ENTRY_FEE,
        creatorFeeEnabled: false, creator: p1.address,
      }),
      initialAsset: asset(MINIMAL_CONTRACT_DEPOSIT),
      inputAssets: [inputAsset(p2.address)],
    })
    const ev = r.events.find((e: any) => e.name === 'RoomDestroyed') as any
    expect(ev?.fields.creatorCut).toEqual(0n)
  }, 30_000)

  it('destroy: fails when playerCount > 0', async () => {
    await expect(
      GameRoom.tests.destroy({
        initialFields: claimableFields({ state: 2n, playerCount: 1n }),
        initialAsset: asset(contractAlph(1n, ENTRY_FEE)),
        inputAssets: [inputAsset(p1.address)],
      })
    ).rejects.toThrow()
  }, 30_000)
})

// ─── Integration tests (real devnet transactions) ─────────────────────────────

describe('GameRoom — integration tests', () => {
  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
  })

  let deployer: any
  let signers: any[]

  beforeEach(async () => {
    deployer = await testNodeWallet()
    signers = []
    for (let i = 0; i < 5; i++) signers.push(await getRandomSigner(0))
  }, 60_000)

  // ── factory ───────────────────────────────────────────────────────────────

  it('factory: deploys with totalRooms = 0', async () => {
    const factory = await deployFactory(deployer, '00')
    const state = await factory.fetchState()
    expect(state.fields.totalRooms).toEqual(0n)
  }, 30_000)

  it('createRoom: increments totalRooms and emits RoomCreated event', async () => {
    const factory = await deployFactory(deployer, '00')
    await factory.transact.createRoom({
      args: {
        entryFee: ENTRY_FEE, maxPlayers: 3n,
        numberRangeMax: NUMBER_RANGE_MAX,
        expiresAt: BigInt(Date.now() + 3_600_000),
      },
      signer: signers[0],
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
    })
    const state = await factory.fetchState()
    expect(state.fields.totalRooms).toEqual(1n)
    const { events } = await web3.getCurrentNodeProvider()
      .events.getEventsContractContractaddress(factory.address, { start: 0 })
    expect(events.length).toEqual(1) // RoomCreated
    expect(events[0].fields[1].value).toEqual(signers[0].address) // creator field
  }, 30_000)

  it('createRoom: fails when maxPlayers < 2', async () => {
    const factory = await deployFactory(deployer, '00')
    await expectAssertionError(
      factory.transact.createRoom({
        args: { entryFee: ENTRY_FEE, maxPlayers: 1n, numberRangeMax: NUMBER_RANGE_MAX, expiresAt: BigInt(Date.now() + 3_600_000) },
        signer: signers[0],
        attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
      }),
      factory.address, FACTORY_ERR.InvalidMaxPlayers
    )
  }, 30_000)

  it('createRoom: fails when numberRangeMax < 20', async () => {
    const factory = await deployFactory(deployer, '00')
    await expectAssertionError(
      factory.transact.createRoom({
        args: { entryFee: ENTRY_FEE, maxPlayers: 3n, numberRangeMax: 19n, expiresAt: BigInt(Date.now() + 3_600_000) },
        signer: signers[0],
        attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
      }),
      factory.address, FACTORY_ERR.InvalidNumberRange
    )
  }, 30_000)

  it('createRoom: fails when entryFee is 0', async () => {
    const factory = await deployFactory(deployer, '00')
    await expectAssertionError(
      factory.transact.createRoom({
        args: { entryFee: 0n, maxPlayers: 3n, numberRangeMax: NUMBER_RANGE_MAX, expiresAt: BigInt(Date.now() + 3_600_000) },
        signer: signers[0],
        attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
      }),
      factory.address, FACTORY_ERR.InvalidEntryFee
    )
  }, 30_000)

  it('createRoom: fails when expiresAt is in the past', async () => {
    const factory = await deployFactory(deployer, '00')
    await expectAssertionError(
      factory.transact.createRoom({
        args: { entryFee: ENTRY_FEE, maxPlayers: 3n, numberRangeMax: NUMBER_RANGE_MAX, expiresAt: 1n },
        signer: signers[0],
        attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT,
      }),
      factory.address, FACTORY_ERR.InvalidExpiresAt
    )
  }, 30_000)

  // ── joinRoom validation ───────────────────────────────────────────────────

  it('joinRoom: fails when number = 0', async () => {
    const factory = await deployFactory(deployer, '00')
    const room = await createRoom(factory, signers[0])
    await expectAssertionError(
      room.transact.joinRoom({ args: { number: 0n }, signer: signers[1], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT }),
      room.address, ERR.NumberOutOfRange
    )
  }, 30_000)

  it('joinRoom: fails when number > numberRangeMax', async () => {
    const factory = await deployFactory(deployer, '00')
    const room = await createRoom(factory, signers[0], { numberRangeMax: 50n })
    await expectAssertionError(
      room.transact.joinRoom({ args: { number: 51n }, signer: signers[1], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT }),
      room.address, ERR.NumberOutOfRange
    )
  }, 30_000)

  it('joinRoom: fails when player has already joined', async () => {
    const factory = await deployFactory(deployer, '00')
    const room = await createRoom(factory, signers[0])
    await room.transact.joinRoom({ args: { number: 42n }, signer: signers[1], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT })
    await expectAssertionError(
      room.transact.joinRoom({ args: { number: 43n }, signer: signers[1], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT }),
      room.address, ERR.AlreadyJoined
    )
  }, 30_000)

  // ── expiry + refund lifecycle ─────────────────────────────────────────────

  it('expiry + refund: player recovers entry fee from an unfilled room', async () => {
    const factory = await deployFactory(deployer, '00')
    const room = await createRoom(factory, signers[0], { expiresOffsetMs: 2_000 })

    const player = signers[1]
    await room.transact.joinRoom({ args: { number: 33n }, signer: player, attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT })

    const balanceBefore = await alphBalanceOf(player.address)
    await sleep(4_000)

    await room.transact.expireRoom({ signer: signers[2], attoAlphAmount: DUST_AMOUNT })
    await room.transact.refund({ signer: player, attoAlphAmount: DUST_AMOUNT })

    const balanceAfter = await alphBalanceOf(player.address)
    expect(balanceAfter).toBeGreaterThan(balanceBefore) // got ENTRY_FEE + deposit back minus gas

    const roomState = await room.fetchState()
    expect(roomState.fields.state).toEqual(3n)  // EXPIRED
    expect(roomState.fields.playerCount).toEqual(0n)
  }, 30_000)

  // ── room locking with mock oracle ─────────────────────────────────────────

  it('room locks when filled: OPEN → LOCKED, pot = maxPlayers × entryFee', async () => {
    const oracle = (await deployOracle(deployer)).contractInstance
    const factory = await deployFactory(deployer, oracle.contractId)
    const room = await createRoom(factory, signers[0], { maxPlayers: 2n })

    // First player — room stays OPEN
    await room.transact.joinRoom({ args: { number: 10n }, signer: signers[1], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT })
    let state = await room.fetchState()
    expect(state.fields.state).toEqual(0n)       // OPEN
    expect(state.fields.playerCount).toEqual(1n)

    // Second player fills the room — should lock
    await room.transact.joinRoom({ args: { number: 90n }, signer: signers[2], attoAlphAmount: ENTRY_FEE + MAP_ENTRY_DEPOSIT })
    state = await room.fetchState()
    expect(state.fields.state).toEqual(1n)             // LOCKED
    expect(state.fields.playerCount).toEqual(2n)
    expect(state.fields.pot).toEqual(2n * ENTRY_FEE)
    expect(state.fields.lockedAtRound).toBeGreaterThanOrEqual(0n)
  }, 60_000)
})
