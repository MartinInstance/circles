import { joinRoom } from 'trystero/nostr'

// Wider relay set for Trystero WebRTC signalling.
// ICE negotiation only needs seconds, so we use many relays to maximise the
// chance that at least one stays open long enough for WebRTC to complete.
const SIGNALLING_RELAYS = [
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
]

const APP_CONFIG = {
  appId: 'dev.circles.app',
  relayUrls: SIGNALLING_RELAYS
}

const activeRooms = new Map()

export function enterRoom(roomId) {
  if (window.__DEMO_ROOM) return window.__DEMO_ROOM(roomId)
  if (activeRooms.has(roomId)) return activeRooms.get(roomId)

  const room = joinRoom(APP_CONFIG, roomId)
  const [sendPresence, onPresence] = room.makeAction('presence')
  const [sendMessage, onMessage]   = room.makeAction('message')

  const peers = new Map()

  room.onPeerJoin(peerId => {
    console.log('[trystero] peer joined', roomId, peerId.slice(0, 8))
    const name    = localStorage.getItem('circles:name')    ?? 'unknown'
    const country = localStorage.getItem('circles:country') ?? ''
    sendPresence({ name, country }, [peerId])
  })

  onPresence((data, peerId) => {
    console.log('[trystero] presence from', data.name, peerId.slice(0, 8))
    peers.set(peerId, data)
  })

  room.onPeerLeave(peerId => {
    console.log('[trystero] peer left', roomId, peerId.slice(0, 8))
    peers.delete(peerId)
  })

  const api = {
    room,
    peers,
    sendPresence,
    onPresence,
    sendMessage,
    onMessage,
    announce() {
      const name    = localStorage.getItem('circles:name')    ?? 'unknown'
      const country = localStorage.getItem('circles:country') ?? ''
      sendPresence({ name, country })
    },
    leave() {
      room.leave()
      activeRooms.delete(roomId)
    }
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
