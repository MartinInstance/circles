<script>
  import { onMount, onDestroy, tick } from 'svelte'
  import { screen, activeCircle, identity, participatedCircles } from '../lib/stores.js'
  import { closeCircle } from '../lib/nostr.js'
  import { leaveCircle } from '../lib/navigate.js'
  import { enterRoom, leaveRoom } from '../lib/rooms.js'
  import { track } from '../lib/analytics.js'

  let circle = null
  let roomApi = null
  let messages = []
  let inputText = ''
  let peerCount = 1
  let msgId = 0
  let listEl
  let lastActivityMs = Date.now()
  let idleTicker

  const IDLE_TIMEOUT = 5 * 60 * 1000   // 5 minutes

  const unsub = activeCircle.subscribe(c => { circle = c })

  onMount(() => {
    if (!circle) { screen.set('feed'); return }

    participatedCircles.update(s => { s.add(circle.id); return s })
    roomApi = enterRoom(`circle:${circle.id}`)
    roomApi.announce()

    roomApi.room.onPeerJoin(() => { peerCount++ })
    roomApi.room.onPeerLeave(() => { peerCount = Math.max(1, peerCount - 1) })

    roomApi.onMessage((data) => {
      lastActivityMs = Date.now()
      messages = [...messages, { ...data, id: ++msgId, self: false }]
      scrollToBottom()
    })

    idleTicker = setInterval(() => {
      if (Date.now() - lastActivityMs >= IDLE_TIMEOUT) forceEnd()
    }, 30_000)
  })

  onDestroy(() => {
    unsub()
    clearInterval(idleTicker)
    leaveRoom(`circle:${circle?.id}`)
  })

  function stepOut() {
    clearInterval(idleTicker)
    track('circle_left', { circle_id: circle?.id, from_phase: 'conversation', method: 'step_out' })
    leaveRoom(`circle:${circle?.id}`)
    leaveCircle(() => { activeCircle.set(null) }, 'stepping out')
  }

  async function forceEnd() {
    clearInterval(idleTicker)
    track('circle_force_ended', { circle_id: circle?.id, reason: 'idle_5min' })
    const circleSnapshot = circle
    leaveRoom(`circle:${circleSnapshot?.id}`)
    leaveCircle(async () => {
      try { await closeCircle(circleSnapshot) } catch {}
      activeCircle.set(null)
    }, 'Goodbye')
  }

  async function send() {
    const text = inputText.trim()
    if (!text) return
    lastActivityMs = Date.now()
    const id   = $identity
    const senderName = id?.country ? `${id.name}, ${id.country}` : (id?.name ?? 'you')
    const msg = { id: ++msgId, senderName, text, ts: Date.now(), self: true }
    inputText = ''
    messages = [...messages, msg]
    roomApi.sendMessage({ senderName: msg.senderName, text: msg.text, ts: msg.ts })
    await scrollToBottom()
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function scrollToBottom() {
    await tick()
    listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' })
  }

  async function leave() {
    clearInterval(idleTicker)
    track('circle_left', { circle_id: circle?.id, from_phase: 'conversation', method: 'goodbye', is_last: peerCount <= 1 })
    const isLast = peerCount <= 1
    const circleSnapshot = circle
    leaveRoom(`circle:${circleSnapshot?.id}`)
    leaveCircle(async () => {
      if (isLast) { try { await closeCircle(circleSnapshot) } catch {} }
      activeCircle.set(null)
    }, 'Goodbye')
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false })
  }
</script>

