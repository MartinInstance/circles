/**
 * WCAG AA contrast audit using rendered pixel sampling.
 * For each text node, gets the actual background colour from a screenshot
 * pixel behind the text, then computes the contrast ratio against the
 * computed foreground colour. Reports every violation.
 */
import { chromium } from 'playwright'

const URL = 'http://localhost:5173'
const NORMAL_TEXT_THRESHOLD = 4.5   // WCAG AA normal text
const LARGE_TEXT_THRESHOLD  = 3.0   // WCAG AA large text (≥18pt or ≥14pt bold)
const LARGE_TEXT_PT         = 18    // 18pt = 24px
const LARGE_BOLD_PT         = 14    // 14pt bold = ~18.67px bold

function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function luminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}
function contrast(l1, l2) {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}
function parseColour(css) {
  // handles rgb(r,g,b) and rgba(r,g,b,a)
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return null
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 }
}

function log(screen, msg) {
  console.log(`[${new Date().toISOString().slice(11,19)}] [${screen.padEnd(14)}] ${msg}`)
}

async function auditPage(page, screenName, screenshot) {
  // Collect all visible text nodes with their colours and bounding boxes
  const nodes = await page.evaluate(() => {
    const results = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim()
      if (!text || text.length < 2) continue
      const el = node.parentElement
      if (!el) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.top < 0 || rect.bottom > window.innerHeight) continue  // off-screen
      const fontSize  = parseFloat(style.fontSize)  // px
      const fontWeight = parseInt(style.fontWeight)
      const fontSizePt = fontSize * 0.75
      const isLarge = fontSizePt >= 18 || (fontSizePt >= 14 && fontWeight >= 700)
      results.push({
        text: text.slice(0, 40),
        tag: el.tagName,
        className: el.className,
        colour: style.color,
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        rectTop: rect.top,
        rectBottom: rect.bottom,
        fontSize,
        fontSizePt,
        fontWeight,
        isLarge
      })
    }
    return results
  })

  const violations = []
  const { width } = page.viewportSize()

  for (const node of nodes) {
    const fg = parseColour(node.colour)
    if (!fg) continue

    // Sample background pixel adjacent to (not on) the text to avoid
    // anti-aliased character pixels being mistaken for background.
    // Try 3px below the bottom edge, fall back to 3px above the top edge.
    const px = node.x
    const pyBelow = Math.round(node.rectBottom + 3)
    const pyAbove = Math.round(node.rectTop - 3)
    let py = (pyBelow < screenshot.height) ? pyBelow : pyAbove
    if (px < 0 || py < 0 || px >= screenshot.width || py >= screenshot.height) continue

    // Get pixel at (px, py) from the screenshot buffer
    const idx = (py * screenshot.width + px) * 4
    const bgR = screenshot.data[idx]
    const bgG = screenshot.data[idx + 1]
    const bgB = screenshot.data[idx + 2]

    // Compose fg over bg (alpha blending)
    const a = fg.a
    const fgR = Math.round(fg.r * a + bgR * (1 - a))
    const fgG = Math.round(fg.g * a + bgG * (1 - a))
    const fgB = Math.round(fg.b * a + bgB * (1 - a))

    const fgL = luminance(fgR, fgG, fgB)
    const bgL = luminance(bgR, bgG, bgB)
    const ratio = contrast(fgL, bgL)
    const required = node.isLarge ? LARGE_TEXT_THRESHOLD : NORMAL_TEXT_THRESHOLD

    if (ratio < required) {
      violations.push({ ...node, ratio: ratio.toFixed(2), required, bgR, bgG, bgB })
      log(screenName, `❌ ${ratio.toFixed(2)}:1 (need ${required}:1) [${node.fontSizePt.toFixed(0)}pt${node.fontWeight >= 700 ? ' bold' : ''}] "${node.text}" — fg:${node.colour} bg:rgb(${bgR},${bgG},${bgB})`)
    }
  }

  if (violations.length === 0) {
    log(screenName, `✅ PASS`)
  }
  return violations
}

async function captureScreenshot(page) {
  const buf = await page.screenshot({ type: 'png' })
  // Use Playwright's built-in pixel access via a canvas in the page
  // Instead, decode the PNG manually — use the page to decode it
  const data = await page.evaluate(async (base64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + base64
    await new Promise(r => { img.onload = r })
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    const d = c.getContext('2d').getImageData(0, 0, img.width, img.height)
    return { width: img.width, height: img.height, data: Array.from(d.data) }
  }, buf.toString('base64'))
  return data
}

async function setName(page, name) {
  const visible = await page.locator('input').first().isVisible().catch(() => false)
  if (visible) {
    await page.locator('input').first().fill(name)
    await page.locator('button').filter({ hasText: /begin|enter|start|go/i }).first().click()
    await new Promise(r => setTimeout(r, 800))
  }
}

async function runAudit(label) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 400, height: 844 } })
  const page = await ctx.newPage()
  const allViolations = {}

  try {
    // ── Onboarding ────────────────────────────────────────────────────────────
    await page.goto(URL)
    await page.waitForSelector('input', { timeout: 8000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 800))
    log('onboarding', `── Auditing (${label})`)
    allViolations.onboarding = await auditPage(page, 'onboarding', await captureScreenshot(page))

    // ── Feed ──────────────────────────────────────────────────────────────────
    await setName(page, 'WCAGTest')
    await page.waitForFunction(() => document.querySelector('.orbs-field') !== null, { timeout: 8000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 600))
    log('feed', `── Auditing (${label})`)
    allViolations.feed = await auditPage(page, 'feed', await captureScreenshot(page))

    // ── Create Circle ─────────────────────────────────────────────────────────
    await page.locator('button').filter({ hasText: /create/i }).first().click()
    await new Promise(r => setTimeout(r, 600))
    log('create', `── Auditing (${label})`)
    allViolations.create = await auditPage(page, 'create', await captureScreenshot(page))
    await page.locator('.btn-back, button').filter({ hasText: /back/i }).first().click().catch(() => {})
    await new Promise(r => setTimeout(r, 400))

    // ── Global Horizon ────────────────────────────────────────────────────────
    await page.waitForFunction(() => document.querySelector('.horizon-strip') !== null, { timeout: 6000 }).catch(() => {})
    await page.locator('.horizon-strip').click({ force: true }).catch(() => {})
    await new Promise(r => setTimeout(r, 800))
    log('globalHorizon', `── Auditing (${label})`)
    allViolations.globalHorizon = await auditPage(page, 'globalHorizon', await captureScreenshot(page))

  } finally {
    await browser.close()
  }

  const total = Object.values(allViolations).flat().length
  console.log(`\n── ${label}: ${total} total contrast violations ──`)
  for (const [s, v] of Object.entries(allViolations)) {
    if (v.length) console.log(`   ${s}: ${v.length}`)
  }
  console.log('')
  return { total, violations: allViolations }
}

const { total, violations } = await runAudit('BEFORE fixes')
console.log(`\nUnique failing CSS values (to fix):`)
const seen = new Set()
for (const vs of Object.values(violations)) {
  for (const v of vs) {
    const key = `${v.colour} on rgb(${v.bgR},${v.bgG},${v.bgB})`
    if (!seen.has(key)) { seen.add(key); console.log(`  ${key}`) }
  }
}
