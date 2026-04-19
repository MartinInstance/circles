import { writable } from 'svelte/store'
import { enterRoom, leaveRoom, GLOBAL_HORIZON_ROOM } from './rooms.js'

// Live count of all users currently active in the app — not just those on
// the Feed screen. Joining a meditation no longer removes you from the count;
// only the 2-minute idle timeout does.
export const presentCount = writable(1)

let joined = false

export function joinGlobalPresence() {
  if (joined) return
  joined = true

  const room = enterRoom(GLOBAL_HORIZON_ROOM)
  room.room.onPeerJoin(()  => presentCount.update(n => n + 1))
  room.room.onPeerLeave(() => presentCount.update(n => Math.max(1, n - 1)))
  room.announce()
}

export function leaveGlobalPresence() {
  if (!joined) return
  joined = false
  presentCount.set(1)
  leaveRoom(GLOBAL_HORIZON_ROOM)
}
