import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import Database from 'better-sqlite3'
import webpush from 'web-push'

// --- Config ---

const PORT = parseInt(process.env.PORT || '3001')
const NODE_URL = process.env.ALEPHIUM_NODE_URL || 'https://node.mainnet.alephium.org'
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@chainreaction.game'
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000')
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
const DB_PATH = process.env.DB_PATH || './data/push.db'

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Run: npm run generate-vapid-keys')
  process.exit(1)
}

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// --- Database ---

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    subscription TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    user_address TEXT,
    was_last_player INTEGER NOT NULL DEFAULT 0,
    notified_5min INTEGER NOT NULL DEFAULT 0,
    notified_1min INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(endpoint, contract_address)
  );

  CREATE TABLE IF NOT EXISTS contract_state (
    contract_address TEXT PRIMARY KEY,
    was_active INTEGER NOT NULL DEFAULT 0
  );
`)

// --- Prepared statements ---

const stmtUpsertSub = db.prepare(`
  INSERT INTO subscribers (endpoint, subscription, contract_address, user_address, was_last_player, notified_5min, notified_1min)
  VALUES (@endpoint, @subscription, @contractAddress, @userAddress, @wasLastPlayer, @notified5min, @notified1min)
  ON CONFLICT(endpoint, contract_address) DO UPDATE SET
    subscription = @subscription,
    user_address = @userAddress,
    was_last_player = CASE WHEN subscribers.was_last_player = 1 THEN 1 ELSE @wasLastPlayer END
`)

const stmtDeleteSub = db.prepare(`
  DELETE FROM subscribers WHERE endpoint = @endpoint AND contract_address = @contractAddress
`)

const stmtDeleteSubAll = db.prepare(`
  DELETE FROM subscribers WHERE endpoint = @endpoint
`)

const stmtGetSubs = db.prepare(`
  SELECT id, endpoint, subscription, contract_address, user_address,
         was_last_player, notified_5min, notified_1min
  FROM subscribers WHERE contract_address = @contractAddress
`)

const stmtGetContracts = db.prepare(`
  SELECT DISTINCT contract_address FROM subscribers
`)

const stmtDeleteById = db.prepare(`
  DELETE FROM subscribers WHERE id = @id
`)

const stmtUpdateFlags = db.prepare(`
  UPDATE subscribers SET was_last_player = @wasLastPlayer,
    notified_5min = @notified5min, notified_1min = @notified1min
  WHERE id = @id
`)

const stmtResetFlags = db.prepare(`
  UPDATE subscribers SET was_last_player = 0, notified_5min = 0, notified_1min = 0
  WHERE contract_address = @contractAddress
`)

const stmtGetContractState = db.prepare(`
  SELECT was_active FROM contract_state WHERE contract_address = @contractAddress
`)

const stmtUpsertContractState = db.prepare(`
  INSERT INTO contract_state (contract_address, was_active) VALUES (@contractAddress, @wasActive)
  ON CONFLICT(contract_address) DO UPDATE SET was_active = @wasActive
`)

const stmtCountSubs = db.prepare(`
  SELECT COUNT(*) as count FROM subscribers
`)

const stmtCountContracts = db.prepare(`
  SELECT COUNT(DISTINCT contract_address) as count FROM subscribers
