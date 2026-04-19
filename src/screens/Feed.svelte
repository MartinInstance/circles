<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, identity, isCreator, participatedCircles } from '../lib/stores.js'
  import { subscribeToCircles } from '../lib/nostr.js'
  import { enterRoom, leaveRoom, GLOBAL_HORIZON_ROOM } from '../lib/rooms.js'
  import { enterCircle } from '../lib/navigate.js'
  import { gongDelay } from '../lib/stores.js'
  import { scheduleGong, unlockAudio } from '../lib/gong.js'
  import { track } from '../lib/analytics.js'

  // Smoke-dissolve transition: orbs drift upward, blur, and fade over 3s
  function smokeOut(_node) {
    return {
      duration: 3000,
      css: t => `
        opacity: ${t * t};
        transform: scale(${1 + (1 - t) * 0.25}) translateY(${-(1 - t) * 40}px);
        filter: blur(${(1 - t) * 12}px);
        pointer-events: none;
      `
    }
  }

  const COLORS = ['mint', 'rose', 'lavender', 'sky', 'gold']
  const COLOR_STYLES = {
    mint:     { bg: 'rgba(6,32,28,0.88)',  border: 'rgba(110,198,184,0.35)', glow: 'rgba(110,198,184,0.12)', text: '#6ec6b8' },
    rose:     { bg: 'rgba(38,6,18,0.88)',  border: 'rgba(232,114,138,0.35)', glow: 'rgba(232,114,138,0.1)',  text: '#e8728a' },
    lavender: { bg: 'rgba(18,12,42,0.88)', border: 'rgba(167,140,200,0.35)', glow: 'rgba(167,140,200,0.1)', text: '#a78cc8' },
    sky:      { bg: 'rgba(6,20,45,0.88)',  border: 'rgba(93,168,212,0.35)',  glow: 'rgba(93,168,212,0.1)',  text: '#5da8d4' },
    gold:     { bg: 'rgba(38,25,6,0.88)',  border: 'rgba(212,168,83,0.35)',  glow: 'rgba(212,168,83,0.1)',  text: '#d4a853' },
  }

  const POSITIONS = [
    { top: '18%', left:  '8%'  },
    { top: '14%', right: '9%'  },
    { top: '43%', left:  '38%' },
    { top: '38%', right: '7%'  },
    { top: '62%', left:  '9%'  },
  ]

  const SIZES = [128, 96, 84, 110, 100]

  // SVG ring geometry — viewBox is 0 0 100 100 units
  const R_OUTER = 46
  const R_INNER = 38
  const CIRC_OUTER = +(2 * Math.PI * R_OUTER).toFixed(3)  // ≈ 289.0
  const CIRC_INNER = +(2 * Math.PI * R_INNER).toFixed(3)  // ≈ 238.8

  let circleMap = new Map()
  let unsubscribe
  let now = Math.floor(Date.now() / 1000)   // integer seconds — drives time filters
  let nowMs = Date.now()                     // milliseconds — drives ring progress
  let presentCount = 1                       // self + peers in global horizon room

  // ── Idle detection ──────────────────────────────────────────────────
  let idleOverlay = false
  let idleTimer = null
  const IDLE_MS = 2 * 60 * 1000   // 2 minutes

  function joinHorizonRoom() {
    const room = enterRoom(GLOBAL_HORIZON_ROOM)
    room.announce()
    room.room.onPeerJoin(()  => { presentCount++ })
    room.room.onPeerLeave(() => { presentCount = Math.max(1, presentCount - 1) })
  }

  function resetIdleTimer() {
    if (idleOverlay) return   // ignore activity while the overlay is showing
    clearTimeout(idleTimer)
    idleTimer = setTimeout(goIdle, IDLE_MS)
  }

  function goIdle() {
    idleOverlay = true
    // Leave the room so peers see our count drop immediately
    leaveRoom(GLOBAL_HORIZON_ROOM)
    track('feed_idle', {})
  }

  function comeback() {
    idleOverlay = false
    presentCount = 1    // reset — onPeerJoin will rebuild the count
    joinHorizonRoom()
    resetIdleTimer()
    track('feed_returned', {})
  }
  // ────────────────────────────────────────────────────────────────────

  $: circles = [...circleMap.values()]
    .filter(c => c.status !== 'closed')
    .filter(c => c.updatedAt > now - 3 * 60 * 60)
    .filter(c => {
      // Abandoned scheduled circles: hide 60s after their window ends
      if (c.status === 'scheduled')     return (c.startsAt + c.duration * 60) > now - 60
      // Meditating: hide 2 min after timer should have ended
      if (c.status === 'meditating')    return (c.updatedAt + c.duration * 60 + 2 * 60) > now
      // Conversation: hide 3 min after entering conversation (aligns with idle timeout)
      if (c.status === 'conversation')  return c.updatedAt > now - 3 * 60
      return true
    })
    .sort((a, b) => a.startsAt - b.startsAt)

  // Returns false when entry should be blocked (last 20s for new users, conversation for non-participants)
  function canEnter(c) {
    if (c.status === 'conversation') return $participatedCircles.has(c.id)
    if (c.status === 'meditating') {
      const secsLeft = (c.updatedAt + c.duration * 60) - now
      if (secsLeft <= 20) return $participatedCircles.has(c.id)
    }
    return true
  }

  const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll']

  onMount(() => {
    joinHorizonRoom()
    resetIdleTimer()

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))

    unsubscribe = subscribeToCircles(incoming => {
      const existing = circleMap.get(incoming.id)
      if (!existing || incoming.updatedAt >= existing.updatedAt) {
        circleMap.set(incoming.id, incoming)
        circleMap = circleMap
      }
    })

    // 1s tick: updates filters AND ring progress. CSS transition fills the gaps.
    const tick = setInterval(() => {
      nowMs = Date.now()
      now = Math.floor(nowMs / 1000)
    }, 1000)
    return () => clearInterval(tick)
  })

  onDestroy(() => {
    clearTimeout(idleTimer)
    ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
    unsubscribe?.()
    leaveRoom(GLOBAL_HORIZON_ROOM)
  })

  // Inner ring: how far through the wait window are we? [0..1]
  // Grows from 0 (just announced) to 1 (start time reached).
  // Stays full once meditation begins.
  function waitProgress(c) {
    if (c.status !== 'scheduled') return 1
    const totalSec = c.startsAt - c.updatedAt
    if (totalSec <= 0) return 1
    return Math.min(1, Math.max(0, (nowMs / 1000 - c.updatedAt) / totalSec))
  }

  // Outer ring: meditation elapsed / total duration [0..1]
  // Only fills during 'meditating'. Full once conversation begins.
  function meditationProgress(c) {
    if (c.status === 'conversation') return 1
    if (c.status !== 'meditating')  return 0
    const elapsed = nowMs / 1000 - c.updatedAt
    return Math.min(1, Math.max(0, elapsed / (c.duration * 60)))
  }

  function innerOffset(c) {
    return (CIRC_INNER * (1 - waitProgress(c))).toFixed(2)
  }

  function outerOffset(c) {
    return (CIRC_OUTER * (1 - meditationProgress(c))).toFixed(2)
  }

  function statusLabel(c) {
    if (c.status === 'settling')     return 'settling'
    if (c.status === 'meditating')   return 'meditating'
    if (c.status === 'conversation') return 'sharing'
    const diffMin = Math.round((c.startsAt - Date.now() / 1000) / 60)
    if (diffMin <= 0) return 'now'
    if (diffMin < 60) return `in ${diffMin}m`
    return `in ${Math.round(diffMin / 60)}h`
  }

  function joinCircle(circle) {
    if (!canEnter(circle)) return
    participatedCircles.update(s => { s.add(circle.id); return s })
    activeCircle.set(circle)
    isCreator.set(circle.creatorPubkey === $identity?.pubkey)
    const target = circle.status === 'meditating'   ? 'meditation'
                 : circle.status === 'conversation' ? 'conversation'
                 : 'settling'

    if (target === 'meditation') {
      // Schedule the gong here, inside the tap gesture, using Web Audio timeline.
      // source.start(when) works on iOS Safari even when it fires 1.5s later,
      // because the scheduling itself happened during the user gesture.
      const scheduled = scheduleGong(1.5)
      // If buffer wasn't ready yet (very rare), fall back to the store-based path.
      gongDelay.set(scheduled ? -1 : 1500)
    } else {
      // Unlock audio now so the settling→meditation gong works later without a gesture.
      unlockAudio()
    }

    track('circle_joined', {
      circle_id:       circle.id,
      circle_duration: circle.duration,
      joined_as:       target,
      creator:         circle.creatorName,
    })
    enterCircle(target)
  }
