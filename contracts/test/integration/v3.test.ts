import { web3, DUST_AMOUNT, ONE_ALPH, prettifyAttoAlphAmount, number256ToBigint, number256ToNumber, NULL_CONTRACT_ADDRESS, sleep, ALPH_TOKEN_ID, MINIMAL_CONTRACT_DEPOSIT, addressFromContractId } from '@alephium/web3'
import { expectAssertionError, mintToken, testNodeWallet } from '@alephium/web3-test'
import { deployToDevnet } from '@alephium/cli'
import { ChainReaction, ChainReactionV3, FactoryChainReactionV2 } from '../../artifacts/ts'
import { alphBalanceOf, getRandomSigner, transferAlphTo, transferTokenTo } from '../utils'
import { bitTorrent } from 'viem/chains'
import { sign } from 'crypto'

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

    const deployed = await ChainReactionV3.deploy(signer, {
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
        burnedAmount: 0n,
        factoryId: NULL_CONTRACT_ADDRESS,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        feesBps: 0n,
        decayPeriodMs: 0n
      }
    })

    const factoryDeployed = await FactoryChainReactionV2.deploy(signer, {
      initialFields: {
        playContractTemplateId: deployed.contractInstance.contractId,
        numberGames: 0n
      },
    })


    const factory = factoryDeployed.contractInstance
    expect(factory).toBeDefined()

    if (!factory) {
      throw new Error('Factory is undefined')
    }

    factory.transact.createNewGame({
      args: {
        durationDecreaseMsGame: 0n,
        minDurationGame: 0n,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        tokenId: ALPH_TOKEN_ID
      },
      signer: signer,
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT

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
        burnRate: 0n,
        feesBpsGame: 0n,
        callerAddr: NULL_CONTRACT_ADDRESS,
        decayPeriodMsGame: 0n
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
          payment: payment,
          callerAddr: NULL_CONTRACT_ADDRESS
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

  it('start game with fees', async () => {
    const signer = await testNodeWallet()

    const now = Date.now() * 1000

    const deployed = await ChainReactionV3.deploy(signer, {
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
        burnedAmount: 0n,
        factoryId: NULL_CONTRACT_ADDRESS,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        feesBps: 0n,
        decayPeriodMs: 0n
      }
    })

    const factoryDeployed = await FactoryChainReactionV2.deploy(signer, {
      initialFields: {
        playContractTemplateId: deployed.contractInstance.contractId,
        numberGames: 0n
      },
    })


    const factory = factoryDeployed.contractInstance
    expect(factory).toBeDefined()

    if (!factory) {
      throw new Error('Factory is undefined')
    }

    await factory.transact.createNewGame({
      args: {
        durationDecreaseMsGame: 0n,
        minDurationGame: 0n,
        addrFees: minters[6].address,
        isFixedTokenId: false,
        tokenId: ALPH_TOKEN_ID
      },
      signer: minters[6],
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT

    })

    // Check that event is emitted
    const { events } = await web3
      .getCurrentNodeProvider()
      .events.getEventsContractContractaddress(factory.address, { start: 0 })
    expect(events.length).toEqual(1)

    const creationEvent = events[0]
    const gameId = creationEvent.fields[0].value as string

    const game = ChainReactionV3.at(addressFromContractId(gameId))

    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(0n)
    expect(initialState.fields.isActive).toEqual(false)
    expect(initialState.fields.factoryId).toBe(factory.contractId)

    await factory.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 1000n,
        multiplierGameBps: 1000n,
        tokenId: ALPH_TOKEN_ID,
        burnRate: 0n,
        gameContractId: gameId,
        feesBps: 1000n,
        decayPeriodMs: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + DUST_AMOUNT
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.multiplierBps).toEqual(1000n)
    expect(state.fields.feesBps).toEqual(1000n)
    expect(state.fields.addrFees).toEqual(minters[6].address)
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n + 10n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {
      const payment = (await game.view.getNextEntryPrice()).returns
      await factory.transact.joinChain({
        args: {
          gameContractId: gameId,
          payment: payment,
          tokenId: ALPH_TOKEN_ID
        },
        signer: minters[index],
        attoAlphAmount: payment + DUST_AMOUNT
      })

    }

    state = await game.fetchState()
    const feesAddrBalanceBeforeEnd = await alphBalanceOf(minters[6].address)

    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(1000)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    const feesAddrBalanceAfterEnd = await alphBalanceOf(minters[6].address)
    expect(feesAddrBalanceAfterEnd).toBeGreaterThan(feesAddrBalanceBeforeEnd)
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)


  }, 20000)

  it('start game custom token with fees', async () => {
    const signer = await testNodeWallet()

    const tokenTest = await mintToken((await signer.getSelectedAccount()).address, 100000n)


    const now = Date.now() * 1000

    const deployed = await ChainReactionV3.deploy(signer, {
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
        burnedAmount: 0n,
        factoryId: NULL_CONTRACT_ADDRESS,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        feesBps: 0n,
        decayPeriodMs: 0n
      }
    })

    const factoryDeployed = await FactoryChainReactionV2.deploy(signer, {
      initialFields: {
        playContractTemplateId: deployed.contractInstance.contractId,
        numberGames: 0n
      },
    })


    const factory = factoryDeployed.contractInstance
    expect(factory).toBeDefined()

    if (!factory) {
      throw new Error('Factory is undefined')
    }

    await factory.transact.createNewGame({
      args: {
        durationDecreaseMsGame: 0n,
        minDurationGame: 0n,
        addrFees: minters[6].address,
        isFixedTokenId: false,
        tokenId: ALPH_TOKEN_ID
      },
      signer: minters[6],
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT

    })

    // Check that event is emitted
    const { events } = await web3
      .getCurrentNodeProvider()
      .events.getEventsContractContractaddress(factory.address, { start: 0 })
    expect(events.length).toEqual(1)

    const creationEvent = events[0]
    const gameId = creationEvent.fields[0].value as string

    const game = ChainReactionV3.at(addressFromContractId(gameId))

    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(0n)
    expect(initialState.fields.isActive).toEqual(false)
    expect(initialState.fields.factoryId).toBe(factory.contractId)

    await transferTokenTo(minters[0].address, tokenTest.tokenId, 1000n)

    await factory.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 1000n,
        multiplierGameBps: 1000n,
        tokenId: tokenTest.contractId,
        burnRate: 0n,
        gameContractId: gameId,
        feesBps: 1000n,
        decayPeriodMs: 0n
      },
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.contractId,
        amount: 10n
      }]
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.multiplierBps).toEqual(1000n)
    expect(state.fields.feesBps).toEqual(1000n)
    expect(state.fields.addrFees).toEqual(minters[6].address)
    expect(state.asset.alphAmount).toEqual(10n ** 17n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {
      await transferTokenTo(minters[index].address, tokenTest.tokenId, 100n)

      const payment = (await game.view.getNextEntryPrice()).returns
      await factory.transact.joinChain({
        args: {
          gameContractId: gameId,
          payment: payment,
          tokenId: tokenTest.tokenId
        },
        signer: minters[index],
        attoAlphAmount: DUST_AMOUNT,
        tokens: [{
          id: tokenTest.tokenId,
          amount: payment
        }]
      })

    }

    state = await game.fetchState()
    const feesAddrBalanceBeforeEnd = await alphBalanceOf(minters[6].address)

    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(1000)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    const feesAddrBalanceAfterEnd = await alphBalanceOf(minters[6].address)
    expect(feesAddrBalanceAfterEnd).toBeGreaterThan(feesAddrBalanceBeforeEnd)
    expect(state.asset.tokens).toEqual([])
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)


  }, 20000)

  it('start game custom token with fees and fixed token', async () => {
    const signer = await testNodeWallet()

    const tokenTest = await mintToken((await signer.getSelectedAccount()).address, 100000n)


    const now = Date.now() * 1000

    const deployed = await ChainReactionV3.deploy(signer, {
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
        burnedAmount: 0n,
        factoryId: NULL_CONTRACT_ADDRESS,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        feesBps: 0n,
        decayPeriodMs: 0n
      }
    })

    const factoryDeployed = await FactoryChainReactionV2.deploy(signer, {
      initialFields: {
        playContractTemplateId: deployed.contractInstance.contractId,
        numberGames: 0n
      },
    })


    const factory = factoryDeployed.contractInstance
    expect(factory).toBeDefined()

    if (!factory) {
      throw new Error('Factory is undefined')
    }

    await factory.transact.createNewGame({
      args: {
        durationDecreaseMsGame: 0n,
        minDurationGame: 0n,
        addrFees: minters[6].address,
        isFixedTokenId: true,
        tokenId: tokenTest.tokenId
      },
      signer: minters[6],
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT

    })

    // Check that event is emitted
    const { events } = await web3
      .getCurrentNodeProvider()
      .events.getEventsContractContractaddress(factory.address, { start: 0 })
    expect(events.length).toEqual(1)

    const creationEvent = events[0]
    const gameId = creationEvent.fields[0].value as string

    const game = ChainReactionV3.at(addressFromContractId(gameId))

    const initialState = await game.fetchState()
    const multiplierBps = initialState.fields.multiplierBps
    expect(multiplierBps).toEqual(0n)
    expect(initialState.fields.isActive).toEqual(false)
    expect(initialState.fields.factoryId).toBe(factory.contractId)

    await transferTokenTo(minters[0].address, tokenTest.tokenId, 1000n)
    await factory.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 1000n,
        multiplierGameBps: 1000n,
        tokenId: tokenTest.contractId,
        burnRate: 0n,
        gameContractId: gameId,
        feesBps: 1000n,
        decayPeriodMs: 0n
      },
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.contractId,
        amount: 10n
      }]
    })


    let state = await game.fetchState()

    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.multiplierBps).toEqual(1000n)
    expect(state.fields.feesBps).toEqual(1000n)
    expect(state.fields.addrFees).toEqual(minters[6].address)
    expect(state.asset.alphAmount).toEqual(10n ** 17n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {
      await transferTokenTo(minters[index].address, tokenTest.tokenId, 100n)

      const payment = (await game.view.getNextEntryPrice()).returns
      await factory.transact.joinChain({
        args: {
          gameContractId: gameId,
          payment: payment,
          tokenId: tokenTest.tokenId
        },
        signer: minters[index],
        attoAlphAmount: DUST_AMOUNT,
        tokens: [{
          id: tokenTest.tokenId,
          amount: payment
        }]
      })

    }

    state = await game.fetchState()
    const feesAddrBalanceBeforeEnd = await alphBalanceOf(minters[6].address)

    const lastPayment = (await game.view.getNextEntryPrice()).returns
    await sleep(1000)

    await game.transact.endChain({
      signer: minters[0],
      attoAlphAmount: ONE_ALPH
    })

    state = await game.fetchState()

    const feesAddrBalanceAfterEnd = await alphBalanceOf(minters[6].address)
    expect(feesAddrBalanceAfterEnd).toBeGreaterThan(feesAddrBalanceBeforeEnd)
    expect(state.asset.tokens).toEqual([])
    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)

    await expectAssertionError(factory.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 1000n,
        multiplierGameBps: 1000n,
        tokenId: ALPH_TOKEN_ID,
        burnRate: 0n,
        gameContractId: gameId,
        feesBps: 1000n,
        decayPeriodMs: 0n
      },
      signer: minters[0],
      attoAlphAmount: 10n + DUST_AMOUNT,
    }), game.address, 9)



  }, 20000)


      it('start game with custom token id and incentive it', async () => {
    const signer = await testNodeWallet()

    const tokenTest = await mintToken((await signer.getSelectedAccount()).address,1000000n)
    await transferTokenTo(minters[0].address,tokenTest.tokenId, 100n)

    const now = Date.now() * 1000
    const deployed = await ChainReactionV3.deploy(signer, {
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
        burnedAmount: 0n,
        factoryId: NULL_CONTRACT_ADDRESS,
        addrFees: NULL_CONTRACT_ADDRESS,
        isFixedTokenId: false,
        feesBps: 0n,
        decayPeriodMs: 0n
      }
    })

      const factoryDeployed = await FactoryChainReactionV2.deploy(signer, {
      initialFields: {
        playContractTemplateId: deployed.contractInstance.contractId,
        numberGames: 0n
      },
    })


    const factory = factoryDeployed.contractInstance
    expect(factory).toBeDefined()

    if (!factory) {
      throw new Error('Factory is undefined')
    }

    await factory.transact.createNewGame({
      args: {
        durationDecreaseMsGame: 0n,
        minDurationGame: 0n,
        addrFees: minters[6].address,
        isFixedTokenId: true,
        tokenId: tokenTest.tokenId
      },
      signer: minters[6],
      attoAlphAmount: DUST_AMOUNT + MINIMAL_CONTRACT_DEPOSIT

    })

        // Check that event is emitted
    const { events } = await web3
      .getCurrentNodeProvider()
      .events.getEventsContractContractaddress(factory.address, { start: 0 })
    expect(events.length).toEqual(1)

    const creationEvent = events[0]
    const gameId = creationEvent.fields[0].value as string

    const game = ChainReactionV3.at(addressFromContractId(gameId))


    if (!game) {
      throw new Error('Game is undefined')
    }


    const initialState = await game.fetchState()
    expect(initialState.fields.isActive).toEqual(false)

    await factory.transact.startChain({
      args: {
        payment: 10n,
        durationGameMs: 500n,
        multiplierGameBps: 1000n,
        gameContractId: gameId,
        burnRate: 0n,
        tokenId: tokenTest.tokenId,
        feesBps: 0n,
        decayPeriodMs: 0n
      },
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.tokenId,
        amount: 10n
      }]
    })

    let state = await game.fetchState()
    const multiplierBps = state.fields.multiplierBps
    expect(multiplierBps).toEqual(1000n)

    await factory.transact.incentive({
      args: {
        amount: 100n,
        gameContractId: gameId,
        tokenId: tokenTest.tokenId
      },
      attoAlphAmount: DUST_AMOUNT,
      tokens: [{
        id: tokenTest.tokenId,
        amount: 100n
      }],
      signer: signer
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)
    expect(state.fields.pot).toEqual(10n)
    expect(state.fields.boostAmount).toEqual(100n)

    const nextPayment = (await game.view.getNextEntryPrice()).returns
    expect(nextPayment).toEqual(11n)

    for (let index = 1; index < 4; index++) {

      await transferTokenTo(minters[index].address, tokenTest.tokenId,20n)
      const payment = (await game.view.getNextEntryPrice()).returns

      state = await game.fetchState()

      await factory.transact.joinChain({
        args: {
          payment: payment,
          gameContractId: gameId,
          tokenId: tokenTest.tokenId
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

    await factory.transact.endChain({
      args:{
        gameContractId: gameId
      },
      signer: minters[0],
      attoAlphAmount: DUST_AMOUNT
    })

    state = await game.fetchState()

    expect(state.asset.alphAmount).toEqual(1n * 10n ** 17n)
    expect(state.asset.tokens).toEqual([])


  }, 20000)


})
