import { test, expect, type Page } from './global';

/**
 * The two inspector safeguards: the live placeholder check under the
 * translation box, and the conflict notice a 409 turns into a real choice.
 */

async function openTermInEditor(page: Page, key: string) {
  await page.getByRole('textbox', { name: 'Search keys or text' }).fill(key);
  await expect(page.locator('.trow')).toHaveCount(1);
  await page.locator('.trow .tgt').first().click();
  await expect(page.locator('.inspector')).toBeVisible();
}

test.describe('placeholder check', () => {
  test('placeholders are compared live while typing', async ({ page }) => {
    await page.goto('/editor');
    await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();

    // A term whose source carries two placeholders; no AI drafts, so the
    // translation starts empty.
    await page.locator('.ed-head button', { hasText: 'Add term' }).click();
    await page.locator('.dlg input').first().fill('e2e.placeholder.cart');
    await page.locator('.dlg input').nth(1).fill('You have {count} items in your <b>cart</b>');
    await page.locator('.dlg button[aria-label="Draft translations with AI"]').click();
    const add = page.locator('.dlg button', { hasText: 'Add' });
    await expect(add).toBeEnabled();
    await add.click();

    await openTermInEditor(page, 'e2e.placeholder.cart');
    const phc = page.locator('.inspector lx-placeholder-check');

    // Untouched: both placeholders listed, nothing flagged yet.
    await expect(phc.locator('.phc__ph')).toHaveCount(2);
    await expect(phc.locator('.phc__msg')).toHaveCount(0);

    // A typo'd placeholder is called out as invented, the real one as missing.
    await page.locator('#lx-translation').fill('Vous avez {cout} articles');
    await expect(phc.locator('.phc__ph--added')).toHaveText('{cout}');
    await expect(phc.locator('.phc__ph--missing')).toHaveCount(2);
    await expect(phc.locator('.phc__msg')).toBeVisible();

    // Carrying both over turns the check green and silent.
    await page
      .locator('#lx-translation')
      .fill('Vous avez {count} articles dans votre <b>panier</b>');
    await expect(phc.locator('.phc__ph--ok')).toHaveCount(2);
    await expect(phc.locator('.phc__msg')).toHaveCount(0);
  });
});

test.describe('conflict notice', () => {
  /** Save the term's fr translation directly through the API, as someone else. */
  async function saveAsSomeoneElse(page: Page, key: string, value: string) {
    const result = await page.evaluate(
      async ({ key, value }) => {
        const token = localStorage.getItem('lx.e2e.token');
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        const projects = await fetch('/api/projects', { headers }).then((r) => r.json());
        const pid = projects.find((p: { name: string }) => p.name === 'Mosaic Web App').id;
        const editor = await fetch(
          `/api/projects/${pid}/languages/fr/translations?q=${encodeURIComponent(key)}`,
          { headers },
        ).then((r) => r.json());
        const row = editor.rows.find((r: { key: string }) => r.key === key);
        const res = await fetch(
          `/api/projects/${pid}/languages/fr/translations/${row.id}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ value, status: 'translated', version: row.version }),
          },
        );
        return res.status;
      },
      { key, value },
    );
    expect(result).toBe(200);
  }

  test('a lost race shows their version; taking theirs resolves it', async ({ page }) => {
    await page.goto('/editor');
    await openTermInEditor(page, 'nav.dashboard');

    await saveAsSomeoneElse(page, 'nav.dashboard', 'Tableau de bord (à eux)');

    await page.locator('#lx-translation').fill('Tableau de bord (à moi)');
    await page.locator('.inspector button', { hasText: 'Save' }).first().click();

    const notice = page.locator('.inspector lx-conflict-notice');
    await expect(notice).toContainText('Saved by someone else');
    await expect(notice).toContainText('Tableau de bord (à eux)');

    await notice.locator('button', { hasText: 'Take theirs' }).click();
    await expect(page.locator('.inspector lx-conflict-notice')).toHaveCount(0);
    await expect(page.locator('#lx-translation')).toHaveValue('Tableau de bord (à eux)');
    await expect(page.locator('.trow .tgt').first()).toContainText('Tableau de bord (à eux)');
  });

  test('overwriting after a conflict saves my version', async ({ page }) => {
    await page.goto('/editor');
    await openTermInEditor(page, 'nav.dashboard');

    await saveAsSomeoneElse(page, 'nav.dashboard', 'Tableau de bord (à eux)');

    await page.locator('#lx-translation').fill('Tableau de bord (à moi)');
    await page.locator('.inspector button', { hasText: 'Save' }).first().click();
    const notice = page.locator('.inspector lx-conflict-notice');
    await expect(notice).toContainText('Saved by someone else');

    await notice.locator('button', { hasText: 'Overwrite with mine' }).click();
    await expect(page.locator('.toast')).toContainText('Translation saved');
    await expect(page.locator('.inspector lx-conflict-notice')).toHaveCount(0);
    await expect(page.locator('.trow .tgt').first()).toContainText('Tableau de bord (à moi)');
  });
});
