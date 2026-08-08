import { useEffect, useRef } from 'react'
import { pushAPI } from '../services/api'

/**
 * Registers the service worker and subscribes the logged-in user to
 * web push notifications. Runs once per login (guarded by a ref so it
 * doesn't re-fire on every render).
 */
export default function usePushNotifications(enabled) {
  const startedRef = useRef(false)

  useEffect(() => {
    // Reset the guard when logging out, so a *different* user logging in
    // later in the same tab re-subscribes (the push subscription needs to
    // be re-associated with the new user's id on the backend).
    if (!enabled) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true

    const init = async () => {
      // 1. Feature detection
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[push] Web Push not supported in this browser')
        return
      }

      // 2. Register the service worker
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (err) {
        console.error('[push] Service worker registration failed:', err)
        return
      }

      // 3. Get the VAPID public key from the backend
      let publicKey
      try {
        const res = await pushAPI.getVapidKey()
        publicKey = res.data.data?.publicKey
      } catch {
        console.warn('[push] Could not fetch VAPID key')
        return
      }
      if (!publicKey) {
        console.warn('[push] VAPID key not configured on server')
        return
      }

      // 4. Request permission + subscribe
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })

        // 5. Send the subscription to the backend
        await pushAPI.subscribe({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
          },
        })
        console.log('[push] Subscribed to push notifications')
      } catch (err) {
        // User denied permission or subscription failed — not fatal
        console.warn('[push] Subscription failed:', err.message)
      }
    }

    init()
  }, [enabled])
}

/** Convert a base64url VAPID public key to a Uint8Array (required by the Push API). */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}