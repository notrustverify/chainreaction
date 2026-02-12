import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import webpush from 'web-push'

// --- Config ---

const PORT = parseInt(process.env.PORT || '3001')
const NODE_URL = process.env.ALEPHIUM_NODE_URL || 'https://node.mainnet.alephium.org'
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@chainreaction.game'
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000')
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Run: npm run generate-vapid-keys')
  process.exit(1)
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// --- Types ---

interface Subscriber {
  subscription: webpush.PushSubscription
  userAddress: string | null
  wasLastPlayer: boolean
  notified5min: boolean
  notified1min: boolean
}

interface ContractState {
  lastPlayer: string
  isActive: boolean
  endTimestamp: number
}

// --- State ---

// Map<contractAddress, Subscriber[]>
const contracts = new Map<string, Subscriber[]>()

// --- Alephium polling ---

function normalizeAddress(address: string): string {
  const idx = address.indexOf(':')
  return idx >= 0 ? address.slice(0, idx) : address
}

async function fetchContractState(contractAddress: string): Promise<ContractState | null> {
  try {
    const res = await fetch(`${NODE_URL}/contracts/${contractAddress}/state`)
    if (!res.ok) return null

    const state = await res.json() as { mutFields: Array<{ value: unknown }> }
    const mut = state.mutFields

    return {
      lastPlayer: mut[2].value as string,
      isActive: mut[7].value as boolean,
      endTimestamp: Number(mut[9].value),
    }
  } catch (e) {
    console.error(`[poll] Failed to fetch ${contractAddress}:`, e)
    return null
  }
}

async function sendPush(sub: Subscriber, payload: { title: string; body: string }) {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload))
  } catch (e: any) {
    // 410 Gone or 404 = subscription expired, remove it
    if (e.statusCode === 410 || e.statusCode === 404) {
      return 'expired'
    }
    console.error('[push] Send failed:', e.statusCode || e.message)
  }
  return 'ok'
}

async function pollContracts() {
  for (const [contractAddress, subs] of contracts.entries()) {
    if (subs.length === 0) {
      contracts.delete(contractAddress)
      continue
    }

    const state = await fetchContractState(contractAddress)
    if (!state) continue

    if (!state.isActive) {
      // Game ended — clean up all subscribers for this contract
      contracts.delete(contractAddress)
      continue
    }

    const remaining = state.endTimestamp - Date.now()
    const expiredIndices: number[] = []

    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i]

      // Check overtaken (only if user address is set)
      if (sub.userAddress) {
        const isUserLastPlayer = normalizeAddress(state.lastPlayer) === normalizeAddress(sub.userAddress)

        if (sub.wasLastPlayer && !isUserLastPlayer) {
          const result = await sendPush(sub, {
            title: "You've been overtaken!",
            body: 'Someone just took the lead in Chain Reaction. Play now to reclaim it!',
          })
          if (result === 'expired') { expiredIndices.push(i); continue }
        }
        sub.wasLastPlayer = isUserLastPlayer
      }

      // Check time warnings
      if (remaining <= 5 * 60 * 1000 && remaining > 0 && !sub.notified5min) {
        sub.notified5min = true
        const result = await sendPush(sub, {
          title: '5 minutes left!',
          body: 'Chain Reaction is ending soon. Make your move!',
        })
        if (result === 'expired') { expiredIndices.push(i); continue }
      }

      if (remaining <= 60 * 1000 && remaining > 0 && !sub.notified1min) {
        sub.notified1min = true
        const result = await sendPush(sub, {
          title: '1 minute left!',
          body: 'Chain Reaction is about to end! Last chance to play!',
        })
        if (result === 'expired') { expiredIndices.push(i); continue }
      }
    }

    // Remove expired subscriptions (reverse order to preserve indices)
    for (let i = expiredIndices.length - 1; i >= 0; i--) {
      subs.splice(expiredIndices[i], 1)
    }
  }
}

// --- HTTP helpers ---

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin || ''
  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  return false
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// --- Server ---

const server = createServer(async (req, res) => {
  if (cors(req, res)) return

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (req.method === 'POST' && url.pathname === '/subscribe') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        subscription: webpush.PushSubscription
        contractAddress: string
        userAddress?: string | null
      }

      if (!body.subscription?.endpoint || !body.contractAddress) {
        return json(res, 400, { error: 'Missing subscription or contractAddress' })
      }

      const subs = contracts.get(body.contractAddress) || []

      // Replace existing subscription for same endpoint
      const existing = subs.findIndex(s => s.subscription.endpoint === body.subscription.endpoint)
      const sub: Subscriber = {
        subscription: body.subscription,
        userAddress: body.userAddress || null,
        wasLastPlayer: false,
        notified5min: false,
        notified1min: false,
      }

      if (existing >= 0) {
        // Preserve wasLastPlayer state on re-subscribe
        sub.wasLastPlayer = subs[existing].wasLastPlayer
        subs[existing] = sub
      } else {
        subs.push(sub)
      }

      contracts.set(body.contractAddress, subs)

      console.log(`[subscribe] contract=${body.contractAddress} user=${body.userAddress || 'anonymous'} total=${subs.length}`)
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 400, { error: 'Invalid JSON' })
    }
  }

  if (req.method === 'POST' && url.pathname === '/unsubscribe') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        endpoint: string
        contractAddress?: string
      }

      if (!body.endpoint) {
        return json(res, 400, { error: 'Missing endpoint' })
      }

      if (body.contractAddress) {
        // Remove from specific contract
        const subs = contracts.get(body.contractAddress)
        if (subs) {
          const idx = subs.findIndex(s => s.subscription.endpoint === body.endpoint)
          if (idx >= 0) subs.splice(idx, 1)
          if (subs.length === 0) contracts.delete(body.contractAddress)
        }
      } else {
        // Remove from all contracts
        for (const [addr, subs] of contracts.entries()) {
          const idx = subs.findIndex(s => s.subscription.endpoint === body.endpoint)
          if (idx >= 0) subs.splice(idx, 1)
          if (subs.length === 0) contracts.delete(addr)
        }
      }

      const totalSubs = Array.from(contracts.values()).reduce((n, s) => n + s.length, 0)
      console.log(`[unsubscribe] contract=${body.contractAddress || 'all'} remaining=${totalSubs}`)
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 400, { error: 'Invalid JSON' })
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    const totalSubs = Array.from(contracts.values()).reduce((n, s) => n + s.length, 0)
    return json(res, 200, { ok: true, contracts: contracts.size, subscribers: totalSubs })
  }

  json(res, 404, { error: 'Not found' })
})

// --- Start ---

setInterval(pollContracts, POLL_INTERVAL)

server.listen(PORT, () => {
  console.log(`Push server listening on :${PORT}`)
  console.log(`Alephium node: ${NODE_URL}`)
  console.log(`Poll interval: ${POLL_INTERVAL}ms`)
})
