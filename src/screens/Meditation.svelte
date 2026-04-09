<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, isCreator, participatedCircles, gongDelay } from '../lib/stores.js'
  import { leaveCircle } from '../lib/navigate.js'
  import { get } from 'svelte/store'
  import { updateCircleStatus } from '../lib/nostr.js'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'
  import ProgressRing from '../components/ProgressRing.svelte'
  import { playGong } from '../lib/gong.js'

  let circle = null
  let roomApi = null
  let elapsed = 0
  let totalSec = 0
  let ticker
  let peerCount = 1
  let newDotIndex = -1

  const unsub = activeCircle.subscribe(c => {
    circle = c
    if (c) totalSec = c.duration * 60
  })

  onMount(() => {
    if (!circle) { screen.set('feed'); return }

    participatedCircles.update(s => { s.add(circle.id); return s })
    const delay = get(gongDelay)
    gongDelay.set(0)
    setTimeout(() => playGong(), delay)
    elapsed = Math.max(0, Math.floor(Date.now() / 1000) - circle.startsAt)

    roomApi = enterRoom(`circle:${circle.id}`)
    roomApi.announce()

    roomApi.room.onPeerJoin(() => {
      peerCount++
      newDotIndex = peerCount - 1
      setTimeout(() => { newDotIndex = -1 }, 800)
    })

    roomApi.room.onPeerLeave(() => {
      peerCount = Math.max(1, peerCount - 1)
    })

    ticker = setInterval(() => {
      if (!circle) return
      elapsed = Math.max(0, Math.floor(Date.now() / 1000) - circle.startsAt)
      if (elapsed >= totalSec) { clearInterval(ticker); advance() }
    }, 1000)
  })

  onDestroy(() => { unsub(); clearInterval(ticker) })

  function stepOut() {
    leaveRoom(`circle:${circle?.id}`)
    leaveCircle(() => { activeCircle.set(null) }, 'stepping out')
  }

  async function advance() {
    playGong()   // end-of-session bell
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

  $: progress = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 0
  $: dots     = Math.min(peerCount, 12)
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

  <div class="below">
    <p class="tagline">silence held together</p>

    <div class="dots">
      {#each Array(dots) as _, i}
        <div class="dot" class:pulse={i === newDotIndex}></div>
      {/each}
    </div>

    <p class="present">{peerCount} present</p>
    <button class="step-out-btn" on:click={stepOut}>step out</button>
  </div>
</div>

<style>
  .wordmark {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
    display: flex; justify-content: center;
  }

  .ring-area {
    flex: 1; display: flex; align-items: center; justify-content: center; position: relative;
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

  .below {
    padding: 0 var(--pad-x) calc(var(--safe-bottom) + 56px);
    display: flex; flex-direction: column; align-items: center; gap: 22px;
  }

  .tagline { font-weight:200; font-size:15px; font-style:italic; color:var(--text-faint); }

  .dots {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 6px; max-width: 200px;
  }

  .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(167,140,200,0.45);
    transition: transform 0.3s, background 0.3s;
  }

  .dot.pulse { background: rgba(167,140,200,0.9); transform: scale(1.8); }

  .present {
    font-weight:200; font-size:9px; letter-spacing:3px;
    text-transform:uppercase; color:var(--text-whisper);
  }

  .step-out-btn {
    font-weight:200; font-size:12px; font-style:italic;
    color:var(--text-faint); letter-spacing:0.5px; cursor:pointer;
  }
</style>
