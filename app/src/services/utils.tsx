import { NetworkId, web3 } from "@alephium/web3";
import { loadDeployments } from "my-contracts/deployments"
import { ChainReactionInstance } from "my-contracts"

export interface GameConfig {
  network: NetworkId
  groupIndex: number
  chainReactionAddress: string
  contractInstance: ChainReactionInstance
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
  const chainReaction = loadDeployments(network).contracts.ChainReaction.contractInstance
  const groupIndex = chainReaction.groupIndex
  const chainReactionAddress = chainReaction.address
  return { network, groupIndex, chainReactionAddress, contractInstance: chainReaction }
}

export const gameConfig = getGameConfig()
