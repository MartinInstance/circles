/**
 * Test runner — executes unit + E2E tests and prints a brief report.
 * Writes BUGS.md if any tests fail (the auto-fix work package).
 *
 * Usage: node tests/run.js
 */

import { spawnSync }       from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM    = '\x1b[2m'

mkdirSync('test-results', { recursive: true })

const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16)

console.log(`\n${BOLD}CIRCLES TEST SUITE${RESET}  ${DIM}${timestamp}${RESET}`)
console.log('═'.repeat(52))

// ─── 1. Unit tests ────────────────────────────────────────────────────────────

console.log(`\n${BOLD}Unit Logic${RESET}`)
const unitResult = spawnSync('node', ['tests/unit.test.js'], { encoding: 'utf-8' })
const unitLines  = (unitResult.stdout + unitResult.stderr).split('\n').filter(Boolean)

// Print each suite line
unitLines.filter(l => l.startsWith('✅') || l.startsWith('❌')).forEach(l => console.log(' ', l))

// Parse totals from unit-results.json
let unitPass = 0, unitFail = 0, unitBugs = []
if (existsSync('test-results/unit-results.json')) {
  const data = JSON.parse(readFileSync('test-results/unit-results.json', 'utf-8'))
  unitPass = data.totalPass; unitFail = data.totalFail
  for (const suite of data.suites) {
    for (const t of suite.tests.filter(t => !t.pass)) {
      unitBugs.push({ area: `Unit · ${suite.name}`, name: t.name, error: t.error, file: 'tests/unit.test.js' })
    }
  }
}

// ─── 2. E2E tests ─────────────────────────────────────────────────────────────

console.log(`\n${BOLD}Screen & PWA Tests (E2E)${RESET}`)

const pwResult = spawnSync(
  'npx', ['playwright', 'test', '--reporter=json'],
  { encoding: 'utf-8', env: { ...process.env } }
)

// Playwright writes JSON to stdout when using --reporter=json
let pwData = null
try {
  // Find the JSON portion (everything from the first '{')
  const raw = pwResult.stdout
  const start = raw.indexOf('{')
  if (start !== -1) pwData = JSON.parse(raw.slice(start))
} catch { /* non-JSON output */ }

let e2ePass = 0, e2eFail = 0, e2eBugs = []
const suiteMap = {}

if (pwData) {
  for (const suite of (pwData.suites ?? [])) {
    for (const child of (suite.suites ?? [suite])) {
      const area  = child.title || suite.title || 'E2E'
      let   pass  = 0, fail = 0
      for (const spec of (child.specs ?? [])) {
        for (const test of (spec.tests ?? [])) {
          const ok = test.results?.every(r => r.status === 'passed')
          if (ok) { pass++; e2ePass++ } else {
            fail++; e2eFail++
            const err = test.results?.[0]?.error?.message ?? 'unknown error'
            e2eBugs.push({ area, name: spec.title, error: err.split('\n')[0], file: child.file ?? suite.file ?? '' })
          }
        }
      }
      if (pass + fail > 0) {
        const icon = fail === 0 ? '✅' : '❌'
        const key  = area.padEnd(28)
        suiteMap[area] = `  ${icon} ${key} ${pass}/${pass + fail}`
      }
    }
  }
  Object.values(suiteMap).forEach(l => console.log(l))
} else {
  // Fallback: run with list reporter so we at least see something
  const fallback = spawnSync('npx', ['playwright', 'test', '--reporter=list'], { encoding: 'utf-8', stdio: 'inherit' })
  e2eFail = fallback.status !== 0 ? 1 : 0
}

// ─── 3. Summary ───────────────────────────────────────────────────────────────

const totalPass = unitPass + e2ePass
const totalFail = unitFail + e2eFail
const allBugs   = [...unitBugs, ...e2eBugs]

console.log('\n' + '═'.repeat(52))
if (totalFail === 0) {
  console.log(`${GREEN}${BOLD}✅  ALL ${totalPass} TESTS PASSED${RESET}`)
} else {
  console.log(`${RED}${BOLD}❌  ${totalFail} FAILING  ${DIM}(${totalPass} passed)${RESET}`)
}

// ─── 4. Bug report ────────────────────────────────────────────────────────────

if (allBugs.length > 0) {
  console.log(`\n${YELLOW}${BOLD}BUGS TO FIX${RESET}`)
  console.log('─'.repeat(52))
  allBugs.forEach((b, i) => {
    console.log(`${i + 1}. [${b.area}] ${b.name}`)
    console.log(`   ${DIM}${b.error}${RESET}`)
    if (b.file) console.log(`   ${DIM}${b.file}${RESET}`)
  })

  // Write BUGS.md for the next fix session
  const md = [
    `# Circles — Test Failures (${timestamp})`,
    `\n**${totalFail} tests failing** · ${totalPass} passing`,
    '\n## Bugs to fix\n',
    ...allBugs.map((b, i) =>
      `### ${i + 1}. [${b.area}] ${b.name}\n\`\`\`\n${b.error}\n\`\`\`\n${b.file ? `File: \`${b.file}\`` : ''}\n`
    )
  ].join('\n')

  writeFileSync('BUGS.md', md)
  console.log(`\n${DIM}Bug report written to BUGS.md${RESET}`)
}

console.log('')
process.exit(totalFail > 0 ? 1 : 0)
