/**
 * 01-home-render.spec.ts
 *
 * Verifies that the Home page renders its key elements correctly and
 * that interactive buttons meet the 44×44 px touch target requirement.
 */

import { test, expect } from '@playwright/test'
import { gotoHome, assertTouchTarget } from './helpers/page-helpers'

test.describe('Home 页渲染', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page)
  })

  test('TopBar 三按钮可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '历史会话' })).toBeVisible()
    await expect(page.getByRole('button', { name: '照片模式' })).toBeVisible()
    await expect(page.getByRole('button', { name: '语音模式' })).toBeVisible()
    await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
  })

  test('DualPill 双语言按钮可见', async ({ page }) => {
    // At least two pill buttons exist (one per language in the pair)
    const pills = page.locator('[aria-label*="开始录音"]')
    await expect(pills).toHaveCount(2)
  })

  test('常用语列表渲染', async ({ page }) => {
    // Default phrases are pre-seeded in localStorage
    await expect(page.locator('text=多少钱')).toBeVisible()
    await expect(page.locator('text=谢谢')).toBeVisible()
  })

  test('TopBar 按钮触控目标 ≥ 44px', async ({ page }) => {
    await assertTouchTarget(page, '[aria-label="历史会话"]')
    await assertTouchTarget(page, '[aria-label="设置"]')
    await assertTouchTarget(page, '[aria-label="照片模式"]')
    await assertTouchTarget(page, '[aria-label="语音模式"]')
  })

  test('DualPill 触控目标 ≥ 44px', async ({ page }) => {
    // Pills span full half-width — just assert height
    const pill = page.locator('[aria-label*="开始录音"]').first()
    const box = await pill.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('切换到语音模式后 TopBar 仍可见', async ({ page }) => {
    await page.getByRole('button', { name: '语音模式' }).click()
    await expect(page.getByRole('button', { name: '设置' })).toBeVisible()
    // Switch back
    await page.getByRole('button', { name: '照片模式' }).click()
    await expect(page.locator('text=多少钱')).toBeVisible()
  })
})
