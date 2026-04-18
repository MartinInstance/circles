import { joinRoom } from 'trystero/nostr'

// Wider relay set for Trystero WebRTC signalling.
// ICE negotiation only needs seconds, so we use many relays to maximise the
// chance that at least one stays open long enough for WebRTC to complete.
const SIGNALLING_RELAYS = [
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nostr.wine',
]

const APP_CONFIG = {
  appId: 'dev.circles.app',
  relayUrls: SIGNALLING_RELAYS,
  // Explicit STUN servers — critical for Safari and mobile (WKWebView / CGNAT).
  // Without these, peers behind NAT cannot discover their public address
  // and ICE negotiation silently fails. Chrome includes Google STUN by
  // default; Safari and WebKit do not.
  rtcConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
}

const activeRooms = new Map()

function myPresence() {
  return {
    name:    localStorage.getItem('circles:name')    ?? 'unknown',
    country: localStorage.getItem('circles:country') ?? '',
  }
}

export function enterRoom(roomId) {
  if (window.__DEMO_ROOM) return window.__DEMO_ROOM(roomId)
  if (activeRooms.has(roomId)) return activeRooms.get(roomId)

  const room = joinRoom(APP_CONFIG, roomId)
  const [sendPresence, onPresence] = room.makeAction('presence')
  const [sendMessage,  onMessage]  = room.makeAction('message')

  let presenceTimer = null

  // When a peer connects (including peers already in the room), immediately
  // send them our presence so they can display our name/country.
  room.onPeerJoin(peerId => {
    console.log('[trystero] peer joined', roomId, peerId.slice(0, 8))
    sendPresence(myPresence(), [peerId])
  })

  room.onPeerLeave(peerId => {
    console.log('[trystero] peer left', roomId, peerId.slice(0, 8))
  })

  const api = {
    room,
    sendPresence,
    onPresence,
    sendMessage,
    onMessage,

    // Call once after entering a room to broadcast your presence.
    // Starts a 15-second heartbeat so late-joiners and relay hiccups
    // never leave you invisible — each tick re-broadcasts to all peers.
    announce() {
      sendPresence(myPresence())
      if (!presenceTimer) {
        presenceTimer = setInterval(() => sendPresence(myPresence()), 15_000)
      }
    },

    leave() {
      clearInterval(presenceTimer)
      presenceTimer = null
      room.leave()
      activeRooms.delete(roomId)
    },
  }

  activeRooms.set(roomId, api)
  return api
}

export function leaveRoom(roomId) {
  activeRooms.get(roomId)?.leave()
}

export function leaveAllRooms() {
  for (const api of activeRooms.values()) api.leave()
  activeRooms.clear()
}

export const GLOBAL_HORIZON_ROOM = 'circles:global-horizon'
