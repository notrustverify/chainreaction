import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { ChainReaction } from '../artifacts/ts'
import { stringToHex, NULL_CONTRACT_ADDRESS } from '@alephium/web3'

// This deploy function will be called by cli deployment tool automatically
// Note that deployment scripts should prefixed with numbers (starting from 0)
const deployGame: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  // Get settings

  const result = await deployer.deployContract(ChainReaction,{
    initialFields:{
      baseEntry: 0n,
      chainId: 0n,
      currentEntry: 0n,
      endTimestamp: 0n,
      houseFee: 0n,
      isActive: false,
      lastEntryTimestamp: 0n,
      durationMs: 0n,
      lastPlayer: NULL_CONTRACT_ADDRESS,
      multiplierBps: 1000n,
      playerCount: 0n,
      pot: 0n,
      durationDecreaseMs: 60n*1000n,
      minDuration: 60n*1000n

    }
  })
  console.log('contract id: ' + result.contractInstance.contractId)
  console.log('contract address: ' + result.contractInstance.address)
}

export default deployGame
