<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, isCreator, participatedCircles } from '../lib/stores.js'
  import { leaveCircle } from '../lib/navigate.js'
  import { updateCircleStatus } from '../lib/nostr.js'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'
  import ProgressRing from '../components/ProgressRing.svelte'

  let circle = null
  let roomApi = null
  let totalSeconds = 0
  let remainingSeconds = 0
  let ticker
  let peers = []
  let greetings = []
  let greetingId = 0

  const unsub = activeCircle.subscribe(c => { circle = c })

  onMount(() => {
    if (!circle) { screen.set('feed'); return }

    participatedCircles.update(s => { s.add(circle.id); return s })
    totalSeconds = Math.max(0, circle.startsAt - Math.floor(Date.now() / 1000))
    remainingSeconds = totalSeconds

    roomApi = enterRoom(`circle:${circle.id}`)
    roomApi.announce()

    roomApi.onPresence((data) => {
      peers = [...peers, data]
      showGreeting(data.name)
    })

    roomApi.room.onPeerLeave(() => {
      peers = peers.slice(0, Math.max(0, peers.length - 1))
    })

    ticker = setInterval(tick, 1000)
    tick()
  })

  onDestroy(() => {
    unsub()
    clearInterval(ticker)
  })

  function stepOut() {
    leaveRoom(`circle:${circle?.id}`)
    leaveCircle(() => { activeCircle.set(null) }, 'stepping out')
  }

  function tick() {
    if (!circle) return
    remainingSeconds = Math.max(0, circle.startsAt - Math.floor(Date.now() / 1000))
    if (remainingSeconds === 0) {
      clearInterval(ticker)
      advance()
    }
  }

  async function advance() {
    if ($isCreator) {
      try { await updateCircleStatus(circle.id, 'meditating') } catch {}
    }
    screen.set('meditation')
  }

  function showGreeting(name) {
    const id = ++greetingId
    const side = id % 2 === 0 ? 'left' : 'right'
    greetings = [...greetings, { id, name, side }]
    setTimeout(() => { greetings = greetings.filter(g => g.id !== id) }, 7000)
  }

  function fmt(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function formatTime(unixSec) {
    return new Date(unixSec * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false })
  }

  $: progress  = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0
  $: peerCount = peers.length + 1
</script>

<div class="screen bg-settling">
  <header>
    <p class="app-name">Circles</p>
    <h2 class="title-italic" style="font-size:26px">settling in</h2>
  </header>

  <div class="orb-area">
    <!-- Greeting bubbles -->
    {#each greetings as g (g.id)}
      <div class="greeting {g.side} fade-in">
        <div class="g-avatar">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="4" r="2.5" fill="rgba(110,198,184,0.65)"/>
            <path d="M1 11c0-2.76 2.24-4.5 5-4.5s5 1.74 5 4.5"
              stroke="rgba(110,198,184,0.65)" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="g-name">{g.name}</p>
      </div>
    {/each}

    <!-- Ring + orb -->
    <div class="ring-orb">
      <ProgressRing
        innerProgress={progress}
        outerProgress={0}
        size={230}
        strokeWidth={2}
        ringGap={8}
        innerColor="rgba(110,198,184,0.75)"
        outerColor="rgba(110,198,184,0.2)"
        trackColor="rgba(255,255,255,0.05)"
      />
      <div class="orb">
        <span class="orb-time">{formatTime(circle?.startsAt ?? 0)}</span>
        <span class="orb-label">begins in</span>
        <span class="orb-countdown">{fmt(remainingSeconds)}</span>
        <span class="orb-dur">{circle?.duration} minutes</span>
      </div>
    </div>
  </div>

  <footer>
    <p class="peer-count">
      {peerCount} {peerCount === 1 ? 'person' : 'people'} settling in
    </p>
    <button class="step-out-btn" on:click={stepOut}>step out</button>
  </footer>
</div>

<style>
  header {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }

  .orb-area {
    flex: 1; position: relative;
    display: flex; align-items: center; justify-content: center;
  }

  .ring-orb {
    position: relative; width: 230px; height: 230px;
    display: flex; align-items: center; justify-content: center;
    animation: float 10s ease-in-out infinite;
  }

  .ring-orb :global(svg) { position: absolute; inset: 0; }

  .orb {
    width: 200px; height: 200px; border-radius: 50%;
    background: rgba(110,198,184,0.07);
    border: 1px solid rgba(110,198,184,0.18);
    box-shadow: 0 0 60px rgba(110,198,184,0.1);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .orb-time     { font-weight:200; font-size:38px; color:var(--text-primary); line-height:1; }
  .orb-label    { font-weight:200; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:var(--text-faint); }
  .orb-countdown{ font-weight:200; font-size:26px; color:var(--mint); line-height:1; }
  .orb-dur      { font-weight:200; font-size:12px; font-style:italic; color:var(--text-faint); }

  .greeting {
    position: absolute;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px; padding: 10px 14px;
    display: flex; align-items: center; gap: 10px;
  }
  .greeting.left  { left: 10px; }
  .greeting.right { right: 10px; }

  .g-avatar {
    width: 26px; height: 26px; border-radius: 9px;
    background: rgba(110,198,184,0.12);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }

  .g-name { font-weight:300; font-size:12px; color:var(--text-secondary); }

  footer {
    padding: 0 var(--pad-x) calc(var(--safe-bottom) + 28px);
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }

  .peer-count {
    font-weight:200; font-size:10px; letter-spacing:2px;
    text-transform:uppercase; color:var(--text-whisper);
  }

  .step-out-btn {
    font-weight:200; font-size:12px; font-style:italic;
    color:var(--text-faint); letter-spacing:0.5px; cursor:pointer;
  }
</style>
