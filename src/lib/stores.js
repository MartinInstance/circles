import { writable } from 'svelte/store'

// 'onboarding' | 'feed' | 'create' | 'settling' | 'meditation' | 'conversation' | 'globalHorizon'
export const screen = writable('onboarding')

// Circle the user is currently inside
export const activeCircle = writable(null)

// Local user identity { name, sk, pubkey }
export const identity = writable(null)

// Whether the current user created the activeCircle
export const isCreator = writable(false)

// Circle IDs the user has been inside — grants re-entry during restricted phases
export const participatedCircles = writable(new Set())

// Active screen transition overlay — { active, message, background }
export const screenTransition = writable({ active: false, message: '', background: '' })

// ms to delay the gong after Meditation mounts (0 = immediate, >0 = post-transition join)
export const gongDelay = writable(0)

// Screen visited before navigating to 'about' — used for back navigation
export const previousScreen = writable('feed')
