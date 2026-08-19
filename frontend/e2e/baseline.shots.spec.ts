import { test, expect, type Page } from './global';

// Captures one screenshot per functionality/state into design-baseline/
// as the visual inventory for the redesign. Run with:
//   npx playwright test baseline.shots --workers=1

const OUT = '../design-baseline';
const shot = (page: Page, name: string, fullPage = false) =>
  page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: 'disabled' });

async function waitShell(page: Page) {
  await expect(page.locator('.rail__brand')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('capture baseline screenshots of every functionality', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Projects dashboard -------------------------------------------------
  await page.goto('/projects');
  await expect(page.locator('.proj-row').first()).toBeVisible();
  await shot(page, '01-projects-dashboard', true);

  // --- Editor -------------------------------------------------------------
  await page.goto('/editor');
  await waitShell(page);
  await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();
  await shot(page, '02-editor-default');

  await page.locator('.ed-head .btn--ghost').first().click();
  await expect(page.locator('.menu__item').first()).toBeVisible();
  await shot(page, '03-editor-language-dropdown');
  await page.keyboard.press('Escape');
  await page.locator('.menu-backdrop').click({ force: true }).catch(() => {});

  // Quick filter: untranslated
  await page.locator('a.navitem', { hasText: 'Untranslated' }).click();
  await expect(page.locator('.ftab.on')).toContainText('Untranslated');
  await shot(page, '04-editor-filter-untranslated');

  // Inspector on a translated row (author, comments, history section)
  await page.locator('.ftab', { hasText: 'All' }).click();
  await page.locator('.trow', { hasText: 'nav.dashboard' }).click();
  await expect(page.locator('.inspector')).toBeVisible();
  await shot(page, '05-editor-inspector');

  // Inspector translation helper on an untranslated row
  await page.locator('.inspector button[aria-label="Close"]').click();
  await page.locator('.trow', { has: page.locator('.tgt.empty') }).first().locator('.tgt').first().click();
  await page.locator('.inspector .helper button', { hasText: 'Suggest' }).click();
  await expect(page.locator('.inspector .helper__text')).toBeVisible();
  await shot(page, '06-editor-inspector-helper');

  // Several languages compared side by side
  await page.locator('.inspector button[aria-label="Close"]').click();
  await page.locator('.ed-head .btn--ghost').first().click();
  await page.locator('.menu__item', { hasText: 'German' }).click();
  await page.locator('.menu__item', { hasText: 'Spanish' }).click();
  await page.locator('.menu-backdrop').click();
  await expect(page.locator('th', { hasText: 'Translation' })).toHaveCount(3);
  await shot(page, '06b-editor-multi-language');

  // --- Terms ----------------------------------------------------------------
  await page.goto('/terms');
  await waitShell(page);
  await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();
  await shot(page, '07-terms-list', true);

  // Expanded row with per-language authors
  await page.locator('.trow', { hasText: 'nav.dashboard' }).click();
  await expect(page.locator('.trow-expand .tr-row').first()).toBeVisible();
  await shot(page, '08-terms-expanded-row');

  // Full translation history modal
  await page.locator('.trow-expand button', { hasText: 'View full history' }).click();
  await expect(page.locator('.modal[aria-label="Translation history"] .event').first()).toBeVisible();
  await shot(page, '09-history-modal');
  await page.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.modal-backdrop')).toBeHidden();

  // Bulk selection bar
  await page.locator('.ttable thead input[type="checkbox"]').check();
  await expect(page.locator('.bulk-bar')).toBeVisible();
  await shot(page, '10-terms-bulk-select');
  await page.locator('.ttable thead input[type="checkbox"]').uncheck();

  // New-only filter
  await page.locator('a.navitem', { hasText: 'Newly added' }).click();
  await expect(page.locator('.ttable tbody .chip--new').first()).toBeVisible();
  await shot(page, '11-terms-new-only');

  // --- Languages / Contributors ---------------------------------------------
  await page.goto('/languages');
  await waitShell(page);
  await expect(page.locator('.lang-row').first()).toBeVisible();
  await shot(page, '12-languages', true);

  await page.goto('/contributors');
  await waitShell(page);
  await expect(page.locator('.ttable tbody tr').first()).toBeVisible();
  await shot(page, '13-contributors', true);

  // --- Settings (all four tabs) ----------------------------------------------
  await page.goto('/settings');
  await waitShell(page);
  await shot(page, '14-settings-general', true);
  await page.locator('button', { hasText: 'API keys' }).click();
  await expect(page.locator('.keyrow').first()).toBeVisible();
  await shot(page, '15-settings-api-keys', true);
  await page.locator('button', { hasText: 'Integrations' }).click();
  await shot(page, '16-settings-integrations', true);
  await page.locator('button', { hasText: 'Import / Export' }).click();
  await shot(page, '17-settings-import-export', true);

  // --- Translation AI (all four tabs) -----------------------------------------
  await page.goto('/ai');
  await waitShell(page);
  await page.locator('.panel textarea').fill('Welcome back');
  await page.locator('.panel button', { hasText: 'Translate' }).first().click();
  await expect(page.locator('.panel .card').last()).toBeVisible();
  await shot(page, '18-ai-playground-result', true);

  await page.locator('.subnav button', { hasText: 'Requests' }).click();
  await expect(page.locator('.ttable tbody tr').first()).toBeVisible();
  await shot(page, '19-ai-requests', true);

  await page.locator('.subnav button', { hasText: 'Cache' }).click();
  await shot(page, '20-ai-cache', true);

  await page.locator('.subnav button', { hasText: 'Settings' }).click();
  await shot(page, '21-ai-settings', true);

  // --- Global chrome -----------------------------------------------------------
  await page.goto('/editor');
  await waitShell(page);
  await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();

  await page.keyboard.press('Meta+k');
  await expect(page.locator('.cmd')).toBeVisible();
  await page.locator('.cmd input').fill('lang');
  await shot(page, '22-command-palette');
  await page.keyboard.press('Escape');

  await page.locator('.rail__proj').click();
  await expect(page.locator('.pm-item').first()).toBeVisible();
  await shot(page, '23-project-switcher');
  await page.locator('.menu-backdrop').click({ force: true });

  await page.locator('.rail__foot').click();
  await expect(page.locator('.menu__item', { hasText: 'Sign out' })).toBeVisible();
  await shot(page, '24-user-menu');
  await page.locator('.menu-backdrop').click({ force: true });

  await page.goto('/settings');
  await page.locator('.subnav button', { hasText: 'Appearance' }).click();
  await expect(page.locator('.tweaks-seg').first()).toBeVisible();
  await shot(page, '25-appearance-settings');

  // --- Dark theme --------------------------------------------------------------
  await page.locator('.tweaks-seg button', { hasText: 'dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/editor');
  await expect(page.locator('.ttable tbody tr.trow').first()).toBeVisible();
  await shot(page, '26-editor-dark');
  await page.goto('/projects');
  await expect(page.locator('.proj-row').first()).toBeVisible();
  await shot(page, '27-projects-dark', true);

  // Restore the light default for whoever uses the browser next.
  await page.goto('/settings');
  await page.locator('.subnav button', { hasText: 'Appearance' }).click();
  await page.locator('.tweaks-seg button', { hasText: 'light' }).click();
});
