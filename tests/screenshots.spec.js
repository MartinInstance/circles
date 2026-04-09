import { test } from '@playwright/test'
import path from 'path'

const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots')

// Wait for the Svelte app to mount (screen class appears)
async function waitForApp(page) {
  await page.waitForSelector('.screen', { timeout: 8000 })
}

test.describe('20-user circle journey', () => {

  // ── 1. Feed — 5 circles, 20 users present ──────────────────────────────────
  test('1 · feed with 20 users present', async ({ page }) => {
    await page.goto('/?demo=feed')
    await waitForApp(page)

    // Wait for circles to appear (nostr mock fires at 100ms, peers at 150ms)
    await page.waitForSelector('.orb', { timeout: 5000 })
    // Wait for peer count to reach 20
    await page.waitForFunction(
      () => document.querySelector('.present-count')?.textContent?.includes('20'),
      { timeout: 5000 }
    )

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '1-feed-20-present.png'),
    })
  })

  // ── 2. Settling — 20 users settling in ────────────────────────────────────
  test('2 · settling with 20 users', async ({ page }) => {
    await page.goto('/?demo=settling')
    await waitForApp(page)

    // Wait for peer count to reach 20 (19 peers join + self = 20)
    await page.waitForFunction(
      () => document.querySelector('.peer-count')?.textContent?.includes('20'),
      { timeout: 5000 }
    )

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '2-settling-20-users.png'),
    })
  })

  // ── 3. Meditation — 20 users sitting in silence ───────────────────────────
  test('3 · meditation with 20 users', async ({ page }) => {
    await page.goto('/?demo=meditation')
    await waitForApp(page)

    // Wait for 20 presence dots to appear
    await page.waitForFunction(
      () => document.querySelector('.present')?.textContent?.includes('20'),
      { timeout: 5000 }
    )

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '3-meditation-20-present.png'),
    })
  })

  // ── 4. Conversation — 20 statements from 20 users ────────────────────────
  test('4 · conversation with 20 statements', async ({ page }) => {
    await page.goto('/?demo=conversation')
    await waitForApp(page)

    // Wait for all 20 messages to render
    await page.waitForFunction(
      () => document.querySelectorAll('.bubble').length >= 20,
      { timeout: 8000 }
    )

    // Scroll to show the last few messages
    await page.evaluate(() => {
      const list = document.querySelector('.messages')
      if (list) list.scrollTop = list.scrollHeight
    })

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '4-conversation-20-statements.png'),
    })
  })

})
