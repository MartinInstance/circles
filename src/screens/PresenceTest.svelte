<script>
  import { onMount, onDestroy } from 'svelte'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'

  const params  = new URLSearchParams(location.search)
  const roomId  = params.get('presence-test') || 'test-presence-default'
  const myName  = params.get('name')    || 'Tester'
  const country = params.get('country') || ''

  // Write to localStorage so rooms.js myPresence() picks it up
  localStorage.setItem('circles:name',    myName)
  localStorage.setItem('circles:country', country)

  let peers    = {}   // peerId -> { name, country }
  let roomApi  = null
  let elapsed  = 0
  let timer

  $: peerList  = Object.values(peers)
  $: total     = peerList.length + 1   // self + peers
  $: allNames  = [myName, ...peerList.map(p => p.name)]

  onMount(() => {
    roomApi = enterRoom(roomId)

    roomApi.onPresence((data, peerId) => {
      peers = { ...peers, [peerId]: data }
    })

    roomApi.room.onPeerJoin(peerId => {
      console.log('[presence-test] peer joined', peerId.slice(0, 8))
    })

    roomApi.room.onPeerLeave(peerId => {
      const { [peerId]: _, ...rest } = peers
      peers = rest
    })

    roomApi.announce()

    timer = setInterval(() => { elapsed++ }, 1000)
  })

  onDestroy(() => {
    clearInterval(timer)
    if (roomApi) leaveRoom(roomId)
  })

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
</script>

<div class="pt-wrap">
  <h1 class="pt-title">Presence Test</h1>
  <p class="pt-room">room: <code>{roomId}</code></p>

  <div class="pt-self">
    You: <strong>{myName}</strong>{country ? `, ${country}` : ''}
  </div>

  <div class="pt-count" data-count="{total}">
    {total} of 4 present
  </div>

  <div class="pt-peers">
    {#each peerList as p}
      <div class="pt-peer">
        {p.name}{p.country ? `, ${p.country}` : ''}
      </div>
    {:else}
      <div class="pt-peer pt-empty">no peers yet…</div>
    {/each}
  </div>

  <div class="pt-status" data-ready="{total >= 4}">
    {#if total >= 4}
      ✅ all 4 present
    {:else}
      ⏳ waiting… ({fmt(elapsed)})
    {/if}
  </div>
</div>

<style>
  .pt-wrap {
    font-family: sans-serif;
    max-width: 400px;
    margin: 40px auto;
    padding: 24px;
    background: #0d1117;
    color: #e6edf3;
    border-radius: 12px;
  }
  .pt-title  { font-size: 22px; margin: 0 0 4px; }
  .pt-room   { font-size: 12px; color: #8b949e; margin: 0 0 20px; }
  code       { background: #161b22; padding: 2px 6px; border-radius: 4px; }
  .pt-self   { font-size: 14px; margin-bottom: 16px; color: #8b949e; }
  .pt-count  { font-size: 36px; font-weight: bold; margin-bottom: 16px; }
  .pt-peers  { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
  .pt-peer   { background: #161b22; padding: 8px 12px; border-radius: 8px; font-size: 14px; }
  .pt-empty  { color: #8b949e; font-style: italic; }
  .pt-status { font-size: 18px; font-weight: bold; }
</style>
