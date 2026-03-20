# Circles — UX Design Description

## Design Philosophy

Circles is built around a single emotional goal: making people feel less alone when they sit in silence. Every design decision follows from that. The interface should disappear during the meditation itself, make arrival feel like entering a real space, and let the fact of shared presence do the work — not features, notifications, or social mechanics.

The design values can be stated simply:
- **Presence over productivity** — the app is a place to be, not a tool to use
- **Ceremony without friction** — entering a circle should feel deliberate but effortless
- **Warmth without noise** — visual and textual language should feel human, not corporate

---

## Visual Language

### Palette

The colour palette draws from natural light phenomena — predawn sky, candlelight, dusk on water. Each colour is used with intent rather than decoration.

| Token | Colour | Used for |
|---|---|---|
| `--mint` | `#6ec6b8` | Primary actions, settling state, creation |
| `--lavender` | `#a78cc8` | Meditation state, presence dots |
| `--rose` | `#e8728a` | Conversation state, own messages |
| `--gold` | `#d4a853` | Global Horizon, completed state |
| `--sky` | `#5da8d4` | Feed screen, discovery state |

All colours are used as tints on dark backgrounds (opacity range 0.06–0.28 for fills, 0.14–0.28 for borders). This creates a sense of soft luminosity rather than hard UI chrome.

### Typography

Two typefaces are used in deliberate contrast:

- **Cormorant** (serif italic) — used exclusively for display headings (`begin your practice`, `settling`, `global horizon`). The italic serif evokes handwriting, contemplative literature, and the quieter traditions of practice. It signals that this moment is different from ordinary app usage.
- **Raleway** (geometric sans, weight 200–400) — used for all labels, metadata, and functional text. Its geometric structure creates legibility and structure without coldness. Ultra-light weights (200) are used for secondary information, allowing important content to breathe.

Text is never black on white. All type is rendered on dark gradient backgrounds in warm off-white (`#f5f0eb`) at varying opacities. Secondary text pulls back gracefully rather than switching colour.

### Animation

Three recurring animations carry meaning:

- **`float`** — a slow, gentle vertical oscillation (12s, 8px range). Used on orbs and the Global Horizon orb to suggest presence and aliveness without movement that demands attention.
- **`pulse-glow`** — a subtle scale + opacity breath (4s). Used on orbs and presence indicators to suggest a living, breathing quality.
- **`ripple`** — an outward expanding ring that fades to zero (4s). Used on the meditation timer to represent the outward effect of practice. Three staggered rings create a continuous, unhurried wave.

Animations are never decorative for their own sake. They encode state: a pulsing orb is live, ripples mean the session is in progress.

---

## User Flows

### First Launch

1. User opens the app. The Onboarding screen appears — deep teal gradient, a single italic heading: *begin your practice*.
2. A minimal prompt asks for a name. One input field, no other friction.
3. Tapping "enter" or pressing Return completes setup and lands the user on the Feed.

The footnote `no account · no email · just your name` is the only explanation offered. There is no tutorial, no feature tour, no permissions prompt on first launch.

### Joining a Circle

1. The Feed screen shows floating orbs, each representing an announced circle. Orbs are sized and positioned to feel scattered, not listed.
2. Each orb shows the start time (or countdown), duration, and current status as small label-caps text.
3. Tapping an orb joins the corresponding Trystero room and routes to the appropriate screen.

The feed uses a live Nostr subscription — new circles appear as they are announced by others without requiring a refresh.

### Creating a Circle

1. The user taps the `+` button on the Feed.
2. The Create screen offers two chip selectors: when the circle begins (1–30 minutes from now) and how long it will last (1–60 minutes).
3. Tapping "begin" publishes the Nostr event and immediately joins the creator's own settling room.

There is no circle name, no description field, no tags. The circle is defined entirely by time.

### Settling

The Settling screen is the gathering space before meditation begins. It has three jobs:

1. **Show the countdown** — a progress ring counts down to the start time. The phrase changes as time passes: long wait = `gathering`, close = `settling in`, imminent = `beginning soon`.
2. **Show who is arriving** — when a peer joins, a greeting bubble appears: their name in a floating chip, left or right, then fades after 7 seconds. No list, no roster — just the sense of others appearing.
3. **Create ceremony** — the transition to meditation is automatic. The screen advances based on the `startsAt` timestamp. No one taps a button to begin.

### Meditation

The Meditation screen is the heart of the application. Design goals:

- **Near-empty** — the screen shows a glowing core, three slow ripple rings, the elapsed/total time, a breath prompt, and a dot for each participant. Nothing else.
- **Presence dots** — one small lavender dot per connected peer, arranged around the core. A new dot pulses when someone arrives.
- **No interaction required** — the user should be able to set their phone face-down. The timer runs autonomously.

The end of the session is also automatic — the screen advances to Conversation when the duration elapses.

### Conversation

After the bell, the Conversation screen opens. Its design principles:

- **Optional participation** — there is no prompt to share, no required step. The field is available; using it is a choice.
- **Ephemeral** — messages are not stored. They exist only while participants remain in the room. This is stated implicitly by the experience, not explained in help text.
- **Not a chat room** — the interface is minimal by design. It is a space to offer a reflection, not to have a conversation. The label `share a reflection` reinforces this intent.

Leaving closes the circle for the creator (publishes `closed` to Nostr) and returns all participants to the Feed.

### Global Horizon

The Global Horizon screen exists to give the user a sense of the broader community without surfacing personal data. It shows:

- How many circles have been held in the last 24 hours
- How many unique practitioners have participated
- How many circles have been completed

A live count shows how many users are viewing the screen right now. This number is small by design — it is not a vanity metric but a moment of connection with whoever else is pausing at the horizon at the same time.

The gold palette, the slowly breathing orb, and the italic label "Global Horizon" are chosen to mark this screen as distinct from the session flow — a contemplative moment of perspective, not a dashboard.

---

## Tone of Voice

All text in the application is written in the second person, lowercase, with minimal punctuation. It speaks directly and gently.

Examples:
- `begin your practice` (not "Get Started")
- `what should others call you?` (not "Enter display name")
- `no account · no email · just your name` (not "Sign up is not required")
- `share a reflection` (not "Add a comment")
- `leave the horizon` (not "Go Back")
- `reading the horizon...` (not "Loading...")

The language avoids imperative commands in favour of invitations. It does not use exclamation marks. It does not use productivity vocabulary (complete, finish, submit). It treats the user as someone who already understands what they are here for.

---

## Accessibility Considerations

- Text contrast ratios are maintained above WCAG AA for primary and secondary text on their respective gradient backgrounds.
- Interactive elements (buttons, orbs, chips) have `cursor: pointer` and visible focus states where applicable.
- `-webkit-tap-highlight-color: transparent` removes the default mobile tap flash; tap feedback is provided via CSS `:active` transitions instead.
- `user-select: none` prevents accidental text selection during the gesture-heavy meditation screen interactions.
- Safe area insets (`env(safe-area-inset-top/bottom)`) ensure content is never obscured by notches or home indicators on iOS.

---

## Design Boundaries (Intentional Omissions)

The following were explicitly not included in v1, and the design is better for their absence:

- **User profiles** — there is nothing to follow, like, or compare. Identity is a name.
- **Notifications** — the application does not push notifications. Discovery is ambient, not algorithmic.
- **Circle history** — past sessions are not displayed. The practice is about presence, not record-keeping.
- **Reactions or emoji** — the Conversation screen supports text only. Reactions would trivialise a moment of genuine reflection.
- **Social graph** — there is no concept of friends, followers, or circles of trust. Anyone can join any circle.
