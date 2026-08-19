import { test, expect, type Page } from './global';

// The global fixture resets the backend before every test, so suites are
// order-independent and repeatable regardless of which tests mutate data.

async function waitShell(page: Page) {
  await expect(page.locator('.rail__brand')).toBeVisible();
}

/** Answer a sequence of window.prompt() dialogs in order. */
function answerPrompts(page: Page, answers: (string | null)[]) {
  let i = 0;
  page.on('dialog', async (d) => {
    const a = answers[i++];
    if (a === null) await d.dismiss();
    else await d.accept(a);
  });
}

// ----------------------------------------------------------------------------
test.describe('sidebar quick filters', () => {
  test('deep-link with the filter applied and show real counts', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();

    // "Needs review" navigates to the editor with the fuzzy filter active.
    await page.locator('a.navitem', { hasText: 'Needs review' }).click();
    await expect(page.locator('.ftab.on')).toContainText('Needs review');
    await expect(page.locator('.ttable tbody tr.trow')).toHaveCount(2);

    // "Newly added" navigates to terms with New-only active.
    await page.locator('a.navitem', { hasText: 'Newly added' }).click();
    await expect(page.locator('.ttable tbody tr.trow')).toHaveCount(3);
    await expect(page.locator('.ttable tbody .chip--new')).toHaveCount(3);

    // Counts come from the project, not hardcoded placeholders.
    await expect(page.locator('a.navitem', { hasText: 'Untranslated' }).locator('.count')).toContainText('47');
  });
});

// ----------------------------------------------------------------------------
test.describe('editor — language switch + AI suggestion', () => {

  test('language picker adds and removes translation columns', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // Default: French only.
    await expect(page.locator('.ed-head .btn--ghost').first()).toContainText('French');
    await expect(page.locator('th', { hasText: 'Translation' })).toHaveCount(1);
    await expect(page.locator('th', { hasText: 'Translation' })).toContainText('fr');

    // Adding German gives a second column, side by side with French.
    await page.locator('.ed-head .btn--ghost').first().click();
    await page.locator('.menu__item', { hasText: 'German' }).click();
    await expect(page.locator('th', { hasText: 'Translation' })).toHaveCount(2);

    const row = page.locator('.trow', { hasText: 'nav.dashboard' });
    await expect(row.locator('.tgt').nth(0)).toContainText('Tableau de bord');
    await expect(row.locator('.tgt').nth(1)).toContainText('Übersicht');

    // Deselecting French leaves German alone.
    await page.locator('.menu__item', { hasText: 'French' }).click();
    await expect(page.locator('th', { hasText: 'Translation' })).toHaveCount(1);
    await expect(page.locator('th', { hasText: 'Translation' })).toContainText('de');
  });

  test('inspector opens on the clicked column and switches language', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // Compare French and German.
    await page.locator('.ed-head .btn--ghost').first().click();
    await page.locator('.menu__item', { hasText: 'German' }).click();
    await page.locator('.menu-backdrop').click();

    // Clicking the German cell opens the inspector on German.
    const row = page.locator('.trow', { hasText: 'nav.dashboard' });
    await row.locator('.tgt').nth(1).click();
    const inspector = page.locator('.inspector');
    await expect(inspector.locator('.lang-pick')).toContainText('German');
    await expect(inspector.locator('textarea').first()).toHaveValue('Übersicht');

    // The inspector's own picker reaches languages that have no column.
    await inspector.locator('.lang-pick').click();
    await inspector.locator('.menu__item', { hasText: 'Japanese' }).click();
    await expect(inspector.locator('.lang-pick')).toContainText('Japanese');
  });

  test('translation helper suggests and applies a translation', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    await page.locator('.trow', { has: page.locator('.tgt.empty') }).first().locator('.tgt').first().click();
    const inspector = page.locator('.inspector');
    await expect(inspector).toBeVisible();

    const helper = inspector.locator('.helper');
    await expect(helper).toContainText('Translation helper');
    await helper.locator('button', { hasText: 'Suggest' }).click();
    await expect(helper.locator('.helper__text')).toBeVisible();

    // "Use it" fills the textarea with the suggestion.
    await helper.locator('button', { hasText: 'Use it' }).click();
    await expect(inspector.locator('textarea').first()).not.toHaveValue('');
  });

  test('auto-translate fills untranslated terms', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    // Switch to Dutch (0% translated) so there is work to do.
    await page.locator('.ed-head .btn--ghost').first().click();
    await page.locator('.menu__item', { hasText: 'Dutch' }).click();
    await page.locator('.menu__item', { hasText: 'French' }).click();
    await page.locator('.menu-backdrop').click();
    await expect(page.locator('th', { hasText: 'Translation' })).toHaveCount(1);
    await expect(page.locator('th', { hasText: 'Translation' })).toContainText('nl');

    const before = await page.locator('.trow .tgt.empty').count();
    expect(before).toBeGreaterThan(0);

    await page.locator('.ed-tabs button', { hasText: 'Auto-translate' }).click();
    await expect(page.locator('.toast')).toContainText('Auto-translated', { timeout: 15000 });
    // Fewer empty targets afterwards.
    await expect(page.locator('.trow .tgt.empty')).toHaveCount(0);
  });
});

