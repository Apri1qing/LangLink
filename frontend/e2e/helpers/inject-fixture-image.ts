/**
 * inject-fixture-image.ts
 *
 * Injects a fixture image directly into the app's photo capture flow,
 * bypassing the real camera. Works by calling the internal handler
 * that CameraCapture would call after capture.
 */

import { type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Load a fixture image from disk and inject it as if the user just took a photo.
 *
 * @param page - Playwright page
 * @param fixtureName - filename inside e2e/fixtures/images/ (e.g. "ja-menu.png")
 */
export async function injectFixtureImage(page: Page, fixtureName: string): Promise<void> {
  const fixturePath = path.join(__dirname, '..', 'fixtures', 'images', fixtureName)
  const imageBytes = fs.readFileSync(fixturePath)
  const base64 = imageBytes.toString('base64')
  const mimeType = fixtureName.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const dataUrl = `data:${mimeType};base64,${base64}`

  // Expose as window variable then dispatch a custom event that
  // the Viewfinder component listens for (or call directly via evaluate).
  await page.evaluate((imgDataUrl: string) => {
    // Store on window so tests can verify it was received
    ;(window as unknown as Record<string, unknown>).__injectedImageDataUrl = imgDataUrl

    // Dispatch custom event — app listens via useEffect on 'test:inject-image'
    window.dispatchEvent(new CustomEvent('test:inject-image', { detail: { dataUrl: imgDataUrl } }))
  }, dataUrl)
}

/**
 * Simple helper: return a 1×1 transparent PNG as a data URL.
 * Useful when you need a placeholder image in tests that don't care about OCR content.
 */
export function blankImageDataUrl(): string {
  // 1×1 white JPEG base64
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB//EAB8QAAIBBAMBAAAAAAAAAAAAAAECAwQFESExQf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC5AA9AAAAAAAAf/9k='
}
