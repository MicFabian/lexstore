import { request } from '@playwright/test';

/** Wipe + reseed the backend database via the dev-only reset endpoint. */
export async function resetDb(): Promise<void> {
  const ctx = await request.newContext({ baseURL: 'http://localhost:4300' });
  const res = await ctx.post('/api/dev/reset');
  if (!res.ok() && res.status() !== 204) {
    throw new Error(`DB reset failed: ${res.status()} ${await res.text()}`);
  }
  await ctx.dispose();
}
