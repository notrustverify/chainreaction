// Resolve a public asset path relative to the app's base URL (handles GitHub Pages subpaths)
function assetUrl(path: string): string {
  if (typeof document === 'undefined') return path
  const base = document.querySelector('base')?.href
    || document.querySelector('link[rel="manifest"]')?.getAttribute('href')?.replace(/manifest\.json$/, '')
    || '/'
  return new URL(path.replace(/^\//, ''), new URL(base, location.href)).href
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    await navigator.serviceWorker.register(assetUrl('sw.js'))
    // .ready resolves only once the SW is fully activated
    return await navigator.serviceWorker.ready
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

export async function sendToSW(message: Record<string, unknown>): Promise<void> {
  const reg = await registerSW()
  if (!reg?.active) return
  reg.active.postMessage(message)
}

export async function notifyViaSW(title: string, options?: NotificationOptions): Promise<boolean> {
  const reg = await registerSW()
  if (!reg) return false

  try {
    await reg.showNotification(title, options)
    return true
  } catch {
    return false
  }
}

// Runtime config — loaded from /push-config.json, falls back to NEXT_PUBLIC_ env vars (baked at build/dev time)
let pushConfig: { pushServerUrl: string; vapidPublicKey: string } | null = null

async function getPushConfig() {
  if (pushConfig) return pushConfig
  try {
    const res = await fetch(assetUrl('push-config.json'))
    const file = await res.json()
    pushConfig = {
      pushServerUrl: file.pushServerUrl || process.env.NEXT_PUBLIC_PUSH_SERVER_URL || '',
      vapidPublicKey: file.vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    }
  } catch {
    pushConfig = {
      pushServerUrl: process.env.NEXT_PUBLIC_PUSH_SERVER_URL || '',
      vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    }
  }
  return pushConfig
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unconfigured' | 'unsupported' | 'permission-denied' | 'push-service-error' | 'server-error' | 'network-error'; detail?: string }

// Compare an existing subscription's applicationServerKey with the configured VAPID key.
// A subscription made with an old key can never be delivered to, so it must be replaced.
function subscriptionKeyMatches(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const key = subscription.options?.applicationServerKey
  if (!key) return true // unknown — assume fine
  const expected = urlBase64ToUint8Array(vapidPublicKey)
  const actual = new Uint8Array(key)
  if (actual.length !== expected.length) return false
  for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) return false
  return true
}

export async function subscribeToPush(contractAddress: string, userAddress: string | null, endTimestamp?: number | null): Promise<PushSubscribeResult> {
  const config = await getPushConfig()

  if (!config?.vapidPublicKey || !config?.pushServerUrl) {
    console.warn('[push] Missing pushServerUrl or vapidPublicKey, skipping push subscription')
    return { ok: false, reason: 'unconfigured' }
  }

  if (typeof window === 'undefined' || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }

  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return { ok: false, reason: 'permission-denied' }
  }

  const reg = await registerSW()
  if (!reg) {
    console.warn('[push] No SW registration, skipping push subscription')
    return { ok: false, reason: 'unsupported' }
  }

  let subscription: PushSubscription | null
  try {
    subscription = await reg.pushManager.getSubscription()
    if (subscription && !subscriptionKeyMatches(subscription, config.vapidPublicKey)) {
      console.log('[push] Existing subscription uses a different VAPID key, resubscribing')
      await subscription.unsubscribe().catch(() => {})
      subscription = null
    }
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      })
      console.log('[push] New push subscription created')
    }
  } catch (e: any) {
    console.warn('[push] pushManager.subscribe failed:', e?.name, e?.message)
    if (e?.name === 'NotAllowedError') return { ok: false, reason: 'permission-denied', detail: e.message }
    return { ok: false, reason: 'push-service-error', detail: e?.message }
  }

  try {
    const res = await fetch(`${config.pushServerUrl}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, contractAddress, userAddress, endTimestamp: endTimestamp || null }),
    })

    if (res.ok) {
      console.log('[push] Subscribed to push server:', config.pushServerUrl, 'contract:', contractAddress)
      return { ok: true }
    }
    const text = await res.text()
    console.warn('[push] Subscribe failed:', res.status, text)
    return { ok: false, reason: 'server-error', detail: `${res.status} ${text}` }
  } catch (e: any) {
    console.warn('[push] Could not reach push server:', e)
    return { ok: false, reason: 'network-error', detail: e?.message }
  }
}

export async function unsubscribeFromPush(contractAddress?: string): Promise<void> {
  const config = await getPushConfig()
  if (!config?.pushServerUrl) return

  const reg = await registerSW()
  if (!reg) return

  try {
    const subscription = await reg.pushManager.getSubscription()
    if (!subscription) return

    const res = await fetch(`${config.pushServerUrl}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint, contractAddress }),
    })

    if (res.ok) {
      console.log('[push] Unsubscribed from push server')
    } else {
      console.warn('[push] Unsubscribe failed:', res.status)
    }
  } catch (e) {
    console.warn('[push] Could not reach push server:', e)
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
