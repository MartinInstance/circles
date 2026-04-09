<script>
  import { screenTransition } from '../lib/stores.js'
</script>

{#if $screenTransition.active}
  <div class="overlay" style="background: {$screenTransition.background}">
    <p class="msg">{$screenTransition.message}</p>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    /* background set via inline style from screenTransition store */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: none;
    animation: overlay-anim 2s ease-in-out forwards;
  }

  .msg {
    font-family: 'Cormorant', Georgia, serif;
    font-weight: 300;
    font-style: italic;
    font-size: 38px;
    color: rgba(245, 240, 235, 0.90);
    letter-spacing: 1px;
    animation: msg-anim 2s ease-in-out forwards;
  }

  @keyframes overlay-anim {
    0%   { opacity: 0 }
    10%  { opacity: 1 }
    80%  { opacity: 1 }
    100% { opacity: 0 }
  }

  @keyframes msg-anim {
    0%   { opacity: 0; transform: translateY(14px) }
    22%  { opacity: 1; transform: translateY(0) }
    70%  { opacity: 1; transform: translateY(0) }
    100% { opacity: 0; transform: translateY(-10px) }
  }
</style>
