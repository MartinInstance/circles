# Circles — Design Document

## Purpose

This document records the key design decisions made during the implementation of Circles, with rationale for each choice. It is intended to help future contributors understand why the system is built the way it is, not just how it works.

---

## 1. Svelte 4 over React / React Native

**Decision**: Rewrite from React Native/Expo to Svelte 4 + Vite + Capacitor.

**Rationale**:
- React Native's abstraction layer adds overhead and complexity for an application whose primary interface is visual effects and animations.
- Svelte compiles to vanilla JavaScript with no virtual DOM. For an animation-heavy, timer-driven app, this reduces runtime cost and eliminates reconciliation stutters during critical moments (e.g. the meditation timer).
- Svelte's scoped component styles make the per-screen design system straightforward to maintain without CSS-in-JS tooling.
- Capacitor provides the same iOS/Android distribution path as Expo but without locking the codebase into React Native's API surface.

---

## 2. Capacitor over Expo / React Native CLI

**Decision**: Use Capacitor 8 as the native wrapper.

**Rationale**:
- Capacitor wraps any web application, not just React Native ones. Switching to Svelte required leaving Expo anyway; Capacitor was the natural pairing.
- Capacitor's native project structure (a real Xcode project, a real Android Studio project) gives full control over native configuration without an opaque managed build layer.
- The web build (`vite build`) and native sync (`cap sync`) are separate steps with clear boundaries.

---

## 3. No Backend — Nostr for Persistence, Trystero for Real-Time

**Decision**: Use Nostr for persistent circle announcements and Trystero (Nostr strategy) for real-time peer-to-peer communication. No server, database, or infrastructure owned by the product team.

**Rationale**:
- The core product promise ("sit together across distances without accounts, servers, or centralised infrastructure") makes a backend philosophically incompatible.
- Nostr's relay network provides free, open, distributed event persistence. A circle announced an hour in advance remains discoverable because relays store the event — no creator device needs to stay online.
- Trystero's Nostr strategy uses the same relay infrastructure for WebRTC signalling, meaning Circles has zero infrastructure dependencies of its own.
- BitTorrent trackers (an alternative considered) do not store events; they only mediate live connections. This would have made advance circle scheduling impossible without a separate persistence layer.

---

## 4. NIP-33 Parameterised Replaceable Events for Circle State

**Decision**: Publish circle announcements as kind 30000 events with a `d` tag (NIP-33), and publish status updates as replacements rather than new events.

**Rationale**:
- NIP-33 replaceable events guarantee that relays converge to the latest state for a given `pubkey + kind + d` combination. Clients subscribing after multiple status updates receive only the most recent event, not the full history.
- This eliminates client-side deduplication complexity for the feed and makes the state model simple: the latest event for a circle is authoritative.
- The `d` tag value is a locally generated ID (base36 timestamp + random component), so no coordination is needed to create globally unique circle identifiers.

---

## 5. Creator-Only Status Publishing

**Decision**: Only the circle creator publishes status update events to Nostr (SR-12).

**Rationale**:
- Allowing any participant to publish updates would create race conditions and ambiguity about which event is authoritative.
- The creator is the natural authority for a circle they scheduled.
- Non-creator participants advance through screens by computing phase from the `startsAt` timestamp and `duration` in the event. They do not depend on receiving relay events once the session has started, which makes the system resilient to connectivity loss mid-session.

---

## 6. Store-Based Routing

**Decision**: Navigate between screens using a single Svelte `writable` store rather than a URL router (e.g. SvelteKit, svelte-routing).

**Rationale**:
- The application has a linear, session-scoped flow. There is no deep linking, browser history, or URL addressability requirement.
- Capacitor's native shells do not benefit from URL routing — the WebView always loads from `index.html`.
- A single `screen` store is simpler, more predictable, and avoids adding a routing dependency for a problem that does not exist in this context.

---

## 7. Client-Side Phase Computation

**Decision**: All participants compute their current circle phase (`settling`, `meditating`, `conversation`) from `startsAt` and `duration` values stored in the Nostr event, using their local clock.

**Rationale**:
- This makes the session entirely self-contained once the event is fetched. No relay connectivity is needed during the meditation itself.
- It avoids a coordination problem: if the creator's device loses connectivity, non-creators would be stranded waiting for a status event that never arrives.
- The trade-off is sensitivity to device clock skew. This is acceptable for a meditation context where second-level precision is not critical.

---

## 8. Identity: Display Name + Nostr Keypair, No Accounts

**Decision**: Generate a local Nostr keypair on first launch; ask only for a display name.

**Rationale**:
- Requiring email or passwords creates friction that contradicts the product's "frictionless entry" requirement (SR-01).
- A Nostr keypair provides a durable pseudonymous identity that can sign events without any server involvement. The private key lives only on the user's device.
- The display name is the only human-readable identity. It is embedded in Nostr events so other participants can see who is present.
- The deliberate limitation is that keypair loss (e.g. clearing localStorage) creates a new identity. This is an acceptable trade-off for v1 — no account recovery flow is needed because there is nothing to recover access to beyond a name and event history.

---

## 9. Trystero Room Naming Convention

**Decision**: Circle rooms are named `circle:<circle-id>`; the Global Horizon room is `circles:global-horizon`.

**Rationale**:
- Namespacing by `circle:` prefix isolates circle rooms from each other and from any other Trystero usage sharing the same relay infrastructure.
- Using the circle ID directly means the room ID is derivable from the Nostr event alone — no separate coordination is needed to know which room to join.
- `circles:global-horizon` is a fixed, well-known name that any client can join regardless of session context.

---

## 10. Feed: Maximum Five Orbs

**Decision**: The feed displays at most five circles as floating orbs (SR-15).

**Rationale**:
- The feed is a gathering space, not a directory. The orb metaphor works visually for a small number of items and breaks down if scaled to a list.
- Five is sufficient for the expected usage density of a niche meditation application. If demand grows, the constraint can be revisited.
- Limiting to five also bounds the layout complexity: five orbs can be positioned with hardcoded offsets that create a natural, scattered composition without an algorithmic layout pass.

---

## 11. Global Horizon: Derived Statistics, No Additional Data Store

**Decision**: Compute all 24-hour statistics client-side from raw Nostr events.

**Rationale**:
- An aggregation service would require infrastructure the product team operates, violating the no-backend constraint.
- Nostr's event model is sufficient: circle count, unique practitioner count, and completed circle count can all be derived from a `querySync` across three relays.
- The result may vary slightly across clients depending on which events each relay has received. This is acceptable — the statistics are intentionally approximate ("a sense of the broader community"), not authoritative metrics.

---

## 12. Text-Only Contributions for v1

**Decision**: The Conversation screen supports text messages only; no images, audio, or reactions.

**Rationale**:
- Post-meditation sharing is intentionally lightweight. A text field is the minimum viable implementation of "say something after sitting together".
- Audio and images over Trystero's data channel add significant complexity around encoding, chunking, and bandwidth.
- Text only keeps the Conversation screen's implementation to a single `makeAction('message')` call.

---

## 13. Viewport Constraint on Wide Screens

**Decision**: `#app` is constrained to `max-width: calc(100vh * 2 / 3)` and centred in the viewport.

**Rationale**:
- The application is designed for mobile proportions. On a desktop browser, an unconstrained full-width layout would distort the orb-based UI into an unrecognisable shape.
- `2/3 * viewport-height` approximately matches a portrait phone aspect ratio at any desktop window size.
- The constraint is applied in CSS only; no JavaScript or media queries are needed.
