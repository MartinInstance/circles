/**
 * 4-user presence test — real WebRTC via Trystero/Nostr (no mocking).
 *
 * Opens four browser contexts, each with a unique name, all joining the
 * same room. Asserts every context reaches a peer count of 4 within 30s.
 */

import { test, expect, chromium } from '@playwright/test'

const ROOM_ID  = `test-presence-${Date.now()}`
const TIMEOUT  = 45_000

test.setTimeout(60_000)

const USERS = [
  { name: 'Alice',   country: 'Denmark' },
  { name: 'Bob',     country: 'Ireland' },
  { name: 'Carol',   country: 'Brazil'  },
  { name: 'Dave',    country: 'Japan'   },
]

test('four users all see each other via real WebRTC', async ({ }) => {
  const browser = await chromium.launch()

  const contexts = await Promise.all(
    USERS.map(u => browser.newContext({
      viewport: { width: 393, height: 852 },
      // Grant mic/camera not needed; grant just in case WebRTC policy blocks
      permissions: [],
    }))
  )

  const pages = await Promise.all(contexts.map(ctx => ctx.newPage()))

  // Navigate all four tabs to the presence-test room simultaneously
  await Promise.all(pages.map((page, i) => {
    const u   = USERS[i]
    const url = `http://localhost:5173/?presence-test=${encodeURIComponent(ROOM_ID)}&name=${encodeURIComponent(u.name)}&country=${encodeURIComponent(u.country)}`
    return page.goto(url)
  }))

  // Wait for each page to show count = 4
  const results = await Promise.allSettled(
    pages.map(async (page, i) => {
      const u = USERS[i]

      // Wait until data-count="4" appears
      await page.waitForSelector('[data-count="4"]', { timeout: TIMEOUT })

      // Confirm the status line also says "all 4 present"
      const status = await page.locator('[data-ready="true"]').textContent()

      // Confirm we can see all other names
      const content = await page.content()
      const missing = USERS.filter(other => other.name !== u.name && !content.includes(other.name))

      return { user: u.name, status: status.trim(), missing }
    })
  )

  await browser.close()

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n── 4-User Presence Test Results ──────────────────────────────')
  let allPassed = true

  for (const [i, result] of results.entries()) {
    const u = USERS[i]
    if (result.status === 'fulfilled') {
      const { status, missing } = result.value
      const ok = missing.length === 0
      if (!ok) allPassed = false
      console.log(`  ${ok ? '✅' : '❌'} ${u.name.padEnd(8)} ${status}${missing.length ? `  (missing: ${missing.map(m => m.name).join(', ')})` : ''}`)
    } else {
      allPassed = false
      const msg = result.reason?.message ?? String(result.reason)
      console.log(`  ❌ ${u.name.padEnd(8)} TIMEOUT — ${msg.split('\n')[0]}`)
    }
  }
  console.log('──────────────────────────────────────────────────────────────')

  expect(allPassed, 'All four users must see each other').toBe(true)
})
