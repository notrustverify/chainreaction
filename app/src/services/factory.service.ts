import { SignerProvider, MINIMAL_CONTRACT_DEPOSIT, DUST_AMOUNT } from '@alephium/web3'
import { FactoryChainReactionV2Instance } from 'my-contracts'

export async function createNewGame(
  factory: FactoryChainReactionV2Instance,
  signer: SignerProvider,
  durationDecreaseMs: bigint,
  minDuration: bigint,
  addrFees: string,
  isFixedTokenId: boolean,
  tokenId: string
): Promise<{ txId: string }> {
  const result = await factory.transact.createNewGame({
    signer,
    args: {
      durationDecreaseMsGame: durationDecreaseMs,
      minDurationGame: minDuration,
      addrFees,
      isFixedTokenId,
      tokenId,
    },
    attoAlphAmount: MINIMAL_CONTRACT_DEPOSIT + DUST_AMOUNT,
  })
  return { txId: result.txId }
}