// ----------------------------------------------------------------------------
test.describe('live actions — create term / language / contributor', () => {

  // Assert on durable state (a new row/card), not the ephemeral toast.
  test('add term appears in the editor', async ({ page }) => {
    answerPrompts(page, ['qa.new.term', 'A brand new string']);
    await page.goto('/editor');
    await waitShell(page);
    await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();
    await page.locator('.ed-head button', { hasText: 'Add term' }).click();
    await expect(page.locator('.trow', { hasText: 'qa.new.term' })).toBeVisible();
  });

  test('add language shows a new card', async ({ page }) => {
    answerPrompts(page, ['it', 'Italian']);
    await page.goto('/languages');
    await waitShell(page);
    // Wait until the existing languages have loaded (project is ready) before adding.
    await expect(page.locator('.lang-row').first()).toBeVisible();
    await page.locator('button', { hasText: 'Add language' }).click();
    await expect(page.locator('.lang-row', { hasText: 'Italian' })).toBeVisible();
  });

  test('invite contributor adds a team row', async ({ page }) => {
    answerPrompts(page, ['QA Tester', 'qa@translad.io']);
    await page.goto('/contributors');
    await waitShell(page);
    await expect(page.locator('.ttable tbody tr').first()).toBeVisible();
    await page.locator('button', { hasText: 'Invite contributor' }).click();
    await expect(page.locator('.ttable', { hasText: 'qa@translad.io' })).toBeVisible();
  });

  test('generate API key adds a key row', async ({ page }) => {
    // Generate prompts for a label, then alerts the one-time secret.
    answerPrompts(page, ['QA CI key', null]);
    await page.goto('/settings');
    await waitShell(page);
    // Wait for the seeded keys to load, or the generate response races the list load.
    await expect(page.locator('.keyrow').first()).toBeVisible();
    const before = await page.locator('.keyrow').count();
    await page.locator('button', { hasText: 'Generate key' }).click();
    await expect(page.locator('.keyrow').filter({ hasText: 'QA CI key' })).toBeVisible();
    expect(await page.locator('.keyrow').count()).toBeGreaterThan(before);
  });
});

