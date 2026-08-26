import { test, expect, type Page } from './global';

// The global fixture resets the backend before each test (order-independent).
// The app boots on the editor; wait for the rail brand to confirm the shell mounted.
async function waitShell(page: Page) {
  await expect(page.locator('.rail__brand')).toBeVisible();
}

test.describe('shell + navigation', () => {
  test('loads the editor by default with the project rail', async ({ page }) => {
    await page.goto('/');
    await waitShell(page);
    await expect(page.locator('.rail__proj')).toContainText('Mosaic Web App');
    // Nav shows the open-work count (untranslated + needs review) from the API.
    await expect(page.locator('.navitem', { hasText: 'Translations' })).toContainText('49');
    // Editor table has rows.
    await expect(page.locator('.ttable tbody tr')).toHaveCount(14);
  });

  test('navigates between every screen', async ({ page }) => {
    await page.goto('/');
    await waitShell(page);
    for (const [label, heading] of [
      ['Terms', 'Terms'],
      ['Languages', 'Languages'],
      ['Contributors', 'Contributors'],
      ['Settings', 'Settings'],
    ] as const) {
      await page.locator('.navitem', { hasText: label }).click();
      await expect(page.locator('h1')).toContainText(heading);
    }
  });
});

test.describe('translation editor', () => {
  test('filters by status and shows New badges', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // "New" filter narrows to the 3 newly-added terms.
    await page.locator('.ftab', { hasText: 'New' }).click();
    await expect(page.locator('.ttable tbody tr')).toHaveCount(3);
    await expect(page.locator('.stcap', { hasText: 'New' }).first()).toBeVisible();
    // Back to all.
    await page.locator('.ftab', { hasText: 'All' }).click();
    await expect(page.locator('.ttable tbody tr')).toHaveCount(14);
  });

  test('search narrows the rows', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    await page.locator('.ed-tabs input').fill('checkout');
    const rows = page.locator('.ttable tbody tr');
    await expect(rows).toHaveCount(3);
    for (const cell of await rows.locator('.keytag').allTextContents()) {
      expect(cell).toContain('checkout');
    }
  });

  test('inspector shows the last editor and opens full history', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // A translated, proofread row carries a "last edited by" line.
    await page.locator('.trow', { hasText: 'nav.dashboard' }).click();
    const inspector = page.locator('.inspector');
    await expect(inspector.locator('.lastedit__text')).toContainText('Last edited by');

    // Open the history modal — it lists events across languages.
    await inspector.locator('button', { hasText: 'History' }).click();
    const modal = page.locator('.modal[aria-label="Translation history"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('nav.dashboard');
    await expect(modal.locator('.event').first()).toBeVisible();
    // Multiple languages appear in the trail.
    await expect(modal.locator('.event .locale')).not.toHaveCount(0);
    await modal.locator('button[aria-label="Close"]').click();
    await expect(modal).toBeHidden();
  });

  test('opens the inspector and saves a translation', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // Re-save an already-translated row so the test doesn't consume a "new" term
    // (keeps the New-filter tests order-independent).
    const target = page.locator('.trow', { hasText: 'checkout.button.pay' });
    await expect(target).toBeVisible();
    await target.click();

    const inspector = page.locator('.inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.locator('.keytag')).toContainText('checkout.button.pay');

    const value = 'Payer maintenant E2E';
    await inspector.locator('textarea').first().fill(value);
    await inspector.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.toast')).toContainText('Translation saved');
    await expect(page.locator('.trow', { hasText: 'checkout.button.pay' }).locator('.tgt')).toContainText(
      value,
    );
  });
});

test.describe('terms', () => {
  test('expands a row to show per-translation authors', async ({ page }) => {
    await page.goto('/terms');
    await waitShell(page);
    await page.locator('.trow', { hasText: 'checkout.button.pay' }).click();
    const expanded = page.locator('.trow-expand');
    await expect(expanded).toBeVisible();
    // One row per language, each with its translation + author column.
    await expect(expanded.locator('.tr-row')).toHaveCount(6);
    // A translated language shows an author name.
    await expect(expanded.locator('.tr-author-name').first()).toBeVisible();
    // The full-history modal is reachable from the expanded row.
    await expanded.locator('button', { hasText: 'View full history' }).click();
    await expect(page.locator('.modal[aria-label="Translation history"]')).toBeVisible();
  });

  test('the "New only" toggle filters to new terms', async ({ page }) => {
    await page.goto('/terms');
    await waitShell(page);
    const rows = page.locator('.ttable tbody tr.trow');
    // Wait for the full table to populate (14 source strings).
    await expect(rows).toHaveCount(14);

    await page.locator('button', { hasText: 'New only' }).click();
    // After filtering, only the 3 new terms remain — wait for the re-render to settle.
    await expect(rows).toHaveCount(3);
    await expect(page.locator('.ttable tbody .chip--new')).toHaveCount(3);
  });
});

