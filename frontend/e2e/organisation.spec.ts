import { test, expect } from '@playwright/test';

async function waitShell(page: import('@playwright/test').Page) {
  await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
}

test.describe('organisation', () => {
  test('usage view reports real counters', async ({ page }) => {
    await page.goto('/organisation');
    await waitShell(page);

    await expect(page.locator('.otitle')).toHaveText('Lexstore');
    await expect(page.locator('.ohead .muted').first()).toContainText('projects');
    await expect(page.locator('.cards .card')).toHaveCount(4);
  });

  test('an AI key can be stored for the organisation and for one project', async ({ page }) => {
    await page.goto('/organisation');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'AI keys' }).click();

    await page.locator('.keyform .input').fill('sk-test-organisation-key-1111');
    await page.locator('.keyform lx-btn button').click();
    await expect(page.locator('.otable')).toContainText('••••1111');
    await expect(page.locator('.otable')).toContainText('Organisation');

    // The same provider, scoped to one project, is stored alongside it.
    await page.locator('.keyform .input').fill('sk-test-project-key-2222');
    await page.locator('.keyform select').nth(1).selectOption({ index: 1 });
    await page.locator('.keyform lx-btn button').click();
    await expect(page.locator('.otable')).toContainText('••••2222');
  });

  test('a stored key is never shown in full', async ({ page }) => {
    await page.goto('/organisation');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'AI keys' }).click();
    await expect(page.locator('.otable')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('sk-test-organisation-key-1111');
  });

  test('activity lists what the AI was used for', async ({ page }) => {
    await page.goto('/organisation');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Activity' }).click();
    await expect(page.locator('.otable, .muted').first()).toBeVisible();
  });

  test('members are listed with their role', async ({ page }) => {
    await page.goto('/organisation');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Members' }).click();
    await expect(page.locator('.otable tbody tr').first()).toBeVisible();
    await expect(page.locator('.otable')).toContainText('@lexstore.io');
  });
});
