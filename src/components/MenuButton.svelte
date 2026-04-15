<script>
  import { screen, previousScreen } from '../lib/stores.js'
  import { get } from 'svelte/store'

  function toggle() {
    if ($screen === 'about') {
      screen.set(get(previousScreen) || 'feed')
    } else {
      previousScreen.set($screen)
      screen.set('about')
    }
  }
</script>

<button class="menu-btn" on:click={toggle} aria-label="About">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" stroke="rgba(245,240,235,0.45)" stroke-width="1.2"/>
    <line x1="7.5" y1="9"   x2="16.5" y2="9"   stroke="rgba(245,240,235,0.70)" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="7.5" y1="15"  x2="16.5" y2="15"  stroke="rgba(245,240,235,0.70)" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
</button>

<style>
  .menu-btn {
    position: fixed;
    top: calc(var(--safe-top) + 14px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    background: rgba(0,0,0,0.15);
    border: none;
    border-radius: 50%;
    padding: 4px;
    cursor: pointer;
    line-height: 0;
    transition: opacity 0.15s;
  }
  .menu-btn:active { opacity: 0.6; }
</style>