test.describe('languages + contributors + settings', () => {
  test('languages render progress cards', async ({ page }) => {
    await page.goto('/languages');
    await waitShell(page);
    await expect(page.locator('.lang-row')).toHaveCount(6);
    await expect(page.locator('.lang-row', { hasText: 'French' })).toContainText('%');
  });

  test('contributors table lists the team', async ({ page }) => {
    await page.goto('/contributors');
    await waitShell(page);
    await expect(page.locator('.ttable tbody tr')).toHaveCount(5);
    await expect(page.locator('.cap', { hasText: 'Admin' })).toBeVisible();
  });

  test('settings never exposes an API key secret after creation', async ({ page }) => {
    await page.goto('/settings');
    const firstKey = page.locator('.keyrow').first();
    await expect(firstKey.locator('.keycode')).toContainText('••');
    await expect(firstKey.getByRole('button', { name: 'Reveal' })).toHaveCount(0);
    await expect(firstKey.getByRole('button', { name: 'Copy' })).toHaveCount(0);
  });

  test('settings tabs switch content', async ({ page }) => {
    await page.goto('/settings');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Integrations' }).click();
    await expect(page.locator('.card', { hasText: 'CLI & API' })).toBeVisible();
    await page.locator('.subnav button', { hasText: 'Import / Export' }).click();
    await expect(page.locator('.card', { hasText: 'Import strings' })).toBeVisible();
  });
});

test.describe('AI on demand', () => {
  test('adding a term drafts a translation for every language', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    await page.locator('.ed-head .btn--primary', { hasText: 'Add term' }).click();
    const dialog = page.locator('lx-prompt-dialog');
    await dialog.locator('#prompt-key').fill('e2e.ai.drafted');
    await dialog.locator('#prompt-source').fill('Welcome back');
    // The AI toggle defaults to on; submitting drafts every project language.
    await dialog.locator('button', { hasText: 'Add term' }).click();
    await expect(page.locator('.toast')).toContainText('to review');

    const row = page.locator('.trow', { has: page.locator('.keytag', { hasText: 'e2e.ai.drafted' }) });
    await expect(row).toBeVisible();
    await expect(row.locator('.tgt')).not.toContainText('Add translation');
    await expect(row.locator('.stcap', { hasText: 'Needs review' })).toBeVisible();
  });

  test('the old ai route lands in the organisation', async ({ page }) => {
    await page.goto('/ai');
    await expect(page).toHaveURL(/organisation/);
  });
});

test.describe('projects dashboard + theming', () => {
  test('dashboard shows all projects with real progress', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h1', { hasText: 'Projects' })).toBeVisible();
    await expect(page.locator('.proj-row')).toHaveCount(5);
    // Stat row.
    await expect(page.locator('.statcell').first()).toContainText('5');
  });

  test('opening a project routes into its editor', async ({ page }) => {
    await page.goto('/projects');
    await page.locator('.proj-row', { hasText: 'Mosaic iOS' }).click();
    await expect(page).toHaveURL(/\/editor/);
    await expect(page.locator('.rail__proj')).toContainText('Mosaic iOS');
  });

  test('theme toggle switches and persists', async ({ page }) => {
    await page.goto('/settings');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Appearance' }).click();
    // The redesign is light-first.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('.tweaks-seg button', { hasText: 'dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Persists across reload.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Reset to light for other runs.
    await page.locator('.subnav button', { hasText: 'Appearance' }).click();
    await page.locator('.tweaks-seg button', { hasText: 'light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('accent change updates the document attribute', async ({ page }) => {
    await page.goto('/settings');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Appearance' }).click();
    await page.locator('.swatch[aria-label="teal"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal');
    await page.locator('.swatch[aria-label="slate"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'slate');
  });
});
