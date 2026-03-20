/**
 * Full circle lifecycle E2E test — 3 users
 *
 * Flow:
 *  UserA  — creates a circle, waits in Settling
 *  UserB  — sees UserA's circle, creates own circle, steps out, joins UserA's circle
 *  UserC  — sees UserA's circle, joins it
 *  All    — advance to Meditation (gong #1), then Conversation (gong #2)
 *  UserA  — sends "hello I am UserA"; UserB + UserC see it
 *  UserB  — sends "hello I am UserB"; UserA + UserC see it
 *  UserC  — steps out  → circle still visible as orb on Feed
 *  UserB  — steps out  → circle still visible as orb on Feed
 *  UserA  — says goodbye → circle disappears from all feeds
 */

import { chromium } from 'playwright'

const URL   = 'http://localhost:5173'
const PASS  = '✅'
const FAIL  = '❌'
const WARN  = '⚠️ '

// ─── helpers ─────────────────────────────────────────────────────────────────

function log(who, msg) {
  console.log(`[${new Date().toISOString().slice(11,19)}] [${String(who).padEnd(6)}] ${msg}`)
}

function check(name, cond, label) {
  log(name, `${cond ? PASS : FAIL} ${label}`)
  return cond
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function newPage(browser, name) {
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('[gong]') || t.includes('[trystero] peer') || msg.type() === 'error') {
      log(name, `  ${msg.type() === 'error' ? '🔴' : '🔔'} ${t}`)
    }
  })
  return page
}

async function onboard(page, name) {
  await page.goto(URL)
  await page.waitForSelector('input', { timeout: 10000 })
  await wait(400)
  if (await page.locator('input').first().isVisible().catch(() => false)) {
    await page.locator('input').first().fill(name)
    await page.locator('button').filter({ hasText: /enter|begin|go/i }).first().click()
    await wait(1200)
  }
  // wait for Feed
  await page.waitForFunction(
    () => document.querySelector('.orbs-field, .empty') !== null,
    { timeout: 12000 }
  ).catch(() => {})
  await wait(500)
  log(name, 'on Feed')
}

async function orbCount(page) {
  return page.locator('.orb').count()
}

async function currentScreen(page) {
  return page.evaluate(() => {
    if (document.querySelector('.timer'))    return 'meditation'
    if (document.querySelector('.input-bar')) return 'conversation'
    if (document.querySelector('.peer-count')) return 'settling'
    if (document.querySelector('.orbs-field, .empty')) return 'feed'
    return 'unknown'
  }).catch(() => 'unknown')
}

async function gongCount(page) {
  return page.evaluate(() => window.__gongCount || 0).catch(() => 0)
}

async function waitForScreen(page, name, screenName, maxMs = 100000) {
  const deadline = Date.now() + maxMs
  const screeners = {
    meditation:   () => page.locator('.timer').isVisible(),
    conversation: () => page.locator('.input-bar').isVisible(),
    settling:     () => page.locator('.peer-count').isVisible(),
    feed:         () => page.locator('.orbs-field, .empty').first().isVisible(),
  }
  const check = screeners[screenName]
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return true
    await wait(2000)
    log(name, `  waiting for ${screenName}… (${Math.round((deadline - Date.now()) / 1000)}s left)`)
  }
  log(name, `${FAIL} timed out waiting for ${screenName}`)
  return false
}

async function bubbleTexts(page) {
  return page.locator('.bubble').allTextContents()
}

// Poll until at least `minOrbs` orbs appear on the feed (max `maxMs`).
async function waitForOrbs(page, name, minOrbs = 1, maxMs = 25000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const count = await orbCount(page)
    if (count >= minOrbs) return count
    await wait(2000)
    log(name, `  waiting for orbs (have ${count}, need ${minOrbs})… (${Math.round((deadline - Date.now()) / 1000)}s left)`)
  }
  return await orbCount(page)
}

// Poll until at least one bubble contains `needle` (max `maxMs`).
async function waitForBubble(page, name, needle, maxMs = 20000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const texts = await page.locator('.bubble').allTextContents().catch(() => [])
    if (texts.some(t => t.trim().includes(needle))) return texts
    await wait(2000)
    log(name, `  waiting for bubble "${needle}"… (${Math.round((deadline - Date.now()) / 1000)}s left)`)
  }
  return await page.locator('.bubble').allTextContents().catch(() => [])
}

// ─── main ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: false, slowMo: 80 })

const results = []
function record(label, ok) {
  results.push({ label, ok })
  return ok
}

