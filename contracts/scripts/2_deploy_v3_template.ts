import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { ChainReactionV3 } from '../artifacts/ts'
import { NULL_CONTRACT_ADDRESS, ALPH_TOKEN_ID } from '@alephium/web3'

const deployV3Template: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const result = await deployer.deployContract(ChainReactionV3, {
    initialFields: {
      factoryId: '00',
      durationDecreaseMs: 60n * 1000n,
      minDuration: 60n * 1000n,
      addrFees: NULL_CONTRACT_ADDRESS,
      isFixedTokenId: false,
      chainId: 0n,
      currentEntry: 0n,
      lastPlayer: NULL_CONTRACT_ADDRESS,
      lastEntryTimestamp: 0n,
      pot: 0n,
      boostAmount: 0n,
      playerCount: 0n,
      isActive: false,
      baseEntry: 0n,
      endTimestamp: 0n,
      durationMs: 0n,
      multiplierBps: 1000n,
      tokenId: ALPH_TOKEN_ID,
      burnBps: 0n,
      burnedAmount: 0n,
      feesBps: 0n,
      decayPeriodMs: 0n,
    },
  })
  console.log('ChainReactionV3 template id: ' + result.contractInstance.contractId)
  console.log('ChainReactionV3 template address: ' + result.contractInstance.address)
}

export default deployV3Template
