/**
 * 06-navigation.spec.ts
 *
 * Verifies page-level navigation:
 * - Home → Settings shows SubPageTopBar (← + title, no mode buttons)
 * - ← returns to Home
 * - Home → History shows SubPageTopBar
 * - TranslationSheet can be closed with Escape key
 */

import { test, expect } from '@playwright/test'
import { gotoHome, openSettings, goBack } from './helpers/page-helpers'

test.describe('页面导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('traveltalk-store') ?? '{"state":{}}')
      store.state = { ...(store.state ?? {}), languagePair: { A: 'zh', B: 'ja' } }
      localStorage.setItem('traveltalk-store', JSON.stringify(store))
    })
    await gotoHome(page)
  })

  test('Settings 顶栏只有 ← 返回 + 标题', async ({ page }) => {
    await openSettings(page)

    // SubPageTopBar: back button + "设置" heading
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
    await expect(page.locator('h1', { hasText: '设置' })).toBeVisible()

    // Home TopBar buttons should NOT be visible
    await expect(page.getByRole('button', { name: '照片模式' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: '语音模式' })).not.toBeVisible()
  })

  test('Settings ← 返回后 Home TopBar 恢复', async ({ page }) => {
    await openSettings(page)
    await goBack(page)

    // Home TopBar restored
    await expect(page.getByRole('button', { name: '照片模式' })).toBeVisible()
    await expect(page.getByRole('button', { name: '语音模式' })).toBeVisible()
    await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
  })

  test('History 页顶栏只有 ← 返回 + 标题', async ({ page }) => {
    await page.getByRole('button', { name: '历史会话' }).click()
    await page.waitForSelector('h1', { timeout: 5_000 })

    await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
    await expect(page.locator('h1', { hasText: '历史会话' })).toBeVisible()

    // No mode switch buttons
    await expect(page.getByRole('button', { name: '照片模式' })).not.toBeVisible()
  })

  test('History ← 返回后 Home TopBar 恢复', async ({ page }) => {
    await page.getByRole('button', { name: '历史会话' }).click()
    await page.waitForSelector('h1', { timeout: 5_000 })
    await goBack(page)

    await expect(page.getByRole('button', { name: '历史会话' })).toBeVisible()
    await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
  })

  test('TranslationSheet Escape 键关闭（桌面端）', async ({ page }) => {
    // Mock translation so sheet appears
    await page.route('**/llm-gateway**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          originalText: '多少钱',
          translatedText: 'いくらですか',
        }),
      })
    })
    await page.route('**/voice-translate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, audioUrl: '' }),
      })
    })

    await page.getByRole('button', { name: '多少钱' }).click()

    // Wait for sheet
    await page.waitForTimeout(1500)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)

    // After Escape, phrase button should be visible (not a paragraph inside the sheet)
    await expect(page.getByRole('button', { name: '多少钱' })).toBeVisible({ timeout: 3_000 })
  })

  test('Settings 删除按钮触控目标 ≥ 44px', async ({ page }) => {
    await openSettings(page)

    const deleteBtn = page.getByRole('button', { name: /删除/ }).first()
    const box = await deleteBtn.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
