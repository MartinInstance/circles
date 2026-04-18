// Generates PNG app icons at all required sizes using Playwright.
// Run once: node generate-icons.js
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

function drawScript(size) {
  const s = size / 512
  return `
    const canvas = document.getElementById('c')
    const ctx = canvas.getContext('2d')

    // Background — full square, OS/store handles the corner rounding
    ctx.fillStyle = '#03071e'
    ctx.fillRect(0, 0, ${size}, ${size})

    // Subtle outer halo
    ctx.beginPath()
    ctx.arc(${size / 2}, ${size / 2}, ${Math.round(180 * s)}, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(110,198,184,0.18)'
    ctx.lineWidth = ${Math.max(1, Math.round(3 * s))}
    ctx.stroke()

    // Main mint ring
    ctx.beginPath()
    ctx.arc(${size / 2}, ${size / 2}, ${Math.round(145 * s)}, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(110,198,184,0.90)'
    ctx.lineWidth = ${Math.max(2, Math.round(16 * s))}
    ctx.stroke()

    // Inner lavender ring
    ctx.beginPath()
    ctx.arc(${size / 2}, ${size / 2}, ${Math.round(100 * s)}, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(167,140,200,0.72)'
    ctx.lineWidth = ${Math.max(1, Math.round(9 * s))}
    ctx.stroke()

    // Centre glow dot
    const grad = ctx.createRadialGradient(
      ${size / 2}, ${size / 2}, 0,
      ${size / 2}, ${size / 2}, ${Math.round(28 * s)}
    )
    grad.addColorStop(0, 'rgba(110,198,184,0.75)')
    grad.addColorStop(1, 'rgba(110,198,184,0)')
    ctx.beginPath()
    ctx.arc(${size / 2}, ${size / 2}, ${Math.round(28 * s)}, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  `
}

async function main() {
  const browser = await chromium.launch()
  const page    = await browser.newPage()

  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><style>*{margin:0;padding:0;overflow:hidden;background:#03071e}</style></head>
      <body>
        <canvas id="c" width="${size}" height="${size}"></canvas>
        <script>${drawScript(size)}<\/script>
      </body>
      </html>
    `)

    const dataUrl = await page.evaluate(() =>
      document.getElementById('c').toDataURL('image/png')
    )
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64')
    writeFileSync(`public/icons/icon-${size}.png`, buffer)
    console.log(`✓ icon-${size}.png`)
  }

  await browser.close()
  console.log('\nAll icons written to public/icons/')
}

main().catch(e => { console.error(e); process.exit(1) })
