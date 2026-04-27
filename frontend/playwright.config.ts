import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop Chromium — fast, used for most logic tests
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },

    // Mobile Safari (WebKit) — iPhone 15 Pro profile, no real device needed
    // Triggers iOS WebKit-specific code paths (fetch ReadableStream limitations, etc.)
    // Note: WebKit does not support permissions: ['microphone','camera'] — omit to avoid launch error
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 15 Pro'],
        browserName: 'webkit',
      },
    },
  ],

  // Start dev server automatically if not already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
