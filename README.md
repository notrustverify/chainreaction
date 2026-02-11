# Chain Reaction

A last-player-wins game on the [Alephium](https://alephium.org) blockchain.

## How it works

1. **Someone starts a chain** by choosing a token (ALPH or any supported token), setting an entry price, a countdown duration, and a price increase percentage.
2. **Players join** by paying the current entry price, which increases with each new player (e.g. +10% per join). Every join resets the countdown timer.
3. **The timer shrinks** — each new player slightly reduces the remaining duration, ratcheting up the pressure.
4. **When the countdown expires**, the last player to have joined wins the entire pot. Anyone can trigger the payout.

Anyone can also **boost the pot** by adding extra tokens at any time, making the prize more attractive without resetting the timer.

## Smart contract

The game runs entirely on-chain via a single Ralph contract (`ChainReaction`). Key mechanics:

- **Entry price escalation**: each join costs `currentEntry + (currentEntry * multiplierBps / 10000)`, where `multiplierBps` is set by the chain starter (e.g. 1000 = 10%)
- **Duration decrease**: the countdown shrinks by a fixed amount per player, down to a configurable minimum — the more players, the faster the clock runs out
- **Multi-token support**: chains can use ALPH or any Alephium token
- **No admin keys**: the contract has no owner and no special privileges — anyone can start a chain, join, boost the pot, or trigger the payout

## Project structure

- `app/` — Next.js frontend (React, Tailwind CSS, `@alephium/web3-react`)
- `contracts/` — Ralph smart contract and deployment scripts

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/)
- A running Alephium devnet — see the [Getting Started docs](https://docs.alephium.org/full-node/getting-started#devnet)

### Setup

```bash
yarn install
yarn compile
yarn deploy
yarn dev
```

### Wallet

Download an [Alephium wallet](https://alephium.org/#wallets) and connect it to your devnet.

## Deployment

The app is configured for static export and can be deployed to GitHub Pages. Environment variables:

- `NEXT_PUBLIC_NETWORK` — `devnet`, `testnet`, or `mainnet`
- `NEXT_PUBLIC_NODE_URL` — Alephium full node URL


## Url parameters 

theme  : forces the use of a custom theme  
tokens : comma-separated list of token IDs that are allowed when creating a game

exemple : 
https://game.notrustverify.ch/game?address=23hX2w3VFzwzNs1TTCbJiYHuhqKjRpyp5dWe5PJ64MNBR&theme=elexium&tokens=cad22f7c98f13fe249c25199c61190a9fb4341f8af9b1c17fcff4cd4b2c3d200


## Built by

[No Trust Verify](https://notrustverify.ch)
