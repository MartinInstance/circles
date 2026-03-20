/**
 * Three-user end-to-end test for Circles
 * Tests: identity setup, circle creation, presence in Settling, messages in Conversation
 */
import { chromium } from 'playwright'

const URL = 'http://localhost:5173'
const USERS = ['Alice', 'Bob', 'Carol']
const CIRCLE_BEGINS_IN_MIN = 1  // shortest option
const CIRCLE_DURATION_MIN  = 1

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(user, msg) {
  console.log(`[${new Date().toISOString().slice(11,19)}] [${user.padEnd(5)}] ${msg}`)
}

function collectConsole(page, user) {
  const lines = []
  page.on('console', msg => {
    const text = `${msg.type().toUpperCase()}: ${msg.text()}`
    lines.push(text)
    if (msg.text().startsWith('[nostr]') || msg.text().startsWith('[trystero]')) {
      log(user, `🔌 ${msg.text()}`)
    }
    if (msg.type() === 'error' || msg.type() === 'warning') {
      log(user, `⚠️  ${msg.text()}`)
    }
  })
  return lines
}

async function waitFor(page, selector, opts = {}) {
  return page.waitForSelector(selector, { timeout: 15000, ...opts })
}

async function getText(page, selector) {
  return page.locator(selector).first().textContent()
}

// ─── Main ────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: false, slowMo: 200 })

// Three isolated browser contexts = three separate localStorage namespaces
const ctxA = await browser.newContext()
const ctxB = await browser.newContext()
const ctxC = await browser.newContext()

const pageA = await ctxA.newPage()
const pageB = await ctxB.newPage()
const pageC = await ctxC.newPage()

const logsA = collectConsole(pageA, USERS[0])
const logsB = collectConsole(pageB, USERS[1])
const logsC = collectConsole(pageC, USERS[2])

