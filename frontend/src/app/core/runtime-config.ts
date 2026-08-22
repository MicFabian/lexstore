/**
 * Settings that differ per deployment. They are fetched from /config.json
 * before the app boots, so one build can be promoted from staging to
 * production without recompiling.
 */
export interface RuntimeConfig {
  authority: string;
  clientId: string;
  apiBase: string;
}

const FALLBACK: RuntimeConfig = {
  authority: 'http://localhost:8089/realms/translad',
  clientId: 'translad-spa',
  apiBase: '/api',
};

let current: RuntimeConfig = FALLBACK;

export function runtimeConfig(): RuntimeConfig {
  return current;
}

/** Loads /config.json; falls back to local-dev defaults if it is absent. */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) current = { ...FALLBACK, ...(await res.json()) };
  } catch {
    // A missing or unreadable config file means local dev; keep the defaults.
  }
  return current;
}
