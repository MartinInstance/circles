import gongSrc from '../../assets/sounds/gong.mp3'

// iOS Safari blocks audio unless AudioContext is created + resumed
// within a user gesture. We unlock it on first touch/click, decode
// the gong into a buffer, then play via AudioContext — which works
// even when called later from setTimeout.

let audioCtx   = null
let gongBuffer = null   // decoded AudioBuffer, ready to play instantly
let rawFetch   = null   // pre-fetched ArrayBuffer (no AudioContext needed)

// Start fetching the audio data immediately — no AudioContext required.
fetch(gongSrc)
  .then(r => r.arrayBuffer())
  .then(buf => {
    rawFetch = buf
    // If AudioContext was already unlocked before fetch finished, decode now.
    if (audioCtx) decodeInto(audioCtx)
  })
  .catch(() => {})

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

function decodeInto(ctx) {
  if (!rawFetch || gongBuffer) return
  // decodeAudioData consumes the buffer — pass a copy
  ctx.decodeAudioData(rawFetch.slice(0))
    .then(buf => { gongBuffer = buf })
    .catch(() => {})
}

// Call once during any user gesture (touchstart/click) to unlock audio.
// App.svelte registers this as a one-time global listener.
export function unlockAudio() {
  const ctx = getCtx()

  // Resume if suspended (required on iOS)
  if (ctx.state === 'suspended') ctx.resume()

  // Play a one-frame silent node — this is what iOS actually requires
  // to lift the audio restriction.
  const silent = ctx.createBuffer(1, 1, 22050)
  const node   = ctx.createBufferSource()
  node.buffer  = silent
  node.connect(ctx.destination)
  node.start(0)

  // Decode the gong buffer if the fetch already finished
  decodeInto(ctx)
}

export async function playGong() {
  try {
    if (audioCtx && gongBuffer) {
      // AudioContext path — works on iOS Safari after unlock, even from setTimeout
      if (audioCtx.state === 'suspended') await audioCtx.resume()
      const source = audioCtx.createBufferSource()
      source.buffer = gongBuffer
      source.connect(audioCtx.destination)
      source.start(0)
      window.__gongCount = (window.__gongCount || 0) + 1
      console.log('[gong] AudioContext — total:', window.__gongCount)
      return
    }

    // Fallback: HTML Audio element (works on desktop, may be blocked on iOS)
    const audio = new Audio(gongSrc)
    await audio.play()
    window.__gongCount = (window.__gongCount || 0) + 1
    console.log('[gong] Audio element — total:', window.__gongCount)
  } catch (e) {
    console.warn('[gong] blocked:', e.message)
  }
}