try {
  // ── Step 1: Open app in all three tabs ─────────────────────────────────────
  log('TEST', '── Step 1: Loading app in all three contexts')
  await Promise.all([pageA, pageB, pageC].map(p => p.goto(URL)))
  await new Promise(r => setTimeout(r, 2000))

  // ── Step 2: Onboarding — set names ─────────────────────────────────────────
  log('TEST', '── Step 2: Setting up identities')

  for (const [page, name] of [[pageA, USERS[0]], [pageB, USERS[1]], [pageC, USERS[2]]]) {
    const onboarding = await page.locator('input[type="text"], input:not([type])').first().isVisible().catch(() => false)
    if (onboarding) {
      await page.locator('input').first().fill(name)
      await page.locator('button[type="submit"], button').filter({ hasText: /begin|enter|start|go/i }).first().click()
      log(name, `✅ name set to "${name}"`)
    } else {
      log(name, `ℹ️  already has identity (localStorage persisted)`)
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  // ── Step 3: Wait for Feed to load on all ───────────────────────────────────
  log('TEST', '── Step 3: Waiting for Feed subscriptions')
  await Promise.all([pageA, pageB, pageC].map(p =>
    p.waitForFunction(
      () => document.querySelector('.orbs-field, .empty, [class*="feed"]') !== null ||
            document.querySelector('h1, h2') !== null,
      { timeout: 15000 }
    ).catch(() => null)
  ))
  await new Promise(r => setTimeout(r, 3000))
  log('TEST', '✅ All three on Feed')

  // ── Step 4: Alice creates a circle ─────────────────────────────────────────
  log('TEST', '── Step 4: Alice creates a circle')

  // Click "Create a new circle"
  await pageA.locator('button').filter({ hasText: /create/i }).first().click()
  await new Promise(r => setTimeout(r, 1000))

  // Select 1 min begins-in chip (first section)
  const chips = pageA.locator('.chip')
  const chipTexts = await chips.allTextContents()
  log(USERS[0], `Available chips: ${chipTexts.map(t => t.trim()).join(', ')}`)
  await chips.filter({ hasText: '1 min' }).first().click({ force: true })
  await new Promise(r => setTimeout(r, 500))

  // Select 1 min duration (second section — second occurrence of "1 min")
  await chips.filter({ hasText: '1 min' }).nth(1).click({ force: true }).catch(() => {})
  await new Promise(r => setTimeout(r, 500))

  // Launch
  await pageA.locator('button').filter({ hasText: /launch|create/i }).first().click()
  log(USERS[0], '🚀 Circle launched — waiting for publish confirmation')
  await new Promise(r => setTimeout(r, 4000))

  // ── Step 5: Bob and Carol should see the circle ─────────────────────────────
  log('TEST', '── Step 5: Checking Bob and Carol see the new circle')

  for (const [page, name] of [[pageB, USERS[1]], [pageC, USERS[2]]]) {
    const orbs = await page.locator('.orb').count()
    const emptyMsg = await page.locator('.empty').isVisible().catch(() => false)
    log(name, `Orbs visible: ${orbs}, empty msg: ${emptyMsg}`)
    if (orbs === 0) {
      log(name, '⚠️  No orbs yet — waiting for poll cycle (10s)')
      await new Promise(r => setTimeout(r, 12000))
      const orbsAfter = await page.locator('.orb').count()
      log(name, `Orbs after poll: ${orbsAfter}`)
    }
  }

  // ── Step 6: Bob and Carol join Alice's circle ───────────────────────────────
  log('TEST', '── Step 6: Bob and Carol join the circle')

  // Circles sort by startsAt ascending — Alice's new circle (starts soonest in future)
  // may not be last if there are old circles. Click the orb with the highest startsAt
  // (most future) by using .last() since they sort ascending = last = furthest future.
  await Promise.all([[pageB, USERS[1]], [pageC, USERS[2]]].map(async ([page, name]) => {
    const orbCount = await page.locator('.orb').count()
    log(name, `Orbs visible: ${orbCount}`)
    if (orbCount > 0) {
      // Last orb = highest startsAt = Alice's newly created circle
      await page.locator('.orb').last().click({ force: true })
      log(name, '✅ Clicked last orb (Alice\'s circle) — entering')
    } else {
      log(name, '❌ No orb to click')
    }
  }))

  // ── Step 7: Check Settling screen — check in parallel, multiple times ────────
  log('TEST', '── Step 7: Monitoring Settling presence for 30s')
  for (let t = 5; t <= 30; t += 5) {
    await new Promise(r => setTimeout(r, 5000))
    await Promise.all([[pageA, USERS[0]], [pageB, USERS[1]], [pageC, USERS[2]]].map(async ([page, name]) => {
      const peerText = await page.locator('.peer-count').textContent().catch(() => '(not on settling)')
      const greetings = await page.locator('.greeting').count()
      const trysteroLog = (await page.evaluate(() =>
        window.__trysteroLog || []
      ).catch(() => [])).join(', ')
      log(name, `t+${t}s — peers: "${peerText}", greetings: ${greetings}`)
    }))
  }

  // ── Step 8: Wait for Meditation (circle starts after 1 min) ────────────────
  log('TEST', '── Step 8: Waiting for circle to start (meditation phase)…')
  await new Promise(r => setTimeout(r, 75000))  // wait ~75s for 1-min begins-in

  log('TEST', '── Step 9: Checking screens after auto-advance')
  for (const [page, name] of [[pageA, USERS[0]], [pageB, USERS[1]], [pageC, USERS[2]]]) {
    const h = await page.locator('h1, h2').first().textContent().catch(() => '?')
    log(name, `Current screen header: "${h}"`)
  }

  // ── Wait for 1-min meditation ────────────────────────────────────────────────
  log('TEST', '── Step 10: Waiting for meditation to finish (1 min)…')
  await new Promise(r => setTimeout(r, 75000))

  // ── Step 11: Conversation — send messages ──────────────────────────────────
  log('TEST', '── Step 11: Testing message exchange in Conversation')

  const messages = [
    [pageA, USERS[0], 'Hello from Alice — deep stillness'],
    [pageB, USERS[1], 'Felt very centred, thank you'],
    [pageC, USERS[2], 'Beautiful session, see you all next time'],
  ]

  for (const [page, name, text] of messages) {
    const textarea = page.locator('textarea')
    const visible = await textarea.isVisible().catch(() => false)
    if (visible) {
      await textarea.fill(text)
      await textarea.press('Enter')
      log(name, `📨 Sent: "${text}"`)
      await new Promise(r => setTimeout(r, 2000))
    } else {
      log(name, `❌ textarea not visible — checking screen…`)
      const h = await page.locator('h1, h2').first().textContent().catch(() => '?')
      log(name, `  Current screen: "${h}"`)
    }
  }

  await new Promise(r => setTimeout(r, 4000))

  // ── Step 12: Check all received messages ───────────────────────────────────
  log('TEST', '── Step 12: Checking received messages')
  for (const [page, name] of [[pageA, USERS[0]], [pageB, USERS[1]], [pageC, USERS[2]]]) {
    const msgCount = await page.locator('.msg').count()
    const bubbles = await page.locator('.bubble').allTextContents()
    log(name, `Messages visible: ${msgCount}`)
    bubbles.forEach(b => log(name, `  💬 "${b.trim()}"`)  )
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log('TEST', '── Summary of console logs by user:')
  const filterLines = (lines) => lines.filter(l =>
    l.includes('[nostr]') || l.includes('[trystero]') || l.includes('ERROR')
  )
  log(USERS[0], `Relevant logs:\n${filterLines(logsA).join('\n')}`)
  log(USERS[1], `Relevant logs:\n${filterLines(logsB).join('\n')}`)
  log(USERS[2], `Relevant logs:\n${filterLines(logsC).join('\n')}`)

} catch (err) {
  console.error('TEST ERROR:', err)
} finally {
  log('TEST', 'Test complete — browsers will stay open for 60s for inspection')
  await new Promise(r => setTimeout(r, 60000))
  await browser.close()
}
