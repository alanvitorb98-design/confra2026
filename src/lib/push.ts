import { db } from './backend'
import { isInstalled } from './install'

// Countdown reminders. The server (edge function "lembrete", called every hour) decides what to send;
// the phone only subscribes. The public half of the server's push key:
const VAPID = 'BI87pNcLKyENaK6h5SsoqBwoOTWFupvZSBaeQwt9HH7cc_GwVMz9jxom3BklJx5TQaCIKRHNQ0FJtw8U9IwTqkg'

export type PushState = 'unsupported' | 'install' | 'denied' | 'off' | 'on'

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const key = () => {
  const b = atob(VAPID.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function subscription() {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function pushState(): Promise<PushState> {
  // iPhone only allows notifications for apps added to the home screen
  if (ios() && !isInstalled()) return 'install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await subscription()) ? 'on' : 'off'
}

/** Must run from a tap: asks for permission and registers this phone. */
export async function enablePush(code: string): Promise<PushState> {
  if (!('Notification' in window)) return 'unsupported'
  const answer = await Notification.requestPermission()
  if (answer !== 'granted') return answer === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() }))
  const j = sub.toJSON()
  const { data, error } = await db.rpc('save_push', { p_code: code, p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth })
  if (error || !data) {
    await sub.unsubscribe()
    throw new Error('não deu pra ligar os avisos')
  }
  return 'on'
}

export async function disablePush() {
  const sub = await subscription()
  if (!sub) return
  await db.rpc('drop_push', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}

/** Sends today's reminder to this phone only, right now. */
export async function testPush() {
  const sub = await subscription()
  if (!sub) throw new Error('avisos desligados')
  const { error } = await db.functions.invoke('lembrete', { body: { op: 'test', endpoint: sub.endpoint } })
  if (error) throw new Error('o servidor não conseguiu mandar')
}