// ----------------------------------------------------------------------------
test.describe('terms — filters + per-translation author', () => {

  test('tag filter narrows the rows', async ({ page }) => {
    await page.goto('/terms');
    await waitShell(page);
    await expect(page.locator('.ttable tbody tr.trow')).toHaveCount(14);
    await page.locator('button', { hasText: 'checkout' }).first().click();
    // Only checkout-tagged terms remain.
    const keys = await page.locator('.ttable tbody .keytag').allTextContents();
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k).toContain('checkout');
  });

  test('search narrows the rows', async ({ page }) => {
    await page.goto('/terms');
    await waitShell(page);
    await page.locator('input[placeholder="Search terms"]').fill('billing');
    const keys = await page.locator('.ttable tbody .keytag').allTextContents();
    for (const k of keys) expect(k).toContain('billing');
  });

  test('expanded row shows authors and opens history', async ({ page }) => {
    await page.goto('/terms');
    await waitShell(page);
    await page.locator('.trow', { hasText: 'nav.dashboard' }).click();
    const expanded = page.locator('.trow-expand');
    await expect(expanded.locator('.tr-row')).toHaveCount(6);
    await expect(expanded.locator('.tr-author-name').first()).toBeVisible();
    await expanded.locator('button', { hasText: 'View full history' }).click();
    const modal = page.locator('.modal[aria-label="Translation history"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.event').first()).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
test.describe('Translation AI — cache + settings', () => {

  test('skip cache forces a fresh result', async ({ page }) => {
    await page.goto('/ai');
    await page.locator('.panel textarea').fill('Dashboard');
    // Prime the cache.
    await page.locator('.panel button', { hasText: 'Translate' }).first().click();
    await expect(page.locator('.panel .card').last()).toBeVisible();
    // Skip cache → fresh.
    await page.locator('.panel button', { hasText: 'Skip cache' }).click();
    await expect(page.locator('.panel .card .chip', { hasText: 'Fresh' })).toBeVisible();
  });

  test('cache browser lists entries and deletes one', async ({ page }) => {
    await page.goto('/ai');
    await page.locator('.panel textarea').fill('Welcome back');
    await page.locator('.panel button', { hasText: 'Translate' }).first().click();
    await expect(page.locator('.panel .card').last()).toBeVisible();

    await page.locator('.subnav button', { hasText: 'Cache' }).click();
    const rows = page.locator('.ttable tbody tr.trow');
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    await rows.first().locator('button[aria-label="Delete entry"]').click();
    await expect(page.locator('.toast')).toContainText('removed');
    await expect(rows).toHaveCount(before - 1);
  });

  test('clear-all empties the cache', async ({ page }) => {
    await page.goto('/ai');
    await page.locator('.panel textarea').fill('Pay now');
    await page.locator('.panel button', { hasText: 'Translate' }).first().click();
    await expect(page.locator('.panel .card').last()).toBeVisible();

    await page.locator('.subnav button', { hasText: 'Cache' }).click();
    await page.locator('button', { hasText: 'Clear all' }).click();
    await expect(page.locator('.toast')).toContainText('Cache cleared');
    await expect(page.locator('.ttable tbody')).toContainText('Cache is empty');
  });

  test('settings save persists provider + formality', async ({ page }) => {
    await page.goto('/ai');
    await page.locator('.subnav button', { hasText: 'Settings' }).click();
    const formalBtn = page.getByRole('button', { name: 'formal', exact: true });
    await formalBtn.click();
    await page.locator('button', { hasText: 'Save settings' }).click();
    await expect(page.locator('.toast')).toContainText('AI settings saved');
    // Reload and confirm the formality stuck (active button gets the ghost class).
    await page.reload();
    await page.locator('.subnav button', { hasText: 'Settings' }).click();
    await expect(page.getByRole('button', { name: 'formal', exact: true })).toHaveClass(/btn--ghost/);
  });
});

// ----------------------------------------------------------------------------
test.describe('search + theming', () => {
  test('projects dashboard search filters cards', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('.proj-row')).toHaveCount(5);
    await page.locator('input[placeholder="Search projects"]').fill('ios');
    await expect(page.locator('.proj-row')).toHaveCount(1);
    await expect(page.locator('.proj-row')).toContainText('Mosaic iOS');
  });

  test('contributors search filters the table', async ({ page }) => {
    await page.goto('/contributors');
    await waitShell(page);
    await page.locator('input[placeholder="Search people"]').fill('marcus');
    await expect(page.locator('.ttable tbody tr')).toHaveCount(1);
    await expect(page.locator('.ttable tbody tr')).toContainText('Marcus Hale');
  });

  test('density tweak changes the html attribute and persists', async ({ page }) => {
    await page.goto('/settings');
    await waitShell(page);
    await page.locator('.subnav button', { hasText: 'Appearance' }).click();
    await page.locator('.tweaks-seg button', { hasText: 'compact' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
    // Reset to cozy.
    await page.locator('.subnav button', { hasText: 'Appearance' }).click();
    await page.locator('.tweaks-seg button', { hasText: 'cozy' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-density', 'cozy');
  });

  test('sidebar project switcher changes the active project', async ({ page }) => {
    await page.goto('/editor');
    await waitShell(page);
    await page.locator('.rail__proj').click();
    await page.locator('.pm-item', { hasText: 'Help center' }).click();
    await expect(page.locator('.rail__proj')).toContainText('Help center');
    await expect(page).toHaveURL(/\/editor/);
  });
});
