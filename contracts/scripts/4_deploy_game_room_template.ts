import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { GameRoom } from '../artifacts/ts'
import { NULL_CONTRACT_ADDRESS } from '@alephium/web3'

const deployGameRoomTemplate: DeployFunction<Settings> = async (
  deployer: Deployer,
  _network: Network<Settings>
): Promise<void> => {
  const result = await deployer.deployContract(GameRoom, {
    initialFields: {
      entryFee: 0n,
      maxPlayers: 2n,
      numberRangeMax: 100n,
      expiresAt: 0n,
      creator: NULL_CONTRACT_ADDRESS,
      oracle: '00',
      state: 0n,
      playerCount: 0n,
      pot: 0n,
      target: 0n,
      lockedAt: 0n,
      lockedAtRound: 0n,
      finalizedAt: 0n,
      creatorFeeEnabled: false,
      snapshotPot: 0n
    }
  })
  console.log('GameRoom template id:      ' + result.contractInstance.contractId)
  console.log('GameRoom template address: ' + result.contractInstance.address)
}

export default deployGameRoomTemplate
