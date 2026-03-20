<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen, activeCircle, identity, isCreator } from '../lib/stores.js'
  import { subscribeToCircles } from '../lib/nostr.js'

  // Smoke-dissolve transition: orbs drift upward, blur, and fade over 3s
  function smokeOut(node) {
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

  let circleMap = new Map()
  let unsubscribe
  let now = Math.floor(Date.now() / 1000)  // ticks every 10s so time-filters re-evaluate

  $: circles = [...circleMap.values()]
    .filter(c => c.status !== 'closed')
    .filter(c => c.updatedAt > now - 3 * 60 * 60)
    .filter(c => {
      // Scheduled circles: hide 60s after their window ends (abandoned circles)
      if (c.status !== 'scheduled') return true
      return (c.startsAt + c.duration * 60) > now - 60
    })
    .sort((a, b) => a.startsAt - b.startsAt)

  onMount(() => {
    unsubscribe = subscribeToCircles(incoming => {
      const existing = circleMap.get(incoming.id)
      if (!existing || incoming.updatedAt >= existing.updatedAt) {
        circleMap.set(incoming.id, incoming)
        circleMap = circleMap
      }
    })

    // Tick every 10s so time-based filters re-evaluate even with no new Nostr events
    const tick = setInterval(() => { now = Math.floor(Date.now() / 1000) }, 10000)
    return () => clearInterval(tick)
  })

  onDestroy(() => unsubscribe?.())

  function formatTime(unixSec) {
    return new Date(unixSec * 1000).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', hour12: false
    })
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
    activeCircle.set(circle)
    isCreator.set(circle.creatorPubkey === $identity?.pubkey)
    if (circle.status === 'meditating')   screen.set('meditation')
    else if (circle.status === 'conversation') screen.set('conversation')
    else screen.set('settling')
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
  </header>

  <!-- Floating orbs -->
  <div class="orbs-field">
    {#each circles.slice(0, 5) as circle, i (circle.id)}
      {@const color = COLORS[i % COLORS.length]}
      {@const c = COLOR_STYLES[color]}
      {@const pos = POSITIONS[i % POSITIONS.length]}
      {@const size = SIZES[i % SIZES.length]}
      <button
        class="orb"
        out:smokeOut
        style="
          width:{size}px; height:{size}px;
          background:{c.bg}; border-color:{c.border};
          box-shadow: 0 0 {Math.round(size/3)}px {c.glow};
          {Object.entries(pos).map(([k,v]) => `${k}:${v}`).join(';')}
        "
        on:click={() => joinCircle(circle)}
      >
        <span class="orb-time">{formatTime(circle.startsAt)}</span>
        <span class="orb-dur" style="color:{c.text}">{circle.duration} min</span>
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

    <button class="horizon-strip" on:click={() => screen.set('globalHorizon')}>
      <span class="h-dot"></span>
      <div class="h-text">
        <span class="h-name">Global Horizon</span>
        <span class="h-sub">24h community pulse</span>
      </div>
      <span class="h-chevron">›</span>
    </button>
  </footer>
</div>

<style>
  header {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
  }

  .orbs-field {
    position: relative;
    flex: 1;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    border: 1px solid;
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

  .orb-time   { font-weight: 200; font-size: clamp(14px, 3.8vw, 22px); color: var(--text-primary); line-height: 1; }
  .orb-dur    { font-weight: 200; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
  .orb-status { font-weight: 200; font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-whisper); }

  .empty {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-weight: 200; font-size: 14px; font-style: italic;
    color: var(--text-faint);
  }

  footer {
    padding: 0 var(--pad-x) calc(var(--safe-bottom) + 28px);
    display: flex; flex-direction: column; gap: 14px;
  }

  .horizon-strip {
    display: flex; align-items: center; gap: 12px;
    background: rgba(5, 10, 15, 0.80);
    border: 1px solid rgba(212,168,83,0.30) !important;
    border-radius: 18px; padding: 14px 18px;
    cursor: pointer; width: 100%; text-align: left;
  }

  .h-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--gold); flex-shrink: 0;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .h-text { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .h-name { font-family: 'Cormorant', Georgia, serif; font-weight: 400; font-style: italic; font-size: 22px; color: #d4a853; line-height: 1; }
  .h-sub  { font-weight: 300; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(245,240,235,0.80); }
  .h-chevron { font-size: 20px; color: var(--text-faint); font-weight: 200; }

  .create-btn { margin-bottom: 4px; }

  .glow-a, .glow-b {
    position: absolute; border-radius: 50%;
    filter: blur(50px); pointer-events: none;
  }
  .glow-a { width:200px; height:200px; background:rgba(93,168,212,0.07); top:80px; right:-40px; }
  .glow-b { width:160px; height:160px; background:rgba(110,198,184,0.06); bottom:180px; left:-30px; }
</style>
