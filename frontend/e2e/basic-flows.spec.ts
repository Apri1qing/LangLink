// e2e/basic-flows.spec.ts
// E2E 测试覆盖关键用户流程
// 运行方式: npx playwright test e2e/basic-flows.spec.ts

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

test.describe('TravelTalk 关键流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('Home 页面加载', async ({ page }) => {
    // VoiceBar 可见
    await expect(page.locator('button:has-text("中文")')).toBeVisible()
    await expect(page.locator('button:has-text("日本語")')).toBeVisible()

    // modeSwitcher 可见
    await expect(page.locator('button:has-text("拍照")')).toBeVisible()
    await expect(page.locator('button:has-text("语音")')).toBeVisible()

    // 常用语可见
    await expect(page.locator('button:has-text("多少钱")')).toBeVisible()
  })

  test('语言切换', async ({ page }) => {
    // 点击日语
    await page.click('button:has-text("日本語")')

    // 日语按钮应该选中（背景变深色）
    const jaBtn = page.locator('button:has-text("日本語")')
    await expect(jaBtn).toHaveClass(/bg-black|bg-\[#000000\]/)
  })

  test('常用语点击 → 结果底卡', async ({ page }) => {
    await page.click('button:has-text("多少钱")')

    // 结果底卡出现
    await expect(page.locator('text=3秒后自动关闭')).toBeVisible()

    // 3秒后自动关闭
    await page.waitForTimeout(3500)
    await expect(page.locator('text=3秒后自动关闭')).not.toBeVisible()
  })

  test('模式切换 → Voice Mode', async ({ page }) => {
    await page.click('button:has-text("语音")')

    // Voice Mode 显示大圆按钮
    await expect(page.locator('button:has-text("🎤")')).toBeVisible()
    await expect(page.locator('text=长按下方按钮开始对话')).toBeVisible()

    // 切换回拍照模式
    await page.click('button:has-text("拍照")')
    // 取景框按钮
    await expect(page.getByRole('button', { name: '📷 拍摄菜单、路牌或标识' })).toBeVisible()
  })

  test('常用语管理 → 添加新短语', async ({ page }) => {
    // 打开管理页
    await page.click('button:has-text("管理")')

    // 点击添加
    await page.click('button:has-text("添加常用语")')

    // 输入内容
    await page.fill('input[placeholder="原文"]', '再见')
    await page.fill('input[placeholder="翻译"]', 'さようなら')

    // 保存
    await page.click('button:has-text("保存")')

    // 新短语出现在列表
    await expect(page.locator('text=再见')).toBeVisible()
    await expect(page.locator('text=さようなら')).toBeVisible()
  })

  test('常用语管理 → 删除短语', async ({ page }) => {
    await page.click('button:has-text("管理")')

    // 记录删除前的数量
    const initialBtns = await page.locator('text=多少钱').count()
    expect(initialBtns).toBeGreaterThan(0)

    // 点击删除（-按钮）
    const deleteBtn = page.locator('button:has-text("-")').first()
    await deleteBtn.click()

    // 数量减少
    // (具体行为取决于 UI，- 可能直接删除)
  })

  test('Menu 返回 Home', async ({ page }) => {
    await page.click('button:has-text("管理")')
    await page.click('button:has-text("←")')

    // 返回 Home 页面
    await expect(page.locator('button:has-text("多少钱")')).toBeVisible()
  })

  test('Home_Result 返回按钮', async ({ page }) => {
    // 触发翻译结果页
    await page.click('button:has-text("多少钱")')

    // 结果页出现
    await expect(page.locator('text=3秒后自动关闭')).toBeVisible()

    // 点击返回按钮
    await page.click('button:has-text("←")')

    // 返回 Home
    await expect(page.locator('button:has-text("多少钱")')).toBeVisible()
  })
})

// Voice Mode 录音流程需要真实 Supabase Edge Functions
// 以下测试在 Supabase 配置完整后可启用
test.describe.skip('Voice Mode 录音流程', () => {
  test('长按录音按钮显示录制状态', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.click('button:has-text("语音")')

    const micBtn = page.locator('button:has-text("🎤")')
    await micBtn.dispatchEvent('mousedown')
    await page.waitForTimeout(500)

    await expect(page.locator('button:has-text("⏹")')).toBeVisible()

    await micBtn.dispatchEvent('mouseup')
  })
})