<div class="screen bg-convo">
  <div class="glow"></div>

  <header>
    <div class="header-meta">
      <p class="label-caps">After the Bell</p>
      <h2 class="title-italic" style="font-size:24px">sharing</h2>
    </div>
    <p class="peer-badge">{peerCount} here</p>
  </header>

  <div class="messages" bind:this={listEl}>
    {#if messages.length === 0}
      <div class="empty-state">
        <p>be the first to share</p>
        <p class="sub">what arose during the silence?</p>
      </div>
    {/if}

    {#each messages as msg (msg.id)}
      <div class="msg {msg.self ? 'msg-self' : 'msg-peer'} fade-in">
        {#if !msg.self}
          <p class="msg-sender">{msg.senderName}</p>
        {/if}
        <div class="bubble {msg.self ? 'b-self' : 'b-peer'}">
          <p class="msg-text">{msg.text}</p>
        </div>
        <p class="msg-time">{fmtTime(msg.ts)}</p>
      </div>
    {/each}
  </div>

  <div class="input-bar">
    <textarea
      bind:value={inputText}
      on:keydown={onKey}
      placeholder="share a reflection..."
      rows="1"
    ></textarea>
    <button class="send-btn" on:click={send} disabled={!inputText.trim()}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <div class="goodbye-wrap">
    <button class="step-out" on:click={stepOut}>step out</button>
    <button class="goodbye" on:click={leave}>thank you and goodbye</button>
  </div>
</div>

<style>
  header {
    padding: calc(var(--safe-top) + 56px) var(--pad-x) 0;
    display: flex; justify-content: space-between; align-items: flex-end;
  }

  .header-meta { display: flex; flex-direction: column; gap: 4px; }

  .peer-badge {
    font-weight:200; font-size:11px; letter-spacing:2px;
    text-transform:uppercase; color:var(--text-whisper); padding-bottom:4px;
  }

  .messages {
    flex: 1; overflow-y: auto;
    padding: 20px var(--pad-x) 8px;
    display: flex; flex-direction: column; gap: 14px;
    -webkit-overflow-scrolling: touch;
  }
  .messages::-webkit-scrollbar { display: none; }

  .empty-state {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; padding: 40px 0;
  }
  .empty-state p { font-weight:200; font-size:16px; font-style:italic; color:var(--text-tertiary); }
  .empty-state .sub { font-size:13px; color:var(--text-faint); }

  .msg { display: flex; flex-direction: column; gap: 4px; max-width: 80%; }
  .msg-self  { align-self: flex-end;  align-items: flex-end; }
  .msg-peer  { align-self: flex-start; }

  .msg-sender { font-weight:300; font-size:11px; color:var(--text-primary); letter-spacing:0.5px; }

  .bubble { padding: 12px 16px; border-radius: 18px; }
  .b-self {
    background: rgba(232,114,138,0.12); border: 1px solid rgba(232,114,138,0.2);
    border-bottom-right-radius: 4px;
  }
  .b-peer {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-bottom-left-radius: 4px;
  }

  .msg-text { font-weight:300; font-size:15px; line-height:1.5; color:var(--text-primary); white-space:pre-wrap; word-break:break-word; }
  .msg-time { font-size:10px; font-weight:200; color:var(--text-faint); }

  .input-bar {
    display: flex; align-items: flex-end; gap: 10px;
    padding: 10px var(--pad-x);
    border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.15);
  }

  textarea {
    flex: 1; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px; padding: 12px 16px;
    color: var(--text-primary); font-family: inherit;
    font-weight:300; font-size:15px; line-height:1.4;
    resize: none; outline: none; caret-color: var(--mint);
    max-height: 120px; overflow-y: auto;
  }
  textarea::placeholder { color: var(--text-faint); }

  .send-btn {
    width: 42px; height: 42px; border-radius: 50%;
    background: rgba(232,114,138,0.12);
    border: 1px solid rgba(232,114,138,0.28) !important;
    color: rgba(232,114,138,0.8);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; cursor: pointer; transition: opacity 0.15s;
  }
  .send-btn:disabled { opacity: 0.3; }

  .goodbye-wrap {
    padding: 12px var(--pad-x) calc(var(--safe-bottom) + 16px);
    display: flex; flex-direction: column; align-items: center; gap: 10px;
  }

  .step-out {
    font-weight:300; font-size:13px; color:var(--text-tertiary);
    letter-spacing:0.5px; cursor:pointer;
  }

  .goodbye {
    font-weight:200; font-size:12px; font-style:italic; color:var(--text-faint); cursor:pointer;
  }

  .glow {
    position: absolute; width:220px; height:220px; border-radius:50%;
    background: rgba(232,114,138,0.06); top:-60px; left:-60px;
    filter: blur(50px); pointer-events: none;
  }
</style>
