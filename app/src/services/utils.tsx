import { NetworkId, web3 } from "@alephium/web3";
import { loadDeployments } from "my-contracts/deployments"
import { FactoryChainReactionV2, ChainReactionV1 } from "my-contracts"
import type { FactoryChainReactionV2Instance, ChainReactionV1Instance } from "my-contracts"

export interface GameConfig {
  network: NetworkId
  groupIndex: number
  factoryAddress: string
  factoryInstance: FactoryChainReactionV2Instance
  v1Address: string | undefined
  getV1Instance: () => ChainReactionV1Instance | null
}

function getNetwork(): NetworkId {
  const network = (process.env.NEXT_PUBLIC_NETWORK ?? 'devnet') as NetworkId
  return network
}

export function getNodeUrl(network: NetworkId): string {
  if (process.env.NEXT_PUBLIC_NODE_URL) return process.env.NEXT_PUBLIC_NODE_URL
  switch (network) {
    case 'devnet': return 'http://127.0.0.1:22973'
    case 'testnet': return 'https://node.testnet.alephium.org'
    case 'mainnet': return 'https://node.mainnet.alephium.org'
    default: return 'http://127.0.0.1:22973'
  }
}

function getGameConfig(): GameConfig {
  const network = getNetwork()
  web3.setCurrentNodeProvider(getNodeUrl(network))
  const deployments = loadDeployments(network)

  // Use FactoryChainReactionV2 if deployed, fall back to V1 address with V2 type
  const v2Deployment = deployments.contracts.FactoryChainReactionV2
  const factory = v2Deployment
    ? v2Deployment.contractInstance
    : FactoryChainReactionV2.at(deployments.contracts.FactoryChainReaction.contractInstance.address)

  const groupIndex = factory.groupIndex
  const v1Address = process.env.NEXT_PUBLIC_CHAINREACTIONV1 || undefined
  const getV1Instance = (): ChainReactionV1Instance | null =>
    v1Address ? ChainReactionV1.at(v1Address) : null
  return { network, groupIndex, factoryAddress: factory.address, factoryInstance: factory, v1Address, getV1Instance }
}

export const gameConfig = getGameConfig()
