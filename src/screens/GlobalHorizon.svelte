<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen } from '../lib/stores.js'
  import { fetch24hStats } from '../lib/nostr.js'
  import { enterRoom, leaveRoom, GLOBAL_HORIZON_ROOM } from '../lib/rooms.js'
  import { track } from '../lib/analytics.js'

  let stats   = null
  let loading = true
  let liveCount = 1
  let retryTimer = null

  // ── Idle detection ──────────────────────────────────────────────────
  let idleOverlay = false
  let idleTimer = null
  const IDLE_MS = 2 * 60 * 1000

  function joinHorizonRoom() {
    const room = enterRoom(GLOBAL_HORIZON_ROOM)
    room.announce()
    room.room.onPeerJoin(()  => { liveCount++ })
    room.room.onPeerLeave(() => { liveCount = Math.max(1, liveCount - 1) })
  }

  function resetIdleTimer() {
    if (idleOverlay) return
    clearTimeout(idleTimer)
    idleTimer = setTimeout(goIdle, IDLE_MS)
  }

  function goIdle() {
    idleOverlay = true
    leaveRoom(GLOBAL_HORIZON_ROOM)
    track('feed_idle', {})
  }

  function comeback() {
    idleOverlay = false
    liveCount = 1
    joinHorizonRoom()
    resetIdleTimer()
    track('feed_returned', {})
  }

  const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll']
  // ────────────────────────────────────────────────────────────────────

  onMount(async () => {
    joinHorizonRoom()
    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))

    try {
      stats = await fetch24hStats()
    } catch (e) {
      console.error('Stats fetch failed:', e)
    } finally {
      loading = false
    }

    // If stats didn't load, retry every 8 s until they do
    if (!stats) {
      retryTimer = setInterval(async () => {
        try {
          stats = await fetch24hStats()
          if (stats) { clearInterval(retryTimer); retryTimer = null }
        } catch { /* keep retrying */ }
      }, 8000)
    }
  })

  onDestroy(() => {
    clearTimeout(idleTimer)
    clearInterval(retryTimer)
    ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
    leaveRoom(GLOBAL_HORIZON_ROOM)
  })
</script>

<div class="screen bg-horizon">
  <div class="glow"></div>

  <div class="top-bar">
    <button class="btn-back" on:click={() => screen.set('feed')}>← back</button>
    <p class="app-name">Circles</p>
  </div>

  <!-- Title + live count: above the orb -->
  <div class="title-block">
    <h1 class="title">Global Horizon</h1>
    <p class="here-count">{liveCount} here</p>
  </div>

  <!-- Orb -->
  <div class="orb-wrap">
    <div class="orb">
      <div class="orb-inner"></div>
    </div>
  </div>

  <!-- 24 h stats -->
  <div class="stats">
    {#if loading}
      <p class="loading">reading the horizon...</p>
    {:else if !stats}
      <p class="loading">numbers are far away... squinting...</p>
    {:else}
      <div class="stat-row">
        <div class="stat">
          <p class="stat-label">circles<br/>in 24h</p>
          <p class="stat-value">{stats.circleCount}</p>
        </div>
        <div class="divider"></div>
        <div class="stat">
          <p class="stat-label">unique<br/>practitioners</p>
          <p class="stat-value">{stats.participantCount}</p>
        </div>
        <div class="divider"></div>
        <div class="stat">
          <p class="stat-label">circles<br/>completed</p>
          <p class="stat-value">{stats.completedCount}</p>
        </div>
      </div>
    {/if}
  </div>

  <div class="leave-wrap">
    <button class="leave-btn" on:click={() => screen.set('feed')}>
      leave the horizon
    </button>
  </div>
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
  .top-bar {
    padding: calc(var(--safe-top) + 20px) var(--pad-x) 0;
    display: flex; justify-content: space-between; align-items: center;
  }

  .orb-wrap {
    flex: 1; display: flex; align-items: center; justify-content: center; padding-top: 20px;
  }

  .orb {
    width: 200px; height: 200px; border-radius: 50%;
    background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.22);
    box-shadow: 0 0 40px rgba(212,168,83,0.10), 0 0 16px rgba(212,168,83,0.06);
    display: flex; align-items: center; justify-content: center;
    animation: float 12s ease-in-out infinite, pulse-glow 4s ease-in-out infinite;
  }

  .orb-inner {
    width: 158px; height: 158px; border-radius: 50%;
    background: rgba(212,168,83,0.06); border: 1px solid rgba(212,168,83,0.14);
  }

  .title-block {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 0 var(--pad-x);
  }

  .title { font-weight:300; font-size:26px; color:#d4a853; letter-spacing:0.5px; }

  .here-count {
    font-weight: 200; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--text-faint);
  }

  .stats { padding: 36px var(--pad-x) 0; }

  .loading {
    text-align:center; font-weight:200; font-size:13px;
    font-style:italic; color:var(--text-faint);
  }

  .stat-row {
    display: flex; flex-direction: row;
    align-items: stretch; justify-content: center;
  }

  .stat {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; gap: 8px; padding: 0 12px;
  }

  .stat-label {
    font-weight:200; font-size:9px; letter-spacing:2px;
    text-transform:uppercase; color:var(--text-tertiary); text-align:center; line-height:1.4;
  }

  .stat-value { font-weight:200; font-size:28px; color:var(--text-secondary); }

  .divider { width:1px; background:rgba(255,255,255,0.08); }

  .leave-wrap {
    padding: 40px var(--pad-x) calc(var(--safe-bottom) + 40px);
    display: flex; justify-content: center;
  }

  .leave-btn {
    background: rgba(8, 6, 2, 0.75);
    border: 1px solid rgba(212,168,83,0.30) !important;
    border-radius: 50px; padding: 14px 32px;
    font-weight:200; font-size:13px; font-style:italic;
    color:#d4a853; cursor:pointer;
  }

  .glow {
    position:absolute; width:300px; height:300px; border-radius:50%;
    background:rgba(212,168,83,0.07); top:120px; left:50%; transform:translateX(-50%);
    filter:blur(60px); pointer-events:none;
  }

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
