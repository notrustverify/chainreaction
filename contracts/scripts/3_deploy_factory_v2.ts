import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { FactoryChainReactionV2 } from '../artifacts/ts'

const deployFactoryV2: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const v3TemplateResult = deployer.getDeployContractResult('ChainReactionV3')

  const result = await deployer.deployContract(FactoryChainReactionV2, {
    initialFields: {
      playContractTemplateId: v3TemplateResult.contractInstance.contractId,
      numberGames: 0n,
    },
  })
  console.log('FactoryChainReactionV2 id: ' + result.contractInstance.contractId)
  console.log('FactoryChainReactionV2 address: ' + result.contractInstance.address)
}

export default deployFactoryV2
