import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Starts the dev server itself unless one is already listening on
 * :4300, so `npm run e2e` works from a cold checkout. The backend and Keycloak
 * still have to be up, since the tests sign in for real.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  // Start the dev server unless one is already running, so CI needs no extra step.
  webServer: {
    command: 'npx ng serve --port 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/owner.json' },
      dependencies: ['setup'],
    },
  ],
});
