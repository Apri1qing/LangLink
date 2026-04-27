/**
 * 07-pwa-meta.spec.ts
 *
 * Verifies PWA meta-tags, manifest, and iOS-specific viewport settings
 * required for correct rendering on iPhone with Dynamic Island / notch.
 */

import { test, expect } from '@playwright/test'

test.describe('PWA meta / iOS 适配', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('viewport 包含 viewport-fit=cover', async ({ page }) => {
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content')
    expect(content).toContain('viewport-fit=cover')
  })

  test('apple-mobile-web-app-status-bar-style = black-translucent', async ({ page }) => {
    const content = await page
      .locator('meta[name="apple-mobile-web-app-status-bar-style"]')
      .getAttribute('content')
    expect(content).toBe('black-translucent')
  })

  test('apple-mobile-web-app-capable = yes', async ({ page }) => {
    const content = await page
      .locator('meta[name="apple-mobile-web-app-capable"]')
      .getAttribute('content')
    expect(content).toBe('yes')
  })

  test('manifest link 标签存在', async ({ page }) => {
    // In dev mode vite-plugin-pwa inlines the manifest; check the <link> tag exists
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href')
    expect(manifestHref).toBeTruthy()

    // Try to fetch the manifest — may only work in production build (dist/ serve)
    const baseUrl = page.url().replace(/\/$/, '')
    const manifestUrl = manifestHref!.startsWith('http') ? manifestHref! : `${baseUrl}${manifestHref}`
    const response = await page.request.get(manifestUrl).catch(() => null)

    if (response && response.status() === 200) {
      const text = await response.text()
      if (text.trim().startsWith('{')) {
        const manifest = JSON.parse(text) as Record<string, unknown>
        expect(manifest.name ?? manifest.short_name).toBeTruthy()
        expect(manifest.display).toBe('standalone')
        expect(Array.isArray(manifest.icons)).toBe(true)
      }
    }
    // In dev mode the manifest is not served as a static file — <link> existence is sufficient
  })

  test('App 容器使用 env(safe-area-inset-*)', async ({ page }) => {
    // Check that the top-level container has safe-area padding set inline
    const appDiv = page.locator('body > #root > div').first()
    const style = await appDiv.getAttribute('style')
    expect(style).toContain('env(safe-area-inset-top)')
    expect(style).toContain('env(safe-area-inset-left)')
    expect(style).toContain('env(safe-area-inset-right)')
  })

  test('App 容器 minHeight = 100dvh', async ({ page }) => {
    const appDiv = page.locator('body > #root > div').first()
    const style = await appDiv.getAttribute('style')
    expect(style).toContain('100dvh')
  })

  test('apple-touch-icon 可访问', async ({ page }) => {
    const href = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute('href')
    expect(href).toBeTruthy()

    if (href) {
      const response = await page.request.get(href)
      expect(response.status()).toBe(200)
    }
  })

  test('theme-color meta 存在', async ({ page }) => {
    const content = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content')
    expect(content).toBeTruthy()
  })
})
