// Generates PNG app icons at all required sizes using Playwright.
// Run once: node generate-icons.js
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

async function main() {
  const browser = await chromium.launch()
  const page    = await browser.newPage()

  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size })

    // Minimal HTML — just the canvas element, no inline scripts
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><style>*{margin:0;padding:0;background:#03071e}</style></head>
      <body><canvas id="c" width="${size}" height="${size}"></canvas></body>
      </html>
    `)

    // Draw entirely inside page.evaluate — reliable execution guaranteed
    const dataUrl = await page.evaluate((size) => {
      const canvas = document.getElementById('c')
      const ctx    = canvas.getContext('2d')
      const cx     = size / 2
      const s      = size / 512

      // ── Background ───────────────────────────────────────────────
      ctx.fillStyle = '#03071e'
      ctx.fillRect(0, 0, size, size)

      // ── Outer gradient glow ring ──────────────────────────────────
      // Drawn as a wide translucent band using a radial gradient
      const outerR = 185 * s
      const outerW = 32 * s
      const outerGrad = ctx.createRadialGradient(cx, cx, outerR - outerW, cx, cx, outerR + outerW)
      outerGrad.addColorStop(0,   'rgba(110,198,184,0.00)')
      outerGrad.addColorStop(0.5, 'rgba(110,198,184,0.28)')
      outerGrad.addColorStop(1,   'rgba(110,198,184,0.00)')
      ctx.beginPath()
      ctx.arc(cx, cx, outerR + outerW, 0, Math.PI * 2)
      ctx.arc(cx, cx, outerR - outerW, 0, Math.PI * 2, true)
      ctx.fillStyle = outerGrad
      ctx.fill()

      // ── Main mint ring ────────────────────────────────────────────
      ctx.beginPath()
      ctx.arc(cx, cx, 148 * s, 0, Math.PI * 2)
      ctx.strokeStyle = '#6ec6b8'
      ctx.lineWidth = Math.max(3, 18 * s)
      ctx.stroke()

      // ── Inner lavender ring ───────────────────────────────────────
      ctx.beginPath()
      ctx.arc(cx, cx, 104 * s, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(167,140,200,0.80)'
      ctx.lineWidth = Math.max(2, 10 * s)
      ctx.stroke()

      return canvas.toDataURL('image/png')
    }, size)

    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(`public/icons/icon-${size}.png`, buffer)
    console.log(`✓ icon-${size}.png`)
  }

  await browser.close()
  console.log('\nAll icons written to public/icons/')
}

main().catch(e => { console.error(e); process.exit(1) })
