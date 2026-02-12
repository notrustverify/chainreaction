# Embedding the game in an iframe (widget)

When the game runs inside an iframe, the parent frame can:

1. **Resize the iframe** – The game posts `chainreaction-embed-resize` with `width` and `height`. Listen and set the iframe size to avoid scrollbars.

2. **Share the parent’s wallet** – So the user doesn’t connect twice. The iframe listens for wallet state and can request the parent to sign transactions.

---

## How the top frame implements the wallet bridge

If the parent app uses the same stack (React, `@alephium/web3-react`, `my-contracts`, this app’s `game.service`), it can use the ready-made parent bridge:

```tsx
'use client'

import { useRef, useEffect } from 'react'
import { useWallet } from '@alephium/web3-react'
import { createParentWalletBridge } from '@/embed/parentWalletBridge'

export function PageWithEmbeddedGame() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const bridgeRef = useRef<ReturnType<typeof createParentWalletBridge> | null>(null)
  const { signer, account } = useWallet()

  useEffect(() => {
    bridgeRef.current = createParentWalletBridge({
      getSigner: () => signer,
      getAddress: () => account?.address ?? null,
      getPublicKey: () => account?.publicKey ?? null,
      getIframe: () => iframeRef.current,
      origin: 'https://your-game-origin.com', // optional; use '*' in dev
    })
    return () => {
      bridgeRef.current?.cleanup()
      bridgeRef.current = null
    }
  }, [signer, account])

  // When wallet connects/disconnects, tell the iframe
  useEffect(() => {
    bridgeRef.current?.sendWalletState()
  }, [account?.address])

  return (
    <iframe
      ref={iframeRef}
      src="https://your-game-origin.com/game?address=..."
      title="Chain Reaction"
    />
  )
}
```

What the parent bridge does:

1. **Listens for `chainreaction-embed-ready`** – When the iframe loads, it posts this. The bridge responds by sending the current wallet state (`chainreaction-wallet` with `address`, `publicKey`, or both `null` when disconnected) to the iframe.
2. **Listens for `chainreaction-sign-request`** – The iframe posts a sign request with `id` and **raw tx params** (`txParams`). The parent does **not** use the contract or game logic; it only deserializes the params and calls `signer.signAndSubmitExecuteScriptTx(params)`, then posts `chainreaction-sign-response` with `id` and either `txId` or `error`.
3. **`sendWalletState()`** – The parent should call this (or post `chainreaction-wallet` manually) whenever the wallet connects or disconnects so the iframe stays in sync.

The parent must provide **`getPublicKey`** (e.g. from `account?.publicKey` or `getSelectedAccount()?.publicKey`). The iframe needs the public key to build valid tx params for the parent to sign.

---

## Protocol reference (custom parent implementation)

If the parent is a different codebase, it can implement the same protocol by hand.

### Parent → iframe: wallet state

Send the current wallet address and **publicKey** (or both `null` when disconnected). The iframe needs `publicKey` to build tx params:

```js
iframe.contentWindow.postMessage({
  type: 'chainreaction-wallet',
  address: connectedAddress ?? null,
  publicKey: account?.publicKey ?? null
}, 'https://your-game-origin.com')
```

When the iframe loads, it posts `chainreaction-embed-ready`; the parent should respond with the current wallet state.

### Iframe → parent: sign requests

The iframe posts **raw tx params** only (no contract or game logic on parent):

```ts
{ type: 'chainreaction-sign-request', id: string, txParams: SerializedSignExecuteScriptTxParams }
```

The parent deserializes `txParams` (use `deserializeTxParams` from `@/embed/captureSigner` or equivalent) and calls:

```ts
signer.signAndSubmitExecuteScriptTx(deserializedParams)
```

Reply with:

```js
e.source.postMessage({ type: 'chainreaction-sign-response', id, txId: result.txId }, e.origin)
// or on error:
e.source.postMessage({ type: 'chainreaction-sign-response', id, error: err.message }, e.origin)
```

The parent does **not** need the contract or game service—only a signer and the ability to deserialize and submit the script tx.
