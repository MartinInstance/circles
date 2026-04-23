import posthog from 'posthog-js'

const POSTHOG_KEY  = 'phc_m4jC2TWLeUo6B6LkkKSCEvdUNiaWCJyciC7nkCbRjRJJ'
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let ready = false

export function initAnalytics() {
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  if (ready || isLocal) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,          // manual events only — no click tracking
    persistence: 'localStorage',
  })
  ready = true
}

export function identifyUser(name, country, pubkey) {
  if (!ready) return
  posthog.identify(pubkey ?? name, { name, country })
}

export function track(event, props = {}) {
  if (!ready) return
  try { posthog.capture(event, props) } catch {}
}
