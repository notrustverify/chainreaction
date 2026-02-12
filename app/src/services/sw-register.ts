export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    await navigator.serviceWorker.register('/sw.js')
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
    const res = await fetch('/push-config.json')
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

export async function subscribeToPush(contractAddress: string, userAddress: string | null): Promise<boolean> {
  const config = await getPushConfig()
  console.log('[push] Config loaded:', JSON.stringify(config))

  if (!config?.vapidPublicKey || !config?.pushServerUrl) {
    console.warn('[push] Missing pushServerUrl or vapidPublicKey, skipping push subscription')
    return false
  }

  const reg = await registerSW()
  if (!reg) {
    console.warn('[push] No SW registration, skipping push subscription')
    return false
  }

  try {
    let subscription = await reg.pushManager.getSubscription()
    console.log('[push] Existing subscription:', subscription ? 'yes' : 'no')
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      })
      console.log('[push] New push subscription created')
    }

    const res = await fetch(`${config.pushServerUrl}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, contractAddress, userAddress }),
    })

    if (res.ok) {
      console.log('[push] Subscribed to push server:', config.pushServerUrl, 'contract:', contractAddress)
    } else {
      console.warn('[push] Subscribe failed:', res.status, await res.text())
    }

    return res.ok
  } catch (e) {
    console.warn('[push] Could not reach push server:', e)
    return false
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
