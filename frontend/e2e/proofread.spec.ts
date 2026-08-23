import { test, expect } from '@playwright/test';

async function waitShell(page: import('@playwright/test').Page) {
  await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
}

/** Creates a term this spec owns, so no other spec's edits can disturb it. */
async function ownTerm(page: import('@playwright/test').Page, key: string, source: string) {
  const created = await page.evaluate(
    async ({ key, source }) => {
      const token = localStorage.getItem('lx.e2e.token');
      const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
      const projects = await (await fetch('/api/projects', { headers: auth })).json();
      const mosaic = projects.find((p: { code: string }) => p.code === 'mosaic-web');
      const res = await fetch(`/api/projects/${mosaic.id}/terms`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ key, source }),
      });
      return { projectId: mosaic.id as string, status: res.status, body: await res.text() };
    },
    { key, source },
  );
  expect(created.status, `creating ${key} failed: ${created.body}`).toBe(201);
  return created.projectId;
}

test.describe('proofreader', () => {
  test('flags a placeholder the translation invented', async ({ page }) => {
    await page.goto('/editor?lang=de');
    await waitShell(page);
    const key = `proof.placeholder.${Date.now()}`;
    await ownTerm(page, key, 'Taxes are calculated at checkout');
    await page.goto('/editor?lang=de');
    await waitShell(page);

    await page.getByRole('textbox', { name: 'Search keys or text' }).fill(key);
    await expect(page.locator('.trow')).toHaveCount(1);
    await page.locator('.trow .tgt').first().click();

    const inspector = page.locator('.inspector');
    await expect(inspector).toBeVisible();
    await inspector.locator('textarea').first().fill('Steuern {unexpected}');
    await inspector.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.trow')).toHaveCount(1);
    await page.locator('.trow .tgt').first().click();
    await inspector.locator('.proofread button', { hasText: 'Review' }).click();

    await expect(inspector.locator('.proofread .verdict')).toContainText('Needs work', { timeout: 15000 });
    await expect(inspector.locator('.proofread .issue')).toContainText('{unexpected}');
  });

  test('a glossary term the translation ignores is reported', async ({ page }) => {
    await page.goto('/editor?lang=de');
    await waitShell(page);

    const key = `proof.glossary.${Date.now()}`;
    const term = `Widget${Date.now()}`;
    await ownTerm(page, key, `Open the ${term} panel`);

    const added = await page.evaluate(
      async ({ term }) => {
        const token = localStorage.getItem('lx.e2e.token');
        const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
        const projects = await (await fetch('/api/projects', { headers: auth })).json();
        const mosaic = projects.find((p: { code: string }) => p.code === 'mosaic-web');
        const res = await fetch(`/api/projects/${mosaic.id}/glossary`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ term, languageCode: 'de', translation: 'Bauteil' }),
        });
        return res.status;
      },
      { term },
    );
    expect([200, 201]).toContain(added);
    await page.goto('/editor?lang=de');
    await waitShell(page);

    await page.getByRole('textbox', { name: 'Search keys or text' }).fill(key);
    await expect(page.locator('.trow')).toHaveCount(1);
    await page.locator('.trow .tgt').first().click();

    const inspector = page.locator('.inspector');
    await inspector.locator('textarea').first().fill('Panel öffnen');
    await inspector.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.trow')).toHaveCount(1);
    await page.locator('.trow .tgt').first().click();
    await inspector.locator('.proofread button', { hasText: 'Review' }).click();
    await expect(inspector.locator('.proofread .issue')).toContainText('Bauteil', { timeout: 15000 });
  });
});

test.describe('glossary settings', () => {
  test('a term can be added and removed in project settings', async ({ page }) => {
    const term = `Widget${Date.now()}`;
    await page.goto('/settings');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.subnav button', { hasText: 'Glossary' }).click();

    await page.locator('.gform .input').first().fill(term);
    await page.locator('.gform .input').nth(1).fill('Bauteil');
    await page.locator('.gform lx-btn button').click();

    await expect(page.locator('.gtable')).toContainText(term);
    await expect(page.locator('.gtable')).toContainText('Bauteil');

    await page
      .locator('.gtable tr', { hasText: term })
      .locator('button', { hasText: 'Remove' })
      .click();
    await expect(page.locator('.gtable, .muted').first()).not.toContainText(term);
  });

  test('a do-not-translate term is shown as such', async ({ page }) => {
    const term = `Brand${Date.now()}`;
    await page.goto('/settings');
    await expect(page.locator('.rail__brand')).toBeVisible({ timeout: 15000 });
    await page.locator('.subnav button', { hasText: 'Glossary' }).click();

    await page.locator('.gform .input').first().fill(term);
    await page.locator('.gkeep input').check();
    await page.locator('.gform lx-btn button').click();

    await expect(page.locator('.gtable tr', { hasText: term })).toContainText('leave untranslated');
  });
});
