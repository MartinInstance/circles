# Circles — Meditation App

A contemplative meditation app where people gather in timed circles of shared silence, then open into ephemeral conversation afterward. Built with React Native (Expo) and Supabase.

## Setup Instructions

### Prerequisites
You already have: Node.js, GitHub, Expo account, Supabase account.

### Step 1 — Get the code onto your Mac

Unzip this project to your Desktop (or wherever you like), then open Terminal:

```bash
cd ~/Desktop/circles
npm install
```

If you see version warnings from Expo, run:
```bash
npx expo install --fix
```
This auto-corrects all package versions to match your Expo SDK.

### Step 2 — Connect Supabase

1. Go to **supabase.com** → your project
2. Find your **Project URL** — look at the URL bar: `https://supabase.com/dashboard/project/XXXXX`. Your URL is `https://XXXXX.supabase.co`
3. Find your **API key** — go to Settings → API Keys → copy the **Publishable** (anon) key
4. Open `src/lib/supabase.js` in VS Code and replace the two placeholder values

### Step 3 — Run the database schema

1. In Supabase → **SQL Editor** → New Query
2. Open `supabase/schema.sql` from this project, copy all of it
3. Paste into the SQL Editor and click **Run**
4. You should see "Success"

**Important**: Also go to **Authentication** → **Providers** → **Email** → turn OFF "Confirm email". This lets accounts work immediately without email verification.

### Step 4 — Add the gong sound

1. Go to [freesound.org](https://freesound.org) and search "singing bowl" or "tibetan bowl"
2. Download a short .mp3 (under 5MB)
3. Rename it `gong.mp3`
4. Place it at `assets/sounds/gong.mp3`

The app works without this file — you just won't hear the gong.

### Step 5 — Run on your phone

```bash
npx expo start --clear
```

Scan the QR code with **Expo Go** on your iPhone. The app loads in about 30 seconds.

If Expo Go says "upgrade to SDK XX", run:
```bash
npx expo install expo@latest --fix
npx expo install --fix
npx expo start --clear
```

### Step 6 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial scaffold"
git branch -M main
git remote add origin https://YOUR_USERNAME@github.com/YOUR_USERNAME/circles.git
git push -u origin main
```

When prompted for password, use your GitHub Personal Access Token (not your password).

---

## Architecture

```
App.js                          # Entry point, providers, audio init
src/
  constants/
    theme.js                    # Colors, fonts, sizes
    mockData.js                 # Test data for solo testing
  lib/
    supabase.js                 # Supabase client
    audio.js                    # Gong sound management
  context/
    AuthContext.js               # Global auth state
  components/
    GradientBackground.js        # Deep ocean gradient
    GlowOrb.js                  # Pulsing luminous orb
    ProgressRing.js              # SVG circular progress
    GreetingStream.js            # Ambient arrival greetings
  screens/
    AuthScreen.js                # Sign in / sign up
    FeedScreen.js                # Discover circles + campfire
    CreateCircleScreen.js        # Launch a new circle
    SettlingScreen.js            # Pre-meditation (green countdown ring)
    MeditationScreen.js          # Silence (white progress ring + gong)
    ConversationScreen.js        # Post-meditation sharing
    CampfireScreen.js            # Permanent always-on space
  navigation/
    index.js                     # Auth-gated navigation
supabase/
  schema.sql                     # Full database schema
```

## Key Technical Decisions

- **Audio**: iOS mute switch is overridden via `playsInSilentModeIOS: true` — the gong plays regardless of phone settings
- **Ring progress**: Green ring (settling) counts DOWN from circle creation to start time. White ring (meditation) counts UP from start to end
- **Participant count**: Initial fetch on mount + real-time subscription — never shows 0 when you're there
- **Greetings**: Positioned as absolute overlay, clips at screen midpoint, uses irregular arrival timing to feel human
- **Mock data**: Built-in test users so solo testing feels social
