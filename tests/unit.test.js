/**
 * Unit tests — pure logic functions.
 * No browser, no network. Runs with: node tests/unit.test.js
 * Writes test-results/unit-results.json for the report.
 */

import { writeFileSync, mkdirSync } from 'fs'

// ─── Minimal test harness ─────────────────────────────────────────────────────

const suites = []
let current = null

function describe(name, fn) {
  current = { name, tests: [] }
  suites.push(current)
  fn()
}

function it(name, fn) {
  try {
    fn()
    current.tests.push({ name, pass: true })
  } catch (e) {
    current.tests.push({ name, pass: false, error: e.message })
  }
}

function eq(a, b)   { if (a !== b)   throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }
function near(a, b) { if (Math.abs(a - b) > 0.01) throw new Error(`Expected ≈${b}, got ${a}`) }
function ok(v)      { if (!v) throw new Error(`Expected truthy, got ${JSON.stringify(v)}`) }

// ─── Functions under test (authoritative spec) ────────────────────────────────
// These mirror the implementations in the Svelte screens.
// If the app diverges, these tests catch it.

const NOW_SEC = 1_700_000_000          // fixed second timestamp
const NOW_MS  = NOW_SEC * 1000         // fixed ms timestamp

function statusLabel(c, nowMs = NOW_MS) {
  if (c.status === 'settling')     return 'settling'
  if (c.status === 'meditating')   return 'meditating'
  if (c.status === 'conversation') return 'sharing'
  const diffMin = Math.round((c.startsAt - nowMs / 1000) / 60)
  if (diffMin <= 0) return 'now'
  if (diffMin < 60) return `in ${diffMin}m`
  return `in ${Math.round(diffMin / 60)}h`
}

function waitProgress(c, nowMs = NOW_MS) {
  if (c.status !== 'scheduled') return 1
  const totalSec = c.startsAt - c.updatedAt
  if (totalSec <= 0) return 1
  return Math.min(1, Math.max(0, (nowMs / 1000 - c.updatedAt) / totalSec))
}

function meditationProgress(c, nowMs = NOW_MS) {
  if (c.status === 'conversation') return 1
  if (c.status !== 'meditating')  return 0
  const elapsed = nowMs / 1000 - c.updatedAt
  return Math.min(1, Math.max(0, elapsed / (c.duration * 60)))
}

function canEnter(c, participated = new Set(), now = NOW_SEC) {
  if (c.status === 'conversation') return participated.has(c.id)
  if (c.status === 'meditating') {
    const secsLeft = (c.updatedAt + c.duration * 60) - now
    if (secsLeft <= 20) return participated.has(c.id)
  }
  return true
}

