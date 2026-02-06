import '@/styles/globals.css'

import { gameConfig } from '@/services/utils'
import { AlephiumWalletProvider } from '@alephium/web3-react'
import React from 'react'

export const metadata = {
  title: "Chain Reaction",
  description: "A blockchain game on Alephium - be the last player standing!",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Chain Reaction</title>
        <meta name="description" content="Chain Reaction game on Alephium" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-white text-gray-900 antialiased">
        <AlephiumWalletProvider theme="retro" network={gameConfig.network} addressGroup={gameConfig.groupIndex}>
          {children}
        </AlephiumWalletProvider>
      </body>
    </html>
  )
}