</script>

<div class="screen bg-feed">
  <div class="glow-a"></div>
  <div class="glow-b"></div>

  <header>
    <div>
      <p class="app-name">Circles</p>
      <h1 class="title-italic" style="font-size:34px">upcoming</h1>
    </div>
    <p class="present-count">{presentCount} present</p>
  </header>

  <!-- Floating orbs -->
  <div class="orbs-field">
    {#each circles.slice(0, 5) as circle, i (circle.id)}
      {@const color = COLORS[i % COLORS.length]}
      {@const c = COLOR_STYLES[color]}
      {@const pos = POSITIONS[i % POSITIONS.length]}
      {@const size = SIZES[i % SIZES.length]}
      {@const pad = Math.round((50 - R_INNER) * size / 100 + 10)}
      <button
        class="orb"
        class:orb-closed={!canEnter(circle)}
        out:smokeOut
        style="
          width:{size}px; height:{size}px;
          padding:{pad}px;
          box-shadow: 0 0 {Math.round(size / 3)}px {c.glow};
          {Object.entries(pos).map(([k, v]) => `${k}:${v}`).join(';')}
        "
        on:click={() => joinCircle(circle)}
      >
        <!-- SVG ring layer — rendered behind text via z-index:-1 -->
        <svg class="orb-rings" viewBox="0 0 100 100">
          <!-- Outer ring: meditation timer -->
          <circle class="ring-track" cx="50" cy="50" r={R_OUTER}/>
          <circle class="ring-prog" cx="50" cy="50" r={R_OUTER}
            transform="rotate(-90 50 50)"
            style="stroke:{c.border}; stroke-dasharray:{CIRC_OUTER}; stroke-dashoffset:{outerOffset(circle)}"/>
          <!-- Inner ring: wait countdown -->
          <circle class="ring-track" cx="50" cy="50" r={R_INNER}/>
          <circle class="ring-prog" cx="50" cy="50" r={R_INNER}
            transform="rotate(-90 50 50)"
            style="stroke:{c.text}; stroke-dasharray:{CIRC_INNER}; stroke-dashoffset:{innerOffset(circle)}"/>
          <!-- Centre fill — gives the orb its background colour -->
          <circle class="ring-fill" cx="50" cy="50" r="33" style="fill:{c.bg}"/>
        </svg>

        <span class="orb-time" style="color:{c.text}">{circle.duration} min</span>
        <span class="orb-status">{statusLabel(circle)}</span>
      </button>
    {/each}

    {#if circles.length === 0}
      <p class="empty">no circles announced yet</p>
    {/if}
  </div>

  <!-- Bottom bar -->
  <footer>
    <button class="btn-primary create-btn" on:click={() => screen.set('create')}>
      Create a new circle
    </button>

    <div class="horizon-row">
      <span class="h-line"></span>
      <button class="horizon-btn" on:click={() => screen.set('globalHorizon')}>
        <span class="h-dot"></span>
        <div class="h-text">
          <span class="h-name">Global Horizon</span>
          <span class="h-sub">24h community pulse</span>
        </div>
      </button>
      <span class="h-line"></span>
    </div>
  </footer>
</div>

<!-- Idle overlay — shown after 2 minutes of no interaction -->
{#if idleOverlay}
  <div class="idle-overlay">
    <div class="idle-modal">
      <p class="idle-question">Did you get distracted?</p>
      <button class="btn-primary idle-btn" on:click={comeback}>I'm back</button>
    </div>
  </div>
{/if}

<style>
  header {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .present-count {
    font-family: 'Raleway', system-ui, sans-serif;
    font-weight: 300;
    font-size: 12px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: rgba(245, 240, 235, 0.80);
    text-align: right;
  }

  .orbs-field {
    position: relative;
    flex: 1;
  }

  /* ── Orb button ────────────────────────────────────────────────── */
  .orb {
    position: absolute;
    border-radius: 50%;
    border: none;
    background: transparent;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    animation: float 10s ease-in-out infinite, pulse-glow 4s ease-in-out infinite;
  }
  .orb:nth-child(2) { animation-delay: -3s, -1s; }
  .orb:nth-child(3) { animation-delay: -6s, -2s; }
  .orb:nth-child(4) { animation-delay: -1s, -3s; }
  .orb:nth-child(5) { animation-delay: -4s, -2s; }
  .orb-closed { opacity: 0.35; cursor: default; }

  /* ── SVG ring layer ────────────────────────────────────────────── */
  .orb-rings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    overflow: visible;
  }

  .ring-track {
    fill: none;
    stroke: rgba(255, 255, 255, 0.07);
    stroke-width: 1.5;
  }

  .ring-prog {
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    /* CSS transition bridges the 1s JS tick → perfectly smooth sweep */
    transition: stroke-dashoffset 1s linear;
  }

  /* ── Orb text labels ───────────────────────────────────────────── */
  .orb-time   { font-weight: 200; font-size: clamp(14px, 3.8vw, 22px); color: var(--text-primary); line-height: 1; }
  .orb-status { font-weight: 200; font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-whisper); }

  .empty {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 200; font-size: 14px; font-style: italic;
    color: var(--text-faint);
  }

  /* ── Footer ────────────────────────────────────────────────────── */
  footer {
    padding: 0 var(--pad-x) calc(var(--safe-bottom) + 28px);
    display: flex; flex-direction: column; gap: 14px;
  }

  .horizon-row {
    display: flex; align-items: center;
    /* Break out of the max-width content constraint to span the full viewport */
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    width: 100vw;
  }

  .h-line {
    flex: 1; height: 1px;
    background: rgba(212,168,83,0.25);
  }

  .horizon-btn {
    display: flex; align-items: center; gap: 10px;
    background: rgba(5, 10, 15, 0.30);
    border: 1px solid rgba(212,168,83,0.25) !important;
    border-radius: 999px; padding: 12px 20px;
    cursor: pointer; flex-shrink: 0;
  }

  .h-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--gold); flex-shrink: 0;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .h-text { display: flex; flex-direction: column; gap: 3px; }
  .h-name { font-family: 'Cormorant', Georgia, serif; font-weight: 400; font-style: italic; font-size: 22px; color: #d4a853; line-height: 1; }
  .h-sub  { font-weight: 300; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(245,240,235,0.80); }

  .create-btn { margin-bottom: 4px; }

  .glow-a, .glow-b {
    position: absolute; border-radius: 50%;
    filter: blur(50px); pointer-events: none;
  }
  .glow-a { width:200px; height:200px; background:rgba(93,168,212,0.07); top:80px; right:-40px; }
  .glow-b { width:160px; height:160px; background:rgba(110,198,184,0.06); bottom:180px; left:-30px; }

  /* ── Idle overlay ──────────────────────────────────────────────── */
  .idle-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(5, 8, 18, 0.88);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
  }

  .idle-modal {
    display: flex; flex-direction: column;
    align-items: center; gap: 32px;
    padding: 0 40px;
  }

  .idle-question {
    font-family: 'Cormorant', Georgia, serif;
    font-weight: 300; font-style: italic;
    font-size: 28px; line-height: 1.3;
    color: var(--text-primary); text-align: center;
  }

  .idle-btn { min-width: 140px; }
</style>
