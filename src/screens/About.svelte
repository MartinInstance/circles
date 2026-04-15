<script>
  import { screen } from '../lib/stores.js'
  import { previousScreen } from '../lib/stores.js'
  import { get } from 'svelte/store'

  function back() {
    const prev = get(previousScreen)
    screen.set(prev || 'feed')
  }
</script>

<div class="screen bg-about">
  <div class="glow-top"></div>
  <div class="glow-bottom"></div>

  <div class="inner">
    <button class="btn-back" on:click={back}>← back</button>

    <div class="content fade-in">
      <p class="app-name">Circles</p>
      <h1 class="title">About</h1>

      <div class="body">
        <p>Circles is a co-meditation app. When you meditate with others, the meditation can often become deeper and more fulfilling.</p>

        <p>And maybe if we start meditating with people from around the world, the world could become a better, more open, and more smiling place. Circles is a naive world-peace app.</p>

        <p>Circles is also a social media app where your profile doesn't matter. You can talk to the people you meditated with after the session, but we do not log or store anything. When the last person has left the session everything is gone — except the human connection. You are never our product. You're consciousness meeting.</p>

        <p>Circles is not free to build and offer, so if you want to donate a coffee or become a patron, please follow the links below.</p>

        <div class="links">
          <a href="https://buymeacoffee.com" target="_blank" rel="noopener" class="link-btn">☕ buy me a coffee</a>
          <a href="https://patreon.com" target="_blank" rel="noopener" class="link-btn">♡ become a patron</a>
        </div>

        <p class="sign">Thank you,<br/><span class="signature">Martin</span><br/><span class="team">on behalf of the Marvelous team</span></p>
      </div>
    </div>
  </div>
</div>

<style>
  .screen {
    background: linear-gradient(160deg, #071a17 0%, #0a1038 100%);
  }

  .inner {
    flex: 1; display: flex; flex-direction: column;
    padding: calc(var(--safe-top) + 20px) var(--pad-x) calc(var(--safe-bottom) + 40px);
    overflow-y: auto;
  }
  .inner::-webkit-scrollbar { display: none; }

  .btn-back {
    font-weight:300; font-size:13px; letter-spacing:0.5px;
    color:rgba(245,240,235,0.88); align-self: flex-start;
    margin-bottom: 32px; cursor: pointer;
  }

  .content { display: flex; flex-direction: column; gap: 0; }

  .app-name {
    font-weight:200; font-size:11px; letter-spacing:4px;
    text-transform:uppercase; color:var(--text-faint);
    margin-bottom: 10px;
  }

  .title {
    font-family:'Cormorant', Georgia, serif;
    font-weight:400; font-style:italic;
    font-size:44px; line-height:1.1;
    color:var(--text-primary);
    margin-bottom: 40px;
  }

  .body { display: flex; flex-direction: column; gap: 22px; }

  .body p {
    font-weight:300; font-size:16px; line-height:1.75;
    color:var(--text-secondary);
  }

  .links {
    display: flex; flex-direction: column; gap: 12px;
    margin-top: 8px;
  }

  .link-btn {
    display: block;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 50px; padding: 14px 24px;
    text-align: center;
    font-weight:300; font-size:13px; letter-spacing:1px;
    color:var(--text-secondary);
    text-decoration: none;
    transition: background 0.2s;
  }
  .link-btn:active { background: rgba(255,255,255,0.08); }

  .sign {
    margin-top: 12px;
    font-weight:300; font-size:15px; line-height:1.9;
    color:var(--text-faint);
    font-style: italic;
  }

  .signature {
    font-family:'Cormorant', Georgia, serif;
    font-size:26px; font-weight:400;
    color:var(--text-secondary);
  }

  .team {
    font-size:13px; font-style:normal; letter-spacing:0.5px;
  }

  .glow-top, .glow-bottom {
    position: absolute; border-radius:50%;
    pointer-events: none; filter: blur(60px);
  }
  .glow-top {
    width:260px; height:260px;
    background: rgba(110,198,184,0.06);
    top:-60px; right:-60px;
  }
  .glow-bottom {
    width:200px; height:200px;
    background: rgba(93,168,212,0.05);
    bottom:60px; left:-60px;
  }
</style>
