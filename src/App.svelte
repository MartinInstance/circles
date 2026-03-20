<script>
  import { onMount } from 'svelte'
  import { screen, identity } from './lib/stores.js'
  import { getIdentity, hasIdentity } from './lib/identity.js'

  import Onboarding    from './screens/Onboarding.svelte'
  import Feed          from './screens/Feed.svelte'
  import CreateCircle  from './screens/CreateCircle.svelte'
  import Settling      from './screens/Settling.svelte'
  import Meditation    from './screens/Meditation.svelte'
  import Conversation  from './screens/Conversation.svelte'
  import GlobalHorizon from './screens/GlobalHorizon.svelte'

  onMount(() => {
    if (hasIdentity()) {
      const id = getIdentity()
      identity.set(id)
      screen.set('feed')
    } else {
      screen.set('onboarding')
    }
  })
</script>

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
