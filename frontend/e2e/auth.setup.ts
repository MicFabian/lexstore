import { test as setup, expect, request } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/owner.json';

/**
 * Obtain a Keycloak token via the password grant and persist it as a
 * localStorage entry, so every test runs authenticated without driving the
 * full OIDC redirect flow (the app reads `lx.e2e.token` in E2E mode).
 */
setup('authenticate as owner', async ({ page, baseURL }) => {
  const api = await request.newContext();
  const res = await api.post(
    'http://localhost:8089/realms/lexstore/protocol/openid-connect/token',
    {
      form: {
        client_id: 'lexstore-spa',
        grant_type: 'password',
        username: 'owner',
        password: 'owner',
      },
    },
  );
  expect(res.ok()).toBeTruthy();
  const token = (await res.json()).access_token as string;
  await api.dispose();

  // Seed localStorage before any app code runs, then load the app once.
  await page.addInitScript((t) => localStorage.setItem('lx.e2e.token', t), token);
  await page.goto(baseURL! + '/editor');
  await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
  await page.context().storageState({ path: AUTH_FILE });
});
