import { finalizeEvent } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { getIdentity } from './identity.js'

export const RELAYS = [
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social'
]

const CIRCLE_KIND = 30000
const CIRCLE_TAG = 'circles-v1'

let _pool = null
function pool() {
  if (!_pool) {
    _pool = new SimplePool({
      enableReconnect: true,
      // Respond to NIP-42 auth challenges using our generated keypair
      automaticallyAuth: (_url) => (authEvent) => {
        try {
          const raw = localStorage.getItem('circles:sk')
          if (!raw) return null
          const sk = new Uint8Array(JSON.parse(raw))
          return finalizeEvent(authEvent, sk)
        } catch { return null }
      }
    })
  }
  return _pool
}

// ─── Circle announcements ────────────────────────────────────────────────────

export async function announceCircle(circle) {
  const identity = getIdentity()
  if (!identity) throw new Error('No identity')

  const event = finalizeEvent({
    kind: CIRCLE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', circle.id],
      ['t', CIRCLE_TAG],
      ['starts', String(circle.startsAt)],
      ['duration', String(circle.duration)],
      ['status', circle.status],
      ['creator', identity.name]
    ],
    content: ''
  }, identity.sk)

  const results = await Promise.allSettled(pool().publish(RELAYS, event))
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') console.log('[nostr] published to', RELAYS[i])
    else console.warn('[nostr] relay rejected:', RELAYS[i], r.reason)
  })
  if (results.every(r => r.status === 'rejected')) throw new Error('All relays rejected the event')
  return event
}

// Any participant can close a circle — used when the last person leaves
export async function closeCircle(circle) {
  const identity = getIdentity()
  if (!identity) return
  const event = finalizeEvent({
    kind: CIRCLE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', circle.id],
      ['t', CIRCLE_TAG],
      ['starts', String(circle.startsAt)],
      ['duration', String(circle.duration)],
      ['status', 'closed'],
      ['creator', circle.creatorName]
    ],
    content: ''
  }, identity.sk)
  await Promise.any(pool().publish(RELAYS, event))
}

export async function updateCircleStatus(circleId, status) {
  const identity = getIdentity()
  if (!identity) return
  const circle = circleCache.get(circleId)
  if (!circle) return

  const event = finalizeEvent({
    kind: CIRCLE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', circleId],
      ['t', CIRCLE_TAG],
      ['starts', String(circle.startsAt)],
      ['duration', String(circle.duration)],
      ['status', status],
      ['creator', identity.name]
    ],
    content: ''
  }, identity.sk)

  await Promise.any(pool().publish(RELAYS, event))
}

// ─── Subscription ────────────────────────────────────────────────────────────

function handleCircleEvent(event, onCircle) {
  const hasTag = event.tags.some(t => t[0] === 't' && t[1] === CIRCLE_TAG)
  if (!hasTag) return
  console.log('[nostr] received circle event', event.id.slice(0, 8), event.tags.find(t => t[0] === 'status')?.[1])
  const circle = parseCircleEvent(event)
  if (circle) onCircle(circle)
}

export function subscribeToCircles(onCircle) {
  if (window.__DEMO_NOSTR_CIRCLES) return window.__DEMO_NOSTR_CIRCLES(onCircle)
  let stopped = false
  let sub = null

  function connect() {
    const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24
    console.log('[nostr] subscribing to circles since', new Date(since * 1000).toISOString())
    sub = pool().subscribeMany(
      RELAYS,
      { kinds: [CIRCLE_KIND], since },
      {
        onevent(event) { handleCircleEvent(event, onCircle) },
        oneose() { console.log('[nostr] end of stored events — live subscription active') },
        onclose(reasons) {
          console.warn('[nostr] subscription closed by relay:', reasons)
          if (!stopped) setTimeout(connect, 5000) // auto-reconnect
        }
      }
    )
  }

  connect()

  // Polling fallback — some relays don't push kind 30000 live events reliably
  let pollSince = Math.floor(Date.now() / 1000) - 120
  const pollInterval = setInterval(async () => {
    const cutoff = pollSince
    pollSince = Math.floor(Date.now() / 1000)
    try {
      const events = await pool().querySync(RELAYS, { kinds: [CIRCLE_KIND], since: cutoff })
      for (const event of events) handleCircleEvent(event, onCircle)
    } catch { /* relay offline, skip */ }
  }, 10000)

  return () => { stopped = true; sub?.close(); clearInterval(pollInterval) }
}

// ─── Global Horizon stats ────────────────────────────────────────────────────

export async function fetch24hStats() {
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24

  const events = (await pool().querySync(
    RELAYS,
    { kinds: [CIRCLE_KIND], since }
  )).filter(ev => ev.tags.some(t => t[0] === 't' && t[1] === CIRCLE_TAG))

  // Keep latest event per creator+d combo (NIP-33 dedup)
  const latestByKey = new Map()
  for (const ev of events) {
    const d = ev.tags.find(t => t[0] === 'd')?.[1]
    if (!d) continue
    const key = `${ev.pubkey}:${d}`
    const existing = latestByKey.get(key)
    if (!existing || ev.created_at > existing.created_at) {
      latestByKey.set(key, ev)
    }
  }

  const circles = [...latestByKey.values()].map(parseCircleEvent).filter(Boolean)
  const uniqueCreators = new Set(circles.map(c => c.creatorPubkey))
  const completedCount = circles.filter(c => c.status === 'closed').length

  return {
    circleCount: circles.length,
    participantCount: uniqueCreators.size,
    completedCount
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCircleEvent(event) {
  try {
    const get = tag => event.tags.find(t => t[0] === tag)?.[1]
    const id = get('d')
    if (!id) return null
    return {
      id,
      startsAt:      Number(get('starts') ?? 0),
      duration:      Number(get('duration') ?? 10),
      status:        get('status') ?? 'scheduled',
      creatorName:   get('creator') ?? 'unknown',
      creatorPubkey: event.pubkey,
      updatedAt:     event.created_at
    }
  } catch {
    return null
  }
}

// In-memory cache so updateCircleStatus can read timing info
const circleCache = new Map()

export function storeCircle(circle) {
  circleCache.set(circle.id, circle)
}
