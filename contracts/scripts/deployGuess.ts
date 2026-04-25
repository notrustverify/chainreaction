import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { GameHubFactory, GameRoom } from '../artifacts/ts'
import { NULL_CONTRACT_ADDRESS } from '@alephium/web3'

// Step 1 – deploy the GameRoom template (zero-value placeholder fields)
const deployGameRoomTemplate: DeployFunction<Settings> = async (
  deployer: Deployer,
  _network: Network<Settings>
): Promise<void> => {
  const result = await deployer.deployContract(GameRoom, {
    initialFields: {
      // immutable
      roomId: '00',
      entryFee: 0n,
      maxPlayers: 2n,
      numberRangeMax: 100n,
      allowDuplicates: false,
      topKPercent: 50n,
      expiresAt: 0n,
      roomName: '00',
      creator: NULL_CONTRACT_ADDRESS,
      oracle: '00',
      factoryId: '00',
      // mutable
      state: 0n,
      playerCount: 0n,
      target: 0n,
      totalPot: 0n,
      creatorFee: 0n,
      keeperFee: 0n,
      randRequestedAt: 0n,
      finalizedWinners: 0n
    }
  })
  console.log('GameRoom template id:      ' + result.contractInstance.contractId)
  console.log('GameRoom template address: ' + result.contractInstance.address)
}

// Step 2 – deploy the GameHubFactory pointing at the template and the oracle
const deployGameHubFactory: DeployFunction<Settings> = async (
  deployer: Deployer,
  _network: Network<Settings>
): Promise<void> => {
  const templateResult = deployer.getDeployContractResult('GameRoom')
  const templateId = templateResult.contractInstance.contractId

  // The DIA oracle contract id must be set for the target network.
  // On devnet, set ORACLE_CONTRACT_ID in the environment or replace the placeholder.
  const oracleContractId = process.env.ORACLE_CONTRACT_ID ?? '00'

  const result = await deployer.deployContract(GameHubFactory, {
    initialFields: {
      gameRoomTemplateId: templateId,
      oracleContractId,
      totalRooms: 0n
    }
  })
  console.log('GameHubFactory id:         ' + result.contractInstance.contractId)
  console.log('GameHubFactory address:    ' + result.contractInstance.address)
}

// Export both steps; the CLI runs them in order (0 = template, 1 = factory)
export const step0 = deployGameRoomTemplate
export const step1 = deployGameHubFactory
export default deployGameRoomTemplate
