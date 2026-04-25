'use client'

import { useState } from 'react'
import Link from 'next/link'

function Section({ title, badge, playHref, playLabel, children }: {
  title: string
  badge?: string
  playHref: string
  playLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full rounded-xl border border-card-border bg-card-bg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-stat-card-bg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-page-heading">{title}</span>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-status-warning-bg text-status-claimable">
              {badge}
            </span>
          )}
        </div>
        <span className="text-muted text-sm ml-4 shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 flex flex-col gap-5 border-t border-card-border">
          <div className="flex items-center justify-between pt-5">
            <p className="text-sm text-muted" />
            <Link href={playHref} className="text-xs text-nav-link hover:text-nav-link-hover whitespace-nowrap">
              {playLabel} →
            </Link>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}

export default function HowToPlayPage() {
  return (
    <main className="flex-1 w-full max-w-6xl px-4 py-8 flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold text-page-heading">How to Play</h1>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        <Section title="Chain Reaction" playHref="/" playLabel="Play Chain Reaction">
          <p className="text-sm text-muted -mt-2">Last-player-standing auction. The clock decides the winner.</p>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-page-heading">1. Start a chain</h3>
              <p className="mt-1 text-sm text-label">Pick a token, set the entry price, countdown duration, price increase, and burn rate. You become the first player.</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">2. Enter the chain</h3>
              <p className="mt-1 text-sm text-label">Each new player pays a higher entry fee (previous price + the % increase). Every play resets the countdown.</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">3. The clock tightens</h3>
              <p className="mt-1 text-sm text-label">The countdown shrinks with each player, making the game more intense. Once it reaches 1 minute, each new play resets the timer back to 1 minute instead of shrinking further.</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">4. Token burning</h3>
              <p className="mt-1 text-sm text-label">If a burn rate is set, a percentage of each entry fee is permanently burned. The rest goes to the pot.</p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">5. Last player wins</h3>
              <p className="mt-1 text-sm text-label">When the timer runs out, the last person who joined wins the entire pot. Anyone can trigger the payout.</p>
            </div>
            <p className="text-xs text-muted">You can also boost the pot at any time to make the prize more attractive without resetting the timer.</p>
          </div>
        </Section>

        <Section title="Number Guessing War" badge="New" playHref="/guess" playLabel="Play Guess">
          <p className="text-sm text-muted -mt-2">
            Pick a number and try to land closest to a drand-powered target, win a band-based payout.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-page-heading">1. Create or join a room</h3>
              <p className="mt-1 text-sm text-label">
                Anyone can create a room with a custom entry fee, max players, and number range (min 20).
                To join you approve the entry fee in ALPH and pick one number in the room&apos;s range. All picks are public on-chain — what&apos;s secret is the <em>target</em>, which isn&apos;t drawn until the room fills.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">2. Room locks when full</h3>
              <p className="mt-1 text-sm text-label">
                Once the room fills up, picks are frozen and the contract snapshots the current DIA randomness round.
                Nobody — not even miners — can change or predict the draw from this point on.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">3. Target is drawn</h3>
              <p className="mt-1 text-sm text-label">
                ~90 seconds after lock, anyone can trigger randomness resolution.
                The contract reads a future drand beacon (a signed, tamper-proof random value)
                and derives the winning number.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">4. Band-based payouts</h3>
              <p className="mt-1 text-sm text-label">
                Payouts are based on how close your pick is to the target. Within range <em>R = numberRangeMax</em>:
              </p>
              <ul className="mt-2 text-sm text-label space-y-1 pl-1">
                <li>
                  <span className="font-medium text-status-claimable">Exact hit</span>
                  <span className="text-muted"> · distance = 0 · </span>
                  <span className="font-medium">2.0×</span>
                </li>
                <li>
                  <span className="font-medium text-status-success-text">Top 5%</span>
                  <span className="text-muted"> · distance ≤ R / 20 · </span>
                  <span className="font-medium">1.5×</span>
                </li>
                <li>
                  <span className="font-medium text-status-success-text">Top 20%</span>
                  <span className="text-muted"> · distance ≤ R / 5 · </span>
                  <span className="font-medium">1.2×</span>
                </li>
                <li>
                  <span className="text-muted">Outside → no payout</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-muted">
                Your payout is fixed the moment the target is drawn — it won&apos;t change as others claim.
                In rare cases where many winners share a band and their combined payouts exceed the pot,
                later claimers may receive less. The game page shows a payout simulation so you can see
                your position before claiming.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">5. Claim your share</h3>
              <p className="mt-1 text-sm text-label">
                Your payout card shows your exact amount and whether any contention risk exists.
                Hit Claim to collect your payout plus a 0.1 ALPH refundable deposit.
                If you forget, anyone can force-claim on your behalf after 3 days (they keep the deposit bonus; you still get the payout).
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">6. Boost the pot</h3>
              <p className="mt-1 text-sm text-label">
                Anyone can add ALPH to the pot at any time while the room is active.
                Boosts before the draw increase everyone&apos;s payout proportionally.
                Boosts after the draw help late claimers by reducing insolvency risk.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-page-heading">7. Room expiry &amp; refunds</h3>
              <p className="mt-1 text-sm text-label">
                If a room never fills before its expiry, players can refund their entry in full.
                After all claims are processed, the creator receives a 5% fee (only if ≥ 3 players joined) and the room is destroyed.
              </p>
            </div>
          </div>
        </Section>

      </div>
    </main>
  )
}
