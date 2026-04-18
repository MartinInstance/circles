/**
 * PWA asset tests — manifest, icons, service worker, HTML meta tags.
 */

import { test, expect } from '@playwright/test'

test.describe('PWA', () => {
  test('manifest.json is accessible', async ({ page }) => {
    const res = await page.goto('/manifest.json')
    expect(res.status()).toBe(200)
  })

  test('manifest has name "Circles"', async ({ page }) => {
    const res      = await page.goto('/manifest.json')
    const manifest = await res.json()
    expect(manifest.name).toBe('Circles')
  })

  test('manifest display is standalone', async ({ page }) => {
    const res      = await page.goto('/manifest.json')
    const manifest = await res.json()
    expect(manifest.display).toBe('standalone')
  })

  test('manifest has theme_color', async ({ page }) => {
    const res      = await page.goto('/manifest.json')
    const manifest = await res.json()
    expect(manifest.theme_color).toBeTruthy()
  })

  test('manifest lists a 192px icon', async ({ page }) => {
    const res      = await page.goto('/manifest.json')
    const manifest = await res.json()
    expect(manifest.icons.some(i => i.sizes.includes('192'))).toBe(true)
  })

  test('manifest lists a 512px icon', async ({ page }) => {
    const res      = await page.goto('/manifest.json')
    const manifest = await res.json()
    expect(manifest.icons.some(i => i.sizes.includes('512'))).toBe(true)
  })

  test('icon-192.png is accessible', async ({ page }) => {
    const res = await page.goto('/icons/icon-192.png')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  test('icon-512.png is accessible', async ({ page }) => {
    const res = await page.goto('/icons/icon-512.png')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  test('service worker file is accessible', async ({ page }) => {
    const res = await page.goto('/sw.js')
    expect(res.status()).toBe(200)
  })

  test('HTML links the manifest', async ({ page }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/manifest.json')
  })

  test('HTML has theme-color meta tag', async ({ page }) => {
    await page.goto('/')
    const color = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(color).toBeTruthy()
  })

  test('HTML has apple-touch-icon', async ({ page }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('HTML registers a service worker', async ({ page }) => {
    await page.goto('/')
    const html = await page.content()
    expect(html).toContain('serviceWorker')
  })
})
