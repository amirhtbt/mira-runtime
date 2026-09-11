import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || 'http://127.0.0.1:4173';
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 }
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [
        ['line'],
        ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
        ['html', { outputFolder: 'playwright-report', open: 'never' }]
      ]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{-snapshotSuffix}{ext}',
  use: {
    baseURL,
    locale: 'fa-IR',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !isCI
      },
  projects: [
    {
      name: 'visual-regression',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Desktop-Chrome',
      testMatch: /e2e\/.*\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Android-like',
      testMatch: /e2e\/.*\.e2e\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium'
      }
    },
    {
      name: 'iPhone-like-simulation',
      testMatch: /e2e\/.*\.e2e\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium'
      }
    }
  ]
});
