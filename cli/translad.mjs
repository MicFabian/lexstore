#!/usr/bin/env node
/**
 * TransLad CLI — pull and push translations from your terminal.
 *
 *   translad projects
 *   translad languages   --project <code>
 *   translad pull        --project <code> --lang <code> [--out file.json] [--status translated,proofread]
 *   translad push        --project <code> --lang <code> --in file.json [--status translated]
 *   translad status      --project <code>
 *
 * Config via flags or env:
 *   TRANSLAD_API   (default http://localhost:8088/api)
 */

const API = process.env.TRANSLAD_API || 'http://localhost:8088/api';
const KEYCLOAK = process.env.TRANSLAD_KEYCLOAK || 'http://localhost:8089/realms/translad';

// ---------- auth ----------
let cachedToken = process.env.TRANSLAD_TOKEN || null;

async function getToken() {
  if (cachedToken) return cachedToken;
  const user = process.env.TRANSLAD_USER;
  const pass = process.env.TRANSLAD_PASS;
  if (!user || !pass) return null; // unauthenticated (reads may still work in dev)
  const res = await fetch(`${KEYCLOAK}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'translad-spa',
      grant_type: 'password',
      username: user,
      password: pass,
    }),
  });
  if (!res.ok) return null;
  cachedToken = (await res.json()).access_token;
  return cachedToken;
}

// ---------- tiny arg parser ----------
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { command, flags };
}

function fail(msg) {
  process.stderr.write(`translad: ${msg}\n`);
  process.exit(1);
}

async function api(path, init) {
  const token = await getToken();
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...auth, ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* non-JSON error body */
    }
    fail(`${res.status} ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function resolveProject(code) {
  if (!code) fail('missing --project <code>');
  const projects = await api('/projects');
  const project = projects.find((p) => p.code === code || p.id === code);
  if (!project) fail(`no project with code "${code}" (try: translad projects)`);
  return project;
}

// ---------- commands ----------
async function cmdProjects() {
  const projects = await api('/projects');
  for (const p of projects) {
    process.stdout.write(
      `${p.code.padEnd(16)} ${String(p.progress + '%').padStart(4)}  ${p.terms} terms  ${p.langs} langs  ${p.name}\n`,
    );
  }
}

async function cmdLanguages(flags) {
  const project = await resolveProject(flags.project);
  const langs = await api(`/projects/${project.id}/languages`);
  for (const l of langs) {
    process.stdout.write(
      `${l.code.padEnd(8)} ${String(l.translated + '%').padStart(4)} translated  ${l.untranslated}% left  ${l.name}\n`,
    );
  }
}

async function cmdStatus(flags) {
  const project = await resolveProject(flags.project);
  const langs = await api(`/projects/${project.id}/languages`);
  process.stdout.write(`${project.name} (${project.code})\n`);
  for (const l of langs) {
    const bar = '█'.repeat(Math.round(l.translated / 5)).padEnd(20, '·');
    process.stdout.write(`  ${l.code.padEnd(8)} ${bar} ${l.translated}%\n`);
  }
}

async function cmdPull(flags) {
  const project = await resolveProject(flags.project);
  if (!flags.lang) fail('missing --lang <code>');
  const wanted = flags.status
    ? new Set(String(flags.status).split(',').map((s) => s.trim()))
    : null;

  const res = await api(`/projects/${project.id}/languages/${flags.lang}/translations`);
  const out = {};
  for (const row of res.rows) {
    if (row.target == null) continue;
    if (wanted && !wanted.has(row.status)) continue;
    out[row.key] = row.target;
  }

  const json = JSON.stringify(out, null, 2) + '\n';
  if (flags.out && flags.out !== true) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(flags.out, json);
    process.stderr.write(
      `Pulled ${Object.keys(out).length} strings → ${flags.out} (${project.code}/${flags.lang})\n`,
    );
  } else {
    process.stdout.write(json);
  }
}

async function cmdPush(flags) {
  const project = await resolveProject(flags.project);
  if (!flags.lang) fail('missing --lang <code>');
  if (!flags.in || flags.in === true) fail('missing --in <file.json>');
  const status = (flags.status && flags.status !== true) ? String(flags.status) : 'translated';

  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(flags.in, 'utf8'));

  // Map term keys → ids for this project.
  const terms = (await api(`/projects/${project.id}/terms?size=1000`)).content;
  const byKey = new Map(terms.map((t) => [t.key, t.id]));

  let pushed = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(data)) {
    const termId = byKey.get(key);
    if (!termId) {
      process.stderr.write(`  skip: no term for key "${key}"\n`);
      skipped++;
      continue;
    }
    await api(`/projects/${project.id}/languages/${flags.lang}/translations/${termId}`, {
      method: 'PUT',
      body: JSON.stringify({ value, status }),
    });
    pushed++;
  }
  process.stderr.write(`Pushed ${pushed} translations to ${project.code}/${flags.lang}` + (skipped ? `, skipped ${skipped}\n` : '\n'));
}

const HELP = `translad — pull and push translations from your terminal

Usage:
  translad projects
  translad languages  --project <code>
  translad status     --project <code>
  translad pull       --project <code> --lang <code> [--out file.json] [--status translated,proofread]
  translad push       --project <code> --lang <code> --in file.json [--status translated]

Env:
  TRANSLAD_API   API base URL (default ${API})
`;

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'projects': return cmdProjects();
    case 'languages': return cmdLanguages(flags);
    case 'status': return cmdStatus(flags);
    case 'pull': return cmdPull(flags);
    case 'push': return cmdPush(flags);
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return;
    default:
      fail(`unknown command "${command}" (try: translad help)`);
  }
}

main().catch((e) => fail(e.message || String(e)));
