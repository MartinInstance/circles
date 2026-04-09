<script>
  import { onMount } from 'svelte'
  import { screen, identity } from './lib/stores.js'
  import { getIdentity, hasIdentity } from './lib/identity.js'
  import { isDemoMode, setupDemo } from './lib/demo.js'

  import Onboarding    from './screens/Onboarding.svelte'
  import Feed          from './screens/Feed.svelte'
  import CreateCircle  from './screens/CreateCircle.svelte'
  import Settling      from './screens/Settling.svelte'
  import Meditation    from './screens/Meditation.svelte'
  import Conversation  from './screens/Conversation.svelte'
  import GlobalHorizon from './screens/GlobalHorizon.svelte'
  import TransitionOverlay from './components/TransitionOverlay.svelte'

  // Demo mode: set up mock state before any component mounts
  if (isDemoMode()) setupDemo()

  onMount(() => {
    if (isDemoMode()) return  // demo.js already set screen + stores
    if (hasIdentity()) {
      const id = getIdentity()
      identity.set(id)
      screen.set('feed')
    } else {
      screen.set('onboarding')
    }
  })
</script>

<TransitionOverlay />

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
{/if}
