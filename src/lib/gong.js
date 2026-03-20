/**
 * Synthesises a Tibetan singing-bowl / meditation gong using the Web Audio API.
 * No audio file needed. Tracks play count on window.__gongCount for testing.
 */
export function playGong() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    // Fundamental + overtones typical of a metal bowl
    const partials = [
      { freq: 220,  vol: 0.55, decay: 4.5 },
      { freq: 440,  vol: 0.28, decay: 3.5 },
      { freq: 660,  vol: 0.14, decay: 2.5 },
      { freq: 880,  vol: 0.07, decay: 1.8 },
    ]

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.9, now)
    master.gain.exponentialRampToValueAtTime(0.001, now + 5)
    master.connect(ctx.destination)

    for (const { freq, vol, decay } of partials) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      gain.gain.setValueAtTime(vol, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + decay)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now)
      osc.stop(now + decay)
    }

    window.__gongCount = (window.__gongCount || 0) + 1
    console.log('[gong] played, total:', window.__gongCount)
  } catch (e) {
    console.warn('[gong] audio unavailable:', e.message)
    window.__gongCount = (window.__gongCount || 0) + 1  // count even if silent
  }
}
