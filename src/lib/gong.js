import gongSrc from '../../assets/sounds/gong.mp3'

// ─── Web Audio setup ──────────────────────────────────────────────────────────
//
// iOS Safari browser blocks audio.play() and AudioContext.resume() when called
// from a setTimeout — i.e. not directly inside a user gesture. The home screen
// (standalone WKWebView) is more permissive, which is why it worked there.
//
// The correct fix is to:
//   1. Pre-fetch the gong into a decoded AudioBuffer at load time.
//   2. Call unlockAudio() inside any user gesture to create + resume the context.
//   3. For the start-of-meditation gong: call scheduleGong(delaySec) inside the
//      tap handler using source.start(ctx.currentTime + delay). This schedules
//      future playback atomically within the gesture — iOS respects it even
//      seconds later.
//   4. For the end-of-meditation gong (timer-triggered): call playGong(). The
//      AudioContext is already unlocked from step 2 and resumeAudio() on
//      visibilitychange keeps it alive if the user locked their phone.

let audioCtx   = null
let gongBuffer = null   // decoded AudioBuffer
let rawBuffer  = null   // pre-fetched ArrayBuffer, waiting for a context to decode into

// Kick off the fetch immediately — no AudioContext needed for this part.
fetch(gongSrc)
  .then(r => r.arrayBuffer())
  .then(buf => {
    rawBuffer = buf
    if (audioCtx) _decode()     // context already exists → decode now
  })
  .catch(() => {})

function _getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function _decode() {
  if (!rawBuffer || gongBuffer) return
  audioCtx.decodeAudioData(rawBuffer.slice(0))   // slice: decodeAudioData detaches the buffer
    .then(buf => { gongBuffer = buf })
    .catch(() => {})
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Unlock the AudioContext. Call this inside any user gesture (tap, click).
 * Idempotent — safe to call multiple times.
 */
export function unlockAudio() {
  const ctx = _getCtx()
  if (ctx.state === 'suspended') ctx.resume()

  // Playing a one-frame silent node is what iOS actually requires to lift the
  // audio restriction. A bare resume() is not always enough.
  const silent = ctx.createBuffer(1, 1, 22050)
  const node   = ctx.createBufferSource()
  node.buffer  = silent
  node.connect(ctx.destination)
  node.start(0)

  _decode()   // decode the buffer now that we have a context
}

/**
 * Schedule the gong to play `delaySec` seconds from now.
 *
 * MUST be called inside a user gesture (e.g. a button click handler).
 * Uses AudioContext timeline scheduling (source.start(when)), which iOS Safari
 * honours even when the playback fires long after the gesture completes.
 *
 * Returns true if successfully scheduled via Web Audio, false if the buffer
 * wasn't ready yet (caller should fall back to gongDelay store).
 */
export function scheduleGong(delaySec = 0) {
  unlockAudio()

  if (!gongBuffer) {
    // Buffer not decoded yet (very rare — fetch still in flight).
    // Signal to caller to use the store-based fallback.
    console.warn('[gong] buffer not ready, caller should use gongDelay fallback')
    return false
  }

  const ctx    = _getCtx()
  const source = ctx.createBufferSource()
  source.buffer = gongBuffer
  source.connect(ctx.destination)
  source.start(ctx.currentTime + delaySec)

  window.__gongCount = (window.__gongCount || 0) + 1
  console.log('[gong] scheduled in', delaySec, 's — total:', window.__gongCount)
  return true
}

/**
 * Play the gong immediately. For timer-triggered plays (end of meditation)
 * where no user gesture is available. Requires AudioContext to already be
 * unlocked from a prior gesture.
 */
export async function playGong() {
  try {
    if (audioCtx && gongBuffer) {
      // Resume in case the phone was locked during meditation
      if (audioCtx.state === 'suspended') await audioCtx.resume()
      const source = audioCtx.createBufferSource()
      source.buffer = gongBuffer
      source.connect(audioCtx.destination)
      source.start(0)
      window.__gongCount = (window.__gongCount || 0) + 1
      console.log('[gong] played — total:', window.__gongCount)
      return
    }

    // Fallback: HTML Audio element (works on desktop, often blocked on iOS Safari)
    const audio = new Audio(gongSrc)
    await audio.play()
    window.__gongCount = (window.__gongCount || 0) + 1
    console.log('[gong] played via fallback — total:', window.__gongCount)
  } catch (e) {
    console.warn('[gong] blocked:', e.message)
  }
}

/**
 * Resume the AudioContext after the page regains focus (visibilitychange).
 * iOS suspends the context when the screen locks; this lifts it on return.
 */
export function resumeAudio() {
  if (audioCtx?.state === 'suspended') audioCtx.resume()
}
