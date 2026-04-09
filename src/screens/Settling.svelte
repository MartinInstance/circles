<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, isCreator, participatedCircles, identity } from '../lib/stores.js'
  import { leaveCircle } from '../lib/navigate.js'
  import { updateCircleStatus } from '../lib/nostr.js'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'
  import ProgressRing from '../components/ProgressRing.svelte'

  let circle = null
  let roomApi = null
  let totalSeconds = 0
  let remainingSeconds = 0
  let ticker
  let peersMap = {}   // peerId -> { name, country }

  const unsub = activeCircle.subscribe(c => { circle = c })

  onMount(() => {
    if (!circle) { screen.set('feed'); return }

    participatedCircles.update(s => { s.add(circle.id); return s })
    totalSeconds = Math.max(0, circle.startsAt - Math.floor(Date.now() / 1000))
    remainingSeconds = totalSeconds

    roomApi = enterRoom(`circle:${circle.id}`)
    roomApi.announce()

    roomApi.onPresence((data, peerId) => {
      peersMap = { ...peersMap, [peerId]: data }
    })

    roomApi.room.onPeerLeave((peerId) => {
      const { [peerId]: _, ...rest } = peersMap
      peersMap = rest
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

  function fmt(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function formatTime(unixSec) {
    return new Date(unixSec * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false })
  }

  function label(user) {
    return user.country ? `${user.name}, ${user.country}` : user.name
  }

  $: progress   = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0
  $: peersList  = Object.values(peersMap)
  $: peerCount  = peersList.length + 1
  $: selfUser   = { name: $identity?.name ?? '', country: $identity?.country ?? '' }
  $: allUsers   = [selfUser, ...peersList]
</script>

<div class="screen bg-settling">
  <header>
    <p class="app-name">Circles</p>
    <h2 class="title-italic" style="font-size:26px">settling in</h2>
  </header>

  <div class="orb-wrap">
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

  <p class="peer-count">
    {peerCount} {peerCount === 1 ? 'person' : 'people'} settling in
  </p>

  <div class="users-panel">
    {#each allUsers as user}
      <div class="user-tag">
        <span class="tag-dot"></span>
        <span class="tag-name">{label(user)}</span>
      </div>
    {/each}
  </div>

  <footer>
    <button class="step-out-btn" on:click={stepOut}>step out</button>
  </footer>
</div>

<style>
  header {
    padding: calc(var(--safe-top) + 28px) var(--pad-x) 0;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    flex-shrink: 0;
  }

  .orb-wrap {
    position: relative; width: 230px; height: 230px;
    margin: 18px auto 0;
    display: flex; align-items: center; justify-content: center;
    animation: float 10s ease-in-out infinite;
    flex-shrink: 0;
  }

  .orb-wrap :global(svg) { position: absolute; inset: 0; }

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

  .peer-count {
    font-weight:200; font-size:10px; letter-spacing:2px;
    text-transform:uppercase; color:var(--text-whisper);
    text-align: center; margin-top: 16px; flex-shrink: 0;
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
    background: rgba(110,198,184,0.06);
    border: 1px solid rgba(110,198,184,0.15);
    border-radius: 20px; padding: 6px 12px;
  }

  .tag-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(110,198,184,0.55); flex-shrink: 0;
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
