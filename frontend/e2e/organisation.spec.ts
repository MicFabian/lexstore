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

    // A missing LEXSTORE_SECRET_KEY makes the server refuse; say so plainly
    // rather than failing on an element that was never going to appear.
    const refused = page.locator('.toast', { hasText: 'encryption key' });
    await expect(
      refused.or(page.locator('.otable')),
      'storing a key needs LEXSTORE_SECRET_KEY set on the API',
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.otable')).toContainText('••••1111');
    await expect(page.locator('.otable')).toContainText('Organisation');

    // The same provider, scoped to one project, is stored alongside it. The
    // button disables itself while saving, so wait for it to come back.
    // The button enables itself once the field has content again.
    const save = page.locator('.keyform lx-btn button');
    await page.locator('.keyform .input').fill('sk-test-project-key-2222');
    await page.locator('.keyform select').nth(1).selectOption({ index: 1 });
    await expect(save).toBeEnabled();
    await save.click();
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

test.describe('organisation API access', () => {
  test('an org-wide key is created, shown once, and revocable', async ({ page }) => {
    await page.goto('/organisation');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.subnav button', { hasText: 'API access' }).click();

    const label = `Pipeline ${Date.now()}`;
    await page.locator('.keyform .input').fill(label);
    await page.locator('.keyform lx-btn button').click();

    // The secret appears once, in full, and only here.
    const secret = await page.locator('.newkey code').innerText();
    expect(secret).toMatch(/^tl_(live|test)_/);

    // The table lists it masked, never in full.
    await expect(page.locator('.otable')).toContainText(label);
    await expect(page.locator('.otable')).not.toContainText(secret);

    await page
      .locator('.otable tr', { hasText: label })
      .locator('button', { hasText: 'Revoke' })
      .click();
    await expect(page.locator('.otable, .muted').first()).not.toContainText(label);
  });

  test('an org key reads a project it was never named on', async ({ page }) => {
    await page.goto('/organisation');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.subnav button', { hasText: 'API access' }).click();

    await page.locator('.keyform .input').fill(`Reach ${Date.now()}`);
    await page.locator('.keyform lx-btn button').click();
    const secret = await page.locator('.newkey code').innerText();

    const reach = await page.evaluate(async (secret) => {
      const token = localStorage.getItem('lx.e2e.token');
      const projects = await (
        await fetch('/api/projects', { headers: { authorization: `Bearer ${token}` } })
      ).json();
      const other = projects.find((p: { code: string }) => p.code === 'mosaic-ios');
      const res = await fetch(`/api/projects/${other.id}/languages/de/translations`, {
        headers: { 'X-API-Key': secret },
      });
      return res.status;
    }, secret);

    expect(reach).toBe(200);
  });
});

test.describe('honest surfaces', () => {
  test('integrations list only what exists, with no dead connect button', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.subnav button', { hasText: 'Integrations' }).click();

    await expect(page.locator('.two-col .card')).toHaveCount(1);
    await expect(page.locator('.two-col')).toContainText('CLI & API');
    await expect(page.locator('.two-col button', { hasText: 'Connect' })).toHaveCount(0);
    await expect(page.locator('.two-col')).not.toContainText('Connected');
  });

  test('the top bar has no notification bell promising unread news', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[aria-label="Notifications"]')).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  test('every data table has a name a screen reader can announce', async ({ page }) => {
    for (const path of ['/editor', '/terms', '/contributors', '/features', '/organisation']) {
      await page.goto(path);
      await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
      const tables = page.locator('table');
      for (let i = 0; i < (await tables.count()); i++) {
        await expect(tables.nth(i)).toHaveAttribute('aria-label', /.+/);
      }
    }
  });

  test('icon-only controls carry a label', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.trow .tgt').first().click();
    await expect(page.locator('.inspector')).toBeVisible();

    const unnamed = await page.locator('.inspector button').evaluateAll((buttons) =>
      buttons.filter((b) => !b.textContent?.trim() && !b.getAttribute('aria-label')).length,
    );
    expect(unnamed).toBe(0);
  });
});

test.describe('failed requests', () => {
  test('a failed load says so instead of looking empty', async ({ page }) => {
    await page.route('**/api/org/usage*', (r) => r.fulfill({ status: 500, body: '{}' }));
    await page.goto('/organisation');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.toast')).toContainText('went wrong', { timeout: 10000 });
  });

  test('a screen that reports failure itself does not say it twice', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.trow .tgt').first().click();
    await expect(page.locator('.inspector')).toBeVisible();

    // Save enables itself only once there is something to save.
    await page.locator('.inspector textarea').first().fill('Etwas zum Speichern');
    await page.route('**/languages/*/translations/*', (r) =>
      r.fulfill({ status: 500, body: '{}' }),
    );
    await page.locator('.inspector').getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.toast')).toHaveCount(1, { timeout: 10000 });
  });
});