`)

// --- Types ---

interface ContractState {
  lastPlayer: string
  isActive: boolean
  endTimestamp: number
}

interface SubRow {
  id: number
  endpoint: string
  subscription: string
  contract_address: string
  user_address: string | null
  was_last_player: number
  notified_5min: number
  notified_1min: number
}

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

async function sendPush(sub: SubRow, payload: { title: string; body: string }): Promise<'ok' | 'expired'> {
  try {
    const subscription = JSON.parse(sub.subscription) as webpush.PushSubscription
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (e: any) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      return 'expired'
    }
    console.error('[push] Send failed:', e.statusCode || e.message)
  }
  return 'ok'
}

async function pollContracts() {
  const contractRows = stmtGetContracts.all() as { contract_address: string }[]

  for (const { contract_address: contractAddress } of contractRows) {
    const subs = stmtGetSubs.all({ contractAddress }) as SubRow[]
    if (subs.length === 0) continue

    const state = await fetchContractState(contractAddress)
    if (!state) continue

    const prev = stmtGetContractState.get({ contractAddress }) as { was_active: number } | undefined
    const wasActive = prev?.was_active === 1
    stmtUpsertContractState.run({ contractAddress, wasActive: state.isActive ? 1 : 0 })

    if (!state.isActive) {
      continue
    }

    // Detect new game started (was inactive, now active)
    if (!wasActive && state.isActive) {
      console.log(`[poll] New game started on ${contractAddress}`)
      stmtResetFlags.run({ contractAddress })
      for (const sub of subs) {
        const result = await sendPush(sub, {
          title: 'New game started!',
          body: 'A new Chain Reaction round has begun. Join now!',
        })
        if (result === 'expired') stmtDeleteById.run({ id: sub.id })
      }
      // Re-fetch after deleting expired
      continue
    }

    const remaining = state.endTimestamp - Date.now()

    for (const sub of subs) {
      let wasLastPlayer = sub.was_last_player === 1
      let notified5min = sub.notified_5min === 1
      let notified1min = sub.notified_1min === 1
      let changed = false

      // Check overtaken (only if user address is set)
      if (sub.user_address) {
        const isUserLastPlayer = normalizeAddress(state.lastPlayer) === normalizeAddress(sub.user_address)

        if (wasLastPlayer && !isUserLastPlayer) {
          const result = await sendPush(sub, {
            title: "You've been overtaken!",
            body: 'Someone just took the lead in Chain Reaction. Play now to reclaim it!',
          })
          if (result === 'expired') { stmtDeleteById.run({ id: sub.id }); continue }
        }
        if (wasLastPlayer !== isUserLastPlayer) {
          wasLastPlayer = isUserLastPlayer
          changed = true
        }
      }

      // Check time warnings
      if (remaining <= 5 * 60 * 1000 && remaining > 0 && !notified5min) {
        notified5min = true
        changed = true
        const result = await sendPush(sub, {
          title: '5 minutes left!',
          body: 'Chain Reaction is ending soon. Make your move!',
        })
        if (result === 'expired') { stmtDeleteById.run({ id: sub.id }); continue }
      }

      if (remaining <= 60 * 1000 && remaining > 0 && !notified1min) {
        notified1min = true
        changed = true
        const result = await sendPush(sub, {
          title: '1 minute left!',
          body: 'Chain Reaction is about to end! Last chance to play!',
        })
        if (result === 'expired') { stmtDeleteById.run({ id: sub.id }); continue }
      }

      if (changed) {
        stmtUpdateFlags.run({
          id: sub.id,
          wasLastPlayer: wasLastPlayer ? 1 : 0,
          notified5min: notified5min ? 1 : 0,
          notified1min: notified1min ? 1 : 0,
        })
      }
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
        endTimestamp?: number | null
      }

      if (!body.subscription?.endpoint || !body.contractAddress) {
        return json(res, 400, { error: 'Missing subscription or contractAddress' })
      }

      // Pre-set notification flags so new subscribers don't get stale warnings
      const remaining = body.endTimestamp ? body.endTimestamp - Date.now() : Infinity
      stmtUpsertSub.run({
        endpoint: body.subscription.endpoint,
        subscription: JSON.stringify(body.subscription),
        contractAddress: body.contractAddress,
        userAddress: body.userAddress || null,
        wasLastPlayer: 0,
        notified5min: remaining <= 5 * 60 * 1000 ? 1 : 0,
        notified1min: remaining <= 60 * 1000 ? 1 : 0,
      })

      const count = (stmtGetSubs.all({ contractAddress: body.contractAddress }) as SubRow[]).length
      console.log(`[subscribe] contract=${body.contractAddress} user=${body.userAddress || 'anonymous'} total=${count}`)
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
        stmtDeleteSub.run({ endpoint: body.endpoint, contractAddress: body.contractAddress })
      } else {
        stmtDeleteSubAll.run({ endpoint: body.endpoint })
      }

      const total = (stmtCountSubs.get() as { count: number }).count
      console.log(`[unsubscribe] contract=${body.contractAddress || 'all'} remaining=${total}`)
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 400, { error: 'Invalid JSON' })
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    const totalSubs = (stmtCountSubs.get() as { count: number }).count
    const totalContracts = (stmtCountContracts.get() as { count: number }).count
    return json(res, 200, { ok: true, contracts: totalContracts, subscribers: totalSubs })
  }

  json(res, 404, { error: 'Not found' })
})

// --- Start ---

setInterval(pollContracts, POLL_INTERVAL)

const startupSubs = (stmtCountSubs.get() as { count: number }).count
const startupContracts = (stmtCountContracts.get() as { count: number }).count
console.log(`Restored ${startupSubs} subscriber(s) across ${startupContracts} contract(s) from database`)

server.listen(PORT, () => {
  console.log(`Push server listening on :${PORT}`)
  console.log(`Alephium node: ${NODE_URL}`)
  console.log(`Poll interval: ${POLL_INTERVAL}ms`)
  console.log(`Database: ${DB_PATH}`)
})
