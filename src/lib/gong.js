import gongSrc from '../../assets/sounds/gong.mp3'

export function playGong() {
  try {
    const audio = new Audio(gongSrc)
    audio.play()
    window.__gongCount = (window.__gongCount || 0) + 1
    console.log('[gong] played, total:', window.__gongCount)
  } catch (e) {
    console.warn('[gong] audio unavailable:', e.message)
    window.__gongCount = (window.__gongCount || 0) + 1
  }
}
