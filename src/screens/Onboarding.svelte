<script>
  import { onMount } from 'svelte'
  import { screen, identity } from '../lib/stores.js'
  import { setName, setCountry, getIdentity } from '../lib/identity.js'
  import { initAnalytics, identifyUser, track } from '../lib/analytics.js'
  import { joinGlobalPresence } from '../lib/globalPresence.js'

  let name = ''
  let error = ''
  let submitting = false
  let detectedCountry = ''

  onMount(async () => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      detectedCountry = data.country_name ?? ''
    } catch {
      detectedCountry = ''
    }
  })

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) { error = 'a name helps others know you are here'; return }
    if (trimmed.length > 32) { error = 'keep it under 32 characters'; return }
    submitting = true
    setName(trimmed)
    setCountry(detectedCountry)
    identity.set(getIdentity())
    initAnalytics()
    identifyUser(trimmed, detectedCountry)
    track('user_logged_in', { country: detectedCountry })
    joinGlobalPresence()
    screen.set('feed')
  }

  function onKey(e) {
    if (e.key === 'Enter') submit()
  }
</script>

<div class="screen bg-auth">
  <div class="glow-top"></div>
  <div class="glow-bottom"></div>

  <div class="inner fade-in">
    <p class="app-name">Circles</p>
    <h1 class="title">Meditate<br/>together</h1>

    <p class="hint">what is your name?</p>

    <input
      type="text"
      placeholder="your name"
      bind:value={name}
      on:keydown={onKey}
      maxlength="32"
      autofocus
    />

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <button class="btn-primary" on:click={submit} disabled={submitting}>
      {submitting ? '...' : 'enter'}
    </button>

    <p class="footnote">no account · no email · just your name</p>
  </div>
</div>

<style>
  .inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: calc(var(--safe-top) + 60px) var(--pad-x) calc(var(--safe-bottom) + 40px);
  }

  .app-name {
    font-weight: 200;
    font-size: 11px;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 16px;
  }

  .title {
    font-family: 'Cormorant', Georgia, serif;
    font-weight: 400;
    font-size: 44px;
    font-style: italic;
    line-height: 1.1;
    color: var(--text-primary);
    margin-bottom: 56px;
  }

  .hint {
    font-weight: 400;
    font-size: 12px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(245, 240, 235, 0.88);
    margin-bottom: 14px;
  }

  input {
    margin-bottom: 32px;
  }

  .error-msg {
    font-size: 13px;
    color: rgba(232, 114, 138, 0.8);
    margin-top: -20px;
    margin-bottom: 24px;
  }

  .btn-primary {
    margin-bottom: 28px;
  }

  .btn-primary:disabled { opacity: 0.5; }

  .footnote {
    text-align: center;
    font-size: 12px;
    font-weight: 200;
    color: var(--text-faint);
  }

  .glow-top, .glow-bottom {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(50px);
  }
  .glow-top {
    width: 260px; height: 260px;
    background: rgba(110, 198, 184, 0.08);
    top: -80px; right: -60px;
  }
  .glow-bottom {
    width: 200px; height: 200px;
    background: rgba(93, 168, 212, 0.06);
    bottom: 60px; left: -60px;
  }
</style>