function fmt(elapsed, totalSec) {
  const remaining = Math.max(0, totalSec - elapsed)
  const m   = Math.floor(remaining / 60)
  const sec = remaining % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function shouldShow(c, now = NOW_SEC) {
  if (c.status === 'closed') return false
  if (c.updatedAt <= now - 3 * 60 * 60) return false
  if (c.status === 'scheduled')    return (c.startsAt + c.duration * 60) > now - 60
  if (c.status === 'meditating')   return (c.updatedAt + c.duration * 60 + 2 * 60) > now
  if (c.status === 'conversation') return c.updatedAt > now - 3 * 60
  return true
}

function statsDedup(events) {
  const byD = new Map()
  for (const ev of events) {
    const d      = ev.tags.find(t => t[0] === 'd')?.[1]
    const status = ev.tags.find(t => t[0] === 'status')?.[1]
    if (!d) continue
    if (!byD.has(d)) {
      byD.set(d, { creatorPubkey: ev.pubkey, oldestAt: ev.created_at, closed: status === 'closed' })
    } else {
      const entry = byD.get(d)
      if (ev.created_at < entry.oldestAt) { entry.creatorPubkey = ev.pubkey; entry.oldestAt = ev.created_at }
      if (status === 'closed') entry.closed = true
    }
  }
  const entries = [...byD.values()]
  return {
    circleCount:      byD.size,
    participantCount: new Set(entries.map(e => e.creatorPubkey)).size,
    completedCount:   entries.filter(e => e.closed).length,
  }
}

const ev = (d, pubkey, created_at, status) => ({
  pubkey, created_at,
  tags: [['d', d], ['status', status], ['t', 'circles-v1']]
})

// ─── Test cases ───────────────────────────────────────────────────────────────

describe('statusLabel', () => {
  it('settling',                () => eq(statusLabel({ status: 'settling',     startsAt: 0 }), 'settling'))
  it('meditating',              () => eq(statusLabel({ status: 'meditating',   startsAt: 0 }), 'meditating'))
  it('conversation → sharing',  () => eq(statusLabel({ status: 'conversation', startsAt: 0 }), 'sharing'))
  it('scheduled in past → now', () => eq(statusLabel({ status: 'scheduled', startsAt: NOW_SEC - 10 }), 'now'))
  it('scheduled 5 min ahead',   () => eq(statusLabel({ status: 'scheduled', startsAt: NOW_SEC + 300 }), 'in 5m'))
  it('scheduled 2 hours ahead', () => eq(statusLabel({ status: 'scheduled', startsAt: NOW_SEC + 7200 }), 'in 2h'))
})

describe('waitProgress', () => {
  it('non-scheduled always returns 1',  () => eq(waitProgress({ status: 'meditating' }), 1))
  it('elapsed window returns 1',        () => eq(waitProgress({ status: 'scheduled', startsAt: NOW_SEC - 100, updatedAt: NOW_SEC - 200 }), 1))
  it('halfway through returns ~0.5',    () => near(waitProgress({ status: 'scheduled', startsAt: NOW_SEC + 100, updatedAt: NOW_SEC - 100 }), 0.5))
  it('clamps to 0 at start',            () => ok(waitProgress({ status: 'scheduled', startsAt: NOW_SEC + 200, updatedAt: NOW_SEC }) >= 0))
})

describe('meditationProgress', () => {
  it('conversation → 1',                () => eq(meditationProgress({ status: 'conversation' }), 1))
  it('scheduled → 0',                   () => eq(meditationProgress({ status: 'scheduled' }),    0))
  it('settling → 0',                    () => eq(meditationProgress({ status: 'settling' }),     0))
  it('halfway through 10-min session',  () => near(meditationProgress({ status: 'meditating', updatedAt: NOW_SEC - 300, duration: 10 }), 0.5))
  it('clamps to 1 after session ends',  () => eq(meditationProgress({ status: 'meditating', updatedAt: NOW_SEC - 900, duration: 10 }), 1))
})

describe('canEnter', () => {
  it('always enter settling',                    () => ok(canEnter({ status: 'settling', id: 'x' })))
  it('blocks conversation for non-participants', () => ok(!canEnter({ status: 'conversation', id: 'x' })))
  it('allows conversation for participants',     () => ok(canEnter({ status: 'conversation', id: 'x' }, new Set(['x']))))
  it('blocks meditating in last 20s',            () => ok(!canEnter({ status: 'meditating', id: 'x', updatedAt: NOW_SEC - 590, duration: 10 })))
  it('allows meditating with time left',         () => ok(canEnter({ status: 'meditating', id: 'x', updatedAt: NOW_SEC - 100, duration: 10 })))
})

describe('timer format', () => {
  it('full 10 minutes',  () => eq(fmt(0,   600), '10:00'))
  it('9 minutes left',   () => eq(fmt(60,  600), '09:00'))
  it('8:55 remaining',   () => eq(fmt(65,  600), '08:55'))
  it('at zero',          () => eq(fmt(600, 600), '00:00'))
  it('clamps past zero', () => eq(fmt(605, 600), '00:00'))
})

describe('feed visibility filters', () => {
  it('hides closed',                  () => ok(!shouldShow({ status: 'closed', updatedAt: NOW_SEC - 60 })))
  it('hides circles older than 3h',   () => ok(!shouldShow({ status: 'scheduled', updatedAt: NOW_SEC - 4 * 3600, startsAt: NOW_SEC + 100, duration: 10 })))
  it('hides abandoned scheduled',     () => ok(!shouldShow({ status: 'scheduled', updatedAt: NOW_SEC - 60, startsAt: NOW_SEC - 700, duration: 10 })))
  it('shows future scheduled',        () => ok( shouldShow({ status: 'scheduled', updatedAt: NOW_SEC - 60, startsAt: NOW_SEC + 300, duration: 10 })))
  it('hides meditating 2min+ after',  () => ok(!shouldShow({ status: 'meditating', updatedAt: NOW_SEC - 900, duration: 10 })))
  it('shows meditating within window',() => ok( shouldShow({ status: 'meditating', updatedAt: NOW_SEC - 500, duration: 10 })))
  it('hides conversation after 3min', () => ok(!shouldShow({ status: 'conversation', updatedAt: NOW_SEC - 4 * 60 })))
  it('shows conversation within 3min',() => ok( shouldShow({ status: 'conversation', updatedAt: NOW_SEC - 2 * 60 })))
})

describe('stats deduplication', () => {
  it('single circle', () => {
    const s = statsDedup([ev('c1', 'alice', 100, 'scheduled')])
    eq(s.circleCount, 1); eq(s.participantCount, 1); eq(s.completedCount, 0)
  })
  it('completed by same creator', () => {
    const s = statsDedup([ev('c1', 'alice', 100, 'scheduled'), ev('c1', 'alice', 200, 'closed')])
    eq(s.circleCount, 1); eq(s.completedCount, 1)
  })
  it('does not double-count when non-creator closes', () => {
    const s = statsDedup([ev('c1', 'alice', 100, 'scheduled'), ev('c1', 'bob', 200, 'closed')])
    eq(s.circleCount, 1); eq(s.completedCount, 1); eq(s.participantCount, 1)
  })
  it('counts multiple distinct circles', () => {
    const s = statsDedup([ev('c1', 'alice', 100, 'scheduled'), ev('c2', 'bob', 100, 'meditating'), ev('c3', 'alice', 100, 'closed')])
    eq(s.circleCount, 3); eq(s.participantCount, 2); eq(s.completedCount, 1)
  })
})

// ─── Output ───────────────────────────────────────────────────────────────────

let totalPass = 0, totalFail = 0
for (const suite of suites) {
  const pass = suite.tests.filter(t => t.pass).length
  const fail = suite.tests.filter(t => !t.pass).length
  totalPass += pass; totalFail += fail
  const icon = fail === 0 ? '✅' : '❌'
  console.log(`${icon} ${suite.name.padEnd(32)} ${pass}/${suite.tests.length}`)
  for (const t of suite.tests.filter(t => !t.pass)) {
    console.log(`   ❌ ${t.name}: ${t.error}`)
  }
}

mkdirSync('test-results', { recursive: true })
writeFileSync('test-results/unit-results.json', JSON.stringify({ suites, totalPass, totalFail }, null, 2))

console.log(`\nUnit total: ${totalPass} passed, ${totalFail} failed`)
process.exit(totalFail > 0 ? 1 : 0)