try {
  // ── 1. Onboard all three users ────────────────────────────────────────────
  log('TEST', '── 1. Onboarding')
  const [pageA, pageB, pageC] = await Promise.all([
    newPage(browser, 'UserA'),
    newPage(browser, 'UserB'),
    newPage(browser, 'UserC'),
  ])
  for (const [page, name] of [[pageA,'UserA'],[pageB,'UserB'],[pageC,'UserC']]) {
    await onboard(page, name)
  }

  // ── 2. UserA confirms empty feed, creates circle ──────────────────────────
  log('TEST', '── 2. UserA creates circle')
  const emptyA = await pageA.locator('.empty').isVisible().catch(() => false)
  record('UserA sees empty feed', emptyA)

  await pageA.locator('button').filter({ hasText: /create/i }).first().click()
  await wait(800)

  // Pick chips: "1 min" begins-in, "1 min" duration
  const chipsA = pageA.locator('.chip')
  await chipsA.filter({ hasText: '1 min' }).first().click({ force: true })
  await wait(300)
  await chipsA.filter({ hasText: '1 min' }).nth(1).click({ force: true }).catch(() => {})
  await wait(300)
  await pageA.locator('button').filter({ hasText: /launch|create/i }).first().click()
  await wait(3000)

  record('UserA reaches Settling', await waitForScreen(pageA, 'UserA', 'settling', 10000))

  // ── 3. UserB sees UserA's circle ──────────────────────────────────────────
  log('TEST', '── 3. UserB checks feed for UserA circle')
  await wait(5000)
  let orbsB = await orbCount(pageB)
  if (orbsB === 0) {
    log('UserB', 'no orbs yet, waiting 12s for relay propagation...')
    await wait(12000)
    orbsB = await orbCount(pageB)
  }
  record('UserB sees UserA circle on Feed', orbsB >= 1)

  // ── 4. UserB creates own circle ───────────────────────────────────────────
  log('TEST', '── 4. UserB creates own circle')
  await pageB.locator('button').filter({ hasText: /create/i }).first().click()
  await wait(700)
  const chipsB = pageB.locator('.chip')
  await chipsB.filter({ hasText: '1 min' }).first().click({ force: true })
  await wait(300)
  await chipsB.filter({ hasText: '1 min' }).nth(1).click({ force: true }).catch(() => {})
  await wait(300)
  await pageB.locator('button').filter({ hasText: /launch|create/i }).first().click()
  await wait(2500)
  record('UserB reaches own Settling', await waitForScreen(pageB, 'UserB', 'settling', 8000))

  // ── 5. UserB steps out of own circle ─────────────────────────────────────
  log('TEST', '── 5. UserB steps out of own circle')
  await pageB.locator('button').filter({ hasText: /step out/i }).first().click()
  await wait(1500)
  record('UserB back on Feed after step-out', await waitForScreen(pageB, 'UserB', 'feed', 8000))

  // ── 6. UserB joins UserA's circle ─────────────────────────────────────────
  log('TEST', '── 6. UserB joins UserA circle')
  await wait(3000)   // let relay update
  const orbsB2 = await orbCount(pageB)
  log('UserB', `orbs visible: ${orbsB2}`)
  // UserA's circle has earlier startsAt → appears first in ascending sort
  await pageB.locator('.orb').first().click({ force: true })
  await wait(1500)
  record('UserB reaches UserA Settling', await waitForScreen(pageB, 'UserB', 'settling', 10000))

  // ── 7. UserC joins UserA's circle ─────────────────────────────────────────
  log('TEST', '── 7. UserC joins UserA circle')
  await wait(2000)
  let orbsC = await orbCount(pageC)
  if (orbsC === 0) { await wait(12000); orbsC = await orbCount(pageC) }
  record('UserC sees UserA circle on Feed', orbsC >= 1)
  await pageC.locator('.orb').first().click({ force: true })
  await wait(1500)
  record('UserC reaches UserA Settling', await waitForScreen(pageC, 'UserC', 'settling', 10000))

  // ── 8. Verify peer counts in Settling ─────────────────────────────────────
  log('TEST', '── 8. Settling peer counts')
  await wait(3000)
  for (const [page, name] of [[pageA,'UserA'],[pageB,'UserB'],[pageC,'UserC']]) {
    const pc = await page.locator('.peer-count').textContent().catch(() => '?')
    log(name, `peer count text: "${pc}"`)
  }

  // ── 9. Wait for meditation to start ──────────────────────────────────────
  log('TEST', '── 9. Waiting for Meditation (gong #1)…')
  const allMed = await Promise.all([
    waitForScreen(pageA, 'UserA', 'meditation', 100000),
    waitForScreen(pageB, 'UserB', 'meditation', 100000),
    waitForScreen(pageC, 'UserC', 'meditation', 100000),
  ])
  record('All 3 reach Meditation', allMed.every(Boolean))

  await wait(1000)
  for (const [page, name] of [[pageA,'UserA'],[pageB,'UserB'],[pageC,'UserC']]) {
    const g = await gongCount(page)
    record(`${name} heard gong #1`, check(name, g >= 1, `gong count = ${g} (expected ≥1)`))
  }

  // ── 10. Wait for meditation to end ───────────────────────────────────────
  log('TEST', '── 10. Waiting for Conversation (gong #2)…')
  const allConvo = await Promise.all([
    waitForScreen(pageA, 'UserA', 'conversation', 100000),
    waitForScreen(pageB, 'UserB', 'conversation', 100000),
    waitForScreen(pageC, 'UserC', 'conversation', 100000),
  ])
  record('All 3 reach Conversation', allConvo.every(Boolean))

  await wait(1000)
  for (const [page, name] of [[pageA,'UserA'],[pageB,'UserB'],[pageC,'UserC']]) {
    const g = await gongCount(page)
    record(`${name} heard gong #2`, check(name, g >= 2, `gong count = ${g} (expected ≥2)`))
  }

  // ── 11. UserA sends message ───────────────────────────────────────────────
  log('TEST', '── 11. UserA sends message')
  const msgA = 'hello I am UserA'
  await pageA.locator('textarea').fill(msgA)
  await pageA.locator('textarea').press('Enter')
  log('UserA', `📨 sent: "${msgA}"`)

  for (const [page, name] of [[pageB,'UserB'],[pageC,'UserC']]) {
    const texts = await waitForBubble(page, name, 'UserA')
    const found = texts.some(t => t.trim().includes('UserA'))
    record(`${name} sees UserA message`, check(name, found, `bubbles: ${JSON.stringify(texts)}`))
  }

  // ── 12. UserB sends message ───────────────────────────────────────────────
  log('TEST', '── 12. UserB sends message')
  const msgB = 'hello I am UserB'
  await pageB.locator('textarea').fill(msgB)
  await pageB.locator('textarea').press('Enter')
  log('UserB', `📨 sent: "${msgB}"`)

  for (const [page, name] of [[pageA,'UserA'],[pageC,'UserC']]) {
    const texts = await waitForBubble(page, name, 'UserB')
    const found = texts.some(t => t.trim().includes('UserB'))
    record(`${name} sees UserB message`, check(name, found, `bubbles: ${JSON.stringify(texts)}`))
  }

  // ── 13. UserC steps out → circle still active ─────────────────────────────
  log('TEST', '── 13. UserC steps out')
  await pageC.locator('button').filter({ hasText: /step out/i }).first().click()
  await waitForScreen(pageC, 'UserC', 'feed', 8000)
  const orbsCAfter = await waitForOrbs(pageC, 'UserC', 1, 25000)
  record('Circle still visible after UserC steps out', check('UserC',
    orbsCAfter >= 1, `orbs on feed: ${orbsCAfter}`))

  // ── 14. UserB steps out → circle still active ─────────────────────────────
  log('TEST', '── 14. UserB steps out')
  await pageB.locator('button').filter({ hasText: /step out/i }).first().click()
  await waitForScreen(pageB, 'UserB', 'feed', 8000)
  const orbsBAfter = await waitForOrbs(pageB, 'UserB', 1, 25000)
  record('Circle still visible after UserB steps out', check('UserB',
    orbsBAfter >= 1, `orbs on feed: ${orbsBAfter}`))

  // ── 15. UserA says goodbye → circle disappears ────────────────────────────
  log('TEST', '── 15. UserA says goodbye (closes circle)')
  await pageA.locator('button').filter({ hasText: /goodbye/i }).first().click()
  await wait(2000)
  await waitForScreen(pageA, 'UserA', 'feed', 8000)
  // UserA's circle propagates via Nostr polling (~10s).
  // UserB's abandoned scheduled circle also needs to expire
  // (visible until startsAt + duration + 60s + up to 10s tick delay).
  // Total: allow 90s.
  log('TEST', 'Waiting 90s for closed status + abandoned circle expiry…')
  await wait(90000)

  for (const [page, name] of [[pageA,'UserA'],[pageB,'UserB'],[pageC,'UserC']]) {
    const orbs   = await orbCount(page)
    const empty  = await page.locator('.empty').isVisible().catch(() => false)
    const scr    = await currentScreen(page)
    record(`${name} — circle gone after close`, check(name,
      orbs === 0, `orbs: ${orbs}, empty: ${empty}, screen: ${scr}`))
  }

} catch (err) {
  console.error('FATAL TEST ERROR:', err)
} finally {
  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('TEST SUMMARY')
  console.log('═'.repeat(60))
  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  for (const r of results) {
    console.log(`  ${r.ok ? PASS : FAIL}  ${r.label}`)
  }
  console.log('─'.repeat(60))
  console.log(`  ${passed} passed, ${failed} failed out of ${results.length} checks`)
  console.log('═'.repeat(60) + '\n')

  log('TEST', 'Browsers stay open 30s for inspection…')
  await wait(30000)
  await browser.close()
}
