<script>
  import { onMount, onDestroy } from 'svelte'
  import { screen } from '../lib/stores.js'
  import { fetch24hStats } from '../lib/nostr.js'
  import { enterRoom, leaveRoom, GLOBAL_HORIZON_ROOM } from '../lib/rooms.js'

  let stats   = null
  let loading = true
  let liveCount = 1
  let roomApi

  onMount(async () => {
    roomApi = enterRoom(GLOBAL_HORIZON_ROOM)
    roomApi.announce()
    roomApi.room.onPeerJoin(() => { liveCount++ })
    roomApi.room.onPeerLeave(() => { liveCount = Math.max(1, liveCount - 1) })

    try {
      stats = await fetch24hStats()
    } catch (e) {
      console.error('Stats fetch failed:', e)
      stats = { circleCount: 0, participantCount: 0, completedCount: 0 }
    } finally {
      loading = false
    }
  })

  onDestroy(() => leaveRoom(GLOBAL_HORIZON_ROOM))
</script>

<div class="screen bg-horizon">
  <div class="glow"></div>

  <div class="top-bar">
    <button class="btn-back" on:click={() => screen.set('feed')}>← back</button>
  </div>

  <!-- Orb -->
  <div class="orb-wrap">
    <div class="orb">
      <div class="orb-inner"></div>
    </div>
  </div>

  <!-- Title + live count -->
  <div class="title-block">
    <h1 class="title">Global Horizon</h1>
    <p class="live">
      <span class="live-dot"></span>
      {liveCount} {liveCount === 1 ? 'person' : 'people'} here now
    </p>
  </div>

  <!-- 24 h stats -->
  <div class="stats">
    {#if loading}
      <p class="loading">reading the horizon...</p>
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

<style>
  .top-bar { padding: calc(var(--safe-top) + 20px) var(--pad-x) 0; }

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

  .live {
    display: flex; align-items: center; gap: 6px;
    font-weight:200; font-size:10px; letter-spacing:2px;
    text-transform:uppercase; color:var(--text-whisper);
  }

  .live-dot {
    width:5px; height:5px; border-radius:50%; background:var(--gold);
    animation: pulse-glow 2s ease-in-out infinite;
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
</style>
