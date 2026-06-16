import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Placeholderer web app.
 *
 * Spins up `pnpm --filter web dev` for the duration of the test run
 * via the `webServer` option. Run `npx playwright install` once to
 * pull the browser binaries, then `pnpm e2e` to execute the suite.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
