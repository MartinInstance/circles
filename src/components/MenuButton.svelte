<script>
  import { screen, previousScreen } from '../lib/stores.js'

  function openAbout() {
    previousScreen.set($screen)
    screen.set('about')
  }
</script>

<button class="menu-btn" on:click={openAbout} aria-label="About">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" stroke="rgba(245,240,235,0.45)" stroke-width="1"/>
    <line x1="7.5" y1="9.5"  x2="16.5" y2="9.5"  stroke="rgba(245,240,235,0.70)" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="7.5" y1="14.5" x2="16.5" y2="14.5" stroke="rgba(245,240,235,0.70)" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
</button>

<style>
  .menu-btn {
    position: fixed;
    top: calc(var(--safe-top) + 16px);
    right: 18px;
    z-index: 1000;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    line-height: 0;
    transition: opacity 0.15s;
  }
  .menu-btn:active { opacity: 0.6; }
</style>
