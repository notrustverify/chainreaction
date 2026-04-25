import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { GameHubFactory } from '../artifacts/ts'

// networkId numbers: 0 = mainnet, 1 = testnet, 4 = devnet
// Pre-computed contract IDs from DIA *randomness* oracle addresses (group 0).
// See https://docs.alephium.org/infrastructure/Oracles/#randomness-oracles
// testnet address: 217k7FMPgahEQWCfSA1BN5TaxPsFovjPagpujkyxKDvS3
// mainnet address: v1v4cBXP9L7M9ryZZCx7tuXuNb9pnDLGb3JJkPBpbR1Z
const DIA_ORACLE_CONTRACT_IDS: Record<number, string> = {
  1: '5f801191ce2a35ce1aa2b2c511ed6f441c158cfbafa0e394b86ec7302d776000', // testnet
  0: '13b7679a42104fbe4b28461fe093e3bd6945b823a325a9840ac227de6338f300'  // mainnet
}

const deployGameHubFactory: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const templateResult = deployer.getDeployContractResult('GameRoom')
  const gameRoomTemplateId = templateResult.contractInstance.contractId

  const chainNetworkId = network.networkId
  const oracleContractId =
    process.env.ORACLE_CONTRACT_ID ??
    (chainNetworkId !== undefined ? DIA_ORACLE_CONTRACT_IDS[chainNetworkId] : undefined)

  if (!oracleContractId) {
    throw new Error(
      `No DIA oracle contract id for networkId "${chainNetworkId}". ` +
      `Set the ORACLE_CONTRACT_ID env var to the DIA randomness oracle contract id.`
    )
  }

  const result = await deployer.deployContract(GameHubFactory, {
    initialFields: {
      gameRoomTemplateId,
      oracleContractId,
      totalRooms: 0n
    }
  })

  console.log('GameHubFactory id:         ' + result.contractInstance.contractId)
  console.log('GameHubFactory address:    ' + result.contractInstance.address)
  console.log('Oracle contract id:        ' + oracleContractId)
  console.log('GameRoom template id:      ' + gameRoomTemplateId)
}

export default deployGameHubFactory
