# Circles — Requirements Document

## Customer Requirements

### Purpose
Circles is a group meditation application designed to help people sit together in silence across distances. The product creates a sense of shared presence and ritual without requiring accounts, servers, or centralised infrastructure.

### Core User Needs

1. **Frictionless entry** — a user should be able to open the app and be present in a circle within seconds. No sign-up, no email, no password.

2. **Scheduled circles** — users should be able to announce a circle in advance (minutes to hours ahead), allowing others to plan around it. Announcements must persist even when the creator closes the app.

3. **Shared silence** — once a circle begins, participants experience a shared meditation timer together. Seeing that others are present is the primary value.

4. **Post-meditation sharing** — after the bell, participants can share a reflection via text. This is intentionally lightweight — not a chat room.

5. **Community pulse** — users should have a sense of the broader community without personal data being stored. A summary of the last 24 hours of activity (circles held, practitioners reached) serves this need.

6. **Permanent gathering point** — the Global Horizon screen acts as an always-available communal space where users can feel connected to the wider community.

7. **Cross-platform** — the application must run on iOS, Android, and the web browser from a single codebase.

8. **No backend dependency** — the product must function without any server owned or operated by the product team. Infrastructure dependencies must be limited to open, decentralised networks.

---

## Software Requirements

### Identity & Accounts

- SR-01: The application shall not require email addresses or passwords.
- SR-02: On first launch, the user shall provide a display name (max 32 characters).
- SR-03: A Nostr keypair shall be generated locally and stored in `localStorage`. This keypair is used to sign Nostr events and constitutes the user's persistent identity.
- SR-04: The display name and keypair shall persist across sessions via `localStorage`.
- SR-05: No identity data shall be transmitted to any centralised server.

### Circle Lifecycle

- SR-06: A user may create a circle by selecting a "begins in" delay (1, 5, 10, or 30 minutes) and a duration (1, 5, 10, 20, 30, 45, or 60 minutes).
- SR-07: On creation, a circle shall be announced as a signed Nostr event (kind 30000, parameterised replaceable) to a set of configured public relays.
- SR-08: The circle announcement shall include: unique ID, scheduled start time (Unix timestamp), duration in minutes, creator display name, and current status.
- SR-09: Circle status shall progress through: `scheduled` → `settling` → `meditating` → `conversation` → `closed`.
- SR-10: Status updates shall be published as replacement Nostr events on the same `d` tag so relays converge to the latest state.
- SR-11: All participants shall auto-advance through screen transitions based on the circle's `startsAt` timestamp and `duration`, independent of relay connectivity during the session.
- SR-12: Only the circle creator shall publish status update events to Nostr.

### Discovery & Feed

- SR-13: On the Feed screen, the application shall subscribe to Nostr relays for circle events from the last 24 hours.
- SR-14: Circles with status `closed` shall be excluded from the feed display.
- SR-15: The feed shall display up to 5 circles as floating orbs. Each orb shall show the start time, duration, and current status.
- SR-16: Tapping an orb shall join the corresponding Trystero room and navigate to the appropriate screen based on current circle status.

### Real-Time Presence & Messaging

- SR-17: Within a circle, real-time peer-to-peer communication shall be handled by Trystero using the Nostr signalling strategy.
- SR-18: Each circle shall have a unique Trystero room derived from its ID (`circle:<id>`).
- SR-19: On joining a room, each peer shall announce their display name via a `presence` action.
- SR-20: The Settling screen shall display floating greeting bubbles when new peers arrive.
- SR-21: The Meditation screen shall display a dot for each peer present, pulsing when a new arrival is detected.
- SR-22: The Conversation screen shall support sending and receiving text messages via Trystero's `message` action.
- SR-23: Text messages shall not be stored. They exist only in the active session.

### Global Horizon

- SR-24: The Global Horizon screen shall query Nostr relays for all circle events from the last 24 hours and display: number of circles, number of unique practitioners (by public key), and number of completed circles.
- SR-25: The Global Horizon screen shall maintain a live Trystero room (`circles:global-horizon`) to show how many users are currently viewing the screen.
- SR-26: The 24-hour statistics shall be derived entirely from public Nostr events. No additional data store is required.

### Platform & Distribution

- SR-27: The web application shall be built with Vite and Svelte 4.
- SR-28: The application shall be wrapped for native deployment using Capacitor 8.
- SR-29: The application shall target iOS, Android, and modern web browsers.
- SR-30: On wide screens (desktop browsers), the application viewport shall be constrained to a maximum width of two-thirds of the viewport height, preserving mobile proportions.

### Nostr Relays

- SR-31: The application shall use the following default relays: `wss://relay.damus.io`, `wss://relay.nostr.band`, `wss://nos.lol`.
- SR-32: At least one relay must accept a published event for the operation to succeed (`Promise.any`).
- SR-33: Relay configuration shall be centralised in `src/lib/nostr.js` for easy modification.
