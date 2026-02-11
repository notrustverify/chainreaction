import { web3 } from '@alephium/web3'

export interface TokenInfo {
  id: string
  name: string
  symbol: string
  decimals: number
  logoURI: string
}

const TOKEN_LIST_URLS: Record<string, string> = {
  mainnet: 'https://raw.githubusercontent.com/alephium/token-list/master/tokens/mainnet.json',
  testnet: 'https://raw.githubusercontent.com/alephium/token-list/master/tokens/testnet.json',
} 

let cachedTokens: TokenInfo[] | null = null

async function fetchTokenList(): Promise<TokenInfo[]> {
  if (cachedTokens) return cachedTokens

  const network = process.env.NEXT_PUBLIC_NETWORK ?? 'devnet'
  const url = TOKEN_LIST_URLS[network]
  if (!url) return [ALPH_TOKEN]

  try {
    const res = await fetch(url)
    const data = await res.json()
    const fetched = (data.tokens as TokenInfo[]).map(t => ({
      id: t.id,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      logoURI: t.logoURI,
    }))
    const hasAlph = fetched.some(t => t.id === ALPH_TOKEN.id)
    cachedTokens = hasAlph ? fetched : [ALPH_TOKEN, ...fetched]
    return cachedTokens
  } catch {
    return [ALPH_TOKEN]
  }
}

export async function fetchWalletTokens(address: string): Promise<TokenInfo[]> {
  const allTokens = await fetchTokenList()
  const tokenMap = new Map(allTokens.map(t => [t.id, t]))

  try {
    const provider = web3.getCurrentNodeProvider()
    const balance = await provider.addresses.getAddressesAddressBalance(address)

    const result: TokenInfo[] = []

    // ALPH is always available if the user has balance
    if (BigInt(balance.balance) > 0n) {
      result.push(tokenMap.get(ALPH_TOKEN.id) ?? ALPH_TOKEN)
    }

    // Add tokens the wallet holds that we have metadata for
    if (balance.tokenBalances) {
      for (const tb of balance.tokenBalances) {
        if (BigInt(tb.amount) > 0n) {
          const info = tokenMap.get(tb.id)
          if (info) result.push(info)
        }
      }
    }

    return result.length > 0 ? result : [ALPH_TOKEN]
  } catch {
    return [ALPH_TOKEN]
  }
}

export const ALPH_TOKEN: TokenInfo = {
  id: '0000000000000000000000000000000000000000000000000000000000000000',
  name: 'Alephium',
  symbol: 'ALPH',
  decimals: 18,
  logoURI: 'https://raw.githubusercontent.com/alephium/token-list/master/logos/ALPH.png',
}

export async function fetchTokenBalance(address: string, tokenId: string): Promise<bigint> {
  try {
    const provider = web3.getCurrentNodeProvider()
    const balance = await provider.addresses.getAddressesAddressBalance(address)

    if (tokenId === ALPH_TOKEN.id || /^0+$/.test(tokenId)) {
      return BigInt(balance.balance)
    }

    const token = balance.tokenBalances?.find(t => t.id === tokenId)
    return token ? BigInt(token.amount) : 0n
  } catch {
    return 0n
  }
}

export function findTokenById(tokens: TokenInfo[], id: string): TokenInfo | undefined {
  return tokens.find(t => t.id === id)
}

export async function resolveTokenInfo(tokenId: string): Promise<TokenInfo> {
  if (!tokenId || tokenId === ALPH_TOKEN.id || /^0+$/.test(tokenId)) {
    return ALPH_TOKEN
  }
  const allTokens = await fetchTokenList()
  return allTokens.find(t => t.id === tokenId) ?? {
    id: tokenId,
    name: tokenId.slice(0, 8),
    symbol: tokenId.slice(0, 6),
    decimals: 18,
    logoURI: '',
  }
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString()

  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const remainder = amount % divisor

  if (remainder === 0n) return whole.toString()

  const fracStr = remainder.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole}.${fracStr}`
}
