// Service Worker for Chain Reaction background notifications
// Polls the Alephium node directly to detect game state changes

console.log('[SW] Service worker loaded')

let config = null // { nodeUrl, contractAddress, userAddress }
let wasLastPlayer = false
let wasActive = false
let notified5min = false
let notified1min = false
let polling = false

function normalizeAddress(address) {
  const idx = address.indexOf(':')
  return idx >= 0 ? address.slice(0, idx) : address
}

async function checkGameState() {
  if (!config) {
    console.log('[SW] checkGameState: no config, skipping')
    return
  }

  const url = `${config.nodeUrl}/contracts/${config.contractAddress}/state`
  console.log('[SW] Fetching:', url)

  try {
    const res = await fetch(url)
    console.log('[SW] Fetch response:', res.status)
    if (!res.ok) return

    const state = await res.json()
    const mut = state.mutFields

    const lastPlayer = mut[2].value
    const isActive = mut[7].value
    const endTimestamp = Number(mut[9].value)

    console.log('[SW] Game state — active:', isActive, 'lastPlayer:', lastPlayer, 'userAddr:', config.userAddress)

    // Detect new game started (was inactive, now active)
    if (!wasActive && isActive) {
      console.log('[SW] New game started! Showing notification')
      self.registration.showNotification('New game started!', {
        body: 'A new Chain Reaction round has begun. Join now!',
        icon: '/favicon.ico',
        tag: 'new-game',
      })
      notified5min = false
      notified1min = false
      wasLastPlayer = false
    }
    wasActive = isActive

    if (!isActive) {
      console.log('[SW] Game not active, waiting for new game')
      return
    }

    // Check if user was overtaken (only if wallet connected)
    if (config.userAddress) {
      const isUserLastPlayer = normalizeAddress(lastPlayer) === normalizeAddress(config.userAddress)

      if (wasLastPlayer && !isUserLastPlayer) {
        console.log('[SW] User overtaken! Showing notification')
        self.registration.showNotification("You've been overtaken!", {
          body: 'Someone just took the lead in Chain Reaction. Play now to reclaim it!',
          icon: '/favicon.ico',
          tag: 'overtaken',
        })
      }
      wasLastPlayer = isUserLastPlayer
    }

    // Check time warnings
    const remaining = endTimestamp - Date.now()

    if (remaining <= 5 * 60 * 1000 && remaining > 0 && !notified5min) {
      notified5min = true
      self.registration.showNotification('5 minutes left!', {
        body: 'Chain Reaction is ending soon. Make your move!',
        icon: '/favicon.ico',
        tag: 'time-warning',
      })
    }

    if (remaining <= 60 * 1000 && remaining > 0 && !notified1min) {
      notified1min = true
      self.registration.showNotification('1 minute left!', {
        body: 'Chain Reaction is about to end! Last chance to play!',
        icon: '/favicon.ico',
        tag: 'time-warning',
      })
    }
  } catch (e) {
    console.error('[SW] Fetch error:', e)
  }
}

// Recursive polling loop: check state, wait 10s, repeat
function pollLoop() {
  if (!polling) {
    console.log('[SW] pollLoop: polling stopped')
    return Promise.resolve()
  }

  return checkGameState()
    .then(() => new Promise((r) => setTimeout(r, 10000)))
    .then(() => pollLoop())
}

self.addEventListener('message', (event) => {
  const data = event.data
  console.log('[SW] Message received:', JSON.stringify(data))

  if (data.type === 'START_POLLING') {
    config = {
      nodeUrl: data.nodeUrl,
      contractAddress: data.contractAddress,
      userAddress: data.userAddress,
    }
    if (data.isLastPlayer !== undefined) {
      wasLastPlayer = data.isLastPlayer
    }
    if (!polling) {
      polling = true
      wasActive = true // assume game is active on start to avoid false "new game" notification
      notified5min = false
      notified1min = false
      console.log('[SW] Starting poll loop')
      // waitUntil keeps the SW alive as long as pollLoop is running
      event.waitUntil(pollLoop())
    } else {
      console.log('[SW] Already polling, updated config')
    }
  } else if (data.type === 'STOP_POLLING') {
    console.log('[SW] Stopping polling')
    polling = false
    config = null
  }
})

// Push events from the server — wakes the SW even when tab is closed
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const title = data.title || 'Chain Reaction'
    const body = data.body || ''

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        tag: data.tag || 'push',
      })
    )
  } catch (e) {
    console.error('[SW] Push parse error:', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow('/')
    })
  )
})

self.addEventListener('install', () => {
  console.log('[SW] Installing')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating')
  event.waitUntil(clients.claim())
})
