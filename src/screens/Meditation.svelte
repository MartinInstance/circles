<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, isCreator, participatedCircles, gongDelay, previousScreen, identity } from '../lib/stores.js'
  import { leaveCircle } from '../lib/navigate.js'
  import { get } from 'svelte/store'
  import { updateCircleStatus, closeCircle } from '../lib/nostr.js'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'
  import ProgressRing from '../components/ProgressRing.svelte'
  import { playGong } from '../lib/gong.js'
  import { track } from '../lib/analytics.js'

  let circle = null
  let roomApi = null
  let elapsed = 0
  let totalSec = 0
  let ticker
  let peersMap = {}   // peerId -> { name, country }

  const unsub = activeCircle.subscribe(c => {
    circle = c
    if (c) totalSec = c.duration * 60
  })

  function setupRoom() {
    roomApi = enterRoom(`circle:${circle.id}`)
    roomApi.onPresence((data, peerId) => {
      peersMap = { ...peersMap, [peerId]: data }
    })
    roomApi.room.onPeerLeave((peerId) => {
      const { [peerId]: _, ...rest } = peersMap
      peersMap = rest
    })
    roomApi.announce()
  }

  // iOS suspends WebSocket + WebRTC when a tab goes to background.
  // On return: announce immediately (fast path if WebRTC survived),
  // then after 3 s force a hard rejoin if we're still alone (WebRTC died).
  let rejoinTimer = null
  function handleVisibility() {
    if (document.visibilityState !== 'visible') return
    roomApi?.announce()
    clearTimeout(rejoinTimer)
    rejoinTimer = setTimeout(() => {
      if (Object.keys(peersMap).length === 0) {
        leaveRoom(`circle:${circle.id}`)
        peersMap = {}
        setupRoom()
      }
    }, 3000)
  }

  onMount(() => {
    if (!circle) { screen.set('feed'); return }

    participatedCircles.update(s => { s.add(circle.id); return s })
    const delay = get(gongDelay)
    gongDelay.set(0)
    // delay === -1 means scheduleGong() already queued it via Web Audio timeline.
    // delay === 0 means settling→meditation transition; play immediately.
    // delay > 0 means fallback (buffer wasn't ready when Join was tapped).
    if (get(previousScreen) !== 'about' && delay !== -1) {
      setTimeout(() => playGong(), Math.max(0, delay))
    }
    elapsed = Math.max(0, Math.floor(Date.now() / 1000) - circle.startsAt)

    setupRoom()
    document.addEventListener('visibilitychange', handleVisibility)

    ticker = setInterval(() => {
      if (!circle) return
      elapsed = Math.max(0, Math.floor(Date.now() / 1000) - circle.startsAt)
      if (elapsed >= totalSec) { clearInterval(ticker); advance() }
    }, 1000)
  })

  onDestroy(() => {
    unsub()
    clearInterval(ticker)
    clearTimeout(rejoinTimer)
    document.removeEventListener('visibilitychange', handleVisibility)
  })

  function stepOut() {
    const isLast = peerCount <= 1
    const circleSnapshot = circle
    track('circle_left', { circle_id: circle?.id, from_phase: 'meditation', method: 'step_out' })
    leaveRoom(`circle:${circle?.id}`)
    leaveCircle(async () => {
      if (isLast) { try { await closeCircle(circleSnapshot) } catch {} }
      activeCircle.set(null)
    }, 'stepping out')
  }

  async function advance() {
    playGong()
    track('conversation_started', { circle_id: circle?.id, duration_minutes: circle?.duration })
    if ($isCreator) {
      try { await updateCircleStatus(circle.id, 'conversation') } catch {}
    }
    screen.set('conversation')
  }

  function fmt(elapsed) {
    const remaining = Math.max(0, totalSec - elapsed)
    const m   = Math.floor(remaining / 60)
    const sec = remaining % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function label(user) {
    return user.country ? `${user.name}, ${user.country}` : user.name
  }

  $: progress  = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 0
  $: peersList = Object.values(peersMap)
  $: peerCount = peersList.length + 1
  $: selfUser  = { name: $identity?.name ?? '', country: $identity?.country ?? '' }
  $: allUsers  = [selfUser, ...peersList]
  $: intention = circle?.intention ?? ''
</script>

<div class="screen bg-meditation">
  <div class="wordmark">
    <span class="app-name">Circles</span>
  </div>

  <div class="ring-area">
    <div class="ripple r1"></div>
    <div class="ripple r2"></div>
    <div class="ripple r3"></div>

    <ProgressRing
      innerProgress={1}
      outerProgress={progress}
      size={220}
      strokeWidth={2}
      ringGap={10}
      innerColor="rgba(167,140,200,0.5)"
      outerColor="rgba(255,255,255,0.8)"
      trackColor="rgba(255,255,255,0.05)"
    />

    <div class="core">
      <span class="timer">{fmt(elapsed)}</span>
    </div>
  </div>

  <div class="below-orb">
    {#if intention}
      <p class="intention">{intention}</p>
    {:else}
      <p class="tagline">silence held together</p>
    {/if}
    <p class="present">{peerCount} present</p>
  </div>

  <div class="users-panel">
    {#each allUsers as user}
      <div class="user-tag">
        <span class="tag-dot"></span>
        <span class="tag-name">{label(user)}</span>
        {#if user.name === circle?.creatorName}
          <span class="host-badge">host</span>
        {/if}
      </div>
    {/each}
  </div>

  <footer>
    <button class="step-out-btn" on:click={stepOut}>step out</button>
  </footer>
</div>

<style>
  .wordmark {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
    display: flex; justify-content: flex-start;
    flex-shrink: 0;
  }

  .ring-area {
    position: relative;
    width: 220px; height: 220px;
    margin: 18px auto 0;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .ring-area :global(svg) { position: absolute; }

  .ripple {
    position: absolute; width: 220px; height: 220px; border-radius: 50%;
    border: 1px solid rgba(167,140,200,0.15);
    animation: ripple 4s ease-out infinite;
  }
  .r2 { animation-delay: -1.33s; }
  .r3 { animation-delay: -2.66s; }

  .core {
    position: absolute; width: 120px; height: 120px; border-radius: 50%;
    background: rgba(167,140,200,0.08); border: 1px solid rgba(167,140,200,0.22);
    box-shadow: 0 0 50px rgba(167,140,200,0.1);
    display: flex; align-items: center; justify-content: center; z-index: 1;
  }

  .timer { font-weight:200; font-size:26px; color:rgba(255,255,255,0.88); letter-spacing:1px; }

  .below-orb {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    margin-top: 16px; flex-shrink: 0;
  }

  .tagline { font-weight:200; font-size:15px; font-style:italic; color:var(--text-faint); }

  .intention {
    font-weight:300; font-size:15px; font-style:italic;
    color:var(--text-secondary); text-align:center;
    padding: 0 var(--pad-x);
  }

  .host-badge {
    font-size:8px; font-weight:300; letter-spacing:1.5px;
    text-transform:uppercase; color:rgba(167,140,200,0.5);
    border: 1px solid rgba(167,140,200,0.2);
    border-radius:4px; padding:1px 5px; margin-left:2px;
  }

  .present {
    font-weight:200; font-size:9px; letter-spacing:3px;
    text-transform:uppercase; color:var(--text-whisper);
  }

  .users-panel {
    flex: 1; overflow-y: auto;
    display: flex; flex-wrap: wrap; gap: 8px;
    padding: 14px var(--pad-x) 8px;
    align-content: flex-start;
  }
  .users-panel::-webkit-scrollbar { display: none; }

  .user-tag {
    display: flex; align-items: center; gap: 8px;
    background: rgba(167,140,200,0.06);
    border: 1px solid rgba(167,140,200,0.18);
    border-radius: 20px; padding: 6px 12px;
  }

  .tag-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(167,140,200,0.55); flex-shrink: 0;
  }

  .tag-name {
    font-weight:300; font-size:13px; color:var(--text-secondary);
    white-space: nowrap;
  }

  footer {
    padding: 10px var(--pad-x) calc(var(--safe-bottom) + 18px);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .step-out-btn {
    font-weight:200; font-size:12px; font-style:italic;
    color:var(--text-faint); letter-spacing:0.5px; cursor:pointer;
  }
</style>
