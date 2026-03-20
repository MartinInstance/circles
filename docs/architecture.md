# Circles — Software Architecture Document

## Overview

Circles is a fully decentralised group meditation application. There is no backend server, no database, and no infrastructure owned or operated by the product team. The architecture relies entirely on open, public protocols: Nostr for persistent event storage and signalling, and WebRTC (via Trystero) for real-time peer-to-peer communication within a circle.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| UI framework | Svelte | 4.x |
| Build tool | Vite | 5.x |
| Native wrapper | Capacitor | 8.x |
| P2P real-time | Trystero (Nostr strategy) | 0.21.x |
| Nostr client | nostr-tools | 2.7.x |
| Platforms | iOS, Android, Web | — |

---

## Module Structure

```
src/
  main.js              — Vite entry point; mounts App.svelte
  App.svelte           — Root component; reads screen store and renders active screen
  app.css              — Global design tokens, resets, layout

  lib/
    stores.js          — Svelte writable stores (screen, activeCircle, identity, isCreator)
    identity.js        — Keypair generation, localStorage persistence, display name
    nostr.js           — SimplePool, circle event publishing and subscription, 24h stats
    rooms.js           — Trystero room management, presence and message actions

  screens/
    Onboarding.svelte  — Name entry; first-launch only
    Feed.svelte        — Circle discovery; live Nostr subscription
    CreateCircle.svelte — Circle configuration and announcement
    Settling.svelte    — Pre-meditation gathering space
    Meditation.svelte  — Shared timer screen
    Conversation.svelte — Post-meditation text sharing
    GlobalHorizon.svelte — 24h community statistics and live presence count

  components/
    ProgressRing.svelte — Reusable SVG arc progress indicator
```

---

## Identity & User Management

**Solution: local keypair + display name, no accounts**

On first launch the user enters a display name (max 32 characters). The application generates a Nostr keypair (`generateSecretKey` / `getPublicKey` from nostr-tools) and persists both the private key (as a byte array) and the display name in `localStorage`.

- Key: `circles:sk` — private key as JSON array
- Key: `circles:name` — display name string

The public key serves as the user's durable pseudonymous identity across all Nostr events. No email address, password, or server-side account is created at any point. Identity data never leaves the device through any centralised channel.

---

## Circle Announcements & Persistence

**Solution: Nostr parameterised replaceable events (NIP-33, kind 30000)**

A circle announcement is a signed Nostr event published to the configured public relays. Because relays store events, circles announced minutes or hours in advance remain discoverable even after the creator closes the application.

### Event structure

```
kind: 30000
tags:
  ["d", "<circle-id>"]             — unique identifier (base36 timestamp+random)
  ["t", "circles-v1"]              — application namespace filter
  ["starts", "<unix-timestamp>"]   — scheduled start time
  ["duration", "<minutes>"]        — session length
  ["status", "<lifecycle-phase>"]  — current status
  ["creator", "<display-name>"]    — human-readable creator name
content: ""
```

NIP-33 parameterised replaceability means that when the creator publishes a status update (e.g. `scheduled` → `meditating`), relays replace the previous event for the same `pubkey + kind + d` combination. Subscribers always converge to the latest state.

### Status lifecycle

```
scheduled → settling → meditating → conversation → closed
```

Only the circle creator publishes status update events. All other participants advance through screens based on the `startsAt` timestamp and `duration` values embedded in the event — they do not depend on relay connectivity once the circle has started.

### Publication strategy

Events are published to all three configured relays simultaneously. `Promise.any` is used so the operation succeeds as long as at least one relay accepts the event.

---

## Real-Time Presence & Messaging

**Solution: Trystero with Nostr signalling strategy**

Within an active circle, real-time communication uses WebRTC peer-to-peer connections established through Trystero. Trystero uses Nostr relays as its WebRTC signalling layer, meaning no dedicated signalling server is required.

### Room naming

Each circle maps to a Trystero room with the ID `circle:<circle-id>`. The Global Horizon screen uses the fixed room `circles:global-horizon`.

### Actions

| Action name | Payload | Purpose |
|---|---|---|
| `presence` | `{ name }` | Announce display name on peer join |
| `message` | `{ senderName, text, ts }` | Send a text message in Conversation screen |

On joining a room, each peer automatically broadcasts their display name. Messages are not persisted — they exist only for the duration of the active WebRTC session.

### Peer count tracking

Each screen that cares about presence listens to `room.onPeerJoin` and `room.onPeerLeave` events from Trystero to maintain a local reactive count. The Global Horizon screen uses this same mechanism to show how many users are currently viewing it.

---

## Screen Routing

**Solution: Svelte writable store**

Navigation is handled entirely by a single `screen` writable store. `App.svelte` conditionally renders one of seven screen components based on the store value. There is no URL router. This keeps navigation trivially simple and compatible with Capacitor's native embedding, where URL-based routing adds no value.

---

## Circle Discovery Feed

**Solution: live Nostr subscription**

The Feed screen opens a `pool.subscribeMany` subscription to all configured relays filtered to:
- `kinds: [30000]`
- `#t: ['circles-v1']`
- `since: now - 86400` (last 24 hours)

Incoming events are parsed and stored in a `Map` keyed on `pubkey:d`. If a newer event arrives for an existing key (higher `created_at`), it replaces the previous entry. Events with status `closed` are excluded from display. Up to five circles are shown as floating orbs.

---

## Global Horizon Statistics

**Solution: Nostr event aggregation, no additional data store**

The 24-hour statistics are derived entirely from public Nostr events:
- **Circles held**: count of unique `pubkey:d` pairs in the last 24 hours
- **Unique practitioners**: count of unique `pubkey` values
- **Completed circles**: count of unique `pubkey:d` pairs where the latest event has `status = closed`

This is computed client-side using `pool.querySync` across all configured relays. No secondary data store or aggregation service is required.

---

## Platform Delivery

**Solution: Vite web app wrapped by Capacitor**

The application is built as a standard Vite/Svelte web application targeting `es2020`. Capacitor wraps the compiled `dist/` output and provides the native iOS and Android shells.

- `vite build` → `dist/`
- `npx cap sync` → copies `dist/` into the iOS and Android native projects and syncs plugins
- `npx cap open ios` / `cap open android` → opens the project in Xcode / Android Studio

Capacitor plugins used: none beyond `@capacitor/core` (StatusBar and SplashScreen configuration is handled via `capacitor.config.ts`).

---

## Relay Configuration

All relay URLs are defined in a single array exported from `src/lib/nostr.js` and imported by both `nostr.js` and `rooms.js`. Changing relay targets requires editing one line in one file.

```js
export const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol'
]
```

---

## Data Flow Summary

```
User action
    │
    ▼
Svelte store update (screen / activeCircle)
    │
    ├──▶ nostr.js ──▶ public Nostr relays (event persistence)
    │         ▲
    │         └── subscribeToCircles / fetch24hStats
    │
    └──▶ rooms.js ──▶ Trystero ──▶ Nostr relays (WebRTC signalling)
                           │
                           └──▶ WebRTC peer connections (presence / messages)
```
