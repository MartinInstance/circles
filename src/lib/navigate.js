import { screen, screenTransition } from './stores.js'

const DURATION = 2000
const NAV_AT   = 500

const BG = {
  feed:         'linear-gradient(160deg, #0a2050 0%, #062030 100%)',
  settling:     'linear-gradient(160deg, #071a17 0%, #052030 100%)',
  meditation:   'linear-gradient(160deg, #1a1060 0%, #2d0a4a 100%)',
  conversation: 'linear-gradient(160deg, #5a1228 0%, #1a0a3d 100%)',
}

export function enterCircle(target, onDone = null) {
  screenTransition.set({ active: true, message: 'Welcome', background: BG[target] ?? BG.feed })
  setTimeout(() => screen.set(target), NAV_AT)
  setTimeout(() => {
    screenTransition.set({ active: false, message: '', background: '' })
    if (onDone) onDone()
  }, DURATION)
}

export function leaveCircle(cleanup = null, message = 'Goodbye') {
  screenTransition.set({ active: true, message, background: BG.feed })
  if (cleanup) cleanup()
  setTimeout(() => screen.set('feed'), NAV_AT)
  setTimeout(() => screenTransition.set({ active: false, message: '', background: '' }), DURATION)
}
