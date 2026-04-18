<script>
  import { onMount } from 'svelte'
  import { screen, identity } from './lib/stores.js'
  import { getIdentity, hasIdentity } from './lib/identity.js'
  import { isDemoMode, setupDemo } from './lib/demo.js'
  import { initAnalytics, identifyUser } from './lib/analytics.js'

  import Onboarding    from './screens/Onboarding.svelte'
  import Feed          from './screens/Feed.svelte'
  import CreateCircle  from './screens/CreateCircle.svelte'
  import Settling      from './screens/Settling.svelte'
  import Meditation    from './screens/Meditation.svelte'
  import Conversation  from './screens/Conversation.svelte'
  import GlobalHorizon from './screens/GlobalHorizon.svelte'
  import About         from './screens/About.svelte'
  import TransitionOverlay from './components/TransitionOverlay.svelte'
  import MenuButton    from './components/MenuButton.svelte'
  import PresenceTest  from './screens/PresenceTest.svelte'

  const isPresenceTest = new URLSearchParams(location.search).has('presence-test')

  // Demo mode: set up mock state before any component mounts
  if (isDemoMode()) setupDemo()

  onMount(() => {
    if (isDemoMode()) return  // demo.js already set screen + stores
    if (hasIdentity()) {
      const id = getIdentity()
      identity.set(id)
      initAnalytics()
      identifyUser(id.name, id.country)
      screen.set('feed')
    } else {
      screen.set('onboarding')
    }
  })
</script>

{#if isPresenceTest}
  <PresenceTest />
{:else}
  <TransitionOverlay />

  {#if $screen !== 'onboarding'}
    <MenuButton />
  {/if}

  {#if $screen === 'onboarding'}
    <Onboarding />
  {:else if $screen === 'feed'}
    <Feed />
  {:else if $screen === 'create'}
    <CreateCircle />
  {:else if $screen === 'settling'}
    <Settling />
  {:else if $screen === 'meditation'}
    <Meditation />
  {:else if $screen === 'conversation'}
    <Conversation />
  {:else if $screen === 'globalHorizon'}
    <GlobalHorizon />
  {:else if $screen === 'about'}
    <About />
  {/if}
{/if}
