import { writable } from 'svelte/store'

// 'onboarding' | 'feed' | 'create' | 'settling' | 'meditation' | 'conversation' | 'globalHorizon'
export const screen = writable('onboarding')

// Circle the user is currently inside
export const activeCircle = writable(null)

// Local user identity { name, sk, pubkey }
export const identity = writable(null)

// Whether the current user created the activeCircle
export const isCreator = writable(false)
