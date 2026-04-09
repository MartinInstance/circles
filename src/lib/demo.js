import { screen, identity, activeCircle, participatedCircles } from './stores.js'

// ─── Demo identities ──────────────────────────────────────────────────────────

export const DEMO_NAMES = [
  'Maya', 'Liam', 'Sofia', 'Ethan', 'Zara', 'Noah', 'Aisha', 'Lucas',
  'Priya', 'Oliver', 'Luna', 'James', 'Amara', 'Theo', 'Suki',
  'Finn', 'Nadia', 'Eli', 'Cleo', 'Ravi',
]

const REFLECTIONS = [
  "I felt a stillness I rarely find in my daily routine.",
  "My breathing slowed naturally — it felt like coming home.",
  "There was a moment where thoughts just... stopped.",
  "I noticed resistance at first, then a gentle release.",
  "Sitting in shared silence felt more connected than words.",
  "A quiet warmth settled in my chest around the midpoint.",
  "I kept returning to the sensation of my feet on the floor.",
  "The timer felt less like pressure, more like a steady rhythm.",
  "Something heavy lifted by the fourth minute, quite unexpectedly.",
  "I found myself smiling without knowing why.",
  "The outside noises faded — just the breath remained.",
  "I noticed colours seem more vivid right after.",
  "Twenty minutes felt both eternal and instant.",
  "A lot of tension in my shoulders quietly dissolved.",
  "I kept picturing still water, and it helped enormously.",
  "Thoughts arrived, but I let them drift through without grabbing.",
  "The gong at the end felt like a friend calling me back.",
  "Gratitude arose — for the group, for the space, for the quiet.",
  "I'll carry this calm into the rest of my afternoon.",
  "Thank you all. This is exactly what I needed today.",
]

// ─── URL helpers ──────────────────────────────────────────────────────────────

export function isDemoMode() {
  return new URLSearchParams(location.search).has('demo')
}

export function getDemoScreen() {
  return new URLSearchParams(location.search).get('demo') || 'feed'
}

// ─── Mock room factory ────────────────────────────────────────────────────────

function makeMockRoom(demoScreen) {
  const peerJoinHandlers  = []
  const peerLeaveHandlers = []
  const presenceHandlers  = []
  const msgHandlers       = []

  const api = {
    room: {
      onPeerJoin:  (fn) => peerJoinHandlers.push(fn),
      onPeerLeave: (fn) => peerLeaveHandlers.push(fn),
    },
    onPresence:  (fn) => presenceHandlers.push(fn),
    onMessage:   (fn) => msgHandlers.push(fn),
    announce:    () => {},
    sendMessage: () => {},
    sendPresence: () => {},
    peers: new Map(),
    leave: () => {},
  }

  // After handlers are registered (next tick), fire simulated events
  setTimeout(() => {
    // 19 peers join (self is always peer #1)
    for (let i = 0; i < 19; i++) {
      const name   = DEMO_NAMES[i + 1]
      const peerId = `demo-peer-${String(i).padStart(3, '0')}`
      const delay  = i * 40
      setTimeout(() => {
        peerJoinHandlers.forEach(fn => fn(peerId))
        presenceHandlers.forEach(fn => fn({ name }, peerId))
      }, delay)
    }

    // For conversation demo: also send 20 messages
    if (demoScreen === 'conversation') {
      DEMO_NAMES.forEach((name, i) => {
        setTimeout(() => {
          msgHandlers.forEach(fn => fn({
            senderName: name,
            text: REFLECTIONS[i],
            ts: Date.now() - (DEMO_NAMES.length - i) * 45000,
          }))
        }, 200 + i * 60)
      })
    }
  }, 150)

  return api
}

// ─── Main setup ───────────────────────────────────────────────────────────────

export function setupDemo() {
  const demoScreen = getDemoScreen()
  const now = Math.floor(Date.now() / 1000)

  // Identity for user "Maya" (index 0)
  identity.set({
    name: 'Maya',
    sk:   new Uint8Array(32).fill(1),
    pubkey: 'demo_pubkey_maya_0000000000000000',
  })

  // Build demo circle state based on which screen we're showing
  let circleStatus  = 'scheduled'
  let circleStartsAt = now + 120   // 2 min from now (for feed / settling)
  let circleUpdatedAt = now - 300

  if (demoScreen === 'meditation') {
    circleStatus    = 'meditating'
    circleStartsAt  = now - 300    // started 5 min ago
    circleUpdatedAt = now - 300
  } else if (demoScreen === 'conversation') {
    circleStatus    = 'conversation'
    circleStartsAt  = now - 1500   // started 25 min ago
    circleUpdatedAt = now - 300
  }

  const demoCircle = {
    id:            'demo-circle-001',
    creatorName:   'Maya',
    creatorPubkey: 'demo_pubkey_maya_0000000000000000',
    duration:      20,
    startsAt:      circleStartsAt,
    status:        circleStatus,
    updatedAt:     circleUpdatedAt,
  }

  // ── Room mock ────────────────────────────────────────────────────────────────
  window.__DEMO_ROOM = () => makeMockRoom(demoScreen)

  // ── Nostr circles mock ───────────────────────────────────────────────────────
  window.__DEMO_NOSTR_CIRCLES = (onCircle) => {
    const extraCircles = [
      {
        id: 'demo-circle-002',
        creatorName: 'Liam',
        creatorPubkey: 'demo_pubkey_liam_000000000000000',
        duration: 15,
        startsAt: now + 2700,   // 45 min from now
        status: 'scheduled',
        updatedAt: now - 120,
      },
      {
        id: 'demo-circle-003',
        creatorName: 'Sofia',
        creatorPubkey: 'demo_pubkey_sofia_00000000000000',
        duration: 30,
        startsAt: now + 5400,   // 90 min from now
        status: 'scheduled',
        updatedAt: now - 60,
      },
      {
        id: 'demo-circle-004',
        creatorName: 'Ethan',
        creatorPubkey: 'demo_pubkey_ethan_00000000000000',
        duration: 10,
        startsAt: now + 900,    // 15 min from now
        status: 'scheduled',
        updatedAt: now - 240,
      },
    ]
    setTimeout(() => {
      onCircle(demoCircle)
      extraCircles.forEach(c => onCircle(c))
    }, 100)
    return () => {}
  }

  // ── Navigate to the requested screen ────────────────────────────────────────
  if (['settling', 'meditation', 'conversation'].includes(demoScreen)) {
    activeCircle.set(demoCircle)
    participatedCircles.update(s => { s.add(demoCircle.id); return s })
  }

  screen.set(demoScreen)
}
