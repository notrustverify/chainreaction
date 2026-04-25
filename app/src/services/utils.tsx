import { NetworkId, web3 } from "@alephium/web3";
import { loadDeployments } from "my-contracts/deployments"
import { FactoryChainReactionV2, ChainReactionV3 } from "my-contracts"
import type { FactoryChainReactionV2Instance, FactoryChainReactionInstance, ChainReactionV3Instance } from "my-contracts"

export interface GameConfig {
  network: NetworkId
  groupIndex: number
  factoryAddress: string
  factoryInstance: FactoryChainReactionV2Instance
  oldFactoryInstance: FactoryChainReactionInstance | null
  featuredAddress: string | undefined
  getFeaturedInstance: () => ChainReactionV3Instance | null
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

export function getExplorerBaseUrl(network: NetworkId = getNetwork()): string | null {
  switch (network) {
    case 'testnet': return 'https://testnet.alephium.org'
    case 'mainnet': return 'https://explorer.alephium.org'
    default: return null
  }
}

export function getTxExplorerUrl(txId: string, network: NetworkId = getNetwork()): string | null {
  const base = getExplorerBaseUrl(network)
  return base ? `${base}/transactions/${txId}` : null
}

function getGameConfig(): GameConfig {
  const network = getNetwork()
  web3.setCurrentNodeProvider(getNodeUrl(network))
  const deployments = loadDeployments(network)

  // FactoryChainReactionV2 is the current factory
  const v2Deployment = deployments.contracts.FactoryChainReactionV2
  const factory = v2Deployment
    ? v2Deployment.contractInstance
    : FactoryChainReactionV2.at(deployments.contracts.FactoryChainReaction.contractInstance.address)

  const groupIndex = factory.groupIndex
  const featuredAddress = process.env.NEXT_PUBLIC_FEATURED_GAME || undefined
  const getFeaturedInstance = (): ChainReactionV3Instance | null =>
    featuredAddress ? ChainReactionV3.at(featuredAddress) : null

  // FactoryChainReaction (V1) is the old factory — load its games until they finish
  const oldFactoryDeployment = deployments.contracts.FactoryChainReaction
  const oldFactoryInstance = oldFactoryDeployment
    ? oldFactoryDeployment.contractInstance
    : null

  return { network, groupIndex, factoryAddress: factory.address, factoryInstance: factory, oldFactoryInstance, featuredAddress, getFeaturedInstance }
}

export const gameConfig = getGameConfig()
