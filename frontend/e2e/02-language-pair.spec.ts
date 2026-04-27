/**
 * 02-language-pair.spec.ts
 *
 * Verifies language pair selection, persistence across reloads,
 * and that DualPill labels reflect the current pair.
 */

import { test, expect } from '@playwright/test'
import { gotoHome, openSettings, goBack, getLocalStorage } from './helpers/page-helpers'

test.describe('语言对配置', () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted language pair so tests start from a known state
    await page.goto('/')
    await page.evaluate(() => {
      const raw = localStorage.getItem('traveltalk-store')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.state = { ...parsed.state, languagePair: { A: 'zh', B: 'ja' } }
        localStorage.setItem('traveltalk-store', JSON.stringify(parsed))
      }
    })
    await gotoHome(page)
  })

  test('Settings 中可以修改语言对', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('combobox', { name: '母语' }).selectOption('en')
    await page.getByRole('combobox', { name: '外语' }).selectOption('ko')
    // Values are reflected immediately
    await expect(page.getByRole('combobox', { name: '母语' })).toHaveValue('en')
    await expect(page.getByRole('combobox', { name: '外语' })).toHaveValue('ko')
  })

  test('语言对写入 localStorage', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('combobox', { name: '母语' }).selectOption('ja')
    await page.getByRole('combobox', { name: '外语' }).selectOption('en')

    const store = await getLocalStorage(page, 'traveltalk-store') as { state?: { languagePair?: { A: string; B: string } } } | null
    expect(store?.state?.languagePair).toEqual({ A: 'ja', B: 'en' })
  })

  test('reload 后语言对持久化', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('combobox', { name: '母语' }).selectOption('fr')
    await page.getByRole('combobox', { name: '外语' }).selectOption('de')
    await goBack(page)

    // Reload the page
    await page.reload()
    await gotoHome(page)

    await openSettings(page)
    await expect(page.getByRole('combobox', { name: '母语' })).toHaveValue('fr')
    await expect(page.getByRole('combobox', { name: '外语' })).toHaveValue('de')
  })

  test('DualPill 标签随语言对同步', async ({ page }) => {
    await openSettings(page)
    await page.getByRole('combobox', { name: '母语' }).selectOption('zh')
    await page.getByRole('combobox', { name: '外语' }).selectOption('ko')
    await goBack(page)

    // DualPill should show the language names
    const pills = page.locator('[aria-label*="开始录音"]')
    const labels = await pills.allInnerTexts()
    const labelsJoined = labels.join(' ')
    // Should contain Chinese and Korean language names
    expect(labelsJoined).toMatch(/中文|Chinese|zh/i)
    expect(labelsJoined).toMatch(/한국어|Korean|ko/i)
  })

  test('Settings 页使用 SubPageTopBar（←返回 + 标题，无模式切换按钮）', async ({ page }) => {
    await openSettings(page)
    // SubPageTopBar: back button + title
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
    await expect(page.locator('h1', { hasText: '设置' })).toBeVisible()
    // No mode-switch buttons (photo/voice) in sub-page TopBar
    await expect(page.getByRole('button', { name: '照片模式' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: '语音模式' })).not.toBeVisible()
  })

  test('← 返回按钮从 Settings 回到 Home', async ({ page }) => {
    await openSettings(page)
    await goBack(page)
    // Home elements visible again
    await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
    await expect(page.locator('text=多少钱')).toBeVisible()
  })
})
