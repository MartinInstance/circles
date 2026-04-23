<script>
  import { screen, activeCircle, isCreator, identity } from '../lib/stores.js'
  import { announceCircle, storeCircle } from '../lib/nostr.js'
  import { track } from '../lib/analytics.js'

  const BEGINS_IN = [1, 5, 10, 30]
  const DURATIONS  = [1, 5, 10, 20, 30, 45, 60]

  let beginsIn   = 5
  let duration   = 10
  let intention  = ''
  let launching  = false
  let error      = ''

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  async function launch() {
    launching = true
    error = ''
    try {
      const id = uid()
      const startsAt = Math.floor(Date.now() / 1000) + beginsIn * 60
      const circle = { id, startsAt, duration, status: 'scheduled', creatorName: $identity.name, intention: intention.trim() }
      storeCircle(circle)
      await announceCircle(circle)
      activeCircle.set(circle)
      isCreator.set(true)
      track('circle_created', { circle_id: id, duration_minutes: duration, begins_in_minutes: beginsIn })
      screen.set('settling')
    } catch (e) {
      console.error(e)
      track('error', { context: 'circle_create', message: e?.message })
      error = 'could not reach relays — check your connection'
      launching = false
    }
  }
</script>

<div class="screen bg-create">
  <div class="glow-tr"></div>

  <div class="top-bar">
    <button class="btn-back" on:click={() => screen.set('feed')}>← back</button>
  </div>

  <div class="header">
    <p class="app-name">Circles</p>
    <h1 class="title-italic" style="font-size:34px">new circle</h1>
  </div>

  <div class="selectors">
    <section>
      <p class="label-caps">Begins In</p>
      <div class="chips">
        {#each BEGINS_IN as opt}
          <button class="chip {beginsIn === opt ? 'active' : ''}" on:click={() => beginsIn = opt}>
            {opt} min
          </button>
        {/each}
      </div>
    </section>

    <section>
      <p class="label-caps">How Long</p>
      <div class="chips">
        {#each DURATIONS as opt}
          <button class="chip {duration === opt ? 'active' : ''}" on:click={() => duration = opt}>
            {opt} min
          </button>
        {/each}
      </div>
    </section>
  </div>

  <div class="intention-wrap">
    <p class="label-caps">Intention <span class="optional">optional</span></p>
    <input
      type="text"
      class="intention-input"
      placeholder="e.g. loving kindness, clarity, rest..."
      bind:value={intention}
      maxlength="80"
    />
  </div>

  {#if error}
    <p class="error-msg">{error}</p>
  {/if}

  <div class="launch">
    <button class="btn-primary" on:click={launch} disabled={launching}>
      {launching ? 'announcing...' : 'launch circle'}
    </button>
  </div>
</div>

<style>
  .top-bar { padding: calc(var(--safe-top) + 20px) var(--pad-x) 0; }
  .header  { padding: 16px var(--pad-x) 0; display: flex; flex-direction: column; gap: 6px; }

  .selectors {
    padding: 40px var(--pad-x) 0;
    display: flex; flex-direction: column; gap: 36px;
    overflow-y: auto;
  }

  section { display: flex; flex-direction: column; gap: 14px; }
  .chips  { display: flex; flex-wrap: wrap; gap: 10px; }

  .error-msg {
    padding: 0 var(--pad-x);
    font-size: 13px; color: rgba(232,114,138,0.8); margin-top: 8px;
  }

  .intention-wrap {
    padding: 0 var(--pad-x);
    display: flex; flex-direction: column; gap: 14px;
  }

  .optional {
    font-size: 8px; letter-spacing: 1.5px; color: var(--text-faint);
    text-transform: uppercase; margin-left: 6px;
  }

  .intention-input { margin-bottom: 0; }

  .launch { padding: 24px var(--pad-x) calc(var(--safe-bottom) + 32px); }
  .btn-primary:disabled { opacity: 0.5; }

  .glow-tr {
    position: absolute; width: 220px; height: 220px; border-radius: 50%;
    background: rgba(110,198,184,0.07); top: -60px; right: -60px;
    filter: blur(50px); pointer-events: none;
  }
</style>
