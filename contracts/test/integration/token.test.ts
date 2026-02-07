import { web3, DUST_AMOUNT, ONE_ALPH, prettifyAttoAlphAmount, number256ToBigint, number256ToNumber, NULL_CONTRACT_ADDRESS, sleep, ALPH_TOKEN_ID } from '@alephium/web3'
import { expectAssertionError, mintToken, testNodeWallet } from '@alephium/web3-test'
import { deployToDevnet } from '@alephium/cli'
import { ChainReaction } from '../../artifacts/ts'
import { getRandomSigner, transferAlphTo, transferTokenTo } from '../utils'
import { bitTorrent } from 'viem/chains'

describe('integration tests', () => {
  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
  })

  let minters: any[]
  beforeEach(async () => {
    minters = []
    for (let i = 0; i < 10; i++) {
      minters.push(await getRandomSigner(0))
    }

    for (const minter of minters) {
      await transferAlphTo(minter.address, 100n * ONE_ALPH)
    }
  }, 20000)

  it('start game', async () => {
    const signer = await testNodeWallet()

    const now = Date.now() * 1000
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 1000n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 0n,
        minDuration: 500n,
        tokenId: ALPH_TOKEN_ID,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await game.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 1000n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + ONE_ALPH
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(10n)
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 10n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {
      const payment = (await game.view.getNextEntryPrice()).returns
      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: nextPayment + ONE_ALPH
      })

    }


    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(1000)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)


  }, 20000)

  it('start game and incentive it', async () => {
    const signer = await testNodeWallet()

    const now = Date.now() * 1000
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 0n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 500n,
        minDuration: 500n,
        tokenId: ALPH_TOKEN_ID,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await game.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 2000n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + ONE_ALPH
    })

    await game.transact.incentive({
      args: {
        amount: 10n * ONE_ALPH
      },
      attoAlphAmount: 10n * ONE_ALPH,
      signer: signer
    })

    let state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 10n + 10n * ONE_ALPH)
    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.boostAmount).toEqual(10n * ONE_ALPH)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)


    for (let index = 1; index < 4; index++) {
      const payment = (await game.view.getNextEntryPrice()).returns

      state = await game.fetchState()


      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: nextPayment + ONE_ALPH
      })

    }


    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(500)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)


  }, 20000)


    it('start game with custom token id and incentive it', async () => {
    const signer = await testNodeWallet()

    const tokenTest = await mintToken((await signer.getSelectedAccount()).address,1000000n)
    await transferTokenTo(minters[0].address,tokenTest.tokenId, 100n)

    const now = Date.now() * 1000
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 0n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 500n,
        minDuration: 500n,
        tokenId: tokenTest.tokenId,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await game.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 2000n,
        multiplierGameBps: 1000n,
        tokenIdGame: tokenTest.tokenId,
        burnRate: 0n
      },
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.tokenId,
        amount: 10n
      }]
    })

    await game.transact.incentive({
      args: {
        amount: 100n
      },
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.tokenId,
        amount: 100n
      }],
      signer: signer
    })

    let state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)
    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.boostAmount).toEqual(100n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {

      await transferTokenTo(minters[index].address, tokenTest.tokenId,20n)
      const payment = (await game.view.getNextEntryPrice()).returns

      state = await game.fetchState()

      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
       attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.tokenId,
        amount: payment
      }],
      })

    }

    state = await game.fetchState()
    expect(state.asset.tokens).toEqual([{
        id: tokenTest.tokenId,
        amount: 146n
      }])

    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(500)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)
    expect(state.asset.tokens).toEqual([])


  }, 20000)

  it('start game with players playing', async () => {
    const signer = await testNodeWallet()

    let now = BigInt(Date.now())
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 0n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 500n,
        minDuration: 500n,
        tokenId: ALPH_TOKEN_ID,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await game.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 500n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + ONE_ALPH
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(10n)
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 10n)


    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 6; index++) {

      const payment = (await game.view.getNextEntryPrice()).returns
      const canEnd = (await game.view.canEnd()).returns

      expect(canEnd).toBe(false)
      state = await game.fetchState()

      now = BigInt(Date.now())
      expect(state.fields.endTimestamp).toBeGreaterThan(now)

      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: nextPayment + ONE_ALPH
      })

    }

    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(1000)

    state = await game.fetchState()
    now = BigInt(Date.now())
    expect(state.fields.endTimestamp).toBeLessThanOrEqual(now)
    expect((await game.view.canEnd()).returns).toBe(true)
  

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)
    expect(state.asset.tokens).toEqual([])


  }, 20000)


    it('start game with players playing, check burn', async () => {
    const signer = await testNodeWallet()

    let now = BigInt(Date.now())
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 0n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 500n,
        minDuration: 500n,
        tokenId: ALPH_TOKEN_ID,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await game.transact.startChain({
      args: {
        payment: 1n * ONE_ALPH,
        durationGameMs: 500n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 500n
      },
      signer: minters[0],
      attoAlphAmount: 1n* ONE_ALPH + DUST_AMOUNT
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(1n * ONE_ALPH)
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 1n * ONE_ALPH)


    let nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(1100000000000000000n)

    for (let index = 1; index < 6; index++) {

      const payment = (await game.view.getNextEntryPrice()).returns
      const canEnd = (await game.view.canEnd()).returns

      expect(canEnd).toBe(false)
      state = await game.fetchState()

      now = BigInt(Date.now())
      expect(state.fields.endTimestamp).toBeGreaterThan(now)

      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: payment + DUST_AMOUNT
      })

    }

    await sleep(1000)

    state = await game.fetchState()
    now = BigInt(Date.now())
    expect(state.fields.endTimestamp).toBeLessThanOrEqual(now)
    expect((await game.view.canEnd()).returns).toBe(true)
  

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT
    })

    state = await game.fetchState()
    console.log(prettifyAttoAlphAmount(state.asset.alphAmount))
    expect(state.asset.alphAmount).toEqual(435780500000000000n)
    expect(state.fields.pot).toEqual(0n)
    expect(state.fields.boostAmount).toEqual(0n)
    expect(state.fields.burnedAmount).toEqual(0n)
    expect(state.asset.tokens).toEqual([])


    await game.transact.startChain({
      args: {
        payment: 1n * ONE_ALPH,
        durationGameMs: 500n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 500n
      },
      signer: minters[0],
      attoAlphAmount: 1n* ONE_ALPH + DUST_AMOUNT
    })


    state = await game.fetchState()

    expect(state.fields.pot).toEqual(1n * ONE_ALPH)
    expect(state.asset.alphAmount).toEqual(435780500000000000n+ONE_ALPH)


     nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(1100000000000000000n)

    for (let index = 1; index < 6; index++) {

      const payment = (await game.view.getNextEntryPrice()).returns
      const canEnd = (await game.view.canEnd()).returns

      expect(canEnd).toBe(false)
      state = await game.fetchState()

      now = BigInt(Date.now())
      expect(state.fields.endTimestamp).toBeGreaterThan(now)

      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: payment + DUST_AMOUNT
      })

    }

    await sleep(1000)

    state = await game.fetchState()
    now = BigInt(Date.now())
    expect(state.fields.endTimestamp).toBeLessThanOrEqual(now)
    expect((await game.view.canEnd()).returns).toBe(true)
  

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT
    })


    state = await game.fetchState()
    console.log(prettifyAttoAlphAmount(state.asset.alphAmount))
    expect(state.asset.alphAmount).toEqual(2n*435780500000000000n-1n * 10n ** 17n)
    expect(state.fields.pot).toEqual(0n)
    expect(state.fields.boostAmount).toEqual(0n)
    expect(state.asset.tokens).toEqual([])


  }, 20000)


  it('edge cases', async () => {
    const signer = await testNodeWallet()

    const now = Date.now() * 1000
    const deployed = await ChainReaction.deploy(signer, {
      initialFields: {
        baseEntry: 0n,
        chainId: 0n,
        currentEntry: 0n,
        endTimestamp: 0n,
        isActive: false,
        lastEntryTimestamp: 0n,
        durationMs: 0n,
        lastPlayer: NULL_CONTRACT_ADDRESS,
        multiplierBps: 1000n, // <-- customize per test
        playerCount: 0n,
        pot: 0n,
        durationDecreaseMs: 500n,
        minDuration: 500n,
        tokenId: ALPH_TOKEN_ID,
        boostAmount: 0n,
        burnBps: 0n,
        burnedAmount: 0n
      }
    })

    const game = deployed.contractInstance
    expect(game).toBeDefined()

    if (!game) {
      throw new Error('Game is undefined')
    }
    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)
    expect(initialState.fields.isActive).toEqual(false)

    await expectAssertionError(game.transact.startChain({
      signer: minters[8],
      attoAlphAmount: ONE_ALPH,
      args: {
        payment: 10n,
        durationGameMs: 100n,
        multiplierGameBps: 0n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 0n
      }
    }), game.address, 6)


    await game.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 2000n,
        multiplierGameBps: 1000n,
        tokenIdGame: ALPH_TOKEN_ID,
        burnRate: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + ONE_ALPH
    })

    await game.transact.incentive({
      args: {
        amount: 10n * ONE_ALPH
      },
      attoAlphAmount: 10n * ONE_ALPH,
      signer: signer
    })


    await expectAssertionError(game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    }), game.address, 4)


    let state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 10n + 10n * ONE_ALPH)
    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.boostAmount).toEqual(10n * ONE_ALPH)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)


    for (let index = 1; index < 4; index++) {
      const payment = (await game.view.getNextEntryPrice()).returns

      state = await game.fetchState()


      await game.transact.joinChain({
        args: {
          payment: payment
        },
        signer: minters[index],
        attoAlphAmount: nextPayment + ONE_ALPH
      })

    }


    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(500)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

     await expectAssertionError(game.transact.joinChain({
       signer: minters[8],
       attoAlphAmount: ONE_ALPH,
       args: {
         payment: 10n
       }
     }), game.address, 0)


    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)


  }, 20000)

})
