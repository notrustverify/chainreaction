import { NetworkId, web3 } from "@alephium/web3";
import { loadDeployments } from "my-contracts/deployments"
import { FactoryChainReactionInstance, ChainReactionV1 } from "my-contracts"
import type { ChainReactionV1Instance } from "my-contracts"

export interface GameConfig {
  network: NetworkId
  groupIndex: number
  factoryAddress: string
  factoryInstance: FactoryChainReactionInstance
  v1Address: string | undefined
  getV1Instance: () => ChainReactionV1Instance | null
}

function getNetwork(): NetworkId {
  const network = (process.env.NEXT_PUBLIC_NETWORK ?? 'devnet') as NetworkId
  return network
}

function getNodeUrl(network: NetworkId): string {
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
  const factory = deployments.contracts.FactoryChainReaction!.contractInstance
  const groupIndex = factory.groupIndex
  const v1Address = process.env.NEXT_PUBLIC_CHAINREACTIONV1 || undefined
  const getV1Instance = (): ChainReactionV1Instance | null =>
    v1Address ? ChainReactionV1.at(v1Address) : null
  return { network, groupIndex, factoryAddress: factory.address, factoryInstance: factory, v1Address, getV1Instance }
}

export const gameConfig = getGameConfig()
