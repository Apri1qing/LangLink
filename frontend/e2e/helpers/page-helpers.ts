/**
 * page-helpers.ts
 *
 * Common page-level helpers for E2E tests.
 */

import { type Page, expect } from '@playwright/test'

/** Navigate to app root and wait for Home page to be ready. */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/')
  // Wait for the DualPill buttons (language pills) to appear — signals Home is mounted
  await page.waitForSelector('[aria-label*="录音"], [aria-label*="开始录音"]', { timeout: 10_000 })
}

/** Open Settings page via the TopBar gear button. */
export async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: '设置' }).click()
  await page.waitForSelector('text=语言配对', { timeout: 5_000 })
}

/** Go back to Home from a sub-page via the ← button. */
export async function goBack(page: Page): Promise<void> {
  await page.getByRole('button', { name: '返回' }).click()
}

/** Switch the language pair in Settings and return to Home. */
export async function setLanguagePair(
  page: Page,
  nativeLang: string,
  foreignLang: string,
): Promise<void> {
  await openSettings(page)
  await page.getByRole('combobox', { name: '母语' }).selectOption(nativeLang)
  await page.getByRole('combobox', { name: '外语' }).selectOption(foreignLang)
  await goBack(page)
}

/** Assert a button's bounding box is at least minSize × minSize pixels. */
export async function assertTouchTarget(
  page: Page,
  selector: string,
  minSize = 44,
): Promise<void> {
  const el = page.locator(selector).first()
  const box = await el.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(minSize)
  expect(box!.height).toBeGreaterThanOrEqual(minSize)
}

/** Intercept a fetch to a given URL path fragment and return a mock response. */
export async function mockFetch(
  page: Page,
  urlFragment: string,
  body: unknown,
  status = 200,
): Promise<void> {
  await page.route(`**/${urlFragment}**`, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

/** Read localStorage key. */
export async function getLocalStorage(page: Page, key: string): Promise<unknown> {
  return page.evaluate((k: string) => {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) : null
  }, key)
}
