import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/owner.json';

/**
 * Log in once through Keycloak as the owner and persist the browser storage so
 * every test runs authenticated. Runs as a dependency of the chromium project.
 */
setup('authenticate as owner', async ({ page }) => {
  await page.goto('/editor');
  // Redirected to Keycloak.
  await page.locator('input#username').fill('owner');
  await page.locator('input#password').fill('owner');
  await page.locator('button:has-text("Sign In")').click();
  // Back in the app, authenticated.
  await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
  await page.context().storageState({ path: AUTH_FILE });
});
