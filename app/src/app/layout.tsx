import '@/styles/globals.css'

import { gameConfig } from '@/services/utils'
import { AlephiumWalletProvider } from '@alephium/web3-react'
import React, { Suspense } from 'react'
import { NavBar } from '@/components/NavBar'
import { Footer } from '@/components/Footer'
import { ThemeBootstrap } from '@/components/ThemeBootstrap'
import { EmbeddedWalletProvider } from '@/embed/EmbeddedWalletContext'
import { EmbedResize } from '@/embed/EmbedResize'

export const metadata = {
  title: "Chain Reaction",
  description: "A blockchain game on Alephium - be the last player standing!",
}

const themeScript = `
(function(){
  var m = /[?&]theme=([^&]+)/.exec(location.search);
  var allowed = ['light','dark','elexium'];
  if (m && allowed.indexOf(m[1]) !== -1) {
    document.documentElement.setAttribute('data-theme', m[1]);
    document.documentElement.setAttribute('data-theme-forced', '1');
  } else {
    var stored = typeof localStorage !== 'undefined' && localStorage.getItem('chainreaction-theme');
    document.documentElement.setAttribute('data-theme', allowed.indexOf(stored) !== -1 ? stored : 'light');
    document.documentElement.setAttribute('data-theme-forced', '0');
  }
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Chain Reaction</title>
        <meta name="description" content="Chain Reaction game on Alephium" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <ThemeBootstrap />
        </Suspense>
        <AlephiumWalletProvider theme="retro" network={gameConfig.network} addressGroup={gameConfig.groupIndex}>
          <EmbeddedWalletProvider>
            <EmbedResize />
            <div className="theme-container min-h-screen flex flex-col items-center">
              <NavBar />
              {children}
              <Footer />
            </div>
          </EmbeddedWalletProvider>
        </AlephiumWalletProvider>
      </body>
    </html>
  )
}
