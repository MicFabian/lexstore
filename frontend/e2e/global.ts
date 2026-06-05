import { test as base } from '@playwright/test';
import { resetDb } from './reset';

/**
 * Reset the backend to its freshly-seeded state before every test, so the whole
 * E2E suite is order-independent and repeatable regardless of which tests mutate
 * data. Import { test } from this file in specs that need isolation.
 */
export const test = base.extend<{ freshDb: void }>({
  freshDb: [
    async ({}, use) => {
      await resetDb();
      await use();
    },
    { auto: true },
  ],
});

export { expect, type Page } from '@playwright/test';
